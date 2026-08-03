import type {
  SanitizedAddress,
  GeocodedLocation,
  GeocodeProvider,
} from '@/types/address';
import { NOMINATIM_RATE_LIMIT_MS } from '@/constants/config';

/**
 * Nominatim geocoding servisi (PRD Bölüm 3.1 & Bölüm 6.2).
 *
 * İstemci tarafından `/api/geocode` proxy'sine gider (bkz. app/api/geocode).
 * Nominatim'in "saniyede 1 istek" kuralına uymak için batchGeocode
 * istekler arasına NOMINATIM_RATE_LIMIT_MS (1000ms) gecikme koyar.
 */

/** Tek bir adres için geocoding sonucu. */
export interface GeocodeOutcome {
  status: 'SUCCESS' | 'FAILED';
  lat?: number;
  lng?: number;
  confidenceScore?: number;
  formattedAddressFromAPI?: string;
  provider?: GeocodeProvider;
}

interface GeocodeApiResponse {
  found: boolean;
  result?: {
    lat: number;
    lng: number;
    confidenceScore: number;
    approximate: boolean;
    withinBounds: boolean;
    formattedAddressFromAPI: string;
    provider?: GeocodeProvider;
  } | null;
  error?: string;
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

/** Sokak adresi bulunamazsa denenecek mahalle-merkezi fallback sorgusu. */
function buildNeighborhoodFallback(address: SanitizedAddress): string {
  const parts = [
    address.neighborhood ? `${address.neighborhood} Mahallesi` : '',
    address.district || 'Pendik',
    address.city || 'İstanbul',
    'Türkiye',
  ].filter(Boolean);
  return parts.join(', ');
}

/**
 * Tek bir adresi koordinata çevirir. Proxy önce tam adresi, bulamazsa mahalle
 * merkezini (yaklaşık) dener. Ağ/servis hatalarında (PRD Bölüm 6.3) sistem
 * çökmez; FAILED döner.
 */
export async function geocodeAddress(
  address: SanitizedAddress,
): Promise<GeocodeOutcome> {
  const q = address.cleanAddress.trim();
  if (!q) return { status: 'FAILED' };

  const params = new URLSearchParams({ q });
  if (address.neighborhood) {
    params.set('nb', buildNeighborhoodFallback(address));
  }

  try {
    const res = await fetch(`/api/geocode?${params.toString()}`);
    if (!res.ok) return { status: 'FAILED' };

    const data = (await res.json()) as GeocodeApiResponse;
    if (!data.found || !data.result) return { status: 'FAILED' };

    return {
      status: 'SUCCESS',
      lat: data.result.lat,
      lng: data.result.lng,
      confidenceScore: data.result.confidenceScore,
      formattedAddressFromAPI: data.result.formattedAddressFromAPI,
      provider: data.result.provider,
    };
  } catch {
    // Ağ hatası vb. — adres FAILED olarak işaretlenip manuel pin'e bırakılır.
    return { status: 'FAILED' };
  }
}

/** Sanitize edilmiş adresi PENDING durumunda bir GeocodedLocation'a çevirir. */
export function toPendingLocation(address: SanitizedAddress): GeocodedLocation {
  return {
    ...address,
    lat: 0,
    lng: 0,
    geocodingStatus: 'PENDING',
  };
}

/** Excel'den hazır koordinat gelmiş mi? (geocoding atlanır) */
export function hasPresetLocation(address: SanitizedAddress): boolean {
  return (
    typeof address.presetLat === 'number' &&
    Number.isFinite(address.presetLat) &&
    typeof address.presetLng === 'number' &&
    Number.isFinite(address.presetLng)
  );
}

/**
 * Hazır koordinatlı adresi doğrudan MANUAL konuma çevirir. Böylece daha önce
 * elle düzeltilip Excel'e yazılmış adresler ağ isteği olmadan aynen konumlanır.
 */
export function toPresetLocation(address: SanitizedAddress): GeocodedLocation {
  return {
    ...address,
    lat: address.presetLat as number,
    lng: address.presetLng as number,
    geocodingStatus: 'MANUAL',
  };
}

/** Bir geocoding sonucunu adresle birleştirip GeocodedLocation üretir. */
export function applyOutcome(
  address: SanitizedAddress,
  outcome: GeocodeOutcome,
): GeocodedLocation {
  if (outcome.status === 'SUCCESS' && outcome.lat != null && outcome.lng != null) {
    return {
      ...address,
      lat: outcome.lat,
      lng: outcome.lng,
      geocodingStatus: 'SUCCESS',
      confidenceScore: outcome.confidenceScore,
      formattedAddressFromAPI: outcome.formattedAddressFromAPI,
      provider: outcome.provider,
    };
  }
  return {
    ...address,
    lat: 0,
    lng: 0,
    geocodingStatus: 'FAILED',
  };
}

export interface BatchGeocodeHandlers {
  /** Her adres işlendiğinde çağrılır — canlı ilerleme/marker güncellemesi için. */
  onResult: (
    location: GeocodedLocation,
    index: number,
    total: number,
  ) => void;
  /** true dönerse döngü durdurulur (kullanıcı iptal ettiğinde). */
  isCancelled?: () => boolean;
}

/**
 * Adres listesini sırayla, istekler arasına 1000ms gecikme koyarak geocode eder.
 * (Nominatim rate-limit: 1 req/sec.)
 */
export async function batchGeocode(
  addresses: SanitizedAddress[],
  handlers: BatchGeocodeHandlers,
): Promise<void> {
  const total = addresses.length;

  for (let i = 0; i < total; i++) {
    if (handlers.isCancelled?.()) return;

    const address = addresses[i];
    const outcome = await geocodeAddress(address);
    handlers.onResult(applyOutcome(address, outcome), i, total);

    // Son adresten sonra beklemeye gerek yok.
    if (i < total - 1) {
      await delay(NOMINATIM_RATE_LIMIT_MS);
    }
  }
}
