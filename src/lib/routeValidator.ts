import type { VehicleRoute, StopItem } from '@/types/fleet';
import { haversineKm } from '@/lib/clustering';
import { MAP_DEFAULT_CENTER } from '@/constants/config';

/**
 * Rota Akış Denetçisi (Faz 7.2).
 * OSRM optimizasyonu sonrası rotaların mantıklı olup olmadığını denetler:
 *  - Kapasite aşımı (atanan koli > araç kapasitesi),
 *  - Anomali adresler (iki durak arası kuşuçuşu mesafe çok uzun ya da durak
 *    Pendik merkezinden aşırı sapmış — deniz ortası / başka şehir).
 */

/** İki durak arası mantıklı sayılan azami kuşuçuşu mesafe (km). */
export const MAX_LEG_KM = 50;
/** Bir durağın Pendik merkezine olabileceği azami makul uzaklık (km). */
export const MAX_FROM_CENTER_KM = 45;

export interface CapacityIssue {
  vehicleId: string;
  vehicleName: string;
  assignedBoxes: number;
  capacity: number;
  overflow: number;
}

export interface RouteAnomaly {
  vehicleId: string;
  vehicleName: string;
  stopOrder: number;
  stop: StopItem;
  /** Anomali nedeni. */
  reason: 'LONG_LEG' | 'FAR_FROM_CENTER';
  /** İlgili mesafe (km) — uzun bacak veya merkeze uzaklık. */
  distanceKm: number;
}

export interface ValidationResult {
  capacityIssues: CapacityIssue[];
  anomalies: RouteAnomaly[];
  hasProblems: boolean;
}

/** Tüm rotaları denetler ve sorunları döndürür. */
export function validateRoutes(routes: VehicleRoute[]): ValidationResult {
  const capacityIssues: CapacityIssue[] = [];
  const anomalies: RouteAnomaly[] = [];

  for (const route of routes) {
    // 1) Kapasite aşımı.
    if (route.totalBoxesAssigned > route.assignedCapacity) {
      capacityIssues.push({
        vehicleId: route.vehicleId,
        vehicleName: route.vehicleName,
        assignedBoxes: route.totalBoxesAssigned,
        capacity: route.assignedCapacity,
        overflow: route.totalBoxesAssigned - route.assignedCapacity,
      });
    }

    // 2) Anomali adresler.
    const stops = [...route.stops].sort((a, b) => a.stopOrder - b.stopOrder);
    let prev: StopItem | null = null;

    for (const stop of stops) {
      const { lat, lng } = stop.location;

      // 2a) Pendik merkezinden aşırı sapma.
      const fromCenter = haversineKm(
        MAP_DEFAULT_CENTER.lat,
        MAP_DEFAULT_CENTER.lng,
        lat,
        lng,
      );
      if (fromCenter > MAX_FROM_CENTER_KM) {
        anomalies.push({
          vehicleId: route.vehicleId,
          vehicleName: route.vehicleName,
          stopOrder: stop.stopOrder,
          stop,
          reason: 'FAR_FROM_CENTER',
          distanceKm: fromCenter,
        });
        prev = stop;
        continue; // aynı durağı iki kez işaretleme
      }

      // 2b) Bir önceki durakla arası mantıksız derecede uzun.
      if (prev) {
        const leg = haversineKm(
          prev.location.lat,
          prev.location.lng,
          lat,
          lng,
        );
        if (leg > MAX_LEG_KM) {
          anomalies.push({
            vehicleId: route.vehicleId,
            vehicleName: route.vehicleName,
            stopOrder: stop.stopOrder,
            stop,
            reason: 'LONG_LEG',
            distanceKm: leg,
          });
        }
      }
      prev = stop;
    }
  }

  return {
    capacityIssues,
    anomalies,
    hasProblems: capacityIssues.length > 0 || anomalies.length > 0,
  };
}
