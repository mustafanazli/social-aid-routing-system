'use client';

import { useEffect } from 'react';
import L from 'leaflet';
import {
  MapContainer as LeafletMap,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import type { GeocodedLocation } from '@/types/address';
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from '@/constants/config';
import RouteMarker from '@/components/map/RouteMarker';

interface MapViewProps {
  /** Koordinatı olan (SUCCESS / MANUAL) konumlar — haritada pin olur. */
  locations: GeocodedLocation[];
  /**
   * Elle konumlandırma bekleyen adresin id'si. Doluysa haritaya tıklamak
   * bu adrese pin bırakır; boşsa tıklama yok sayılır.
   */
  manualTargetId: string | null;
  onMapClick: (lat: number, lng: number) => void;
  onMarkerDragEnd: (id: string, lat: number, lng: number) => void;
}

/**
 * Yeni pin(ler) eklendiğinde haritayı tüm pinleri kapsayacak şekilde çerçeveler.
 * Yalnızca pin KÜMESİ (id'ler) değişince tetiklenir; böylece bir marker
 * sürüklendiğinde (koordinat değişir, id'ler aynı kalır) harita zıplamaz.
 */
function FitBounds({ locations }: { locations: GeocodedLocation[] }) {
  const map = useMap();
  const idSignature = locations
    .map((l) => l.id)
    .sort()
    .join('|');

  useEffect(() => {
    if (locations.length === 0) return;
    if (locations.length === 1) {
      map.setView([locations[0].lat, locations[0].lng], 15);
      return;
    }
    const bounds = L.latLngBounds(
      locations.map((l) => [l.lat, l.lng] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    // idSignature değişince (pin eklenince/çıkınca) yeniden çerçevele.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idSignature, map]);

  return null;
}

/** Haritaya tıklama olayını yakalar (manuel pin bırakma modu). */
function ClickHandler({
  manualTargetId,
  onMapClick,
}: {
  manualTargetId: string | null;
  onMapClick: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  // Manuel mod aktifken imleci artı (crosshair) yap.
  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = manualTargetId ? 'crosshair' : '';
    return () => {
      container.style.cursor = '';
    };
  }, [manualTargetId, map]);

  useMapEvents({
    click(e) {
      if (manualTargetId) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  return null;
}

/**
 * Leaflet harita bileşeni.
 * ÖNEMLİ: Bu bileşen `window`/`document`e bağımlıdır ve ASLA sunucuda render
 * edilmemelidir. Bu yüzden yalnızca MapSection içinde
 * `dynamic(() => import(...), { ssr: false })` ile yüklenir (PRD Bölüm 6.1).
 */
export default function MapContainer({
  locations,
  manualTargetId,
  onMapClick,
  onMarkerDragEnd,
}: MapViewProps) {
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

      <FitBounds locations={locations} />
      <ClickHandler manualTargetId={manualTargetId} onMapClick={onMapClick} />

      {locations.map((location, index) => (
        <RouteMarker
          key={location.id}
          location={location}
          order={index + 1}
          onDragEnd={onMarkerDragEnd}
        />
      ))}
    </LeafletMap>
  );
}
