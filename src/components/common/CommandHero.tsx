'use client';

import { useMemo } from 'react';
import {
  MapPinned,
  Truck,
  Package,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';

import { useDeliveryStore } from '@/store/useDeliveryStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { useCountUp } from '@/hooks/useCountUp';

interface KpiCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  accent: string; // ikon rengi
  ring: string; // ikon kutusu arka planı
}

function KpiCard({ label, value, icon: Icon, accent, ring }: KpiCardProps) {
  const animated = useCountUp(value);
  const display = Math.round(animated).toLocaleString('tr-TR');

  return (
    <div className="animate-fade-in-up rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${ring} ${accent}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
        {display}
      </p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

/** Üst özet — temel dağıtım sayıları (adres, araç, koli, teslim). */
export default function CommandHero() {
  const hydrated = useHasHydrated();
  const sanitizedAddresses = useDeliveryStore((s) => s.sanitizedAddresses);
  const vehicleConfigs = useDeliveryStore((s) => s.vehicleConfigs);
  const routes = useDeliveryStore((s) => s.routes);

  const stats = useMemo(() => {
    if (!hydrated) {
      return { addresses: 0, vehicles: 0, boxes: 0, delivered: 0 };
    }
    return {
      addresses: sanitizedAddresses.length,
      vehicles: vehicleConfigs.length,
      boxes: sanitizedAddresses.reduce((s, a) => s + (a.boxCount || 0), 0),
      delivered: routes.reduce(
        (s, r) => s + r.stops.filter((st) => st.status === 'DELIVERED').length,
        0,
      ),
    };
  }, [hydrated, sanitizedAddresses, vehicleConfigs, routes]);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        label="Toplam Adres"
        value={stats.addresses}
        icon={MapPinned}
        accent="text-sky-600"
        ring="bg-sky-50"
      />
      <KpiCard
        label="Aktif Araç Sayısı"
        value={stats.vehicles}
        icon={Truck}
        accent="text-blue-600"
        ring="bg-blue-50"
      />
      <KpiCard
        label="Toplam Koli"
        value={stats.boxes}
        icon={Package}
        accent="text-amber-600"
        ring="bg-amber-50"
      />
      <KpiCard
        label="Teslim Edilen"
        value={stats.delivered}
        icon={CheckCircle2}
        accent="text-emerald-600"
        ring="bg-emerald-50"
      />
    </div>
  );
}
