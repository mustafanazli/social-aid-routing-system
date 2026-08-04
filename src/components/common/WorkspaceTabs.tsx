'use client';

import { type ComponentType } from 'react';
import {
  Upload,
  MapPinned,
  Route as RouteIcon,
  Share2,
  type LucideIcon,
} from 'lucide-react';

import { useDeliveryStore } from '@/store/useDeliveryStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import ExcelWorkspace from '@/components/excel/ExcelWorkspace';
import MapSection from '@/components/map/MapSection';
import RoutePlanner from '@/components/route/RoutePlanner';
import RouteExportPanel from '@/components/route/RouteExportPanel';

interface TabDef {
  id: number;
  short: string;
  title: string;
  icon: LucideIcon;
  Component: ComponentType;
}

const TABS: TabDef[] = [
  { id: 1, short: 'Adres Verisi', title: 'Excel & Adres İşleme', icon: Upload, Component: ExcelWorkspace },
  { id: 2, short: 'Harita', title: 'Harita & Geocoding', icon: MapPinned, Component: MapSection },
  { id: 3, short: 'Filo & Rota', title: 'Araç Kümeleme & Rota', icon: RouteIcon, Component: RoutePlanner },
  { id: 4, short: 'Paylaşım', title: 'Şoför & Rapor', icon: Share2, Component: RouteExportPanel },
];

/** Komuta konsolu — sekmeli iş akışı (Excel → Harita → Rota → Paylaşım). */
export default function WorkspaceTabs() {
  const hydrated = useHasHydrated();

  const sanitizedAddresses = useDeliveryStore((s) => s.sanitizedAddresses);
  const geocodedLocations = useDeliveryStore((s) => s.geocodedLocations);
  const routes = useDeliveryStore((s) => s.routes);
  const activeStep = useDeliveryStore((s) => s.activeStep);
  const setActiveStep = useDeliveryStore((s) => s.setActiveStep);
  // Aktif sekme store'dan sürülür → başka bileşenler (ör. "yeni dağıtıma taşı")
  // setActiveStep ile sekme değiştirebilir. Hidrasyondan önce 1. sekme.
  const active = hydrated ? activeStep : 1;

  const badgeFor = (id: number): number | null => {
    if (!hydrated) return null;
    if (id === 1) return sanitizedAddresses.length || null;
    if (id === 2)
      return (
        geocodedLocations.filter(
          (l) =>
            l.geocodingStatus === 'SUCCESS' || l.geocodingStatus === 'MANUAL',
        ).length || null
      );
    if (id === 3) return routes.length || null;
    if (id === 4)
      return (
        routes.reduce(
          (s, r) =>
            s + r.stops.filter((st) => st.status === 'DELIVERED').length,
          0,
        ) || null
      );
    return null;
  };

  const ActiveComponent = TABS.find((t) => t.id === active)!.Component;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:p-3">
      {/* Sekme çubuğu */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          const badge = badgeFor(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveStep(tab.id as 1 | 2 | 3 | 4)}
              className={`group inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition active:scale-95 ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold ${
                  isActive ? 'bg-white/20' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {tab.id}
              </span>
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.short}</span>
              {badge != null && (
                <span
                  className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Aktif içerik */}
      <div key={active} className="animate-fade-in-up p-1 pt-3">
        <ActiveComponent />
      </div>
    </div>
  );
}
