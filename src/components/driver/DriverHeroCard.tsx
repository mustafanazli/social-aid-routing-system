'use client';

import { MapPin, Package, Phone, AlertTriangle, Navigation2 } from 'lucide-react';

import type { StopItem } from '@/types/fleet';
import { priorityOf } from '@/lib/priority';
import NavButton from '@/components/driver/NavButton';

interface DriverHeroCardProps {
  stop: StopItem;
  total: number;
}

/** Kahraman kart — şoförün gitmesi gereken birincil (aktif) durak. */
export default function DriverHeroCard({ stop, total }: DriverHeroCardProps) {
  const { location } = stop;
  const isUrgent = priorityOf(location) === 'URGENT';

  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-white shadow-xl ring-1 transition ${
        isUrgent
          ? 'ring-2 ring-rose-400 shadow-rose-500/20'
          : 'ring-slate-200'
      }`}
      style={
        isUrgent
          ? { borderTop: '5px solid #f43f5e' }
          : { borderTop: '5px solid #10b981' }
      }
    >
      {/* Acil rozeti */}
      {isUrgent && (
        <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-lg">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          ACİL · YAŞLI/HASTA
        </span>
      )}

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
          {isUrgent && (
            <span className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-3 py-1.5 text-sm font-bold text-rose-700">
              <AlertTriangle className="h-4 w-4" />
              Öncelikli teslim
            </span>
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
