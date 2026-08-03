'use client';

import { useMemo } from 'react';
import L from 'leaflet';
import { Marker, Popup } from 'react-leaflet';

import type { GeocodedLocation } from '@/types/address';

interface RouteMarkerProps {
  location: GeocodedLocation;
  /** Haritada gösterilecek sıra numarası (1..n). */
  order: number;
  /** Marker sürüklendiğinde yeni koordinatı bildirir (manuel düzeltme). */
  onDragEnd?: (id: string, lat: number, lng: number) => void;
  /** Verilirse pin rengini bu değere sabitler (araç rengi — rota modu). */
  color?: string;
  /** Pin sürüklenebilir mi? Varsayılan true (geocoding düzeltme modu). */
  draggable?: boolean;
}

/** Marker rengini geocoding durumuna/güvenine göre belirler. */
function markerColor(location: GeocodedLocation): string {
  if (location.geocodingStatus === 'MANUAL') return '#7c3aed'; // mor — elle konumlanan
  // Düşük güven skoru → amber uyarı rengi.
  if ((location.confidenceScore ?? 1) < 0.35) return '#d97706';
  return '#059669'; // emerald — başarılı
}

/**
 * Numaralandırılmış, renk kodlu damla (teardrop) pin.
 * L.divIcon kullanıldığı için Leaflet'in varsayılan PNG asset'lerine gerek yoktur.
 */
function buildIcon(color: string, order: number): L.DivIcon {
  const html = `
    <div style="
      position: relative;
      width: 30px;
      height: 40px;
    ">
      <div style="
        width: 30px; height: 30px;
        background: ${color};
        border: 2px solid #ffffff;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        position: absolute; top: 0; left: 0;
      "></div>
      <span style="
        position: absolute;
        top: 4px; left: 0;
        width: 30px; height: 26px;
        display: flex; align-items: center; justify-content: center;
        color: #ffffff; font-size: 12px; font-weight: 700;
        font-family: system-ui, -apple-system, sans-serif;
      ">${order}</span>
    </div>`;

  return L.divIcon({
    html,
    className: 'pendik-pin', // varsayılan leaflet-div-icon stilini iptal eder
    iconSize: [30, 40],
    // Damlanın sivri ucu -45° dönüş sonrası y≈36px'de kalır; koordinatın tam
    // üstüne otursun diye anchor ucun kendisine (15, 36) sabitlenir.
    iconAnchor: [15, 36],
    popupAnchor: [0, -34],
  });
}

export default function RouteMarker({
  location,
  order,
  onDragEnd,
  color: colorOverride,
  draggable = true,
}: RouteMarkerProps) {
  const color = colorOverride ?? markerColor(location);
  const icon = useMemo(() => buildIcon(color, order), [color, order]);

  const statusLabel =
    location.geocodingStatus === 'MANUAL'
      ? 'Elle konumlandı'
      : (location.confidenceScore ?? 1) < 0.35
        ? 'Düşük güven — kontrol edin'
        : 'Otomatik bulundu';

  return (
    <Marker
      position={[location.lat, location.lng]}
      icon={icon}
      draggable={draggable}
      eventHandlers={{
        dragend: (e) => {
          const { lat, lng } = e.target.getLatLng();
          onDragEnd?.(location.id, lat, lng);
        },
      }}
    >
      <Popup>
        <div style={{ minWidth: 200 }}>
          <p
            style={{
              margin: 0,
              fontWeight: 700,
              fontSize: 13,
              color: '#0f172a',
            }}
          >
            {order}. {location.recipientName || 'İsimsiz alıcı'}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#475569' }}>
            {location.cleanAddress}
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 8,
            }}
          >
            {location.neighborhood && (
              <span
                style={{
                  background: '#ecfdf5',
                  color: '#047857',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 999,
                }}
              >
                {location.neighborhood}
              </span>
            )}
            <span
              style={{
                background: '#fef3c7',
                color: '#b45309',
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 999,
              }}
            >
              {location.boxCount} koli
            </span>
            <span
              style={{
                background: `${color}1a`,
                color,
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 999,
              }}
            >
              {statusLabel}
            </span>
          </div>
          {location.phone && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>
              ☎ {location.phone}
            </p>
          )}
          {draggable && (
            <p style={{ margin: '8px 0 0', fontSize: 11, color: '#94a3b8' }}>
              Konumu düzeltmek için pini sürükleyin.
            </p>
          )}
        </div>
      </Popup>
    </Marker>
  );
}
