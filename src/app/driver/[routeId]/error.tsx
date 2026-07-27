'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

/**
 * Şoför ekranı hata sınırı (Faz 7.3) — mobil, açık temalı kurumsal fallback.
 */
export default function DriverError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Şoför ekranı hata sınırı:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <div>
        <p className="text-base font-bold text-slate-900">
          Ekran yüklenirken sorun oluştu
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Teslimat verileriniz cihazda güvende. Lütfen tekrar deneyin.
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition active:scale-95"
      >
        <RefreshCw className="h-4 w-4" />
        Tekrar Dene
      </button>
      <Link href="/" className="text-xs text-slate-400 underline">
        Yönetici Paneli
      </Link>
    </div>
  );
}
