import type { NextRequest } from 'next/server';

import {
  NOMINATIM_BASE_URL,
  NOMINATIM_RATE_LIMIT_MS,
  PENDIK_VIEWBOX,
  APP_USER_AGENT,
} from '@/constants/config';

/**
 * Nominatim proxy (PRD Bölüm 2 · api/geocode).
 *
 * Neden proxy? Tarayıcıdan doğrudan Nominatim'e istek atınca:
 *  - `User-Agent` header'ı tarayıcıda ayarlanamaz (forbidden header),
 *    oysa Nominatim kullanım politikası tanımlayıcı UA ister.
 *  - CORS ve rate-limit yönetimi tek noktadan yapılamaz.
 *
 * Kademeli (cascade) arama: Türk adresleri Nominatim'de çoğunlukla sokak/bina
 * seviyesinde bulunamaz ama mahalle seviyesinde güvenilir çözülür. Bu yüzden:
 *   1) Tam adres (`q`) ile aranır.
 *   2) Sonuç yoksa ve mahalle fallback'i (`nb`) verilmişse mahalle merkezi
 *      aranır ve sonuç "yaklaşık" (düşük güven) olarak işaretlenir.
 *
 * Kullanım: GET /api/geocode?q=<tam adres>&nb=<mahalle fallback adresi>
 */

interface NominatimRawResult {
  lat: string;
  lon: string;
  display_name?: string;
  importance?: number;
  class?: string;
  type?: string;
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

/** Nominatim'e tek sorgu — viewbox Pendik'e önceliklendirir (bounded=0 = yalnızca bias). */
async function queryNominatim(query: string): Promise<NominatimRawResult[]> {
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
    headers: {
      'User-Agent': APP_USER_AGENT,
      'Accept-Language': 'tr',
    },
    // Aynı adres tekrar arandığında Nominatim'i yormamak için cache.
    cache: 'force-cache',
  });

  if (!res.ok) {
    throw new Error(`Nominatim yanıtı başarısız: ${res.status}`);
  }
  return (await res.json()) as NominatimRawResult[];
}

function buildResult(top: NominatimRawResult, approximate: boolean) {
  const lat = parseFloat(top.lat);
  const lng = parseFloat(top.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const importance = typeof top.importance === 'number' ? top.importance : 0.3;
  const withinBounds = isWithinPendikBounds(lat, lng);

  // Mahalle merkezine düşen (yaklaşık) sonuçlar bilinçli olarak düşük güvenli
  // işaretlenir → arayüzde amber "düşük güven" rozetiyle görünür ve elle
  // düzeltmeye teşvik eder.
  const confidenceScore = approximate
    ? 0.3
    : Math.min(1, Math.max(0, importance * (withinBounds ? 1 : 0.5)));

  return {
    lat,
    lng,
    confidenceScore,
    approximate,
    withinBounds,
    formattedAddressFromAPI: top.display_name ?? '',
  };
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim();
  const neighborhoodQuery = request.nextUrl.searchParams.get('nb')?.trim();

  if (!query) {
    return Response.json({ error: 'q parametresi gerekli.' }, { status: 400 });
  }

  try {
    // 1) Tam adres.
    const primary = await queryNominatim(query);
    if (primary.length > 0) {
      const result = buildResult(primary[0], false);
      if (result) return Response.json({ found: true, result });
    }

    // 2) Mahalle merkezi fallback (yaklaşık). Nominatim'in 1 req/sec kuralına
    //    saygı için ikinci istekten önce kısa gecikme.
    if (neighborhoodQuery && neighborhoodQuery !== query) {
      await delay(NOMINATIM_RATE_LIMIT_MS);
      const fallback = await queryNominatim(neighborhoodQuery);
      if (fallback.length > 0) {
        const result = buildResult(fallback[0], true);
        if (result) return Response.json({ found: true, result });
      }
    }

    return Response.json({ found: false, result: null });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Bilinmeyen geocoding hatası.';
    return Response.json({ found: false, error: message }, { status: 502 });
  }
}
