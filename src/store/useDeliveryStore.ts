import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { createSafeStorage } from '@/lib/safeStorage';

import type {
  RawExcelRow,
  SanitizedAddress,
  GeocodedLocation,
  AddressPriority,
} from '@/types/address';
import type {
  VehicleConfig,
  VehicleRoute,
  StopStatus,
  StopItem,
  DeliveryProof,
} from '@/types/fleet';

/** Canlı bildirim akışı kaydı (SMS/WhatsApp simülasyonu — Faz 6.2). */
export interface NotificationLog {
  id: string;
  channel: 'SMS' | 'WHATSAPP';
  message: string;
  recipientName: string;
  stopOrder: number;
  vehicleName: string;
  createdAt: string;
}

/**
 * Uygulama akışındaki 4 ana adım:
 * 1: Excel & Adres Temizleme
 * 2: Araç & Kümeleme Ayarları
 * 3: Harita & Rota Düzenleme
 * 4: Saha Takibi & Excel İndirme
 */
export type WorkflowStep = 1 | 2 | 3 | 4;

interface DeliveryState {
  // --- State ---
  excelRows: RawExcelRow[];
  rawAddresses: RawExcelRow[];
  sanitizedAddresses: SanitizedAddress[];
  geocodedLocations: GeocodedLocation[];
  vehicleConfigs: VehicleConfig[];
  routes: VehicleRoute[];
  activeStep: WorkflowStep;
  notificationLogs: NotificationLog[];
  /** Aktif canlı paylaşım kimliği (varsa) — şoför linkleri bunu taşır. */
  shareId: string | null;

  // --- Excel / ham veri ---
  setExcelRows: (rows: RawExcelRow[]) => void;
  setRawAddresses: (rows: RawExcelRow[]) => void;

  // --- Sanitize edilmiş adresler ---
  setSanitizedAddresses: (addresses: SanitizedAddress[]) => void;
  updateSanitizedAddress: (id: string, patch: Partial<SanitizedAddress>) => void;
  removeSanitizedAddress: (id: string) => void;
  /** Önceliği hem sanitize hem geocode listelerinde senkron günceller. */
  setAddressPriority: (id: string, priority: AddressPriority) => void;

  // --- Geocode edilmiş konumlar ---
  setGeocodedLocations: (locations: GeocodedLocation[]) => void;
  updateGeocodedLocation: (id: string, patch: Partial<GeocodedLocation>) => void;
  removeGeocodedLocation: (id: string) => void;

  // --- Araç konfigürasyonları ---
  setVehicleConfigs: (vehicles: VehicleConfig[]) => void;
  addVehicleConfig: (vehicle: VehicleConfig) => void;
  updateVehicleConfig: (id: string, patch: Partial<VehicleConfig>) => void;
  removeVehicleConfig: (id: string) => void;

  // --- Rotalar ---
  setRoutes: (routes: VehicleRoute[]) => void;
  updateVehicleRoute: (vehicleId: string, patch: Partial<VehicleRoute>) => void;
  reorderStops: (vehicleId: string, stops: StopItem[]) => void;
  updateStopStatus: (
    vehicleId: string,
    stopOrder: number,
    status: StopStatus,
    notes?: string,
  ) => void;
  /** Bir durağa teslim kanıtı (imza/fotoğraf) iliştirir. */
  setStopProof: (
    vehicleId: string,
    stopOrder: number,
    proof: DeliveryProof,
  ) => void;

  // --- Canlı bildirim akışı (SMS/WhatsApp simülasyonu) ---
  pushNotificationLog: (log: NotificationLog) => void;
  clearNotificationLogs: () => void;

  // --- Canlı şoför paylaşımı ---
  setShareId: (shareId: string | null) => void;

  // --- Adım kontrolü & sıfırlama ---
  setActiveStep: (step: WorkflowStep) => void;
  resetSession: () => void;
}

const initialState = {
  excelRows: [] as RawExcelRow[],
  rawAddresses: [] as RawExcelRow[],
  sanitizedAddresses: [] as SanitizedAddress[],
  geocodedLocations: [] as GeocodedLocation[],
  vehicleConfigs: [] as VehicleConfig[],
  routes: [] as VehicleRoute[],
  activeStep: 1 as WorkflowStep,
  notificationLogs: [] as NotificationLog[],
  shareId: null as string | null,
};

/** Bildirim akışında saklanacak en fazla kayıt (localStorage şişmesini önler). */
const MAX_NOTIFICATION_LOGS = 50;

