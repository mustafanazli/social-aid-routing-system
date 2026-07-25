'use client';

import { useSyncExternalStore } from 'react';
import { Clock } from 'lucide-react';

/**
 * Saniye başına tetiklenen dış "zaman kaynağı".
 * getSnapshot saniyeye yuvarlanır → aynı saniye içindeki render'larda
 * değer sabit kalır (useSyncExternalStore sonsuz döngüye girmez).
 */
function subscribe(onStoreChange: () => void): () => void {
  const id = window.setInterval(onStoreChange, 1000);
  return () => window.clearInterval(id);
}
function getSnapshot(): number {
  return Math.floor(Date.now() / 1000) * 1000;
}
function getServerSnapshot(): number {
  return 0; // SSR: değer yok → hydration uyumsuzluğu olmaz.
}

/** Canlı sistem saati (komuta merkezi üst barı). */
export default function SystemClock() {
  const ms = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const now = ms ? new Date(ms) : null;

  // İlk render'da (SSR) boş kalır → hydration uyumsuzluğu olmaz.
  const time = now
    ? now.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '--:--:--';
  const date = now
    ? now.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'short',
        weekday: 'short',
      })
    : '';

  return (
    <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-white md:flex">
      <Clock className="h-4 w-4 text-sky-300" />
      <div className="leading-tight">
        <p className="font-mono text-sm font-semibold tabular-nums">{time}</p>
        <p className="text-[10px] uppercase tracking-wide text-slate-300">
          {date}
        </p>
      </div>
    </div>
  );
}
