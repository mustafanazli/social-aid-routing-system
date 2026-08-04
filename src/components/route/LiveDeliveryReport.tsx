'use client';

import { useMemo, useState } from 'react';
import {
  ClipboardList,
  CheckCircle2,
  Home,
  Clock,
  Truck,
  ChevronDown,
  BadgeCheck,
  MessageSquare,
} from 'lucide-react';

import type { VehicleRoute } from '@/types/fleet';
import type { RouteCompletion } from '@/lib/shareSerialization';

interface LiveDeliveryReportProps {
  /** Rapor kaynağı — canlı modda sunucudan gelen güncel rotalar. */
  routes: VehicleRoute[];
  /** Şoförlerin gönderdiği tamamlama bildirimleri. */
  completions: RouteCompletion[];
  /** Canlı yayın açık mı (rozet + "canlı" ibaresi). */
  live: boolean;
}

function fmtTime(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Yönetici ekranında CANLI dağıtım raporu (Faz: kurumsal takip).
 * Şoförlerin işaretlediği teslim/evde-yok durumları buraya anlık yansır;
 * her araç için özet + durak durumları + "rapor teslim edildi" damgası gösterir.
 */
export default function LiveDeliveryReport({
  routes,
  completions,
  live,
}: LiveDeliveryReportProps) {
  const [openVehicle, setOpenVehicle] = useState<string | null>(null);

  const totals = useMemo(() => {
    const stops = routes.flatMap((r) => r.stops);
    const delivered = stops.filter((s) => s.status === 'DELIVERED').length;
    const notHome = stops.filter((s) => s.status === 'NOT_HOME').length;
    const pending = stops.filter(
      (s) => s.status === 'PENDING' || s.status === 'CANCELLED',
    ).length;
    const total = stops.length;
    const pct = total > 0 ? Math.round(((delivered + notHome) / total) * 100) : 0;
    return { delivered, notHome, pending, total, pct };
  }, [routes]);

  const completionByVehicle = useMemo(() => {
    const map = new Map<string, RouteCompletion>();
    for (const c of completions) map.set(c.vehicleId, c);
    return map;
  }, [completions]);

  if (routes.length === 0) return null;

  const allDone = totals.total > 0 && totals.pending === 0;

  return (
    <div className="border-b border-slate-100 px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <ClipboardList className="h-4 w-4 text-emerald-600" />
          Canlı Dağıtım Raporu
        </h4>
        {live && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
            </span>
            CANLI
          </span>
        )}
      </div>

      {/* Genel özet (KPI) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Teslim" value={totals.delivered} cls="text-emerald-700 bg-emerald-50" icon={<CheckCircle2 className="h-4 w-4" />} />
        <Kpi label="Evde Yok" value={totals.notHome} cls="text-amber-700 bg-amber-50" icon={<Home className="h-4 w-4" />} />
        <Kpi label="Bekleyen" value={totals.pending} cls="text-slate-600 bg-slate-100" icon={<Clock className="h-4 w-4" />} />
        <Kpi label="Toplam" value={totals.total} cls="text-sky-700 bg-sky-50" icon={<Truck className="h-4 w-4" />} />
      </div>

      {/* İlerleme çubuğu */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600">
            İşlenen: {totals.delivered + totals.notHome}/{totals.total}
          </span>
          <span className="font-semibold text-emerald-700">%{totals.pct}</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              allDone ? 'bg-emerald-600' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
            }`}
            style={{ width: `${totals.pct}%` }}
          />
        </div>
      </div>

      {/* Araç bazlı canlı durum */}
      <ul className="mt-3 space-y-2">
        {routes.map((r) => {
          const stops = r.stops;
          const delivered = stops.filter((s) => s.status === 'DELIVERED').length;
          const notHome = stops.filter((s) => s.status === 'NOT_HOME').length;
          const pending = stops.filter(
            (s) => s.status === 'PENDING' || s.status === 'CANCELLED',
          ).length;
          const done = stops.length > 0 && pending === 0;
          const completion = completionByVehicle.get(r.vehicleId);
          const isOpen = openVehicle === r.vehicleId;

          return (
            <li
              key={r.vehicleId}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              style={{ borderLeft: `4px solid ${r.vehicleColor}` }}
            >
              <button
                type="button"
                onClick={() => setOpenVehicle(isOpen ? null : r.vehicleId)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ background: r.vehicleColor }}
                >
                  <Truck className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {r.vehicleName}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium">
                    <span className="text-emerald-700">{delivered} teslim</span>
                    {notHome > 0 && <span className="text-amber-700">{notHome} evde yok</span>}
                    {pending > 0 && <span className="text-slate-500">{pending} bekliyor</span>}
                  </span>
                </span>

                {completion ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700"
                    title={`Rapor teslim edildi: ${fmtTime(completion.completedAt)}`}
                  >
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Rapor alındı
                  </span>
                ) : done ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                    Tamamlandı
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-600">
                    Sürüyor
                  </span>
                )}

                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Şoför notu (varsa) */}
              {completion?.note && (
                <p className="mx-3 mb-2 flex items-start gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
                  <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                  <span>
                    <strong>Şoför notu:</strong> {completion.note}
                  </span>
                </p>
              )}

              {isOpen && (
                <ul className="divide-y divide-slate-100 border-t border-slate-100">
                  {[...stops]
                    .sort((a, b) => a.stopOrder - b.stopOrder)
                    .map((s) => {
                      const cls =
                        s.status === 'DELIVERED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : s.status === 'NOT_HOME'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-500';
                      const label =
                        s.status === 'DELIVERED'
                          ? 'Teslim'
                          : s.status === 'NOT_HOME'
                            ? 'Evde yok'
                            : s.status === 'CANCELLED'
                              ? 'İptal'
                              : 'Bekliyor';
                      return (
                        <li
                          key={s.stopOrder}
                          className="flex items-center gap-2 px-3 py-2"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-600">
                            {s.stopOrder}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-slate-800">
                              {s.location.recipientName || 'İsimsiz alıcı'}
                            </p>
                            <p className="truncate text-[11px] text-slate-500">
                              {s.location.neighborhood || s.location.cleanAddress}
                              {s.location.boxCount ? ` · ${s.location.boxCount} koli` : ''}
                            </p>
                          </div>
                          {s.updatedAt && s.status !== 'PENDING' && (
                            <span className="shrink-0 text-[10px] text-slate-400">
                              {fmtTime(s.updatedAt)}
                            </span>
                          )}
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}
                          >
                            {label}
                          </span>
                        </li>
                      );
                    })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Kpi({
  label,
  value,
  cls,
  icon,
}: {
  label: string;
  value: number;
  cls: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl px-3 py-2 ${cls}`}>
      <div className="flex items-center gap-1 text-[11px] font-semibold opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-xl font-black">{value}</div>
    </div>
  );
}
