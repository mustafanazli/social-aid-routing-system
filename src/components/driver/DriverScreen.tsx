'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Truck,
  ArrowLeft,
  CheckCircle2,
  MapPinned,
  LocateFixed,
  Loader2,
  Map as MapIcon,
  Navigation,
  AlertTriangle,
  ListChecks,
  RotateCcw,
  Home as HomeIcon,
  PackageCheck,
  ChevronDown,
  Radio,
  Send,
  BadgeCheck,
} from 'lucide-react';

import { useDeliveryStore } from '@/store/useDeliveryStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import {
  fetchShare,
  patchStop,
  patchDriverLocation,
  patchRouteCompletion,
} from '@/services/shareService';
import { sharedToVehicleRoute } from '@/lib/shareSerialization';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useCountUp } from '@/hooks/useCountUp';
import {
  buildGoogleMapsRouteUrl,
  buildYandexMapsRouteUrl,
  type Point,
} from '@/lib/navigationLinks';
import DriverHeroCard from '@/components/driver/DriverHeroCard';
import type {
  StopItem,
  StopStatus,
  DeliveryProof,
  VehicleRoute,
} from '@/types/fleet';

interface DriverScreenProps {
  routeId: string;
  /** Canlı paylaşım kimliği — verilmişse rota sunucudan çekilir. */
  shareId?: string | null;
}

type ServerStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Sunucudan gelen taze rotayı, yerelde tutulan gerçek kanıt görselleriyle
 * birleştirir. Sunucu kanıt görselini taşımaz (yalnızca "kanıt var" bilgisi);
 * bu cihazda az önce çekilen görsel varsa gösterim için korunur.
 */
function mergeLocalProofs(
  fresh: VehicleRoute,
  prev: VehicleRoute | null,
): VehicleRoute {
  if (!prev) return fresh;
  const prevByOrder = new Map(prev.stops.map((s) => [s.stopOrder, s.proof]));
  return {
    ...fresh,
    stops: fresh.stops.map((s) => {
      const localProof = prevByOrder.get(s.stopOrder);
      if (s.proof && localProof && localProof.dataUrl) {
        return { ...s, proof: localProof };
      }
      return s;
    }),
  };
}

