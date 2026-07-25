import type { GeocodedLocation } from '@/types/address';
import type { VehicleConfig } from '@/types/fleet';

/**
 * Kapasiteye duyarlı coğrafi kümeleme (PRD Bölüm 3.2 & 5.2).
 *
 * Amaç: koordinatı olan adresleri, araç sayısına göre coğrafi olarak yakın
 * gruplara böl; her grubun toplam koli sayısı ilgili aracın kapasitesini
 * aşmasın. Yaklaşım: k-means++ ile tohumlanmış birkaç iterasyonluk k-means
 * (coğrafi merkezler) + kapasite kısıtlı hırslı (greedy) atama.
 */

export interface ClusterResult {
  /** vehicles ile aynı sırada — her aracın adres listesi. */
  clusters: GeocodedLocation[][];
  /** Kapasitesi aşılan araçların id'leri (kapasite yetersizse). */
  overCapacityVehicleIds: string[];
}

interface Point {
  location: GeocodedLocation;
  lat: number;
  lng: number;
  box: number;
}

/** İki koordinat arası Haversine mesafesi (km). */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Yalnızca geçerli koordinatı olan (geocode başarılı/manuel) adresler. */
export function hasValidCoords(l: GeocodedLocation): boolean {
  return (
    (l.geocodingStatus === 'SUCCESS' || l.geocodingStatus === 'MANUAL') &&
    Number.isFinite(l.lat) &&
    Number.isFinite(l.lng) &&
    (l.lat !== 0 || l.lng !== 0)
  );
}

interface Centroid {
  lat: number;
  lng: number;
}

/** k-means++ tohumlaması: birbirinden uzak başlangıç merkezleri seçer. */
function seedCentroids(points: Point[], k: number): Centroid[] {
  const centroids: Centroid[] = [];
  // İlk merkez: rastgele değil, deterministik olsun diye ilk nokta.
  centroids.push({ lat: points[0].lat, lng: points[0].lng });

  while (centroids.length < k) {
    let best: Point | null = null;
    let bestDist = -1;
    for (const p of points) {
      // En yakın merkeze olan mesafe; bunu maksimize eden noktayı seç.
      let nearest = Infinity;
      for (const c of centroids) {
        const d = haversineKm(p.lat, p.lng, c.lat, c.lng);
        if (d < nearest) nearest = d;
      }
      if (nearest > bestDist) {
        bestDist = nearest;
        best = p;
      }
    }
    if (!best) break;
    centroids.push({ lat: best.lat, lng: best.lng });
  }
  return centroids;
}

/** Kapasiteyi yok sayan klasik k-means — yalnızca coğrafi merkezleri bulur. */
function runKMeans(points: Point[], k: number, iterations = 12): Centroid[] {
  let centroids = seedCentroids(points, k);

  for (let iter = 0; iter < iterations; iter++) {
    const sums = Array.from({ length: k }, () => ({
      lat: 0,
      lng: 0,
      count: 0,
    }));

    for (const p of points) {
      let nearest = 0;
      let nearestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = haversineKm(p.lat, p.lng, centroids[c].lat, centroids[c].lng);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = c;
        }
      }
      sums[nearest].lat += p.lat;
      sums[nearest].lng += p.lng;
      sums[nearest].count += 1;
    }

    // Merkezleri güncelle; boş kalan merkez eski konumunu korur.
    centroids = centroids.map((old, c) =>
      sums[c].count > 0
        ? { lat: sums[c].lat / sums[c].count, lng: sums[c].lng / sums[c].count }
        : old,
    );
  }

  return centroids;
}

/**
 * Adresleri araçlara kapasite kısıtıyla paylaştırır.
 * @param locations Koordinatı olan adresler.
 * @param vehicles  Araç konfigürasyonları (kapasite & id).
 */
export function clusterLocations(
  locations: GeocodedLocation[],
  vehicles: VehicleConfig[],
): ClusterResult {
  const k = vehicles.length;
  const clusters: GeocodedLocation[][] = Array.from({ length: k }, () => []);

  const points: Point[] = locations.filter(hasValidCoords).map((l) => ({
    location: l,
    lat: l.lat,
    lng: l.lng,
    box: Math.max(1, l.boxCount || 1),
  }));

  if (k === 0 || points.length === 0) {
    return { clusters, overCapacityVehicleIds: [] };
  }

  // Nokta sayısı araç sayısından az/eşitse her noktayı farklı araca dağıt.
  const centroids =
    points.length <= k
      ? points.map((p) => ({ lat: p.lat, lng: p.lng }))
      : runKMeans(points, k);

  const capacities = vehicles.map((v) => Math.max(0, v.capacity));
  const used = new Array(k).fill(0);

  // Atama sırası: "kararlılık" (en yakın ile ikinci en yakın merkez farkı)
  // büyük olan noktalar önce atanır — güçlü tercihli noktalar önceliklidir.
  const withPref = points.map((p) => {
    const dists = centroids.map((c, ci) => ({
      ci,
      d: haversineKm(p.lat, p.lng, c.lat, c.lng),
    }));
    dists.sort((a, b) => a.d - b.d);
    const decisiveness = (dists[1]?.d ?? dists[0].d) - dists[0].d;
    return { p, order: dists.map((x) => x.ci), decisiveness };
  });
  withPref.sort((a, b) => b.decisiveness - a.decisiveness);

  const overCapacity = new Set<number>();

  for (const { p, order } of withPref) {
    // Merkez yakınlık sırasına göre kapasitesi yeten ilk araca yerleştir.
    let placed = false;
    for (const ci of order) {
      if (used[ci] + p.box <= capacities[ci]) {
        clusters[ci].push(p.location);
        used[ci] += p.box;
        placed = true;
        break;
      }
    }
    // Hiçbir araçta yer yoksa: en çok boş kapasitesi olana koy (taşma) ve işaretle.
    if (!placed) {
      let bestCi = 0;
      let bestRemaining = -Infinity;
      for (let ci = 0; ci < k; ci++) {
        const remaining = capacities[ci] - used[ci];
        if (remaining > bestRemaining) {
          bestRemaining = remaining;
          bestCi = ci;
        }
      }
      clusters[bestCi].push(p.location);
      used[bestCi] += p.box;
      overCapacity.add(bestCi);
    }
  }

  return {
    clusters,
    overCapacityVehicleIds: [...overCapacity].map((ci) => vehicles[ci].id),
  };
}
