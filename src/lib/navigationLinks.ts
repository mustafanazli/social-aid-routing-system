/**
 * Dış harita uygulamaları için TOPLU rota linkleri üretir (saha özelliği).
 * Başlangıç (origin) = şoförün canlı konumu; destination = son durak;
 * aradaki duraklar ara nokta (waypoint) olarak eklenir.
 */

export interface Point {
  lat: number;
  lng: number;
}

const fmt = (p: Point) => `${p.lat},${p.lng}`;

/**
 * Google Haritalar toplu rota:
 * https://www.google.com/maps/dir/?api=1&origin=..&destination=..&waypoints=a|b|c
 */
export function buildGoogleMapsRouteUrl(origin: Point, stops: Point[]): string {
  if (stops.length === 0) return '';

  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1);

  const params = new URLSearchParams({
    api: '1',
    origin: fmt(origin),
    destination: fmt(destination),
  });
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map(fmt).join('|'));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Yandex Haritalar toplu rota:
 * https://yandex.com.tr/harita/?rtext=oLat,oLng~s1Lat,s1Lng~...&rtt=auto
 * (Yandex virgül ve tilda ayırıcılarını ham bekler.)
 */
export function buildYandexMapsRouteUrl(origin: Point, stops: Point[]): string {
  if (stops.length === 0) return '';

  const rtext = [origin, ...stops].map(fmt).join('~');
  return `https://yandex.com.tr/harita/?rtext=${rtext}&rtt=auto`;
}

/**
 * Apple Haritalar ile tek durağa yol tarifi.
 * iOS/macOS'ta doğrudan Harita uygulamasını açar; diğer platformlarda
 * maps.apple.com web sayfasına düşer. dirflg=d → araçla sürüş modu.
 * https://maps.apple.com/?daddr=<lat>,<lng>&dirflg=d
 */
export function buildAppleMapsNavUrl(p: Point): string {
  return `https://maps.apple.com/?daddr=${p.lat},${p.lng}&dirflg=d`;
}

/**
 * Tek bir adresi Google Haritalar'da arama olarak açar (yeni sekme).
 * Operatör doğru noktayı bulup koordinatı kopyalayıp uygulamaya yapıştırır.
 * https://www.google.com/maps/search/?api=1&query=<adres>
 */
export function buildGoogleMapsSearchUrl(query: string): string {
  const params = new URLSearchParams({ api: '1', query });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

/**
 * Google Haritalar'dan kopyalanan koordinat metnini ("40.887880, 29.260750")
 * ayrıştırır. Ayırıcı virgül veya boşluk olabilir; Google nokta ondalık
 * kullandığından ilk iki ondalıklı sayı enlem/boylam kabul edilir.
 * İstanbul/Pendik makul aralığında değilse null döner (yanlış yapıştırmayı önler).
 */
export function parseLatLng(text: string): Point | null {
  if (!text) return null;
  const nums = text.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return null;

  const lat = parseFloat(nums[0]);
  const lng = parseFloat(nums[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // Türkiye kabaca lat 35–43, lng 25–45. Bu aralık dışını geçersiz say
  // (ör. lat/lng ters yapıştırılmış veya alakasız bir metin).
  if (lat < 35 || lat > 43 || lng < 25 || lng > 45) return null;

  return { lat, lng };
}
