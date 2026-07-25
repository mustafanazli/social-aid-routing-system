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
