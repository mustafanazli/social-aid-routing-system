import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { createSafeStorage } from '@/lib/safeStorage';

import type {
  RawExcelRow,
  SanitizedAddress,
  GeocodedLocation,
} from '@/types/address';
import type {
  VehicleConfig,
  VehicleRoute,
  StopStatus,
  StopItem,
  DeliveryProof,
} from '@/types/fleet';
import type { DeliveryArchive } from '@/types/delivery';
import { generateId } from '@/lib/utils';

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
  /** Aktif canlı paylaşım kimliği (varsa) — şoför linkleri bunu taşır. */
  shareId: string | null;
  /** Tamamlanıp arşivlenmiş geçmiş dağıtımlar (en yeni başta). */
  history: DeliveryArchive[];

  // --- Excel / ham veri ---
  setExcelRows: (rows: RawExcelRow[]) => void;
  setRawAddresses: (rows: RawExcelRow[]) => void;

  // --- Sanitize edilmiş adresler ---
  setSanitizedAddresses: (addresses: SanitizedAddress[]) => void;
  /** Tek bir adresi listenin sonuna ekler (elle giriş). */
  addSanitizedAddress: (address: SanitizedAddress) => void;
  updateSanitizedAddress: (id: string, patch: Partial<SanitizedAddress>) => void;
  removeSanitizedAddress: (id: string) => void;

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

  // --- Canlı şoför paylaşımı ---
  setShareId: (shareId: string | null) => void;

  // --- Dağıtım geçmişi (arşiv) ---
  /** Mevcut rotaları özetleyip geçmişe ekler; boş rota varsa hiçbir şey yapmaz. */
  archiveCurrentSession: (label: string) => void;
  removeArchive: (id: string) => void;

  // --- Adım kontrolü & sıfırlama ---
  setActiveStep: (step: WorkflowStep) => void;
  /** Bir adres kümesini yeni dağıtım için pipeline'a yükler (eksik teslimatlar). */
  loadForRedelivery: (addresses: SanitizedAddress[]) => void;
  resetSession: () => void;
}

/** Rotalardan arşiv özeti üretir (durum sayımları + toplamlar). */
function summarizeRoutes(
  routes: VehicleRoute[],
  label: string,
): DeliveryArchive {
  const stops = routes.flatMap((r) => r.stops);
  return {
    id: generateId('arch'),
    archivedAt: new Date().toISOString(),
    label,
    vehicleCount: routes.length,
    totalStops: stops.length,
    delivered: stops.filter((s) => s.status === 'DELIVERED').length,
    notHome: stops.filter((s) => s.status === 'NOT_HOME').length,
    pending: stops.filter(
      (s) => s.status === 'PENDING' || s.status === 'CANCELLED',
    ).length,
    totalDistanceKm: routes.reduce((s, r) => s + (r.totalDistanceKm || 0), 0),
    totalBoxes: routes.reduce((s, r) => s + (r.totalBoxesAssigned || 0), 0),
    // Kanıt görsellerini arşive taşımıyoruz (boyut + gizlilik).
    routes: routes.map((r) => ({
      ...r,
      stops: r.stops.map((s) => {
        const copy = { ...s };
        delete copy.proof;
        return copy;
      }),
    })),
  };
}

const initialState = {
  excelRows: [] as RawExcelRow[],
  rawAddresses: [] as RawExcelRow[],
  sanitizedAddresses: [] as SanitizedAddress[],
  geocodedLocations: [] as GeocodedLocation[],
  vehicleConfigs: [] as VehicleConfig[],
  routes: [] as VehicleRoute[],
  activeStep: 1 as WorkflowStep,
  shareId: null as string | null,
  history: [] as DeliveryArchive[],
};

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
      addSanitizedAddress: (address) =>
        set((state) => ({
          sanitizedAddresses: [...state.sanitizedAddresses, address],
        })),
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

      // --- Canlı şoför paylaşımı ---
      setShareId: (shareId) => set({ shareId }),

      // --- Dağıtım geçmişi (arşiv) ---
      archiveCurrentSession: (label) =>
        set((state) => {
          if (state.routes.length === 0) return state;
          const trimmed = label.trim() || 'Dağıtım';
          return {
            history: [
              summarizeRoutes(state.routes, trimmed),
              ...(state.history ?? []),
            ],
          };
        }),
      removeArchive: (id) =>
        set((state) => ({
          history: (state.history ?? []).filter((h) => h.id !== id),
        })),

      // --- Adım kontrolü & sıfırlama ---
      setActiveStep: (step) => set({ activeStep: step }),
      loadForRedelivery: (addresses) =>
        set({
          sanitizedAddresses: addresses,
          geocodedLocations: [],
          vehicleConfigs: [],
          routes: [],
          shareId: null,
          activeStep: 1,
        }),
      // Geçmiş arşivi korunur; yalnızca aktif oturum sıfırlanır.
      resetSession: () =>
        set((state) => ({ ...initialState, history: state.history })),
    }),
    {
      name: 'pendik-delivery-store',
      version: 2,
      // Güvenli localStorage: bozuk veri sessizce temizlenir, kota hatası
      // uygulamayı kilitlemez (Faz 7.5).
      storage: createJSONStorage(() => createSafeStorage()),
      // v1 → v2: yalnızca `history` alanı eklendi; mevcut oturum korunur.
      migrate: (persistedState, version) => {
        if (version === 1 && persistedState && typeof persistedState === 'object') {
          return { ...(persistedState as object), history: [] } as unknown as DeliveryState;
        }
        if (version !== 2) {
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
