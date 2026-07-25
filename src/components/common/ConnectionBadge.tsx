'use client';

import { Wifi, WifiOff } from 'lucide-react';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useHasHydrated } from '@/hooks/useHasHydrated';

/** Çevrimiçi/Çevrimdışı durum rozeti (komuta merkezi üst barı). */
export default function ConnectionBadge() {
  const hydrated = useHasHydrated();
  const online = useOnlineStatus();

  // Hydration'a kadar nötr (çevrimiçi) göster.
  const isOnline = !hydrated || online;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        isOnline
          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
          : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
      }`}
    >
      {isOnline ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <Wifi className="h-3.5 w-3.5" />
          Çevrimiçi
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          Çevrimdışı
        </>
      )}
    </span>
  );
}
