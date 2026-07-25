'use client';

import { useMemo } from 'react';
import {
  MapPinned,
  Truck,
  Fuel,
  Wind,
  Package,
  CheckCircle2,
  Route as RouteIcon,
  type LucideIcon,
} from 'lucide-react';

import { useDeliveryStore } from '@/store/useDeliveryStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { useCountUp } from '@/hooks/useCountUp';
import {
  OPTIMIZATION_SAVING_RATIO,
  FUEL_LITER_PER_KM,
  CO2_GRAM_PER_KM,
} from '@/constants/config';

interface KpiCardProps {
  label: string;
  value: number;
  decimals?: number;
  unit?: string;
  icon: LucideIcon;
  accent: string; // ikon rengi
  ring: string; // ikon kutusu arka planı
  featured?: boolean; // yeşil belediye vurgusu
}

function KpiCard({
  label,
  value,
  decimals = 0,
  unit,
  icon: Icon,
  accent,
  ring,
  featured,
}: KpiCardProps) {
  const animated = useCountUp(value);
  const display = animated.toLocaleString('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <div
      className={`glass animate-fade-in-up rounded-2xl p-4 transition hover:bg-white/[0.12] ${
        featured ? 'ring-1 ring-emerald-400/30' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${ring} ${accent}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        {featured && (
          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
            Yeşil Belediye
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums text-white">
        {display}
        {unit && (
          <span className="ml-1 text-base font-semibold text-slate-300">
            {unit}
          </span>
        )}
      </p>
      <p className="text-sm text-slate-300">{label}</p>
    </div>
  );
}

/** Komuta merkezi KPI şeridi — animasyonlu metrik kartları (Faz 6.4). */
export default function CommandHero() {
  const hydrated = useHasHydrated();
  const sanitizedAddresses = useDeliveryStore((s) => s.sanitizedAddresses);
  const vehicleConfigs = useDeliveryStore((s) => s.vehicleConfigs);
  const routes = useDeliveryStore((s) => s.routes);

  const stats = useMemo(() => {
    if (!hydrated) {
      return {
        addresses: 0,
        vehicles: 0,
        boxes: 0,
        delivered: 0,
        savedKm: 0,
        fuel: 0,
        co2: 0,
      };
    }
    const addresses = sanitizedAddresses.length;
    const vehicles = vehicleConfigs.length;
    const boxes = sanitizedAddresses.reduce((s, a) => s + (a.boxCount || 0), 0);
    const delivered = routes.reduce(
      (s, r) => s + r.stops.filter((st) => st.status === 'DELIVERED').length,
      0,
    );
    const optimizedKm = routes.reduce(
      (s, r) => s + (r.totalDistanceKm || 0),
      0,
    );
    const standardKm =
      OPTIMIZATION_SAVING_RATIO < 1
        ? optimizedKm / (1 - OPTIMIZATION_SAVING_RATIO)
        : optimizedKm;
    const savedKm = Math.max(0, standardKm - optimizedKm);
    return {
      addresses,
      vehicles,
      boxes,
      delivered,
      savedKm,
      fuel: savedKm * FUEL_LITER_PER_KM,
      co2: (savedKm * CO2_GRAM_PER_KM) / 1000,
    };
  }, [hydrated, sanitizedAddresses, vehicleConfigs, routes]);

  return (
    <div>
      {/* Ana KPI kartları */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Toplam Adres"
          value={stats.addresses}
          icon={MapPinned}
          accent="text-sky-300"
          ring="bg-sky-400/15"
        />
        <KpiCard
          label="Aktif Araç Sayısı"
          value={stats.vehicles}
          icon={Truck}
          accent="text-blue-300"
          ring="bg-blue-400/15"
        />
        <KpiCard
          label="Tahmini Yakıt Tasarrufu"
          value={stats.fuel}
          decimals={1}
          unit="L"
          icon={Fuel}
          accent="text-emerald-300"
          ring="bg-emerald-400/15"
          featured
        />
        <KpiCard
          label="Engellenen CO₂"
          value={stats.co2}
          decimals={1}
          unit="kg"
          icon={Wind}
          accent="text-emerald-300"
          ring="bg-emerald-400/15"
          featured
        />
      </div>

      {/* İkincil metrik şeridi */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <MiniStat
          label="Toplam Koli"
          value={stats.boxes}
          icon={Package}
          accent="text-amber-300"
        />
        <MiniStat
          label="Teslim Edilen"
          value={stats.delivered}
          icon={CheckCircle2}
          accent="text-emerald-300"
        />
        <MiniStat
          label="Kısaltılan Mesafe"
          value={stats.savedKm}
          decimals={1}
          unit="km"
          icon={RouteIcon}
          accent="text-sky-300"
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  decimals = 0,
  unit,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  decimals?: number;
  unit?: string;
  icon: LucideIcon;
  accent: string;
}) {
  const animated = useCountUp(value);
  const display = animated.toLocaleString('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <div className="glass flex items-center gap-2.5 rounded-xl px-3 py-2.5">
      <Icon className={`h-4 w-4 shrink-0 ${accent}`} />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-bold tabular-nums text-white">
          {display}
          {unit && <span className="ml-0.5 text-xs text-slate-300">{unit}</span>}
        </p>
        <p className="truncate text-[11px] text-slate-400">{label}</p>
      </div>
    </div>
  );
}