export const useDeliveryStore = create<DeliveryState>()(
  persist(
    (set) => ({
      ...initialState,

      // --- Excel / ham veri ---
      setExcelRows: (rows) => set({ excelRows: rows }),
      setRawAddresses: (rows) => set({ rawAddresses: rows }),

      // --- Sanitize edilmiş adresler ---
      setSanitizedAddresses: (addresses) =>
        set({ sanitizedAddresses: addresses }),
      updateSanitizedAddress: (id, patch) =>
        set((state) => ({
          sanitizedAddresses: state.sanitizedAddresses.map((a) =>
            a.id === id ? { ...a, ...patch } : a,
          ),
        })),
      removeSanitizedAddress: (id) =>
        set((state) => ({
          sanitizedAddresses: state.sanitizedAddresses.filter(
            (a) => a.id !== id,
          ),
        })),
      setAddressPriority: (id, priority) =>
        set((state) => ({
          sanitizedAddresses: state.sanitizedAddresses.map((a) =>
            a.id === id ? { ...a, priority } : a,
          ),
          // Geocode edilmiş kopyayı da senkron tut (varsa).
          geocodedLocations: state.geocodedLocations.map((l) =>
            l.id === id ? { ...l, priority } : l,
          ),
        })),

      // --- Geocode edilmiş konumlar ---
      setGeocodedLocations: (locations) =>
        set({ geocodedLocations: locations }),
      updateGeocodedLocation: (id, patch) =>
        set((state) => ({
          geocodedLocations: state.geocodedLocations.map((l) =>
            l.id === id ? { ...l, ...patch } : l,
          ),
        })),
      removeGeocodedLocation: (id) =>
        set((state) => ({
          geocodedLocations: state.geocodedLocations.filter((l) => l.id !== id),
        })),

      // --- Araç konfigürasyonları ---
      setVehicleConfigs: (vehicles) => set({ vehicleConfigs: vehicles }),
      addVehicleConfig: (vehicle) =>
        set((state) => ({
          vehicleConfigs: [...state.vehicleConfigs, vehicle],
        })),
      updateVehicleConfig: (id, patch) =>
        set((state) => ({
          vehicleConfigs: state.vehicleConfigs.map((v) =>
            v.id === id ? { ...v, ...patch } : v,
          ),
        })),
      removeVehicleConfig: (id) =>
        set((state) => ({
          vehicleConfigs: state.vehicleConfigs.filter((v) => v.id !== id),
        })),

      // --- Rotalar ---
      setRoutes: (routes) => set({ routes }),
      updateVehicleRoute: (vehicleId, patch) =>
        set((state) => ({
          routes: state.routes.map((r) =>
            r.vehicleId === vehicleId ? { ...r, ...patch } : r,
          ),
        })),
      reorderStops: (vehicleId, stops) =>
        set((state) => ({
          routes: state.routes.map((r) =>
            r.vehicleId === vehicleId
              ? {
                  ...r,
                  stops: stops.map((s, index) => ({
                    ...s,
                    stopOrder: index + 1,
                  })),
                }
              : r,
          ),
        })),
      updateStopStatus: (vehicleId, stopOrder, status, notes) =>
        set((state) => ({
          routes: state.routes.map((r) =>
            r.vehicleId === vehicleId
              ? {
                  ...r,
                  stops: r.stops.map((s) =>
                    s.stopOrder === stopOrder
                      ? {
                          ...s,
                          status,
                          notes: notes ?? s.notes,
                          updatedAt: new Date().toISOString(),
                        }
                      : s,
                  ),
                }
              : r,
          ),
        })),

      setStopProof: (vehicleId, stopOrder, proof) =>
        set((state) => ({
          routes: state.routes.map((r) =>
            r.vehicleId === vehicleId
              ? {
                  ...r,
                  stops: r.stops.map((s) =>
                    s.stopOrder === stopOrder ? { ...s, proof } : s,
                  ),
                }
              : r,
          ),
        })),

      // --- Canlı bildirim akışı ---
      pushNotificationLog: (log) =>
        set((state) => ({
          // Yeni kayıt başa; en fazla MAX_NOTIFICATION_LOGS tutulur.
          notificationLogs: [log, ...state.notificationLogs].slice(
            0,
            MAX_NOTIFICATION_LOGS,
          ),
        })),
      clearNotificationLogs: () => set({ notificationLogs: [] }),

      // --- Canlı şoför paylaşımı ---
      setShareId: (shareId) => set({ shareId }),

      // --- Adım kontrolü & sıfırlama ---
      setActiveStep: (step) => set({ activeStep: step }),
      resetSession: () => set({ ...initialState }),
    }),
    {
      name: 'pendik-delivery-store',
      version: 1,
      // Güvenli localStorage: bozuk veri sessizce temizlenir, kota hatası
      // uygulamayı kilitlemez (Faz 7.5).
      storage: createJSONStorage(() => createSafeStorage()),
      // Sürüm uyuşmazlığında güvenli varsayılana (initialState) düş.
      migrate: (persistedState, version) => {
        if (version !== 1) {
          return initialState as unknown as DeliveryState;
        }
        return persistedState as DeliveryState;
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          // Rehydration hatası → bozuk depoyu temizle, güvenli başla.
          try {
            createSafeStorage().removeItem('pendik-delivery-store');
          } catch {
            /* yoksay */
          }
        }
      },
    },
  ),
);
