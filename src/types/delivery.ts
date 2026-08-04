// Dağıtım ve Durum tipleri — PRD Bölüm 3

import type { GeocodedLocation } from './address';
import type { VehicleRoute } from './fleet';

export type GlobalStatus = 'DRAFT' | 'OPTIMIZED' | 'IN_PROGRESS' | 'COMPLETED';

/** Tek bir dağıtım oturumunun tamamı. */
export interface DeliverySession {
  sessionId: string;
  createdAt: string;
  totalAddresses: number;
  totalVehicles: number;
  routes: VehicleRoute[];
  unassignedLocations: GeocodedLocation[];
  globalStatus: GlobalStatus;
}

/**
 * Arşivlenmiş (tamamlanmış) bir dağıtımın özeti + tam rota anlık görüntüsü.
 * "Dağıtım Geçmişi" panelinde listelenir; raporu tekrar indirilebilir.
 */
export interface DeliveryArchive {
  id: string;
  /** Arşivlenme zamanı (ISO). */
  archivedAt: string;
  /** Kullanıcının verdiği ad (ör. "4 Ağustos Sabah Dağıtımı"). */
  label: string;
  vehicleCount: number;
  totalStops: number;
  delivered: number;
  notHome: number;
  pending: number;
  totalDistanceKm: number;
  totalBoxes: number;
  /** Raporu yeniden üretebilmek için rota anlık görüntüsü (kanıt görselleri hariç). */
  routes: VehicleRoute[];
}
