import type { NextRequest } from 'next/server';

import { OSRM_BASE_URL, APP_USER_AGENT } from '@/constants/config';

/**
 * OSRM proxy (PRD Bölüm 2 · api/route-optimize).
 *
 * İki mod:
 *  - `trip` : /trip/v1/driving — durak sırasını optimize eder (TSP çözümü).
 *  - `route`: /route/v1/driving — verilen sırayı KORUR, yalnızca geometri +
 *             mesafe/süre döndürür (sürükle-bırak sonrası yeniden hesaplama).
 *
 * Body: { coordinates: [[lng, lat], ...], mode: 'trip' | 'route' }
 * Not: GeoJSON [lng, lat] sırasındadır; Leaflet için [lat, lng]'ye çevrilir.
 */

interface OptimizeBody {
  coordinates?: [number, number][];
  mode?: 'trip' | 'route';
}

interface OsrmGeometry {
  coordinates: [number, number][]; // [lng, lat]
}

interface OsrmTrip {
  distance: number; // metre
  duration: number; // saniye
  geometry: OsrmGeometry;
}

interface OsrmWaypoint {
  waypoint_index?: number; // trip modunda optimize edilmiş sıradaki konum
}

interface OsrmResponse {
  code: string;
  trips?: OsrmTrip[];
  routes?: OsrmTrip[];
  waypoints?: OsrmWaypoint[];
}

/** GeoJSON [lng,lat] dizisini Leaflet [lat,lng] dizisine çevirir. */
function toLatLng(coords: [number, number][]): [number, number][] {
  return coords.map(([lng, lat]) => [lat, lng]);
}

export async function POST(request: NextRequest) {
  let body: OptimizeBody;
  try {
    body = (await request.json()) as OptimizeBody;
  } catch {
    return Response.json({ ok: false, error: 'Geçersiz JSON.' }, { status: 400 });
  }

  // Yalnızca geçerli [lng, lat] sayı çiftlerini kabul et (malformed girdiye karşı).
  const coordinates = (Array.isArray(body.coordinates) ? body.coordinates : [])
    .filter(
      (c): c is [number, number] =>
        Array.isArray(c) &&
        c.length === 2 &&
        Number.isFinite(c[0]) &&
        Number.isFinite(c[1]),
    );
  const mode = body.mode === 'route' ? 'route' : 'trip';

  // 0 veya 1 nokta: rota yok. Tek noktayı olduğu gibi döndür.
  if (coordinates.length < 2) {
    return Response.json({
      ok: true,
      order: coordinates.map((_, i) => i),
      geometry: coordinates.map(([lng, lat]) => [lat, lng]),
      distanceKm: 0,
      durationMin: 0,
    });
  }

  const coordPath = coordinates
    .map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`)
    .join(';');

  const service = mode === 'trip' ? 'trip' : 'route';
  const params =
    mode === 'trip'
      ? 'source=first&roundtrip=false&overview=full&geometries=geojson'
      : 'overview=full&geometries=geojson';
  const url = `${OSRM_BASE_URL}/${service}/v1/driving/${coordPath}?${params}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': APP_USER_AGENT },
    });
    if (!res.ok) {
      return Response.json(
        { ok: false, error: `OSRM yanıtı başarısız: ${res.status}` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as OsrmResponse;
    if (data.code !== 'Ok') {
      return Response.json(
        { ok: false, error: `OSRM kodu: ${data.code}` },
        { status: 502 },
      );
    }

    const leg = (mode === 'trip' ? data.trips : data.routes)?.[0];
    if (!leg) {
      return Response.json({ ok: false, error: 'Rota bulunamadı.' }, { status: 502 });
    }

    // trip modunda giriş sırasını optimize edilmiş ziyaret sırasına çevir:
    // order[i] = ziyaret sırasındaki i. durağın GİRİŞ indeksidir.
    let order = coordinates.map((_, i) => i);
    if (mode === 'trip' && data.waypoints) {
      const ordered: number[] = new Array(coordinates.length);
      data.waypoints.forEach((wp, inputIndex) => {
        if (typeof wp.waypoint_index === 'number') {
          ordered[wp.waypoint_index] = inputIndex;
        }
      });
      // Boşluk kalmadıysa kullan; aksi halde giriş sırasına düş.
      if (ordered.every((v) => typeof v === 'number')) {
        order = ordered;
      }
    }

    return Response.json({
      ok: true,
      order,
      geometry: toLatLng(leg.geometry.coordinates),
      distanceKm: leg.distance / 1000,
      durationMin: leg.duration / 60,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Bilinmeyen OSRM hatası.';
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
