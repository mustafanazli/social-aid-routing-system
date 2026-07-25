'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

/**
 * Yönetici paneli hata sınırı (Faz 7.3).
 * Bir bileşen render sırasında çökse bile beyaz ekran yerine kurumsal bir
 * hata kartı gösterilir; otomatik ve elle yeniden deneme sunulur.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Hata telemetride görünsün (üretimde bir servise gönderilebilir).
    console.error('Panel hata sınırı:', error);
  }, [error]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          window.clearInterval(id);
          reset();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [reset]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-white">
          Beklenmeyen bir hata oluştu
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Sistem bir aksaklıkla karşılaştı ancak verileriniz güvende (yerel
          hafızada saklı). Lütfen tekrar deneyin.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-95"
          >
            <RefreshCw className="h-4 w-4" />
            Tekrar Dene ({countdown})
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 active:scale-95"
          >
            <Home className="h-4 w-4" />
            Ana Sayfa
          </Link>
        </div>
      </div>
    </div>
  );
}
