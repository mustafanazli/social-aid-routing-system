'use client';

import { useEffect, useState } from 'react';
import { Truck, Package, Play, RotateCcw, AlertTriangle } from 'lucide-react';

import { useDeliveryStore } from '@/store/useDeliveryStore';
import { VEHICLE_COLOR_PALETTE } from '@/constants/config';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import type { VehicleConfig } from '@/types/fleet';

interface VehicleConfigFormProps {
  onOptimize: () => void;
  isOptimizing: boolean;
  /** Haritada konumu olan adres sayısı (rota kurulabilir mi?). */
  locatedCount: number;
  /** Konumlanan adreslerin toplam koli sayısı. */
  totalBoxes: number;
  /** Daha önce rota hesaplanmış mı? (buton etiketini değiştirir) */
  hasRoutes: boolean;
}

const MIN_VEHICLES = 1;
const MAX_VEHICLES = 10;

/** Araç sayısı & kapasite kontrol paneli (PRD Bölüm 4.1). */
export default function VehicleConfigForm({
  onOptimize,
  isOptimizing,
  locatedCount,
  totalBoxes,
  hasRoutes,
}: VehicleConfigFormProps) {
  const vehicleConfigs = useDeliveryStore((s) => s.vehicleConfigs);
  const setVehicleConfigs = useDeliveryStore((s) => s.setVehicleConfigs);

  const [count, setCount] = useState(() =>
    vehicleConfigs.length >= MIN_VEHICLES ? vehicleConfigs.length : 2,
  );
  const [capacity, setCapacity] = useState(
    () => vehicleConfigs[0]?.capacity ?? 40,
  );

  // count/capacity değiştikçe araç konfigürasyonlarını yeniden üret ve store'a yaz.
  useEffect(() => {
    const configs: VehicleConfig[] = Array.from({ length: count }, (_, i) => ({
      id: `vehicle-${i + 1}`,
      name: `Araç ${i + 1}`,
      capacity,
      color: VEHICLE_COLOR_PALETTE[i % VEHICLE_COLOR_PALETTE.length],
    }));
    setVehicleConfigs(configs);
  }, [count, capacity, setVehicleConfigs]);

  const totalCapacity = count * capacity;
  const insufficient = totalBoxes > totalCapacity;
  const canOptimize = locatedCount > 0 && count >= MIN_VEHICLES && !isOptimizing;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Araç sayısı */}
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Truck className="h-3.5 w-3.5 text-emerald-600" />
            Dağıtım Yapacak Araç Sayısı
          </span>
          <input
            type="number"
            min={MIN_VEHICLES}
            max={MAX_VEHICLES}
            value={count}
            onChange={(e) => {
              const v = Math.round(Number(e.target.value));
              if (Number.isFinite(v)) {
                setCount(Math.min(MAX_VEHICLES, Math.max(MIN_VEHICLES, v)));
              }
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        {/* Araç başına kapasite */}
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Package className="h-3.5 w-3.5 text-amber-600" />
            Araç Başına Maksimum Koli Kapasitesi
          </span>
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => {
              const v = Math.round(Number(e.target.value));
              if (Number.isFinite(v)) setCapacity(Math.max(1, v));
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </label>
      </div>

      {/* Renk önizlemesi */}
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600"
          >
            <span
              className="h-3 w-3 rounded-full"
              style={{
                background:
                  VEHICLE_COLOR_PALETTE[i % VEHICLE_COLOR_PALETTE.length],
              }}
            />
            Araç {i + 1}
          </span>
        ))}
      </div>

      {/* Kapasite özeti / uyarı */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-slate-500">
          Toplam kapasite:{' '}
          <strong className="text-slate-700">{totalCapacity} koli</strong>
        </span>
        <span className="text-slate-500">
          Yüklenecek:{' '}
          <strong className="text-slate-700">{totalBoxes} koli</strong>
        </span>
        {insufficient && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            Kapasite yetersiz — bazı duraklar taşacak
          </span>
        )}
      </div>

      {/* Optimize butonu */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOptimize}
          disabled={!canOptimize}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isOptimizing ? (
            <LoadingSpinner className="text-white" label="Hesaplanıyor…" />
          ) : hasRoutes ? (
            <>
              <RotateCcw className="h-4 w-4" />
              Rotayı Yeniden Optimize Et
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Rotayı Hesapla / Optimize Et
            </>
          )}
        </button>
        {locatedCount === 0 && (
          <span className="text-xs text-slate-500">
            Önce Adım 2&apos;de adresleri haritalayın.
          </span>
        )}
      </div>
    </div>
  );
}
