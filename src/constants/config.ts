// Uygulama geneli konfigürasyon: API adresleri ve harita varsayılanları.

/** Pendik merkez koordinatı — harita varsayılan odak noktası. */
export const MAP_DEFAULT_CENTER = {
  lat: 40.8754,
  lng: 29.233,
} as const;

export const MAP_DEFAULT_ZOOM = 13;

/**
 * Canlı konum alınamadığında (izin reddi / masaüstü / desteklenmeyen tarayıcı)
 * kullanılacak yedek başlangıç noktası: Pendik Belediyesi Merkez Binası.
 */
export const PENDIK_MUNICIPALITY = {
  lat: 40.8775,
  lng: 29.2306,
} as const;

/**
 * Pendik/İstanbul için geocoding sonuçlarını sınırlandıran viewbox.
 * Format: [minLon, minLat, maxLon, maxLat]
 */
export const PENDIK_VIEWBOX = {
  minLon: 29.2,
  minLat: 40.85,
  maxLon: 29.35,
  maxLat: 40.95,
} as const;

/**
 * OpenStreetMap Nominatim geocoding servisi. Saniyede maks. 1 istek.
 * `.env` üzerinden özel/self-hosted bir Nominatim adresiyle değiştirilebilir.
 */
export const NOMINATIM_BASE_URL =
  process.env.NEXT_PUBLIC_NOMINATIM_URL ??
  'https://nominatim.openstreetmap.org/search';
export const NOMINATIM_RATE_LIMIT_MS = Number(
  process.env.NEXT_PUBLIC_NOMINATIM_RATE_LIMIT_MS ?? 1000,
);

/**
 * OSRM public routing servisi (Trip & Route API).
 * Üretimde kendi OSRM sunucunuzu `.env` ile tanımlamanız önerilir.
 */
export const OSRM_BASE_URL =
  process.env.NEXT_PUBLIC_OSRM_URL ?? 'https://router.project-osrm.org';

/** Araçlara otomatik atanacak ayırt edici renk paleti (marker & polyline). */
export const VEHICLE_COLOR_PALETTE: string[] = [
  '#2563eb', // mavi
  '#16a34a', // yeşil
  '#dc2626', // kırmızı
  '#d97706', // turuncu
  '#7c3aed', // mor
  '#0891b2', // camgöbeği
  '#db2777', // pembe
  '#65a30d', // fıstık yeşili
  '#ea580c', // koyu turuncu
  '#4f46e5', // indigo
];

/** OpenStreetMap kullanım politikası gereği gönderilen tanımlayıcı. */
export const APP_USER_AGENT = 'PendikSosyalYardimRotaSistemi/1.0';

/**
 * Sürdürülebilirlik / karbon ayak izi varsayımları (Faz 6.4).
 * Optimize rota, standart (rastgele) dağıtıma göre ORTALAMA_TASARRUF_ORANI
 * kadar daha kısa kabul edilir; buradan yakıt ve CO₂ tasarrufu türetilir.
 */
export const OPTIMIZATION_SAVING_RATIO = 0.25; // %25 mesafe tasarrufu varsayımı
export const FUEL_LITER_PER_KM = 0.08; // km başına ortalama yakıt (L)
export const CO2_GRAM_PER_KM = 120; // km başına ortalama CO₂ salınımı (g)
