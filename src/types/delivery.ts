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
