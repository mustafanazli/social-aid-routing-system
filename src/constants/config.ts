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
 * Ortam değişkeninden gelen URL'yi temizler. Panolardan/README'den kopyalanan
 * değerler bazen Markdown link biçiminde ("[https://x](https://x)") ya da
 * baş/son boşluk/tırnakla gelir; bu, sunucu tarafı `fetch`'te "Failed to parse
 * URL" hatasına yol açar. Geçerli http(s) çıkaramazsak güvenli varsayılana düşer.
 */
function cleanEnvUrl(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  let v = raw.trim().replace(/^['"]|['"]$/g, '');
  // Markdown link: "[metin](url)" → url
  const md = v.match(/\((https?:\/\/[^)]+)\)/);
  if (md) v = md[1];
  // Değerin herhangi bir yerindeki ilk http(s) URL'sini yakala.
  const m = v.match(/https?:\/\/[^\s\])'"]+/);
  v = m ? m[0] : v;
  v = v.replace(/\/+$/, ''); // sondaki eğik çizgileri at
  return /^https?:\/\//.test(v) ? v : fallback;
}

/**
 * OpenStreetMap Nominatim geocoding servisi. Saniyede maks. 1 istek.
 * `.env` üzerinden özel/self-hosted bir Nominatim adresiyle değiştirilebilir.
 */
export const NOMINATIM_BASE_URL = cleanEnvUrl(
  process.env.NEXT_PUBLIC_NOMINATIM_URL,
  'https://nominatim.openstreetmap.org/search',
);
export const NOMINATIM_RATE_LIMIT_MS = Number(
  process.env.NEXT_PUBLIC_NOMINATIM_RATE_LIMIT_MS ?? 1000,
);

/**
 * Otomatik konumlandırma sağlayıcıları (SUNUCU TARAFI — anahtarlar tarayıcıya
 * sızmaması için NEXT_PUBLIC_ ÖNEKSİZ tutulur; sadece /api/geocode okur).
 *
 * Sıra: Yandex → Google → OpenStreetMap (Nominatim, son çare, anahtarsız).
 * Bir sağlayıcının anahtarı yoksa o adım otomatik atlanır; sistem çökmez.
 *
 * Anahtar alma:
 *  - Yandex : https://developer.tech.yandex.ru → "Geocoder API" (JavaScript API
 *             ve HTTP Geocoder) ücretsiz anahtar (kredi kartı gerekmez).
 *  - Google : https://console.cloud.google.com → "Geocoding API" etkinleştir →
 *             API anahtarı oluştur (faturalandırma açık olmalı; aylık 200$ kredi).
 * Anahtarları proje kökündeki `.env.local` dosyasına yaz:
 *   YANDEX_GEOCODER_API_KEY=...
 *   GOOGLE_MAPS_API_KEY=...
 */
export const YANDEX_GEOCODER_API_KEY = process.env.YANDEX_GEOCODER_API_KEY ?? '';
export const YANDEX_GEOCODER_URL = 'https://geocode-maps.yandex.ru/1.x/';

export const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? '';
export const GOOGLE_GEOCODER_URL =
  'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * OSRM public routing servisi (Trip & Route API).
 * Üretimde kendi OSRM sunucunuzu `.env` ile tanımlamanız önerilir.
 */
export const OSRM_BASE_URL = cleanEnvUrl(
  process.env.NEXT_PUBLIC_OSRM_URL,
  'https://router.project-osrm.org',
);

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
