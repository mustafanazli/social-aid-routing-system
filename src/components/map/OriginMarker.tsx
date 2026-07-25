'use client';

import { useMemo } from 'react';
import L from 'leaflet';
import { Marker, Popup } from 'react-leaflet';

interface OriginMarkerProps {
  lat: number;
  lng: number;
  /** true → gerçek konum, false → belediye merkezi (yedek). */
  isLive: boolean;
}

/** Rota başlangıç noktası — yanıp sönen mavi "Aracım / Başlangıç" marker'ı. */
export default function OriginMarker({ lat, lng, isLive }: OriginMarkerProps) {
  const icon = useMemo(
    () =>
      L.divIcon({
        className: 'origin-marker',
        html: `<div class="origin-pulse"><span class="origin-pulse__ring"></span><span class="origin-pulse__dot"></span></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -12],
      }),
    [],
  );

  return (
    <Marker position={[lat, lng]} icon={icon} zIndexOffset={1000}>
      <Popup>
        <div style={{ minWidth: 150 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#1e3a8a' }}>
            🚚 Başlangıç Noktası
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#475569' }}>
            {isLive
              ? 'Canlı konumunuz (rotalar buradan başlar).'
              : 'Pendik Belediyesi (yedek başlangıç).'}
          </p>
        </div>
      </Popup>
    </Marker>
  );
}
