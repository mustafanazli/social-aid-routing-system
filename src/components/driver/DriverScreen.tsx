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
} from 'lucide-react';

import { useDeliveryStore } from '@/store/useDeliveryStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { fetchShare, patchStop } from '@/services/shareService';
import { sharedToVehicleRoute } from '@/lib/shareSerialization';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useCountUp } from '@/hooks/useCountUp';
import {
  buildGoogleMapsRouteUrl,
  buildYandexMapsRouteUrl,
  type Point,
} from '@/lib/navigationLinks';
import { PENDIK_MUNICIPALITY } from '@/constants/config';
import {
  buildArrivalNotification,
  broadcastNotification,
} from '@/lib/notifications';
import { priorityOf } from '@/lib/priority';
import DriverHeroCard from '@/components/driver/DriverHeroCard';
import DeliveryProofModal from '@/components/driver/DeliveryProofModal';
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
  const pushNotificationLog = useDeliveryStore((s) => s.pushNotificationLog);

  const isLive = Boolean(shareId);
  const [serverRoute, setServerRoute] = useState<VehicleRoute | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus>(
    shareId ? 'loading' : 'idle',
  );
  const [serverError, setServerError] = useState<string | null>(null);

  const [proofStop, setProofStop] = useState<StopItem | null>(null);
  const [busy, setBusy] = useState<'deliver' | 'nothome' | null>(null);
  const [showBulk, setShowBulk] = useState(false);

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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {isLive ? 'Canlı rota yükleniyor…' : 'Yükleniyor…'}
      </div>
    );
  }

  if (!route) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center">
        <MapPinned className="h-10 w-10 text-slate-600" />
        <p className="text-base font-semibold text-slate-200">Rota bulunamadı</p>
        <p className="text-sm text-slate-400">
          {isLive ? (
            <>
              {serverError ??
                'Canlı paylaşım bulunamadı veya süresi dolmuş olabilir.'}{' '}
              Yönetici panelinden paylaşımı yeniden başlatın.
            </>
          ) : (
            <>
              Bu cihazda{' '}
              <strong className="text-slate-300">{routeId}</strong> için
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

  const notifyNextCitizen = (completedStopOrder: number) => {
    const next = sortedStops.find(
      (s) => s.stopOrder !== completedStopOrder && s.status === 'PENDING',
    );
    if (!next) return;
    const avgLeg =
      route.totalDurationMinutes > 0 && total > 0
        ? route.totalDurationMinutes / total
        : 12;
    const log = buildArrivalNotification({
      recipientName: next.location.recipientName || 'Vatandaş',
      stopOrder: next.stopOrder,
      vehicleName: route.vehicleName,
      etaMinutes: Math.max(5, Math.round(avgLeg)),
    });
    pushNotificationLog(log);
    broadcastNotification(log);
  };

  const handleComplete = (
    stop: StopItem,
    status: StopStatus,
    proof?: DeliveryProof,
  ) => {
    applyStatus(route.vehicleId, stop.stopOrder, status, proof);
    notifyNextCitizen(stop.stopOrder);
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

  const origin: Point = driverCoords ?? { ...PENDIK_MUNICIPALITY };
  const stopPoints: Point[] = sortedStops
    .map((s) => ({ lat: s.location.lat, lng: s.location.lng }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const googleRouteUrl = buildGoogleMapsRouteUrl(origin, stopPoints);
  const yandexRouteUrl = buildYandexMapsRouteUrl(origin, stopPoints);
  const canBulkNavigate = stopPoints.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 pb-32 text-slate-100">
      {/* ---- Sabit üst bilgi ---- */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto max-w-md px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/"
              className="rounded-lg p-1.5 text-slate-300 active:scale-90 active:bg-white/10"
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
              <p className="mt-0.5 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                {isLive && (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </span>
                    Canlı
                  </span>
                )}
                {isLive && <span className="text-slate-600">·</span>}
                Şoför Paneli · {today}
              </p>
            </div>
            <div className="w-8" />
          </div>

          {/* İlerleme */}
          <div className="mt-3">
            <div className="mb-1.5 flex items-end justify-between">
              <p className="text-sm font-semibold text-slate-300">
                Sıradaki Durak{' '}
                <span className="text-xl font-black text-white">
                  {activeStop ? activeStop.stopOrder : total}
                </span>
                <span className="text-slate-500"> / {total}</span>
              </p>
              <p className="text-xs font-medium text-emerald-400">
                {Math.round(animatedCompleted)}/{total} tamamlandı
              </p>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        {/* ---- Toplu rota (ikincil) ---- */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
          <button
            type="button"
            onClick={() => setShowBulk((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left"
          >
            <MapIcon className="h-4 w-4 text-sky-400" />
            <span className="flex-1 text-sm font-semibold text-slate-200">
              Tüm Rotayı Haritada Aç
            </span>
            <ChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform ${
                showBulk ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showBulk && (
            <div className="space-y-2.5 border-t border-white/10 p-3">
              <button
                type="button"
                onClick={requestLocation}
                disabled={locationStatus === 'loading'}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-slate-200 transition active:scale-95 disabled:opacity-60"
              >
                {locationStatus === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LocateFixed className="h-4 w-4 text-blue-400" />
                )}
                Rotayı Buradan Başlat
              </button>

              {locationStatus === 'success' && (
                <p className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                  Canlı konum alındı.
                </p>
              )}
              {locationIsFallback && (
                <p className="flex items-center gap-1.5 text-[11px] text-amber-400">
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
                      : 'pointer-events-none bg-slate-700 text-slate-500'
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
                      : 'pointer-events-none bg-slate-700 text-slate-500'
                  }`}
                >
                  <Navigation className="h-4 w-4" />
                  Yandex
                </a>
              </div>
            </div>
          )}
        </div>

        {/* ---- Kahraman kart / tamamlandı ---- */}
        {activeStop ? (
          <DriverHeroCard stop={activeStop} total={total} />
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-10 text-center">
            <PackageCheck className="h-12 w-12 text-emerald-400" />
            <p className="text-lg font-black text-white">
              Tüm duraklar tamamlandı! 🎉
            </p>
            <p className="text-sm text-slate-300">
              {total} durağın tamamı işlendi. Teşekkürler!
            </p>
          </div>
        )}

        {/* ---- Diğer duraklar (timeline) ---- */}
        {otherStops.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wide text-slate-400">
              <ListChecks className="h-4 w-4" />
              Aşağıdaki Duraklar ({otherStops.length})
            </p>
            <ul className="space-y-2">
              {otherStops.map((stop) => {
                const isDone =
                  stop.status === 'DELIVERED' || stop.status === 'NOT_HOME';
                const isUrgent = priorityOf(stop.location) === 'URGENT';
                return (
                  <li
                    key={stop.stopOrder}
                    className={`flex items-center gap-3 rounded-2xl border p-3 ${
                      isDone
                        ? 'border-white/5 bg-white/[0.03]'
                        : 'border-white/10 bg-slate-900'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                        stop.status === 'DELIVERED'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : stop.status === 'NOT_HOME'
                            ? 'bg-amber-500/15 text-amber-400'
                            : isUrgent
                              ? 'bg-rose-500/15 text-rose-400'
                              : 'bg-white/10 text-slate-300'
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
                        className={`flex items-center gap-1.5 truncate text-sm font-semibold ${
                          isDone
                            ? 'text-slate-500 line-through'
                            : 'text-slate-100'
                        }`}
                      >
                        {isUrgent && !isDone && (
                          <span className="inline-flex shrink-0 items-center rounded bg-rose-500/20 px-1 py-0.5 text-[9px] font-black text-rose-300">
                            ACİL
                          </span>
                        )}
                        {stop.location.recipientName || 'İsimsiz alıcı'}
                      </p>
                      <p
                        className={`truncate text-xs ${
                          isDone ? 'text-slate-600' : 'text-slate-400'
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
                        className="rounded-lg p-1.5 text-slate-500 transition active:scale-90 hover:text-slate-300"
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

        <p className="pt-1 text-center text-[11px] text-slate-600">
          Pendik Belediyesi · Sosyal Yardım Dağıtım
        </p>
      </main>

      {/* ---- Yapışık alt aksiyon barı ---- */}
      {activeStop && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-slate-950/95 backdrop-blur">
          <div className="mx-auto grid max-w-md grid-cols-2 gap-2.5 px-4 py-3">
            <button
              type="button"
              onClick={() => setProofStop(activeStop)}
              disabled={busy !== null}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-base font-black text-white shadow-md shadow-emerald-900/40 transition active:scale-95 active:bg-emerald-700 disabled:opacity-70"
            >
              <PackageCheck className="h-6 w-6" />
              Koliyi Teslim Et
            </button>
            <button
              type="button"
              onClick={handleNotHome}
              disabled={busy !== null}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 py-4 text-base font-black text-white shadow-md shadow-amber-900/40 transition active:scale-95 active:bg-amber-600 disabled:opacity-70"
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

      {/* ---- Teslim kanıtı modalı ---- */}
      {proofStop && (
        <DeliveryProofModal
          recipientName={proofStop.location.recipientName || 'Alıcı'}
          onCancel={() => setProofStop(null)}
          onConfirm={(proof) => {
            handleComplete(proofStop, 'DELIVERED', proof);
            setProofStop(null);
          }}
        />
      )}
    </div>
  );
}
