'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Share2,
  FileDown,
  ExternalLink,
  Copy,
  Check,
  Truck,
  CheckCircle2,
  QrCode,
} from 'lucide-react';

import { useDeliveryStore } from '@/store/useDeliveryStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { exportDeliveryReportToExcel } from '@/lib/excelUtils';
import type { SanitizedAddress } from '@/types/address';

export default function RouteExportPanel() {
  const hydrated = useHasHydrated();
  const routes = useDeliveryStore((s) => s.routes);
  const sanitizedAddresses = useDeliveryStore((s) => s.sanitizedAddresses);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Şoför linkleri için origin yalnızca istemcide bilinir (SSR uyumu):
  // effect'te setState yerine dış kaynak anlık görüntüsü olarak okunur.
  const origin = useSyncExternalStore(
    () => () => {}, // origin değişmez → aboneliğe gerek yok.
    () => window.location.origin,
    () => '', // SSR anlık görüntüsü.
  );

  const hasRoutes = hydrated && routes.length > 0;

  // Rotaya atanmamış (ör. geocode başarısız) adresler — rapora "Atanmadı" girer.
  const unassigned = useMemo<SanitizedAddress[]>(() => {
    if (!hydrated) return [];
    const assignedIds = new Set(
      routes.flatMap((r) => r.stops.map((s) => s.location.id)),
    );
    return sanitizedAddresses.filter((a) => !assignedIds.has(a.id));
  }, [hydrated, routes, sanitizedAddresses]);

  const driverUrl = (vehicleId: string) =>
    `${origin}/driver/${encodeURIComponent(vehicleId)}`;

  const handleCopy = async (vehicleId: string) => {
    try {
      await navigator.clipboard.writeText(driverUrl(vehicleId));
      setCopiedId(vehicleId);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard erişimi yoksa sessiz geç */
    }
  };

  const handleExport = () => {
    exportDeliveryReportToExcel(routes, unassigned);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Başlık + Excel indir */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
            4
          </span>
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Share2 className="h-4 w-4 text-emerald-600" />
              Şoför Paylaşımı &amp; Rapor
            </h3>
            <p className="text-xs text-slate-500">
              Her araç için QR/şoför linki üretin; gün sonunda dağıtım raporunu
              indirin.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={!hasRoutes}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <FileDown className="h-4 w-4" />
          Dağıtım Raporunu Excel Olarak İndir
        </button>
      </div>

      <div className="p-5">
        {!hasRoutes ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
            Önce Adım 3&apos;te rota hesaplayın. Ardından her araç için şoför
            linki ve QR kodu burada belirir.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {routes.map((route) => {
              const delivered = route.stops.filter(
                (s) => s.status === 'DELIVERED',
              ).length;
              const url = driverUrl(route.vehicleId);
              const copied = copiedId === route.vehicleId;

              return (
                <div
                  key={route.vehicleId}
                  className="flex flex-col overflow-hidden rounded-xl border border-slate-200"
                  style={{ borderTop: `3px solid ${route.vehicleColor}` }}
                >
                  <div className="flex items-center gap-2 px-4 py-3">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                      style={{ background: route.vehicleColor }}
                    >
                      <Truck className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {route.vehicleName}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <CheckCircle2 className="h-3 w-3" />
                        {delivered}/{route.stops.length} teslim ·{' '}
                        {route.stops.length} durak
                      </p>
                    </div>
                  </div>

                  {/* QR kod */}
                  <div className="flex justify-center border-y border-slate-100 bg-slate-50 py-4">
                    {origin ? (
                      <div className="rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-200">
                        <QRCodeSVG value={url} size={116} level="M" />
                      </div>
                    ) : (
                      <div className="flex h-[132px] w-[132px] items-center justify-center text-slate-300">
                        <QrCode className="h-8 w-8" />
                      </div>
                    )}
                  </div>

                  {/* Link + eylemler */}
                  <div className="flex flex-col gap-2 p-3">
                    <code className="truncate rounded-md bg-slate-100 px-2 py-1.5 text-[11px] text-slate-600">
                      /driver/{route.vehicleId}
                    </code>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(route.vehicleId)}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            Kopyalandı
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Linki Kopyala
                          </>
                        )}
                      </button>
                      <a
                        href={url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Şoför Ekranını Aç
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
