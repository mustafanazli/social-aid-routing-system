'use client';

import { useState } from 'react';
import {
  Archive,
  ChevronDown,
  FileDown,
  Trash2,
  CheckCircle2,
  Home,
  Clock,
  Truck,
  Save,
} from 'lucide-react';

import { useDeliveryStore } from '@/store/useDeliveryStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { exportDeliveryReportToExcel } from '@/lib/excelUtils';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function defaultLabel(): string {
  const now = new Date();
  const d = now.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' });
  const hour = now.getHours();
  const part = hour < 12 ? 'Sabah' : hour < 18 ? 'Öğleden Sonra' : 'Akşam';
  return `${d} ${part} Dağıtımı`;
}

/**
 * Dağıtım Geçmişi (Özellik 7) — tamamlanan dağıtımları arşivler ve listeler.
 * Her arşiv özet istatistiklerini gösterir; raporu tekrar indirilebilir.
 */
export default function HistoryPanel() {
  const hydrated = useHasHydrated();
  const routes = useDeliveryStore((s) => s.routes);
  const history = useDeliveryStore((s) => s.history);
  const archiveCurrentSession = useDeliveryStore((s) => s.archiveCurrentSession);
  const removeArchive = useDeliveryStore((s) => s.removeArchive);

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');

  const canArchive = hydrated && routes.length > 0;
  const items = hydrated ? history ?? [] : [];

  const handleArchive = () => {
    archiveCurrentSession(label.trim() || defaultLabel());
    setLabel('');
    setOpen(true);
  };

  return (
    <div className="border-t border-slate-100 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-800"
        >
          <Archive className="h-4 w-4 text-emerald-600" />
          Dağıtım Geçmişi
          {items.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
              {items.length}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        <div className="flex items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={defaultLabel()}
            disabled={!canArchive}
            className="hidden w-48 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none disabled:opacity-50 sm:block"
          />
          <button
            type="button"
            onClick={handleArchive}
            disabled={!canArchive}
            title={
              canArchive
                ? 'Mevcut dağıtımı geçmişe kaydet'
                : 'Önce rota oluşturun'
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Save className="h-4 w-4" />
            Bu Dağıtımı Arşivle
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3">
          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
              Henüz arşivlenmiş dağıtım yok. Bir dağıtımı tamamlayıp
              &quot;Bu Dağıtımı Arşivle&quot; ile buraya kaydedin.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {a.label}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {fmtDate(a.archivedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => exportDeliveryReportToExcel(a.routes, [])}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        Rapor
                      </button>
                      <button
                        type="button"
                        onClick={() => removeArchive(a.id)}
                        title="Arşivden sil"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                      <Truck className="h-3 w-3" />
                      {a.vehicleCount} araç
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      {a.delivered}/{a.totalStops} teslim
                    </span>
                    {a.notHome > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                        <Home className="h-3 w-3" />
                        {a.notHome} evde yok
                      </span>
                    )}
                    {a.pending > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">
                        <Clock className="h-3 w-3" />
                        {a.pending} bekliyor
                      </span>
                    )}
                    <span className="text-slate-400">
                      {a.totalBoxes} koli ·{' '}
                      {a.totalDistanceKm >= 10
                        ? a.totalDistanceKm.toFixed(0)
                        : a.totalDistanceKm.toFixed(1)}{' '}
                      km
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
