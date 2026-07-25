// Araç ve Rota tipleri — PRD Bölüm 3

import type { GeocodedLocation } from './address';

/** Dağıtıma çıkacak aracın konfigürasyonu. */
export interface VehicleConfig {
  id: string;
  name: string; // Örn: "Araç 1 (34 BSK 34)"
  capacity: number; // Örn: 50 koli
  color: string; // Haritadaki rota ve marker rengi (hex/hsl)
}

export type StopStatus = 'PENDING' | 'DELIVERED' | 'NOT_HOME' | 'CANCELLED';

/** Teslimat kanıtı (Proof of Delivery) — imza veya fotoğraf (Faz 6.1). */
export interface DeliveryProof {
  type: 'SIGNATURE' | 'PHOTO';
  /** base64 data URL (imza canvas verisi ya da küçültülmüş fotoğraf). */
  dataUrl: string;
  capturedAt: string;
}

/** Bir rota içindeki tek bir durak. */
export interface StopItem {
  stopOrder: number; // Rota içindeki durak sırası (1, 2, 3...)
  location: GeocodedLocation;
  estimatedArrivalMinutes?: number;
  distanceFromPreviousKm?: number;
  status: StopStatus;
  notes?: string;
  updatedAt?: string;
  /** Teslim kanıtı (yalnızca DELIVERED durumunda alınır). */
  proof?: DeliveryProof;
}

/** Bir araca atanmış tam rota. */
export interface VehicleRoute {
  vehicleId: string;
  vehicleName: string;
  vehicleColor: string;
  assignedCapacity: number;
  totalBoxesAssigned: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  stops: StopItem[];
  driverShareUrl?: string;
}
