'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
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
  Radio,
  Loader2,
  CircleStop,
  Cloud,
  CloudOff,
  AlertTriangle,
  MapPin,
  Printer,
} from 'lucide-react';

import { useDeliveryStore } from '@/store/useDeliveryStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { exportDeliveryReportToExcel } from '@/lib/excelUtils';
import { printDriverSheets } from '@/lib/printDriverSheet';
import UndeliveredPanel from '@/components/route/UndeliveredPanel';
import HistoryPanel from '@/components/route/HistoryPanel';
import LiveDeliveryReport from '@/components/route/LiveDeliveryReport';
import { createShare, fetchShare } from '@/services/shareService';
import {
  sharedToVehicleRoute,
  type SharedRoute,
  type DriverLocation,
  type RouteCompletion,
} from '@/lib/shareSerialization';
import type { SanitizedAddress } from '@/types/address';
import type { VehicleRoute } from '@/types/fleet';

// Leaflet SSR-güvensiz → yalnızca istemcide yükle.
const LiveTrackingMap = dynamic(
  () => import('@/components/map/LiveTrackingMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Harita yükleniyor…
      </div>
    ),
  },
);

interface LiveCount {
  delivered: number;
  total: number;
}

export default function RouteExportPanel() {
  const hydrated = useHasHydrated();
  const routes = useDeliveryStore((s) => s.routes);
  const sanitizedAddresses = useDeliveryStore((s) => s.sanitizedAddresses);
  const shareId = useDeliveryStore((s) => s.shareId);
  const setShareId = useDeliveryStore((s) => s.setShareId);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const [live, setLive] = useState<Record<string, LiveCount>>({});
  const [liveError, setLiveError] = useState<string | null>(null);
  const [sharedRoutes, setSharedRoutes] = useState<SharedRoute[]>([]);
  const [driverLocs, setDriverLocs] = useState<DriverLocation[]>([]);
  const [completions, setCompletions] = useState<RouteCompletion[]>([]);

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

  const driverUrl = (vehicleId: string) => {
    const base = `${origin}/driver/${encodeURIComponent(vehicleId)}`;
    return shareId ? `${base}?sid=${encodeURIComponent(shareId)}` : base;
  };

  // Canlı paylaşım açıkken sunucuyu kısa aralıklarla yokla (polling) → şoförün
  // işaretlediği teslimatlar yönetici panelinde canlı görünsün.
  useEffect(() => {
    if (!shareId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const snapshot = await fetchShare(shareId);
        if (cancelled) return;
        const next: Record<string, LiveCount> = {};
        for (const r of snapshot.routes) {
          next[r.vehicleId] = {
            delivered: r.stops.filter((s) => s.status === 'DELIVERED').length,
            total: r.stops.length,
          };
        }
        setLive(next);
        setSharedRoutes(snapshot.routes);
        setDriverLocs(snapshot.driverLocations ?? []);
        setCompletions(snapshot.completions ?? []);
        setLiveError(null);
      } catch (error) {
        if (cancelled) return;
        setLiveError(
          error instanceof Error ? error.message : 'Canlı veri alınamadı.',
        );
      }
    };

    poll();
    const intervalId = window.setInterval(poll, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [shareId]);

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
    // Canlı yayın açıkken rapor, şoförün işaretlediği güncel durumları içerir.
    exportDeliveryReportToExcel(reportRoutes, unassigned);
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      const result = await createShare(routes);
      setShareId(result.shareId);
      setPersistent(result.persistent);
    } catch (error) {
      setPublishError(
        error instanceof Error ? error.message : 'Paylaşım başlatılamadı.',
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleStop = () => {
    setShareId(null);
    setPersistent(null);
    setLive({});
    setSharedRoutes([]);
    setDriverLocs([]);
    setCompletions([]);
    setLiveError(null);
  };

  // Rapor & indirme kaynağı: canlı yayın açıkken sunucudaki GÜNCEL durumlar
  // (şoförün işaretledikleri) kullanılır; aksi halde yerel (planlanan) rotalar.
  const reportRoutes: VehicleRoute[] =
    shareId && sharedRoutes.length > 0
      ? sharedRoutes.map(sharedToVehicleRoute)
      : routes;

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
              Canlı paylaşımı başlatın; QR/şoför linki her cihazda açılır ve
              teslimatlar buraya canlı düşer.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => printDriverSheets(routes)}
            disabled={!hasRoutes}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Föyleri Yazdır
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!hasRoutes}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <FileDown className="h-4 w-4" />
            Excel Raporu İndir
          </button>
        </div>
      </div>

      {/* Eksik / ulaşılamayan teslimatların yönetimi (Özellik 2) */}
      {hasRoutes && <UndeliveredPanel />}

      {/* Canlı paylaşım kontrol çubuğu */}
      {hasRoutes && (
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5">
          {!shareId ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2 text-xs text-slate-600">
                <Radio className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong className="text-slate-800">Canlı Paylaşım</strong> —
                  rotaları sunucuya yayınlar; şoför QR/linki telefonda açtığında
                  rota yüklenir, işaretlediği teslimatlar bu panele canlı yansır.
                </span>
              </div>
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Radio className="h-4 w-4" />
                )}
                Canlı Paylaşımı Başlat
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
                  </span>
                  CANLI YAYINDA
                </span>
                {persistent === false ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700"
                    title="Geçici (in-memory) depolama: sunucu yeniden başlarsa paylaşım kaybolur. Kalıcı yayın için Upstash env değişkenlerini tanımlayın."
                  >
                    <CloudOff className="h-3 w-3" />
                    Geçici depolama
                  </span>
                ) : persistent === true ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-[11px] font-semibold text-sky-700">
                    <Cloud className="h-3 w-3" />
                    Kalıcı depolama
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                <CircleStop className="h-4 w-4" />
                Paylaşımı Durdur
              </button>
            </div>
          )}

          {publishError && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {publishError}
            </p>
          )}
          {shareId && liveError && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              Canlı güncelleme duraklıyor: {liveError}
            </p>
          )}
        </div>
      )}

      {/* Canlı takip haritası */}
      {shareId && (
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <MapPin className="h-4 w-4 text-emerald-600" />
              Canlı Takip Haritası
            </h4>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                driverLocs.length > 0
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Truck className="h-3 w-3" />
              {driverLocs.length} şoför canlı
            </span>
          </div>

          <div className="relative h-[360px] overflow-hidden rounded-xl border border-slate-200">
            <LiveTrackingMap routes={sharedRoutes} driverLocations={driverLocs} />
            {driverLocs.length === 0 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/95 to-transparent px-4 py-3 text-center text-xs text-slate-500">
                Şoför, telefonundaki{' '}
                <strong className="text-slate-700">“Canlı Konumu Paylaş”</strong>{' '}
                düğmesini açınca konumu burada anlık görünür.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Canlı dağıtım raporu — şoförlerin işaretledikleri anlık yansır */}
      {hasRoutes && (
        <LiveDeliveryReport
          routes={reportRoutes}
          completions={completions}
          live={Boolean(shareId)}
        />
      )}

      <div className="p-5">
        {!hasRoutes ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
            Önce Adım 3&apos;te rota hesaplayın. Ardından her araç için şoför
            linki ve QR kodu burada belirir.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {routes.map((route) => {
              const liveCount = shareId ? live[route.vehicleId] : undefined;
              const delivered =
                liveCount?.delivered ??
                route.stops.filter((s) => s.status === 'DELIVERED').length;
              const total = liveCount?.total ?? route.stops.length;
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
                        {shareId && liveCount ? (
                          <Radio className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {delivered}/{total} teslim · {route.stops.length} durak
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
                      {shareId ? `?sid=${shareId}` : ''}
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
                    <button
                      type="button"
                      onClick={() => printDriverSheets([route])}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Föyü Yazdır
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dağıtım geçmişi / arşiv (Özellik 7) */}
      <HistoryPanel />
    </section>
  );
}
