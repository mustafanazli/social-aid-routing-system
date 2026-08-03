'use client';

import { Navigation, MapPin, Compass } from 'lucide-react';

import { buildAppleMapsNavUrl } from '@/lib/navigationLinks';

interface NavButtonProps {
  lat: number;
  lng: number;
}

/**
 * Dev navigasyon butonları (PRD Bölüm 5.2) — tek elle, thumb-friendly.
 *  - Google Haritalar: https://www.google.com/maps/dir/?api=1&destination={lat},{lng}
 *  - Yandex Navigasyon: mobilde `yandexnavi://build_route_on_map?...` şeması;
 *    açılamazsa Yandex Haritalar web yol tarifine düşülür.
 *  - Apple Haritalar: iOS/macOS'ta Harita uygulamasını açar (iPhone kuryeler için).
 */
export default function NavButton({ lat, lng }: NavButtonProps) {
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const yandexApp = `yandexnavi://build_route_on_map?lat_to=${lat}&lon_to=${lng}`;
  const yandexWeb = `https://yandex.com/maps/?rtext=~${lat},${lng}&rtt=auto`;
  const appleUrl = buildAppleMapsNavUrl({ lat, lng });

  const openGoogle = () => {
    window.open(googleUrl, '_blank', 'noopener,noreferrer');
  };

  const openYandex = () => {
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = yandexApp;
      window.setTimeout(() => {
        window.open(yandexWeb, '_blank', 'noopener,noreferrer');
      }, 700);
    } else {
      window.open(yandexWeb, '_blank', 'noopener,noreferrer');
    }
  };

  const openApple = () => {
    window.open(appleUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={openGoogle}
        className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-4 text-lg font-bold text-white shadow-md transition active:scale-95 active:brightness-95"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
          <MapPin className="h-5 w-5" />
        </span>
        Google Haritalar ile Git
      </button>
      <button
        type="button"
        onClick={openYandex}
        className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-amber-400 py-4 text-lg font-bold text-slate-900 shadow-md transition active:scale-95 active:brightness-95"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900/15">
          <Navigation className="h-5 w-5" />
        </span>
        Yandex Navigasyon ile Git
      </button>
      <button
        type="button"
        onClick={openApple}
        className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-slate-900 py-4 text-lg font-bold text-white shadow-md transition active:scale-95 active:brightness-95"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
          <Compass className="h-5 w-5" />
        </span>
        Apple Haritalar ile Git
      </button>
    </div>
  );
}
