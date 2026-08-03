'use client';

import { useMemo, useState } from 'react';
import {
  ExternalLink,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  CornerDownLeft,
} from 'lucide-react';

import type { GeocodedLocation } from '@/types/address';
import {
  buildGoogleMapsSearchUrl,
  parseLatLng,
} from '@/lib/navigationLinks';

interface LocationVerifyListProps {
  /** Haritalanmış tüm adresler (başarılı + bulunamayan). */
  locations: GeocodedLocation[];
  /** Yapıştırılan koordinatı uygular (pin MANUAL olur). */
  onApplyCoord: (id: string, lat: number, lng: number) => void;
}

/** Konumu bulan servisin kısa etiketi (rozet altında gösterilir). */
function providerLabel(loc: GeocodedLocation): string | null {
  if (loc.geocodingStatus === 'MANUAL') return null; // elle uygulanmış — sağlayıcı önemsiz
  switch (loc.provider) {
    case 'yandex':
      return 'Yandex';
    case 'google':
      return 'Google Maps';
    case 'osm':
      return 'OpenStreetMap';
    default:
      return null;
  }
}

/** Durum rozetinin metin + renk sınıflarını verir. */
function statusMeta(loc: GeocodedLocation): { label: string; cls: string } {
  if (loc.geocodingStatus === 'MANUAL') {
    return {
      label: 'Konum doğrulandı',
      cls: 'bg-violet-100 text-violet-700',
    };
  }
  if (loc.geocodingStatus === 'FAILED' || loc.geocodingStatus === 'PENDING') {
    return { label: 'Bulunamadı', cls: 'bg-rose-100 text-rose-700' };
  }
  if ((loc.confidenceScore ?? 1) < 0.35) {
    return { label: 'Düşük güven', cls: 'bg-amber-100 text-amber-700' };
  }
  return { label: 'Otomatik bulundu', cls: 'bg-emerald-100 text-emerald-700' };
}

/**
 * "Google Maps ile Konum Doğrulama" listesi.
 * Operatör her adresi Google Maps'te açar, doğru noktaya sağ tıklayıp
 * koordinatı kopyalar ve buraya yapıştırır → pin tam o noktaya taşınır.
 * Ücretsizdir; API anahtarı gerektirmez.
 */
export default function LocationVerifyList({
  locations,
  onApplyCoord,
}: LocationVerifyListProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const verifiedCount = useMemo(
    () => locations.filter((l) => l.geocodingStatus === 'MANUAL').length,
    [locations],
  );

  const setDraft = (id: string, value: string) =>
    setDrafts((d) => ({ ...d, [id]: value }));

  const apply = (loc: GeocodedLocation) => {
    const raw = drafts[loc.id] ?? '';
    const point = parseLatLng(raw);
    if (!point) {
      setErrors((e) => ({
        ...e,
        [loc.id]:
          'Geçerli koordinat okunamadı. Örn: 40.887880, 29.260750',
      }));
      return;
    }
    onApplyCoord(loc.id, point.lat, point.lng);
    setErrors((e) => {
      const next = { ...e };
      delete next[loc.id];
      return next;
    });
    setDraft(loc.id, '');
  };

  if (locations.length === 0) return null;

  return (
    <div className="border-t border-slate-100">
      {/* Başlık + ilerleme */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-violet-600" />
          <h4 className="text-sm font-semibold text-slate-800">
            Google Maps ile Konum Doğrulama
          </h4>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {verifiedCount}/{locations.length} doğrulandı
        </span>
      </div>

      {/* Kısa yönerge */}
      <p className="px-5 pb-2 text-xs leading-relaxed text-slate-500">
        Her adresi <strong>Google Maps&apos;te Aç</strong> ile açın; doğru noktaya
        sağ tıklayıp koordinatı (ör. <em>40.887880, 29.260750</em>) kopyalayın ve
        aşağıya yapıştırıp <strong>Uygula</strong>&apos;ya basın. Pin tam o noktaya
        taşınır ve rapora kaydedilir.
      </p>

      <div className="max-h-[28rem] overflow-y-auto px-3 pb-4">
        <ul className="space-y-2">
          {locations.map((loc) => {
            const meta = statusMeta(loc);
            const provider = providerLabel(loc);
            const err = errors[loc.id];
            return (
              <li
                key={loc.id}
                className="rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {loc.recipientName || 'İsimsiz alıcı'}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                      {loc.cleanAddress}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}
                    >
                      {meta.label}
                    </span>
                    {provider ? (
                      <span className="text-[10px] font-medium text-slate-400">
                        {provider}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <a
                    href={buildGoogleMapsSearchUrl(loc.cleanAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Google Maps&apos;te Aç
                  </a>

                  <div className="flex min-w-[13rem] flex-1 items-center gap-1.5">
                    <input
                      value={drafts[loc.id] ?? ''}
                      onChange={(e) => setDraft(loc.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') apply(loc);
                      }}
                      placeholder="40.887880, 29.260750"
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-violet-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => apply(loc)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 active:scale-95"
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      Uygula
                    </button>
                  </div>
                </div>

                {err ? (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-rose-600">
                    <AlertTriangle className="h-3 w-3" />
                    {err}
                  </p>
                ) : loc.geocodingStatus === 'MANUAL' ? (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-violet-600">
                    <CornerDownLeft className="h-3 w-3" />
                    {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)} uygulandı
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
