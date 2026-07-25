'use client';

import { Polyline } from 'react-leaflet';

import type { LatLng } from '@/services/osrmService';

interface RoutePolylineProps {
  positions: LatLng[];
  color: string;
}

/**
 * Bir aracın rota çizgisi — araç rengiyle (PRD Bölüm 5.3).
 * Kontrast için altta beyaz "casing" (kılıf), üstte canlı renkli çizgi çizilir.
 */
export default function RoutePolyline({ positions, color }: RoutePolylineProps) {
  if (positions.length < 2) return null;
  return (
    <>
      {/* Kılıf (casing) — çizgiyi zemine karşı belirginleştirir */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: '#ffffff',
          weight: 9,
          opacity: 0.9,
          lineJoin: 'round',
          lineCap: 'round',
        }}
      />
      {/* Ana renkli çizgi */}
      <Polyline
        positions={positions}
        pathOptions={{
          color,
          weight: 5.5,
          opacity: 0.95,
          lineJoin: 'round',
          lineCap: 'round',
        }}
      />
    </>
  );
}
