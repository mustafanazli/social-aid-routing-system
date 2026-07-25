'use client';

import { useCallback, useState } from 'react';

import { PENDIK_MUNICIPALITY } from '@/constants/config';

export interface Coordinates {
  lat: number;
  lng: number;
}

export type LocationStatus =
  | 'idle' // henüz istenmedi
  | 'loading' // konum bekleniyor
  | 'success' // gerçek GPS/tarayıcı konumu alındı
  | 'fallback'; // izin yok / hata → Pendik Belediyesi yedek koordinatı

interface UseCurrentLocationResult {
  coords: Coordinates | null;
  status: LocationStatus;
  /** Yedek (belediye merkezi) mi kullanılıyor? */
  isFallback: boolean;
  requestLocation: () => void;
}

/**
 * HTML5 Geolocation sarmalayıcısı (PRD saha özelliği).
 * İzin verilmezse veya tarayıcı desteklemezse UYGULAMA HATA VERMEZ:
 * Pendik Belediyesi Merkez Binası koordinatına düşülür (fallback).
 */
export function useCurrentLocation(): UseCurrentLocationResult {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');

  const requestLocation = useCallback(() => {
    setStatus('loading');

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setCoords({ ...PENDIK_MUNICIPALITY });
      setStatus('fallback');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setStatus('success');
      },
      () => {
        // İzin reddi / zaman aşımı / hata → yedek konum.
        setCoords({ ...PENDIK_MUNICIPALITY });
        setStatus('fallback');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }, []);

  return {
    coords,
    status,
    isFallback: status === 'fallback',
    requestLocation,
  };
}
