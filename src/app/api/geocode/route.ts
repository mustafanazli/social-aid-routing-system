import type { NextRequest } from 'next/server';

import {
  NOMINATIM_BASE_URL,
  NOMINATIM_RATE_LIMIT_MS,
  PENDIK_VIEWBOX,
  APP_USER_AGENT,
  YANDEX_GEOCODER_API_KEY,
  YANDEX_GEOCODER_URL,
  GOOGLE_MAPS_API_KEY,
  GOOGLE_GEOCODER_URL,
} from '@/constants/config';

/**
 * Çok-sağlayıcılı geocoding proxy'si.
 *
 * Neden proxy? Anahtarlar (Yandex / Google) SUNUCU tarafında kalmalı — asla
 * tarayıcıya sızmamalı. Ayrıca Nominatim `User-Agent` header'ı ve rate-limit'i
 * tek noktadan yönetilir.
 *
 * Sağlayıcı sırası (cascade): Google → Yandex → OpenStreetMap (Nominatim).
 *  - Kullanıcı "adresi Google/Yandex'te arasın" istedi; bu servisler Türkiye
 *    sokak/bina verisinde OSM'den çok daha güncel.
 *  - Google öne alındı: Türkiye kapsaması çok iyi ve anahtarı doğrulandı.
 *    Yandex ikinci sıradadır; anahtarı geçerli hale gelince otomatik katılır.
 *  - Bir sağlayıcının anahtarı yoksa ya da hata verirse otomatik bir sonrakine
 *    geçilir. Hiçbiri bulamazsa mahalle merkezi (yaklaşık) fallback denenir.
 *
 * Kullanım: GET /api/geocode?q=<tam adres>&nb=<mahalle fallback adresi>
 */

/** Tüm sağlayıcıların döndüğü ortak (normalize) sonuç. */
interface NormalizedGeocode {
  lat: number;
  lng: number;
  confidenceScore: number;
  approximate: boolean;
  withinBounds: boolean;
  formattedAddressFromAPI: string;
  provider: 'yandex' | 'google' | 'osm';
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

/** Pendik/İstanbul çevresini kabaca doğrulamak için gevşek sınır kutusu. */
function isWithinPendikBounds(lat: number, lng: number): boolean {
  return (
    lat >= PENDIK_VIEWBOX.minLat - 0.1 &&
    lat <= PENDIK_VIEWBOX.maxLat + 0.1 &&
    lng >= PENDIK_VIEWBOX.minLon - 0.15 &&
    lng <= PENDIK_VIEWBOX.maxLon + 0.15
  );
}

// Viewbox merkezi ve yarı-genişliği (sağlayıcıları Pendik'e önceliklendirmek için).
const CENTER_LON = (PENDIK_VIEWBOX.minLon + PENDIK_VIEWBOX.maxLon) / 2;
const CENTER_LAT = (PENDIK_VIEWBOX.minLat + PENDIK_VIEWBOX.maxLat) / 2;
const SPAN_LON = PENDIK_VIEWBOX.maxLon - PENDIK_VIEWBOX.minLon;
const SPAN_LAT = PENDIK_VIEWBOX.maxLat - PENDIK_VIEWBOX.minLat;

// ————————————————————————————————————————————————————————————————
//  1) YANDEX GEOCODER
// ————————————————————————————————————————————————————————————————

/** Yandex "precision" değerini güven skoruna çevirir. */
const YANDEX_PRECISION_SCORE: Record<string, number> = {
  exact: 0.95,
  number: 0.9,
  near: 0.72,
  range: 0.7,
  street: 0.5,
  other: 0.3,
};

interface YandexResponse {
  response?: {
    GeoObjectCollection?: {
      featureMember?: Array<{
        GeoObject?: {
          Point?: { pos?: string };
          metaDataProperty?: {
            GeocoderMetaData?: { precision?: string; text?: string };
          };
        };
      }>;
    };
  };
}

async function queryYandex(query: string): Promise<NormalizedGeocode | null> {
  if (!YANDEX_GEOCODER_API_KEY) return null;

  const params = new URLSearchParams({
    apikey: YANDEX_GEOCODER_API_KEY,
    geocode: query,
    format: 'json',
    results: '1',
    lang: 'tr_TR',
    // Pendik çevresine önceliklendir (rspn=0 → katı sınır değil, sadece bias).
    ll: `${CENTER_LON},${CENTER_LAT}`,
    spn: `${SPAN_LON},${SPAN_LAT}`,
    rspn: '0',
  });

  const res = await fetch(`${YANDEX_GEOCODER_URL}?${params.toString()}`, {
    cache: 'force-cache',
  });
  if (!res.ok) throw new Error(`Yandex yanıtı başarısız: ${res.status}`);

  const data = (await res.json()) as YandexResponse;
  const member = data.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
  const pos = member?.Point?.pos;
  if (!pos) return null;

  // Yandex "pos" formatı: "boylam enlem" (LON önce, boşlukla ayrılmış).
  const [lonStr, latStr] = pos.split(' ');
  const lng = parseFloat(lonStr);
  const lat = parseFloat(latStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const precision =
    member?.metaDataProperty?.GeocoderMetaData?.precision ?? 'other';
  const withinBounds = isWithinPendikBounds(lat, lng);
  const base = YANDEX_PRECISION_SCORE[precision] ?? 0.3;

  return {
    lat,
    lng,
    confidenceScore: withinBounds ? base : base * 0.5,
    approximate: precision === 'street' || precision === 'other',
    withinBounds,
    formattedAddressFromAPI:
      member?.metaDataProperty?.GeocoderMetaData?.text ?? '',
    provider: 'yandex',
  };
}

// ————————————————————————————————————————————————————————————————
//  2) GOOGLE GEOCODER
// ————————————————————————————————————————————————————————————————

/** Google "location_type" değerini güven skoruna çevirir. */
const GOOGLE_LOCTYPE_SCORE: Record<string, number> = {
  ROOFTOP: 0.95,
  RANGE_INTERPOLATED: 0.85,
  GEOMETRIC_CENTER: 0.6,
  APPROXIMATE: 0.4,
};

interface GoogleResponse {
  status: string;
  results?: Array<{
    geometry?: {
      location?: { lat: number; lng: number };
      location_type?: string;
    };
    formatted_address?: string;
  }>;
}

async function queryGoogle(query: string): Promise<NormalizedGeocode | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;

  const params = new URLSearchParams({
    address: query,
    key: GOOGLE_MAPS_API_KEY,
    language: 'tr',
    region: 'tr',
    // Pendik sınırlarına önceliklendir (bias — "bounds" katı değildir).
    bounds: `${PENDIK_VIEWBOX.minLat},${PENDIK_VIEWBOX.minLon}|${PENDIK_VIEWBOX.maxLat},${PENDIK_VIEWBOX.maxLon}`,
  });

  const res = await fetch(`${GOOGLE_GEOCODER_URL}?${params.toString()}`, {
    cache: 'force-cache',
  });
  if (!res.ok) throw new Error(`Google yanıtı başarısız: ${res.status}`);

  const data = (await res.json()) as GoogleResponse;
  if (data.status !== 'OK' || !data.results?.length) return null;

  const top = data.results[0];
  const loc = top.geometry?.location;
  if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) {
    return null;
  }

