'use client';

import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import {
  MapContainer as LeafletMap,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from '@/constants/config';
import type { SharedRoute, DriverLocation } from '@/lib/shareSerialization';
import RouteMarker from '@/components/map/RouteMarker';

interface LiveTrackingMapProps {
  routes: SharedRoute[];
  driverLocations: DriverLocation[];
}

const hasCoords = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);

/** Araç renginde, atım animasyonlu canlı şoför pini. */
function driverIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'driver-live-icon',
    html: `<div class="driver-live" style="--c:${color}">
        <span class="driver-live__ring"></span>
        <span class="driver-live__dot">🚚</span>
      </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
  });
}

/** Durak ve şoför konumları değişince haritayı kapsayacak şekilde çerçeveler. */
function FitBounds({ points }: { points: [number, number][] }) {
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

/** Geçen süreyi "az önce / 2 dk önce" gibi Türkçe ifadeye çevirir. */
function agoText(iso: string): string {
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 15) return 'az önce';
  if (sec < 60) return `${sec} sn önce`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} dk önce`;
  return `${Math.round(min / 60)} sa önce`;
}

/**
 * Yönetici canlı takip haritası: her aracın durakları (renk kodlu) + şoförün
 * son bilinen konumu (atım animasyonlu pin). SSR-güvensiz (leaflet) olduğundan
 * RouteExportPanel içinde dynamic(ssr:false) ile yüklenir.
 */
export default function LiveTrackingMap({
  routes,
  driverLocations,
}: LiveTrackingMapProps) {
  const colorByVehicle = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of routes) m[r.vehicleId] = r.vehicleColor;
    return m;
  }, [routes]);

  const allPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    for (const r of routes) {
      for (const s of r.stops) {
        if (hasCoords(s.location.lat, s.location.lng)) {
          pts.push([s.location.lat, s.location.lng]);
        }
      }
    }
    for (const d of driverLocations) {
      if (hasCoords(d.lat, d.lng)) pts.push([d.lat, d.lng]);
    }
    return pts;
  }, [routes, driverLocations]);

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

      <FitBounds points={allPoints} />

      {/* Duraklar (araç renkli, sıra numaralı) */}
      {routes.flatMap((route) =>
        route.stops
          .filter((s) => hasCoords(s.location.lat, s.location.lng))
          .map((stop) => (
            <RouteMarker
              key={`${route.vehicleId}-${stop.location.id}`}
              location={stop.location}
              order={stop.stopOrder}
              color={route.vehicleColor}
              draggable={false}
            />
          )),
      )}

      {/* Şoför canlı konumları */}
      {driverLocations
        .filter((d) => hasCoords(d.lat, d.lng))
        .map((d) => {
          const color = colorByVehicle[d.vehicleId] ?? '#059669';
          const vehicleName =
            routes.find((r) => r.vehicleId === d.vehicleId)?.vehicleName ??
            d.vehicleId;
          return (
            <Marker
              key={`driver-${d.vehicleId}`}
              position={[d.lat, d.lng]}
              icon={driverIcon(color)}
              zIndexOffset={1000}
            >
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>
                    🚚 {vehicleName}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#475569' }}>
                    Son konum: {agoText(d.updatedAt)}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
    </LeafletMap>
  );
}
