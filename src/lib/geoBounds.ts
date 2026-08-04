// Pendik sınır kontrolü — geocode edilen bir konum beklenen viewbox dışına
// düşerse (ör. yanlış mahalle/il eşleşmesi) operatörü uyarmak için kullanılır.

import { PENDIK_VIEWBOX } from '@/constants/config';
import type { GeocodedLocation } from '@/types/address';

/** Koordinat Pendik viewbox'ının dışında mı? (küçük bir tolerans payıyla) */
export function isOutOfPendik(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const pad = 0.02; // ~2 km tolerans (sınır mahalleler için)
  return (
    lat < PENDIK_VIEWBOX.minLat - pad ||
    lat > PENDIK_VIEWBOX.maxLat + pad ||
    lng < PENDIK_VIEWBOX.minLon - pad ||
    lng > PENDIK_VIEWBOX.maxLon + pad
  );
}

/**
 * Bir konum "şüpheli" mi? (elle doğrulanmamış + düşük güven veya Pendik dışı)
 * Elle uygulanan (MANUAL) konumlar operatör onayı sayıldığından şüpheli değildir.
 */
export function isSuspectLocation(loc: GeocodedLocation): boolean {
  if (loc.geocodingStatus !== 'SUCCESS') return false;
  const lowConfidence = (loc.confidenceScore ?? 1) < 0.35;
  return lowConfidence || isOutOfPendik(loc.lat, loc.lng);
}