/** Mobil şoför dağıtım ekranı (kurye standardı) — /driver/[routeId]. */
export default function DriverScreen({ routeId, shareId }: DriverScreenProps) {
  const hydrated = useHasHydrated();
  const routes = useDeliveryStore((s) => s.routes);
  const updateStopStatus = useDeliveryStore((s) => s.updateStopStatus);
  const setStopProof = useDeliveryStore((s) => s.setStopProof);

  const isLive = Boolean(shareId);
  const [serverRoute, setServerRoute] = useState<VehicleRoute | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus>(
    shareId ? 'loading' : 'idle',
  );
  const [serverError, setServerError] = useState<string | null>(null);

  const [busy, setBusy] = useState<'deliver' | 'nothome' | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [sharingLoc, setSharingLoc] = useState(false);
  // Dağıtım tamamlama raporu (canlı mod).
  const [reportNote, setReportNote] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportSentAt, setReportSentAt] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // Canlı mod: rotayı sunucudan çek ve kısa aralıklarla tazele (yönetici
  // sıralama değiştirirse yansısın). İlk yükleme hatası kritik; sonraki
  // yoklama hataları sessiz geçilir (geçici ağ kesintisi UI'ı bozmasın).
  useEffect(() => {
    if (!shareId) return;
    let cancelled = false;

    const load = async (initial: boolean) => {
      try {
        const snapshot = await fetchShare(shareId);
        if (cancelled) return;
        const shared = snapshot.routes.find((r) => r.vehicleId === routeId);
        if (!shared) {
          setServerStatus('error');
          setServerError('Bu araç için paylaşımda rota bulunamadı.');
          return;
        }
        setServerRoute((prev) =>
          mergeLocalProofs(sharedToVehicleRoute(shared), prev),
        );
        // Bu araç için daha önce "dağıtımı tamamla" raporu gönderilmişse
        // (başka cihaz/yeniden yükleme) durumu koru.
        const mine = (snapshot.completions ?? []).find(
          (c) => c.vehicleId === routeId,
        );
        if (mine) setReportSentAt(mine.completedAt);
        setServerStatus('ready');
        setServerError(null);
      } catch (error) {
        if (cancelled || !initial) return;
        setServerStatus('error');
        setServerError(
          error instanceof Error ? error.message : 'Rota yüklenemedi.',
        );
      }
    };

    load(true);
    const intervalId = window.setInterval(() => load(false), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [shareId, routeId]);

  // Durum güncellemesini uygun hedefe yazar: canlı modda sunucuya (iyimser
  // yerel güncelleme + PATCH), yerel modda Zustand store'una.
  const applyStatus = useCallback(
    (
      vehicleId: string,
      stopOrder: number,
      status: StopStatus,
      proof?: DeliveryProof,
    ) => {
      if (isLive && shareId) {
        setServerRoute((prev) =>
          prev
            ? {
                ...prev,
                stops: prev.stops.map((s) =>
                  s.stopOrder === stopOrder
                    ? {
                        ...s,
                        status,
                        updatedAt: new Date().toISOString(),
                        proof: proof ?? s.proof,
                      }
                    : s,
                ),
              }
            : prev,
        );
        patchStop(shareId, {
          vehicleId,
          stopOrder,
          status,
          hasProof: Boolean(proof),
        }).catch((error) =>
          setServerError(
            error instanceof Error
              ? error.message
              : 'Güncelleme sunucuya gönderilemedi.',
          ),
        );
      } else {
        updateStopStatus(vehicleId, stopOrder, status);
        if (proof) setStopProof(vehicleId, stopOrder, proof);
      }
    },
    [isLive, shareId, updateStopStatus, setStopProof],
  );

  const {
    coords: driverCoords,
    status: locationStatus,
    isFallback: locationIsFallback,
    requestLocation,
  } = useCurrentLocation();

  // Canlı konum paylaşımı açıkken GPS'i başlat ve 15 sn'de bir tazele.
  useEffect(() => {
    if (!isLive || !shareId || !sharingLoc) return;
    requestLocation();
    const id = window.setInterval(() => requestLocation(), 15000);
    return () => window.clearInterval(id);
  }, [isLive, shareId, sharingLoc, requestLocation]);

  // Gerçek GPS konumu alındıkça sunucuya gönder (yedek/belediye konumu gönderilmez).
  useEffect(() => {
    if (!isLive || !shareId || !sharingLoc) return;
    if (locationStatus !== 'success' || !driverCoords) return;
    patchDriverLocation(shareId, {
      vehicleId: routeId,
      lat: driverCoords.lat,
      lng: driverCoords.lng,
    }).catch(() => {
      /* geçici ağ hatası — bir sonraki tazelemede yeniden denenir */
    });
  }, [isLive, shareId, sharingLoc, locationStatus, driverCoords, routeId]);

  const storeRoute = useMemo(
    () => routes.find((r) => r.vehicleId === routeId),
    [routes, routeId],
  );
  // Canlı modda kaynak sunucudur; aksi halde yerel store.
  const route = isLive ? serverRoute ?? undefined : storeRoute;

  const activeStopOrder = useMemo(() => {
    if (!route) return null;
    const pending = [...route.stops]
      .sort((a, b) => a.stopOrder - b.stopOrder)
      .find((s) => s.status === 'PENDING');
    return pending?.stopOrder ?? null;
  }, [route]);

  const completedCount = route
    ? route.stops.filter(
        (s) => s.status === 'DELIVERED' || s.status === 'NOT_HOME',
      ).length
    : 0;
  const animatedCompleted = useCountUp(completedCount, 700);

  const showLoading = isLive
    ? serverStatus === 'idle' || serverStatus === 'loading'
    : !hydrated;

  if (showLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {isLive ? 'Canlı rota yükleniyor…' : 'Yükleniyor…'}
      </div>
    );
  }

  if (!route) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
        <MapPinned className="h-10 w-10 text-slate-400" />
        <p className="text-base font-semibold text-slate-900">Rota bulunamadı</p>
        <p className="text-sm text-slate-600">
          {isLive ? (
            <>
              {serverError ??
                'Canlı paylaşım bulunamadı veya süresi dolmuş olabilir.'}{' '}
              Yönetici panelinden paylaşımı yeniden başlatın.
            </>
          ) : (
            <>
              Bu cihazda{' '}
              <strong className="text-slate-800">{routeId}</strong> için
              hesaplanmış bir rota yok. Rotalar yönetici panelinde oluşturulur.
            </>
          )}
        </p>
        <Link
          href="/"
          className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          Yönetici Paneli
        </Link>
      </div>
    );
  }

  const sortedStops = [...route.stops].sort((a, b) => a.stopOrder - b.stopOrder);
  const total = route.stops.length;
  const completed = completedCount;
  const activeStop = sortedStops.find((s) => s.stopOrder === activeStopOrder);
  const otherStops = sortedStops.filter(
    (s) => s.stopOrder !== activeStopOrder,
  );
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const today = new Date().toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    weekday: 'long',
  });

  const handleComplete = (
    stop: StopItem,
    status: StopStatus,
    proof?: DeliveryProof,
  ) => {
    applyStatus(route.vehicleId, stop.stopOrder, status, proof);
  };

  // Teslim: yanlışlıkla basmayı önlemek için küçük bir onay penceresi çıkar,
  // onaylanırsa kısa bir "kaydediliyor" hissiyle durağı teslim edildi yapar.
  const handleDeliver = () => {
    if (!activeStop) return;
    const name = activeStop.location.recipientName || 'Alıcı';
    const ok = window.confirm(
      `"${name}" için koli teslim edildi olarak işaretlensin mi?`,
    );
    if (!ok) return;
    setBusy('deliver');
    window.setTimeout(() => {
      handleComplete(activeStop, 'DELIVERED');
      setBusy(null);
    }, 350);
  };

  // Dokunma hissi için kısa "kaydediliyor" efekti, ardından işlemi uygula.
  const handleNotHome = () => {
    if (!activeStop) return;
    setBusy('nothome');
    window.setTimeout(() => {
      handleComplete(activeStop, 'NOT_HOME');
      setBusy(null);
    }, 450);
  };

  // Dağıtımı tamamla: o anki durum özetini + isteğe bağlı notu yöneticiye iletir.
  const handleSubmitReport = async () => {
    if (!isLive || !shareId || !route) return;
    setReportSending(true);
    setReportError(null);
    try {
      await patchRouteCompletion(shareId, {
        type: 'route-complete',
        vehicleId: route.vehicleId,
        ...(reportNote.trim() ? { note: reportNote.trim() } : {}),
      });
      setReportSentAt(new Date().toISOString());
    } catch (error) {
      setReportError(
        error instanceof Error ? error.message : 'Rapor gönderilemedi.',
      );
    } finally {
      setReportSending(false);
    }
  };

  const deliveredCount = route.stops.filter(
    (s) => s.status === 'DELIVERED',
  ).length;
  const notHomeCount = route.stops.filter(
    (s) => s.status === 'NOT_HOME',
  ).length;

  // Başlangıç noktası YALNIZCA gerçek canlı GPS varsa eklenir. Yedek (belediye)
  // konumu başlangıç olarak konmaz — aksi halde harita bunu "0. durak" gibi ilk
  // sıraya koyup gerçek ilk teslimat durağını 2. sıraya itiyordu. Canlı konum
  // yoksa rota doğrudan ilk teslimat durağından başlar (harita cihaz konumunu
  // kendisi başlangıç kabul eder).
  const liveOrigin: Point | null =
    locationStatus === 'success' && !locationIsFallback && driverCoords
      ? driverCoords
      : null;
  // Toplu rota: yalnızca KALAN (henüz teslim edilmemiş) duraklar, sıra sırasıyla.
  // Böylece harita servisleri tamamlanmış duraklara geri dönmeden ilerler.
  const remainingStops = sortedStops.filter((s) => s.status === 'PENDING');
  const bulkStops = remainingStops.length > 0 ? remainingStops : sortedStops;
  const stopPoints: Point[] = bulkStops
    .map((s) => ({ lat: s.location.lat, lng: s.location.lng }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const googleRouteUrl = buildGoogleMapsRouteUrl(liveOrigin, stopPoints);
  const yandexRouteUrl = buildYandexMapsRouteUrl(liveOrigin, stopPoints);
  // Not: Apple Haritalar URL şeması çok duraklı rotayı desteklemediğinden toplu
  // rota bölümünde yer almaz; Apple yalnızca tek-tek durak navigasyonunda bulunur.
  const canBulkNavigate = stopPoints.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-32 text-slate-900">
      {/* ---- Sabit üst bilgi ---- */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-md px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/"
              className="rounded-lg p-1.5 text-slate-600 active:scale-90 active:bg-slate-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0 flex-1 text-center">
              <p
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-black tracking-wide"
                style={{
                  backgroundColor: `${route.vehicleColor}22`,
                  color: route.vehicleColor,
                }}
              >
                <Truck className="h-4 w-4" />
                {route.vehicleName}
              </p>
              <p className="mt-0.5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                {isLive && (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </span>
                    Canlı
                  </span>
                )}
                {isLive && <span className="text-slate-300">·</span>}
                Şoför Paneli · {today}
              </p>
            </div>
            <div className="w-8" />
          </div>

          {/* İlerleme */}
          <div className="mt-3">
            <div className="mb-1.5 flex items-end justify-between">
              <p className="text-sm font-semibold text-slate-700">
                Sıradaki Durak{' '}
                <span className="text-xl font-black text-slate-900">
                  {activeStop ? activeStop.stopOrder : total}
                </span>
                <span className="text-slate-400"> / {total}</span>
              </p>
              <p className="text-xs font-medium text-emerald-600">
                {Math.round(animatedCompleted)}/{total} tamamlandı
              </p>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        {/* ---- Canlı konum paylaşımı (yalnızca canlı modda) ---- */}
        {isLive && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setSharingLoc((v) => !v)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  sharingLoc
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {sharingLoc ? (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
                  </span>
                ) : (
                  <Radio className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-800">
                  {sharingLoc
                    ? 'Canlı konum paylaşılıyor'
                    : 'Canlı Konumu Paylaş'}
                </span>
                <span className="block text-xs text-slate-500">
                  {sharingLoc
                    ? locationStatus === 'success'
                      ? 'Yönetici sizi haritada canlı görüyor.'
                      : 'Konum bekleniyor… (izin verin)'
                    : 'Yöneticinin sizi haritada görmesi için açın.'}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  sharingLoc
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {sharingLoc ? 'AÇIK' : 'KAPALI'}
              </span>
            </button>
          </div>
        )}

        {/* ---- Toplu rota (ikincil) ---- */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setShowBulk((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left"
          >
            <MapIcon className="h-4 w-4 text-sky-600" />
            <span className="flex-1 text-sm font-semibold text-slate-700">
              {remainingStops.length > 0
                ? `Kalan Rotayı Haritada Aç (${remainingStops.length} durak)`
                : 'Rotayı Haritada Aç'}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform ${
                showBulk ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showBulk && (
            <div className="space-y-2.5 border-t border-slate-200 p-3">
              <button
                type="button"
                onClick={requestLocation}
                disabled={locationStatus === 'loading'}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-700 transition active:scale-95 disabled:opacity-60"
              >
                {locationStatus === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LocateFixed className="h-4 w-4 text-blue-600" />
                )}
                Rotayı Buradan Başlat
              </button>

              {locationStatus === 'success' && (
                <p className="flex items-center gap-1.5 text-[11px] text-emerald-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                  Canlı konum alındı.
                </p>
              )}
              {locationIsFallback && (
                <p className="flex items-center gap-1.5 text-[11px] text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  Konum alınamadı — Pendik Belediyesi (yedek).
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={canBulkNavigate ? googleRouteUrl : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!canBulkNavigate}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white transition active:scale-95 ${
                    canBulkNavigate
                      ? 'bg-blue-600'
                      : 'pointer-events-none bg-slate-200 text-slate-400'
                  }`}
                >
                  <MapIcon className="h-4 w-4" />
                  Google
                </a>
                <a
                  href={canBulkNavigate ? yandexRouteUrl : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!canBulkNavigate}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition active:scale-95 ${
                    canBulkNavigate
                      ? 'bg-amber-400 text-slate-900'
                      : 'pointer-events-none bg-slate-200 text-slate-400'
                  }`}
                >
                  <Navigation className="h-4 w-4" />
                  Yandex
                </a>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">
                Google ve Yandex tüm durakları sırayla açar. Google bazen sırayı
                kendi optimize edebilir; sıra kritikse Yandex daha sadıktır.
              </p>
            </div>
          )}
        </div>

        {/* ---- Kahraman kart / tamamlandı ---- */}
        {activeStop ? (
          <DriverHeroCard
            stop={activeStop}
            total={total}
            driverCoords={locationStatus === 'success' ? driverCoords : null}
          />
        ) : (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <PackageCheck className="h-12 w-12 text-emerald-600" />
              <p className="text-lg font-black text-slate-900">
                Tüm duraklar tamamlandı! 🎉
              </p>
              <p className="text-sm text-slate-600">
                {total} durağın tamamı işlendi. Teşekkürler!
              </p>
            </div>

            {/* Özet */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white px-3 py-2 text-center ring-1 ring-emerald-100">
                <p className="text-2xl font-black text-emerald-600">
                  {deliveredCount}
                </p>
                <p className="text-[11px] font-semibold text-slate-500">
                  Teslim edildi
                </p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2 text-center ring-1 ring-amber-100">
                <p className="text-2xl font-black text-amber-600">
                  {notHomeCount}
                </p>
                <p className="text-[11px] font-semibold text-slate-500">
                  Evde yok
                </p>
              </div>
            </div>

            {/* Canlı modda: raporu yöneticiye gönder */}
            {isLive &&
              (reportSentAt ? (
                <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">
                  <BadgeCheck className="h-5 w-5" />
                  Rapor yöneticiye iletildi ·{' '}
                  {new Date(reportSentAt).toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              ) : (
                <div className="mt-4">
                  <textarea
                    value={reportNote}
                    onChange={(e) => setReportNote(e.target.value)}
                    rows={2}
                    placeholder="İsteğe bağlı not (ör. 2 hane ulaşılamadı, koliler depoya döndü)…"
                    className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSubmitReport}
                    disabled={reportSending}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-base font-black text-white shadow-md shadow-emerald-500/30 transition active:scale-95 disabled:opacity-70"
                  >
                    {reportSending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                    Dağıtımı Tamamla ve Raporu Gönder
                  </button>
                  {reportError && (
                    <p className="mt-1.5 text-center text-xs font-medium text-rose-600">
                      {reportError}
                    </p>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* ---- Diğer duraklar (timeline) ---- */}
        {otherStops.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
              <ListChecks className="h-4 w-4" />
              Aşağıdaki Duraklar ({otherStops.length})
            </p>
            <ul className="space-y-2">
              {otherStops.map((stop) => {
                const isDone =
                  stop.status === 'DELIVERED' || stop.status === 'NOT_HOME';
                return (
                  <li
                    key={stop.stopOrder}
                    className={`flex items-center gap-3 rounded-2xl border p-3 ${
                      isDone
                        ? 'border-slate-200 bg-slate-100'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                        stop.status === 'DELIVERED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : stop.status === 'NOT_HOME'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {stop.status === 'DELIVERED' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : stop.status === 'NOT_HOME' ? (
                        <HomeIcon className="h-4 w-4" />
                      ) : (
                        stop.stopOrder
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-semibold ${
                          isDone
                            ? 'text-slate-400 line-through'
                            : 'text-slate-900'
                        }`}
                      >
                        {stop.location.recipientName || 'İsimsiz alıcı'}
                      </p>
                      <p
                        className={`truncate text-xs ${
                          isDone ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        {stop.location.neighborhood || stop.location.cleanAddress}
                        {' · '}
                        {stop.location.boxCount} koli
                      </p>
                    </div>

                    {isDone && (
                      <button
                        type="button"
                        onClick={() =>
                          applyStatus(route.vehicleId, stop.stopOrder, 'PENDING')
                        }
                        title="Durumu geri al"
                        className="rounded-lg p-1.5 text-slate-400 transition active:scale-90 hover:text-slate-600"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <p className="pt-1 text-center text-[11px] text-slate-400">
          Pendik Belediyesi · Sosyal Yardım Dağıtım
        </p>
      </main>

      {/* ---- Yapışık alt aksiyon barı ---- */}
      {activeStop && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto grid max-w-md grid-cols-2 gap-2.5 px-4 py-3">
            <button
              type="button"
              onClick={handleDeliver}
              disabled={busy !== null}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-base font-black text-white shadow-md shadow-emerald-500/30 transition active:scale-95 active:bg-emerald-700 disabled:opacity-70"
            >
              {busy === 'deliver' ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <PackageCheck className="h-6 w-6" />
              )}
              Koliyi Teslim Et
            </button>
            <button
              type="button"
              onClick={handleNotHome}
              disabled={busy !== null}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 py-4 text-base font-black text-white shadow-md shadow-amber-500/30 transition active:scale-95 active:bg-amber-600 disabled:opacity-70"
            >
              {busy === 'nothome' ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <HomeIcon className="h-6 w-6" />
              )}
              Evde Yok
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
