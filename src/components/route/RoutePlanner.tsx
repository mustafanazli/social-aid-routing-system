'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Route as RouteIcon,
  AlertTriangle,
  LocateFixed,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  MapPinOff,
  PackageX,
} from 'lucide-react';

import { useDeliveryStore } from '@/store/useDeliveryStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { clusterLocations, hasValidCoords } from '@/lib/clustering';
import { validateRoutes, type RouteAnomaly } from '@/lib/routeValidator';
import {
  optimizeRoute,
  fetchRouteGeometry,
  type LatLng,
  type RouteResult,
  type OriginPoint,
} from '@/services/osrmService';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import MapErrorBoundary from '@/components/common/MapErrorBoundary';
import VehicleConfigForm from '@/components/fleet/VehicleConfigForm';
import RouteList from '@/components/route/RouteList';
import type { VehicleRoute, StopItem } from '@/types/fleet';
import type { GeocodedLocation } from '@/types/address';

/** SSR-güvenli rota haritası (Leaflet → yalnızca istemci). */
const RouteMap = dynamic(() => import('@/components/map/RouteMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-slate-50">
      <LoadingSpinner label="Harita yükleniyor…" />
    </div>
  ),
});

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export default function RoutePlanner() {
  const hydrated = useHasHydrated();

  const geocodedLocations = useDeliveryStore((s) => s.geocodedLocations);
  const vehicleConfigs = useDeliveryStore((s) => s.vehicleConfigs);
  const routes = useDeliveryStore((s) => s.routes);
  const setRoutes = useDeliveryStore((s) => s.setRoutes);
  const updateVehicleRoute = useDeliveryStore((s) => s.updateVehicleRoute);
  const reorderStops = useDeliveryStore((s) => s.reorderStops);
  const setActiveStep = useDeliveryStore((s) => s.setActiveStep);

  const [geometries, setGeometries] = useState<Record<string, LatLng[]>>({});
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [recalculatingVehicleId, setRecalculatingVehicleId] = useState<
    string | null
  >(null);
  const [focusedVehicleId, setFocusedVehicleId] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [quarantined, setQuarantined] = useState<GeocodedLocation[]>([]);
  const rehydratedRef = useRef(false);
  const runningRef = useRef(false); // re-entry (throttle) kilidi

  // Canlı konum (rota başlangıç noktası / origin).
  const {
    coords: originCoords,
    status: locationStatus,
    isFallback: originIsFallback,
    requestLocation,
  } = useCurrentLocation();
  const origin: OriginPoint | null = useMemo(
    () =>
      originCoords ? { lat: originCoords.lat, lng: originCoords.lng } : null,
    [originCoords],
  );

  const located = useMemo(
    () => geocodedLocations.filter(hasValidCoords),
    [geocodedLocations],
  );
  const totalBoxes = useMemo(
    () => located.reduce((s, l) => s + (l.boxCount || 1), 0),
    [located],
  );

  const buildRoute = useCallback(
    (
      vehicle: (typeof vehicleConfigs)[number],
      cluster: typeof located,
      result: RouteResult,
    ): VehicleRoute => ({
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      vehicleColor: vehicle.color,
      assignedCapacity: vehicle.capacity,
      totalBoxesAssigned: cluster.reduce((s, l) => s + (l.boxCount || 1), 0),
      totalDistanceKm: result.totalDistanceKm,
      totalDurationMinutes: result.totalDurationMinutes,
      stops: result.orderedLocations.map((loc, idx) => ({
        stopOrder: idx + 1,
        location: loc,
        status: 'PENDING',
      })),
    }),
    [],
  );

  const handleOptimize = useCallback(async () => {
    // Throttle: işlem sürerken tekrar tetiklenmeyi engelle (art arda tıklama).
    if (runningRef.current) return;
    if (located.length === 0 || vehicleConfigs.length === 0) return;

    runningRef.current = true;
    setIsOptimizing(true);
    setWarning(null);
    setQuarantined([]);
    setFocusedVehicleId(null);
    setProgress({ done: 0, total: vehicleConfigs.length });

    try {
      const { clusters, overCapacityVehicleIds } = clusterLocations(
        located,
        vehicleConfigs,
      );

      const newRoutes: VehicleRoute[] = [];
      const newGeometries: Record<string, LatLng[]> = {};

      for (let i = 0; i < vehicleConfigs.length; i++) {
        const vehicle = vehicleConfigs[i];
        const cluster = clusters[i] ?? [];

        let result: RouteResult;
        try {
          // origin verilmişse rota canlı konumdan başlar (en yakın duraktan).
          result = await optimizeRoute(cluster, origin);
        } catch {
          // OSRM hatası → kümelenmiş sırayı koru, düz geometri (PRD 6.3 fallback).
          result = {
            orderedLocations: cluster,
            geometry: cluster.map((l) => [l.lat, l.lng] as LatLng),
            totalDistanceKm: 0,
            totalDurationMinutes: 0,
          };
        }

        newRoutes.push(buildRoute(vehicle, cluster, result));
        newGeometries[vehicle.id] = result.geometry;
        setProgress({ done: i + 1, total: vehicleConfigs.length });

        // OSRM public sunucusuna nazik olmak için araçlar arası kısa gecikme.
        if (i < vehicleConfigs.length - 1) await delay(400);
      }

      setRoutes(newRoutes);
      setGeometries(newGeometries);
      setActiveStep(3);

      if (overCapacityVehicleIds.length > 0) {
        setWarning(
          `${overCapacityVehicleIds.length} araçta kapasite aşıldı. Araç sayısını veya kapasiteyi artırmayı düşünün.`,
        );
      }
    } finally {
      setIsOptimizing(false);
      runningRef.current = false;
    }
  }, [located, vehicleConfigs, buildRoute, setRoutes, setActiveStep, origin]);

  const handleReorder = useCallback(
    async (vehicleId: string, newStops: StopItem[]) => {
      // 1) Sırayı hemen store'a yaz (UI anında güncellensin).
      reorderStops(vehicleId, newStops);
      setRecalculatingVehicleId(vehicleId);

      // 2) Yeni sıra için OSRM'den geometri + mesafe/süre al.
      try {
        const orderedLocations = newStops.map((s) => s.location);
        const result = await fetchRouteGeometry(orderedLocations, origin);
        setGeometries((g) => ({ ...g, [vehicleId]: result.geometry }));
        updateVehicleRoute(vehicleId, {
          totalDistanceKm: result.totalDistanceKm,
          totalDurationMinutes: result.totalDurationMinutes,
        });
      } catch {
        // Sessiz geç — sıra yine de güncellendi.
      } finally {
        setRecalculatingVehicleId(null);
      }
    },
    [reorderStops, updateVehicleRoute, origin],
  );

  // Sayfa yenilendiğinde rotalar persist'ten gelir ama geometriler gelmez.
  // Polyline'ları yeniden çizmek için mevcut sıraya göre geometriyi bir kez getir.
  useEffect(() => {
    if (!hydrated || rehydratedRef.current) return;
    if (routes.length === 0) return;
    if (Object.keys(geometries).length > 0) return;

    rehydratedRef.current = true;
    (async () => {
      for (const route of routes) {
        try {
          const result = await fetchRouteGeometry(
            route.stops.map((s) => s.location),
          );
          setGeometries((g) => ({ ...g, [route.vehicleId]: result.geometry }));
          await delay(300);
        } catch {
          /* yoksay */
        }
      }
    })();
  }, [hydrated, routes, geometries]);

  // Rota Akış Denetçisi (Faz 7.2) — rotalar değiştikçe kapasite/anomali denetle.
  const validation = useMemo(
    () => (hydrated && routes.length > 0 ? validateRoutes(routes) : null),
    [hydrated, routes],
  );

  // Anomali durağı rotadan çıkar → karantinaya al, geometri & toplamları güncelle.
  const removeAnomaly = useCallback(
    async (anomaly: RouteAnomaly) => {
      const route = routes.find((r) => r.vehicleId === anomaly.vehicleId);
      if (!route) return;

      const remaining = route.stops.filter(
        (s) => s.stopOrder !== anomaly.stopOrder,
      );
      setQuarantined((q) =>
        q.some((l) => l.id === anomaly.stop.location.id)
          ? q
          : [...q, anomaly.stop.location],
      );
      reorderStops(anomaly.vehicleId, remaining);

      const totalBoxes = remaining.reduce(
        (s, st) => s + (st.location.boxCount || 1),
        0,
      );
      try {
        const result = await fetchRouteGeometry(
          remaining.map((s) => s.location),
          origin,
        );
        setGeometries((g) => ({
          ...g,
          [anomaly.vehicleId]: result.geometry,
        }));
        updateVehicleRoute(anomaly.vehicleId, {
          totalBoxesAssigned: totalBoxes,
          totalDistanceKm: result.totalDistanceKm,
          totalDurationMinutes: result.totalDurationMinutes,
        });
      } catch {
        updateVehicleRoute(anomaly.vehicleId, {
          totalBoxesAssigned: totalBoxes,
        });
      }
    },
    [routes, reorderStops, updateVehicleRoute, origin],
  );

  const hasRoutes = hydrated && routes.length > 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Başlık */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
          3
        </span>
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <RouteIcon className="h-4 w-4 text-emerald-600" />
            Araç Kümeleme &amp; Rota Optimizasyonu
          </h3>
          <p className="text-xs text-slate-500">
            Adresleri kapasiteye göre araçlara paylaştırın; OSRM en kısa durak
            sırasını hesaplasın. Durakları sürükleyerek yeniden sıralayın.
          </p>
        </div>
      </div>

      {/* Kontrol paneli */}
      <div className="space-y-4 border-b border-slate-100 p-5">
        {/* Canlı konum ile başlangıç noktası */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <button
            type="button"
            onClick={requestLocation}
            disabled={locationStatus === 'loading'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {locationStatus === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LocateFixed className="h-4 w-4" />
            )}
            Mevcut Konumu Al / Rotayı Buradan Başlat
          </button>

          {locationStatus === 'idle' && (
            <span className="text-xs text-slate-500">
              İsteğe bağlı: rota, seçtiğiniz başlangıç noktasından en yakın
              durakla başlar.
            </span>
          )}
          {locationStatus === 'success' && origin && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              Canlı konum alındı ({origin.lat.toFixed(4)}, {origin.lng.toFixed(4)})
            </span>
          )}
          {originIsFallback && origin && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              Konum alınamadı — yedek: Pendik Belediyesi merkez ({origin.lat.toFixed(4)}, {origin.lng.toFixed(4)})
            </span>
          )}
        </div>

        <VehicleConfigForm
          onOptimize={handleOptimize}
          isOptimizing={isOptimizing}
          locatedCount={hydrated ? located.length : 0}
          totalBoxes={hydrated ? totalBoxes : 0}
          hasRoutes={hasRoutes}
        />
      </div>

      {/* İlerleme çubuğu */}
      {isOptimizing && progress.total > 0 && (
        <div className="h-1 w-full bg-slate-100">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{
              width: `${Math.round((progress.done / progress.total) * 100)}%`,
            }}
          />
        </div>
      )}

      {/* Kapasite uyarısı */}
      {warning && (
        <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-5 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {warning}
        </div>
      )}

      {/* Sistem Denetimi (Faz 7.2) */}
      {hasRoutes && validation && (
        <div
          className={`border-b px-5 py-3 ${
            validation.hasProblems
              ? 'border-rose-100 bg-rose-50/60'
              : 'border-emerald-100 bg-emerald-50/60'
          }`}
        >
          <div className="flex items-center gap-2">
            {validation.hasProblems ? (
              <ShieldAlert className="h-4 w-4 text-rose-600" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            )}
            <h4
              className={`text-sm font-semibold ${
                validation.hasProblems ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              Sistem Denetimi
            </h4>
            <span className="text-xs text-slate-500">
              {validation.hasProblems
                ? 'Kontrol edilmesi gereken durumlar var'
                : 'Rotalar tutarlı — sorun bulunmadı'}
            </span>
          </div>

          {/* Kapasite alarmları */}
          {validation.capacityIssues.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {validation.capacityIssues.map((c) => (
                <li
                  key={c.vehicleId}
                  className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200"
                >
                  <PackageX className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>{c.vehicleName}</strong> kapasite aşımı:{' '}
                    {c.assignedBoxes}/{c.capacity} koli (
                    <strong>+{c.overflow}</strong>). Araç sayısını veya
                    kapasiteyi artırın.
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Anomali adresler */}
          {validation.anomalies.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {validation.anomalies.map((a) => (
                <li
                  key={`${a.vehicleId}-${a.stopOrder}`}
                  className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200"
                >
                  <MapPinOff className="h-4 w-4 shrink-0 text-amber-600" />
                  <span className="min-w-0 flex-1">
                    <strong>{a.stop.location.recipientName || 'Adres'}</strong>{' '}
                    ({a.vehicleName}) —{' '}
                    {a.reason === 'FAR_FROM_CENTER'
                      ? `Pendik merkezinden ${a.distanceKm.toFixed(0)} km sapma`
                      : `önceki durakla arası ${a.distanceKm.toFixed(0)} km`}
                    . Anomali olabilir.
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAnomaly(a)}
                    className="shrink-0 rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-200 active:scale-95"
                  >
                    Rotadan Çıkar
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Karantinaya alınan (kontrol edilecek) adresler */}
          {quarantined.length > 0 && (
            <div className="mt-2 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <MapPinOff className="h-3.5 w-3.5" />
                Kontrol Edilecek Adresler ({quarantined.length})
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Rotadan çıkarıldı; Excel raporunda &quot;Atanmadı&quot; olarak
                yer alır. Konumu düzeltip yeniden optimize edebilirsiniz.
              </p>
              <ul className="mt-1.5 space-y-1">
                {quarantined.map((l) => (
                  <li
                    key={l.id}
                    className="truncate text-xs text-slate-600"
                  >
                    • {l.recipientName || 'Adres'} — {l.cleanAddress}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Harita + rota listesi */}
      <div className="grid gap-0 lg:grid-cols-[1fr_22rem]">
        <div className="relative h-[30rem] border-b border-slate-100 lg:border-b-0 lg:border-r">
          {hasRoutes ? (
            <MapErrorBoundary>
              <RouteMap
                routes={routes}
                geometries={geometries}
                focusedVehicleId={focusedVehicleId}
                origin={origin}
                originIsLive={locationStatus === 'success'}
              />
            </MapErrorBoundary>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:24px_24px] text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-emerald-500 shadow-sm ring-1 ring-slate-200">
                <RouteIcon className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Renkli rotalar burada çizilecek
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Araç bilgilerini girip &quot;Rotayı Hesapla&quot; deyin.
                </p>
              </div>
            </div>
          )}
        </div>

        <aside className="max-h-[30rem] overflow-y-auto p-4">
          <RouteList
            routes={hasRoutes ? routes : []}
            recalculatingVehicleId={recalculatingVehicleId}
            focusedVehicleId={focusedVehicleId}
            onFocus={setFocusedVehicleId}
            onReorder={handleReorder}
          />
        </aside>
      </div>
    </section>
  );
}
