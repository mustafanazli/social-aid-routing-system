'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  MapPinned,
  Play,
  RotateCcw,
  X,
  AlertTriangle,
  MousePointerClick,
  CheckCircle2,
  Package,
} from 'lucide-react';

import { useDeliveryStore } from '@/store/useDeliveryStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import {
  batchGeocode,
  toPendingLocation,
  hasPresetLocation,
  toPresetLocation,
} from '@/services/nominatimService';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import MapErrorBoundary from '@/components/common/MapErrorBoundary';
import LocationVerifyList from '@/components/map/LocationVerifyList';
import { isOutOfPendik } from '@/lib/geoBounds';
import type { GeocodedLocation } from '@/types/address';

/**
 * KRİTİK (PRD Bölüm 6.1): Leaflet `window`e bağımlıdır. Harita bileşeni
 * SSR sırasında render edilmemelidir. Bu yüzden `ssr: false` ile dynamic
 * import edilir — ve `ssr: false` yalnızca Client Component içinde geçerli
 * olduğundan bu wrapper `'use client'` ile işaretlidir.
 */
const MapContainer = dynamic(
  () => import('@/components/map/MapContainer'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <LoadingSpinner label="Harita yükleniyor…" />
      </div>
    ),
  },
);

export default function MapSection() {
  const hydrated = useHasHydrated();

  const sanitizedAddresses = useDeliveryStore((s) => s.sanitizedAddresses);
  const geocodedLocations = useDeliveryStore((s) => s.geocodedLocations);
  const setGeocodedLocations = useDeliveryStore((s) => s.setGeocodedLocations);
  const updateGeocodedLocation = useDeliveryStore(
    (s) => s.updateGeocodedLocation,
  );

  const [isGeocoding, setIsGeocoding] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [manualTargetId, setManualTargetId] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const runningRef = useRef(false); // re-entry (throttle) kilidi

  // Koordinatı olan konumlar haritada pin olur; olmayanlar (FAILED/PENDING) listede.
  const locatedOnMap = useMemo(
    () =>
      geocodedLocations.filter(
        (l) =>
          (l.geocodingStatus === 'SUCCESS' ||
            l.geocodingStatus === 'MANUAL') &&
          Number.isFinite(l.lat) &&
          Number.isFinite(l.lng) &&
          (l.lat !== 0 || l.lng !== 0),
      ),
    [geocodedLocations],
  );

  const failedLocations = useMemo(
    () =>
      geocodedLocations.filter(
        (l) => l.geocodingStatus === 'FAILED' || l.geocodingStatus === 'PENDING',
      ),
    [geocodedLocations],
  );

  const lowConfidence = useMemo(
    () =>
      locatedOnMap.filter(
        (l) =>
          l.geocodingStatus === 'SUCCESS' && (l.confidenceScore ?? 1) < 0.35,
      ).length,
    [locatedOnMap],
  );

  // Pendik viewbox dışına düşen (muhtemelen yanlış eşleşmiş) otomatik konumlar.
  const outOfBounds = useMemo(
    () =>
      locatedOnMap.filter(
        (l) => l.geocodingStatus === 'SUCCESS' && isOutOfPendik(l.lat, l.lng),
      ).length,
    [locatedOnMap],
  );

  // Kontrol edilmesi önerilen toplam adres (bulunamayan + düşük güven + Pendik dışı).
  const suspectTotal = failedLocations.length + lowConfidence + outOfBounds;

  const startGeocoding = useCallback(async () => {
    // Throttle: geocoding sürerken tekrar tetiklenmeyi engelle.
    if (runningRef.current) return;
    if (sanitizedAddresses.length === 0) return;

    runningRef.current = true;
    cancelledRef.current = false;
    setIsGeocoding(true);
    setManualTargetId(null);

    // Excel'de hazır koordinatı olan adresler (önceden elle düzeltilmiş) ağ
    // isteği olmadan doğrudan MANUAL konumlanır; sadece kalanlar geocode edilir.
    const needGeocode = sanitizedAddresses.filter((a) => !hasPresetLocation(a));
    setProgress({ done: 0, total: needGeocode.length });

    // Hazır koordinatlılar MANUAL, kalanlar PENDING olarak başlar.
    setGeocodedLocations(
      sanitizedAddresses.map((a) =>
        hasPresetLocation(a) ? toPresetLocation(a) : toPendingLocation(a),
      ),
    );

    try {
      if (needGeocode.length > 0) {
        await batchGeocode(needGeocode, {
          isCancelled: () => cancelledRef.current,
          onResult: (location, index, total) => {
            // Her sonucu store'a yaz — pinler tek tek belirsin.
            updateGeocodedLocation(location.id, location);
            setProgress({ done: index + 1, total });
          },
        });
      }
    } finally {
      setIsGeocoding(false);
      runningRef.current = false;
    }
  }, [
    sanitizedAddresses,
    setGeocodedLocations,
    updateGeocodedLocation,
  ]);

  const cancelGeocoding = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (!manualTargetId) return;
      updateGeocodedLocation(manualTargetId, {
        lat,
        lng,
        geocodingStatus: 'MANUAL',
      });
      setManualTargetId(null);
    },
    [manualTargetId, updateGeocodedLocation],
  );

  const handleMarkerDragEnd = useCallback(
    (id: string, lat: number, lng: number) => {
      updateGeocodedLocation(id, { lat, lng, geocodingStatus: 'MANUAL' });
    },
    [updateGeocodedLocation],
  );

  const hasAddresses = hydrated && sanitizedAddresses.length > 0;
  const hasGeocoded = hydrated && geocodedLocations.length > 0;
  const activeManualTarget: GeocodedLocation | undefined = manualTargetId
    ? geocodedLocations.find((l) => l.id === manualTargetId)
    : undefined;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Başlık + eylemler */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
            2
          </span>
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <MapPinned className="h-4 w-4 text-emerald-600" />
              Harita &amp; Geocoding
            </h3>
            <p className="text-xs text-slate-500">
              Temizlenmiş adresleri koordinata çevirin; pinleri haritada görün,
              gerekirse elle düzeltin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isGeocoding ? (
            <>
              <LoadingSpinner
                label={`Geocoding ${progress.done}/${progress.total}`}
              />
              <button
                type="button"
                onClick={cancelGeocoding}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" />
                Durdur
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startGeocoding}
              disabled={!hasAddresses}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {hasGeocoded ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Yeniden Geocode Et
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Adresleri Haritala
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* İlerleme çubuğu */}
      {isGeocoding && progress.total > 0 && (
        <div className="h-1 w-full bg-slate-100">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{
              width: `${Math.round((progress.done / progress.total) * 100)}%`,
            }}
          />
        </div>
      )}

      {/* Özet rozetleri */}
      {hasGeocoded && (
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {locatedOnMap.length} konumlandı
          </span>
          {failedLocations.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600">
              <AlertTriangle className="h-4 w-4" />
              {failedLocations.length} bulunamadı
            </span>
          )}
          {lowConfidence > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
              <Package className="h-4 w-4" />
              {lowConfidence} düşük güven
            </span>
          )}
          {outOfBounds > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700">
              <AlertTriangle className="h-4 w-4" />
              {outOfBounds} Pendik dışı
            </span>
          )}
        </div>
      )}

      {/* Şüpheli adres uyarı şeridi (Özellik 4) — kontrol edilmesi önerilir. */}
      {hasGeocoded && suspectTotal > 0 && (
        <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50/70 px-5 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="min-w-0">
            <strong>{suspectTotal} adres kontrol edilmeli.</strong>{' '}
            {failedLocations.length > 0 && `${failedLocations.length} bulunamadı, `}
            {lowConfidence > 0 && `${lowConfidence} düşük güvenli, `}
            {outOfBounds > 0 && `${outOfBounds} Pendik sınırı dışında. `}
            Aşağıdaki <strong>Konum Doğrulama</strong> listesinden bunları
            Google Maps&apos;te açıp doğru koordinatı yapıştırarak düzeltin.
          </p>
        </div>
      )}

      {/* Manuel pin modu bilgi şeridi */}
      {activeManualTarget && (
        <div className="flex items-center gap-2 border-b border-sky-100 bg-sky-50 px-5 py-2.5 text-sm text-sky-800">
          <MousePointerClick className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            <strong>{activeManualTarget.recipientName || 'Adres'}</strong> için
            haritada konum seçin — doğru noktaya tıklayın.
          </span>
          <button
            type="button"
            onClick={() => setManualTargetId(null)}
            className="rounded-md p-1 text-sky-600 transition hover:bg-sky-100"
            title="Vazgeç"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid gap-0 lg:grid-cols-[1fr_20rem]">
        {/* Harita */}
        <div className="relative h-[26rem] border-b border-slate-100 lg:border-b-0 lg:border-r">
          {!hasAddresses && !hasGeocoded ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:24px_24px] text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-emerald-500 shadow-sm ring-1 ring-slate-200">
                <MapPinned className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Önce Adım 1&apos;de adres yükleyin
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Adresler temizlendikten sonra &quot;Adresleri Haritala&quot;
                  ile koordinatlar çıkar.
                </p>
              </div>
            </div>
          ) : (
            <MapErrorBoundary>
              <MapContainer
                locations={locatedOnMap}
                manualTargetId={manualTargetId}
                onMapClick={handleMapClick}
                onMarkerDragEnd={handleMarkerDragEnd}
              />
            </MapErrorBoundary>
          )}
        </div>

        {/* Konumu bulunamayan adresler */}
        <aside className="flex max-h-[26rem] flex-col">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h4 className="text-sm font-semibold text-slate-700">
              Konumu Bulunamayan Adresler
            </h4>
            {failedLocations.length > 0 && (
              <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                {failedLocations.length}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {failedLocations.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-xs text-slate-400">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                {hasGeocoded
                  ? 'Tüm adresler konumlandı. 🎉'
                  : 'Geocoding sonrası bulunamayan adresler burada listelenir.'}
              </div>
            ) : (
              <ul className="space-y-2">
                {failedLocations.map((loc) => {
                  const isTarget = manualTargetId === loc.id;
                  return (
                    <li
                      key={loc.id}
                      className={`rounded-xl border p-3 transition ${
                        isTarget
                          ? 'border-sky-300 bg-sky-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-800">
                        {loc.recipientName || 'İsimsiz alıcı'}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                        {loc.cleanAddress}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        {loc.neighborhood ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {loc.neighborhood}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600">
                            Mahalle belirsiz
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setManualTargetId(isTarget ? null : loc.id)
                          }
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                            isTarget
                              ? 'bg-sky-600 text-white hover:bg-sky-700'
                              : 'bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-700'
                          }`}
                        >
                          <MousePointerClick className="h-3.5 w-3.5" />
                          {isTarget ? 'Haritaya tıklayın' : 'Haritada Konumla'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* Google Maps ile tüm adresleri tek tek doğrulama/konumlama */}
      {hasGeocoded && (
        <LocationVerifyList
          locations={geocodedLocations}
          onApplyCoord={handleMarkerDragEnd}
        />
      )}
    </section>
  );
}