  const locType = top.geometry?.location_type ?? 'APPROXIMATE';
  const withinBounds = isWithinPendikBounds(loc.lat, loc.lng);
  const base = GOOGLE_LOCTYPE_SCORE[locType] ?? 0.4;

  return {
    lat: loc.lat,
    lng: loc.lng,
    confidenceScore: withinBounds ? base : base * 0.5,
    approximate: locType === 'APPROXIMATE',
    withinBounds,
    formattedAddressFromAPI: top.formatted_address ?? '',
    provider: 'google',
  };
}

// ————————————————————————————————————————————————————————————————
//  3) OPENSTREETMAP / NOMINATIM (son çare)
// ————————————————————————————————————————————————————————————————

interface NominatimRawResult {
  lat: string;
  lon: string;
  display_name?: string;
  importance?: number;
}

async function queryNominatim(query: string): Promise<NormalizedGeocode | null> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '1',
    countrycodes: 'tr',
    viewbox: `${PENDIK_VIEWBOX.minLon},${PENDIK_VIEWBOX.minLat},${PENDIK_VIEWBOX.maxLon},${PENDIK_VIEWBOX.maxLat}`,
    bounded: '0',
  });

  const res = await fetch(`${NOMINATIM_BASE_URL}?${params.toString()}`, {
    headers: { 'User-Agent': APP_USER_AGENT, 'Accept-Language': 'tr' },
    cache: 'force-cache',
  });
  if (!res.ok) throw new Error(`Nominatim yanıtı başarısız: ${res.status}`);

  const rows = (await res.json()) as NominatimRawResult[];
  if (!rows.length) return null;

  const top = rows[0];
  const lat = parseFloat(top.lat);
  const lng = parseFloat(top.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const importance = typeof top.importance === 'number' ? top.importance : 0.3;
  const withinBounds = isWithinPendikBounds(lat, lng);

  return {
    lat,
    lng,
    confidenceScore: Math.min(1, Math.max(0, importance * (withinBounds ? 1 : 0.5))),
    approximate: false,
    withinBounds,
    formattedAddressFromAPI: top.display_name ?? '',
    provider: 'osm',
  };
}

// ————————————————————————————————————————————————————————————————
//  CASCADE
// ————————————————————————————————————————————————————————————————

/**
 * Bir sorguyu sağlayıcı sırasıyla (Yandex → Google → OSM) dener; ilk geçerli
 * sonucu döndürür. Bir sağlayıcı hata verirse yutulur ve sıradakine geçilir —
 * tek bir servis çökse bile sistem çalışmaya devam eder.
 */
async function cascadeQuery(query: string): Promise<NormalizedGeocode | null> {
  const providers: Array<() => Promise<NormalizedGeocode | null>> = [
    () => queryGoogle(query),
    () => queryYandex(query),
    () => queryNominatim(query),
  ];

  for (const run of providers) {
    try {
      const result = await run();
      if (result) return result;
    } catch (err) {
      // Sağlayıcı hatası kritik değil — logla ve sıradakini dene.
      console.warn('[geocode] sağlayıcı hatası:', (err as Error).message);
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim();
  const neighborhoodQuery = request.nextUrl.searchParams.get('nb')?.trim();

  if (!query) {
    return Response.json({ error: 'q parametresi gerekli.' }, { status: 400 });
  }

  try {
    // 1) Tam adres — Yandex → Google → OSM.
    const primary = await cascadeQuery(query);
    if (primary) {
      return Response.json({ found: true, result: primary });
    }

    // 2) Mahalle merkezi fallback (yaklaşık). Nominatim'in 1 req/sec kuralına
    //    saygı için kısa gecikme (Yandex/Google için de zararsız).
    if (neighborhoodQuery && neighborhoodQuery !== query) {
      await delay(NOMINATIM_RATE_LIMIT_MS);
      const fallback = await cascadeQuery(neighborhoodQuery);
      if (fallback) {
        return Response.json({
          found: true,
          result: { ...fallback, approximate: true, confidenceScore: 0.3 },
        });
      }
    }

    return Response.json({ found: false, result: null });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Bilinmeyen geocoding hatası.';
    return Response.json({ found: false, error: message }, { status: 502 });
  }
}
