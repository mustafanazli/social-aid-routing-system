import type { GeocodedLocation } from '@/types/address';

/**
 * OSRM rota servisi (PRD Bölüm 3.3 & 5.3).
 * İstemci `/api/route-optimize` proxy'sine gider (CORS'suz, tek noktadan).
 */

export type LatLng = [number, number];

/** Rotanın başlangıç noktası (şoförün canlı konumu / belediye merkezi). */
export interface OriginPoint {
  lat: number;
  lng: number;
}

export interface RouteResult {
  /** Ziyaret sırasına dizilmiş adresler (trip modunda optimize edilmiş). */
  orderedLocations: GeocodedLocation[];
  /** Leaflet polyline için [lat, lng] noktaları (origin varsa oradan başlar). */
  geometry: LatLng[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
}

interface OptimizeApiResponse {
  ok: boolean;
  order?: number[];
  geometry?: LatLng[];
  distanceKm?: number;
  durationMin?: number;
  error?: string;
}

async function callOptimize(
  locations: GeocodedLocation[],
  mode: 'trip' | 'route',
  origin?: OriginPoint | null,
): Promise<RouteResult> {
  // Durak koordinatları [lng, lat]; origin varsa başa eklenir (0. nokta).
  const stopCoords: LatLng[] = locations.map((l) => [l.lng, l.lat]);
  const coordinates: LatLng[] = origin
    ? [[origin.lng, origin.lat], ...stopCoords]
    : stopCoords;

  // 0 veya 1 toplam nokta: OSRM'e gerek yok.
  if (coordinates.length < 2) {
    return {
      orderedLocations: [...locations],
      geometry: coordinates.map(([lng, lat]) => [lat, lng] as LatLng),
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
    };
  }

  const res = await fetch('/api/route-optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinates, mode }),
  });

  const data = (await res.json()) as OptimizeApiResponse;
  if (!res.ok || !data.ok || !data.geometry) {
    throw new Error(data.error || 'OSRM rota hesaplanamadı.');
  }

  const order = data.order ?? coordinates.map((_, i) => i);

  // origin varsa 0. giriş origin'dir → duraklardan ayıklanır; kalanların
  // giriş indeksi 1 kaydırılmıştır (locations[i - 1]).
  const orderedLocations = origin
    ? order.filter((i) => i !== 0).map((i) => locations[i - 1]).filter(Boolean)
    : order.map((i) => locations[i]).filter(Boolean);

  return {
    orderedLocations,
    geometry: data.geometry,
    totalDistanceKm: data.distanceKm ?? 0,
    totalDurationMinutes: data.durationMin ?? 0,
  };
}

/**
 * Durakların en kısa ziyaret sırasını (TSP) hesaplar — trip servisi.
 * `origin` verilirse rota o noktadan başlar (en yakın duraktan sıralanır)
 * ve origin sonuç duraklarına dahil edilmez.
 */
export function optimizeRoute(
  locations: GeocodedLocation[],
  origin?: OriginPoint | null,
): Promise<RouteResult> {
  return callOptimize(locations, 'trip', origin);
}

/**
 * Verilen durak SIRASINI koruyarak yalnızca geometri + mesafe/süre hesaplar.
 * Sürükle-bırak ile sıra elle değiştiğinde çağrılır (route servisi).
 * `origin` verilirse geometri/mesafe o noktadan başlar.
 */
export function fetchRouteGeometry(
  orderedLocations: GeocodedLocation[],
  origin?: OriginPoint | null,
): Promise<RouteResult> {
  return callOptimize(orderedLocations, 'route', origin);
}
