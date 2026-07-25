'use client';

import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer as LeafletMap, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from '@/constants/config';
import type { VehicleRoute } from '@/types/fleet';
import type { LatLng } from '@/services/osrmService';
import RouteMarker from '@/components/map/RouteMarker';
import RoutePolyline from '@/components/map/RoutePolyline';
import OriginMarker from '@/components/map/OriginMarker';

interface RouteMapProps {
  routes: VehicleRoute[];
  /** vehicleId → OSRM polyline noktaları ([lat, lng]). */
  geometries: Record<string, LatLng[]>;
  /** Yalnızca bu araç gösterilsin (null = hepsi). */
  focusedVehicleId: string | null;
  /** Rota başlangıç noktası (canlı konum / belediye merkezi). */
  origin?: { lat: number; lng: number } | null;
  /** origin gerçek konum mu (true) yoksa yedek mi (false)? */
  originIsLive?: boolean;
}

/** Rota/durak değişince haritayı görünür duraklara sığdırır. */
function FitToStops({ points }: { points: LatLng[] }) {
  const map = useMap();
  const signature = points.map((p) => p.join(',')).join('|');

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, map]);

  return null;
}

/**
 * Rota haritası (Faz 4): her araç için farklı renkte polyline + numaralı
 * durak pinleri. SSR-güvenli olması için RoutePlanner içinde dynamic
 * (ssr:false) yüklenir.
 */
export default function RouteMap({
  routes,
  geometries,
  focusedVehicleId,
  origin,
  originIsLive = false,
}: RouteMapProps) {
  const visibleRoutes = useMemo(
    () =>
      focusedVehicleId
        ? routes.filter((r) => r.vehicleId === focusedVehicleId)
        : routes,
    [routes, focusedVehicleId],
  );

  // Sığdırma için tüm görünür durak koordinatları (+ origin).
  const allPoints = useMemo<LatLng[]>(() => {
    const pts = visibleRoutes.flatMap((r) =>
      r.stops.map((s) => [s.location.lat, s.location.lng] as LatLng),
    );
    if (origin) pts.push([origin.lat, origin.lng]);
    return pts;
  }, [visibleRoutes, origin]);

  return (
    <LeafletMap
      center={[MAP_DEFAULT_CENTER.lat, MAP_DEFAULT_CENTER.lng]}
      zoom={MAP_DEFAULT_ZOOM}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıda bulunanlar'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitToStops points={allPoints} />

      {/* Başlangıç noktası (yanıp sönen mavi marker) */}
      {origin && (
        <OriginMarker lat={origin.lat} lng={origin.lng} isLive={originIsLive} />
      )}

      {/* Rota çizgileri (araç renkli) */}
      {visibleRoutes.map((route) => (
        <RoutePolyline
          key={`line-${route.vehicleId}`}
          positions={geometries[route.vehicleId] ?? []}
          color={route.vehicleColor}
        />
      ))}

      {/* Durak pinleri (araç renkli, sıra numaralı) */}
      {visibleRoutes.flatMap((route) =>
        route.stops.map((stop) => (
          <RouteMarker
            key={`${route.vehicleId}-${stop.location.id}`}
            location={stop.location}
            order={stop.stopOrder}
            color={route.vehicleColor}
            draggable={false}
          />
        )),
      )}
    </LeafletMap>
  );
}
