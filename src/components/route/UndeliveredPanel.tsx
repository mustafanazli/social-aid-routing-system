'use client';

import { useMemo, useState } from 'react';
import {
  PackageX,
  FileDown,
  ArrowRightCircle,
  Home,
  Ban,
  Clock,
} from 'lucide-react';

import { useDeliveryStore } from '@/store/useDeliveryStore';
import { exportDeliveryReportToExcel } from '@/lib/excelUtils';
import type { VehicleRoute } from '@/types/fleet';
import type { SanitizedAddress, GeocodedLocation } from '@/types/address';

/** GeocodedLocation → SanitizedAddress (koordinatı preset olarak taşır). */
function toRedeliveryAddress(loc: GeocodedLocation): SanitizedAddress {
  return {
    id: loc.id,
    originalText: loc.originalText,
    cleanAddress: loc.cleanAddress,
    neighborhood: loc.neighborhood,
    district: loc.district,
    city: loc.city,
    recipientName: loc.recipientName,
    phone: loc.phone,
    boxCount: loc.boxCount,
    ...(loc.timeWindow ? { timeWindow: loc.timeWindow } : {}),
    // Konumu koru → yeni dağıtımda tekrar geocode edilmez (MANUAL).
    ...(Number.isFinite(loc.lat) && Number.isFinite(loc.lng)
      ? { presetLat: loc.lat, presetLng: loc.lng }
      : {}),
  };
}

/**
 * Teslim edilemeyen (evde yok / iptal / bekleyen) durakların yönetimi (Özellik 2).
 * İki eylem sunar: yalnızca eksikleri Excel indir, veya bunları yeni bir
 * dağıtıma taşıyıp Adım 1'den yeniden planla.
 */
export default function UndeliveredPanel() {
  const routes = useDeliveryStore((s) => s.routes);
  const loadForRedelivery = useDeliveryStore((s) => s.loadForRedelivery);

  const [moved, setMoved] = useState(false);

  const undelivered = useMemo(() => {
    const notHome: GeocodedLocation[] = [];
    const cancelled: GeocodedLocation[] = [];
    const pending: GeocodedLocation[] = [];
    for (const r of routes) {
      for (const s of r.stops) {
        if (s.status === 'NOT_HOME') notHome.push(s.location);
        else if (s.status === 'CANCELLED') cancelled.push(s.location);
        else if (s.status === 'PENDING') pending.push(s.location);
      }
    }
    return { notHome, cancelled, pending };
  }, [routes]);

  const all = [
    ...undelivered.notHome,
    ...undelivered.cancelled,
    ...undelivered.pending,
  ];
  const total = all.length;

  if (routes.length === 0 || total === 0) return null;

  // Yalnızca teslim edilmemiş durakları içeren daraltılmış rota kopyası.
  const filteredRoutes: VehicleRoute[] = routes
    .map((r) => ({
      ...r,
      stops: r.stops.filter((s) => s.status !== 'DELIVERED'),
    }))
    .filter((r) => r.stops.length > 0);

  const handleExport = () => exportDeliveryReportToExcel(filteredRoutes, []);

  const handleMove = () => {
    const ok = window.confirm(
      `${total} teslim edilemeyen adres yeni bir dağıtıma taşınacak. ` +
        `Mevcut rotalar temizlenip Adım 1'e dönülecek. Devam edilsin mi?`,
    );
    if (!ok) return;
    // Aynı alıcı birden fazla durakta olmayacağından id'ye göre tekilleştir.
    const seen = new Set<string>();
    const addresses = all
      .filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)))
      .map(toRedeliveryAddress);
    loadForRedelivery(addresses);
    setMoved(true);
  };

  return (
    <div className="border-b border-slate-100 bg-amber-50/40 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <PackageX className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <h4 className="text-sm font-semibold text-slate-800">
              Eksik / Ulaşılamayan Teslimatlar
            </h4>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-medium">
              {undelivered.notHome.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                  <Home className="h-3 w-3" />
                  {undelivered.notHome.length} evde yok
                </span>
              )}
              {undelivered.cancelled.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">
                  <Ban className="h-3 w-3" />
                  {undelivered.cancelled.length} iptal
                </span>
              )}
              {undelivered.pending.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">
                  <Clock className="h-3 w-3" />
                  {undelivered.pending.length} bekliyor
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <FileDown className="h-4 w-4" />
            Eksikleri Excel İndir
          </button>
          <button
            type="button"
            onClick={handleMove}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-700 active:scale-95"
          >
            <ArrowRightCircle className="h-4 w-4" />
            Yeni Dağıtıma Taşı
          </button>
        </div>
      </div>

      {moved && (
        <p className="mt-2 text-xs font-medium text-emerald-700">
          {total} adres yeni dağıtıma yüklendi — <strong>Adım 1</strong>&apos;e
          geçildi. Oradan tekrar haritalayıp rota oluşturabilirsiniz.
        </p>
      )}
    </div>
  );
}
