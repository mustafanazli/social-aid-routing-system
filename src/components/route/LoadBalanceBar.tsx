'use client';

import { Scale, AlertTriangle, CheckCircle2 } from 'lucide-react';

import type { VehicleRoute } from '@/types/fleet';

interface LoadBalanceBarProps {
  routes: VehicleRoute[];
}

/**
 * Araçlara dağıtılan koli yükünü görselleştirir (Özellik 6).
 * Her araç için doluluk çubuğu (koli/kapasite) + kapasite aşımı uyarısı ve
 * araçlar arası denge ("en dolu" ile "en boş" farkı) özeti gösterir.
 */
export default function LoadBalanceBar({ routes }: LoadBalanceBarProps) {
  if (routes.length === 0) return null;

  const loads = routes.map((r) => ({
    id: r.vehicleId,
    name: r.vehicleName,
    color: r.vehicleColor,
    boxes: r.totalBoxesAssigned,
    capacity: Math.max(1, r.assignedCapacity),
    stops: r.stops.length,
  }));

  const totalBoxes = loads.reduce((s, l) => s + l.boxes, 0);
  const maxBoxes = Math.max(...loads.map((l) => l.boxes));
  const minBoxes = Math.min(...loads.map((l) => l.boxes));
  const spread = maxBoxes - minBoxes;
  // Denge: en dolu ile en boş araç arası fark, ortalamanın %40'ından azsa "dengeli".
  const avg = totalBoxes / loads.length;
  const balanced = loads.length < 2 || spread <= Math.max(2, avg * 0.4);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <Scale className="h-4 w-4 text-emerald-600" />
          Araç Yük Dengesi
        </h4>
        {balanced ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Dengeli dağıtım
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Dengesiz — fark {spread} koli
          </span>
        )}
      </div>

      <ul className="space-y-2.5">
        {loads.map((l) => {
          const pct = Math.min(100, Math.round((l.boxes / l.capacity) * 100));
          const over = l.boxes > l.capacity;
          return (
            <li key={l.id}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: l.color }}
                  />
                  <span className="max-w-[10rem] truncate">{l.name}</span>
                </span>
                <span
                  className={`font-semibold ${
                    over ? 'text-rose-600' : 'text-slate-500'
                  }`}
                >
                  {l.boxes}/{l.capacity} koli · {l.stops} durak
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(4, pct)}%`,
                    background: over ? '#e11d48' : l.color,
                  }}
                />
              </div>
              {over && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-600">
                  <AlertTriangle className="h-3 w-3" />
                  Kapasite aşıldı (+{l.boxes - l.capacity} koli)
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
