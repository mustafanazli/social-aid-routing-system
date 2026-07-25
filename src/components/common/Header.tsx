'use client';

import { Radar, RotateCcw, ShieldCheck } from 'lucide-react';

import { useDeliveryStore } from '@/store/useDeliveryStore';
import SystemClock from '@/components/common/SystemClock';
import ConnectionBadge from '@/components/common/ConnectionBadge';

/** Akıllı Şehir Komuta Merkezi üst barı (Header). */
export default function Header() {
  const resetSession = useDeliveryStore((s) => s.resetSession);
  const clearNotificationLogs = useDeliveryStore(
    (s) => s.clearNotificationLogs,
  );

  const handleReset = () => {
    const ok = window.confirm(
      'Tüm oturum verileri (adresler, rotalar, teslimatlar) sıfırlansın mı? Bu işlem geri alınamaz.',
    );
    if (!ok) return;
    resetSession();
    clearNotificationLogs();
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/80">
      <div className="mx-auto flex max-w-[92rem] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Sol: logo + başlık */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 shadow-lg shadow-blue-900/40">
            <Radar className="h-6 w-6 text-white" strokeWidth={2.2} />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 ring-2 ring-slate-950" />
          </div>
          <div className="leading-tight">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/90">
              <ShieldCheck className="h-3 w-3" />
              Pendik Belediyesi
            </p>
            <h1 className="text-sm font-bold text-white sm:text-base">
              Akıllı Lojistik &amp;{' '}
              <span className="text-slate-300">Sosyal Yardım Rota Sistemi</span>
            </h1>
          </div>
        </div>

        {/* Sağ: durum + saat + hızlı işlem */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ConnectionBadge />
          <SystemClock />
          <button
            type="button"
            onClick={handleReset}
            title="Oturumu sıfırla"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Sıfırla</span>
          </button>
        </div>
      </div>
    </header>
  );
}
