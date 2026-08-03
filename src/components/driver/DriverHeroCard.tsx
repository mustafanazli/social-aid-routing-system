'use client';

import { MapPin, Package, Phone, Navigation2 } from 'lucide-react';

import type { StopItem } from '@/types/fleet';
import NavButton from '@/components/driver/NavButton';

interface DriverHeroCardProps {
  stop: StopItem;
  total: number;
}

/** Kahraman kart — şoförün gitmesi gereken birincil (aktif) durak. */
export default function DriverHeroCard({ stop, total }: DriverHeroCardProps) {
  const { location } = stop;

  return (
    <div
      className="relative overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200 transition"
      style={{ borderTop: '5px solid #10b981' }}
    >
      <div className="p-5">
        {/* Sıra etiketi */}
        <div className="flex items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-xl font-black text-white shadow-md">
            {stop.stopOrder}
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">
              Sıradaki Aktif Durak
            </p>
            <p className="text-xs text-slate-400">
              {stop.stopOrder}. durak / {total} durak
            </p>
          </div>
        </div>

        {/* Alıcı + adres (devasa tipografi) */}
        <h2 className="mt-4 text-2xl font-black leading-tight text-slate-900">
          {location.recipientName || 'İsimsiz alıcı'}
        </h2>

        {location.neighborhood && (
          <p className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-sm font-bold text-emerald-700">
            <MapPin className="h-4 w-4" />
            {location.neighborhood}
          </p>
        )}

        <p className="mt-2 flex items-start gap-2 text-xl font-semibold leading-snug text-slate-700">
          <Navigation2 className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
          {location.cleanAddress}
        </p>

        {/* Bilgi rozetleri */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1.5 text-base font-bold text-amber-700">
            <Package className="h-5 w-5" />
            {location.boxCount} koli
          </span>
          {location.phone && (
            <a
              href={`tel:${location.phone}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-50 px-3 py-1.5 text-base font-bold text-sky-700 transition active:scale-95"
            >
              <Phone className="h-5 w-5" />
              Ara
            </a>
          )}
        </div>

        {/* Dev navigasyon butonları */}
        <div className="mt-4">
          <NavButton lat={location.lat} lng={location.lng} />
        </div>
      </div>
    </div>
  );
}
