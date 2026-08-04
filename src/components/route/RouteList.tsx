'use client';

import { useState } from 'react';
import {
  DragDropContext,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  ChevronDown,
  Truck,
  Route as RouteIcon,
  Clock,
  Package,
  Loader2,
  Eye,
  EyeOff,
  CalendarClock,
} from 'lucide-react';

import type { VehicleRoute, StopItem } from '@/types/fleet';
import DraggableStopItem from '@/components/route/DraggableStopItem';
import {
  computeStopEtas,
  windowFit,
  type Point,
  type WindowFit,
} from '@/lib/timeWindow';

interface RouteListProps {
  routes: VehicleRoute[];
  /** Yeniden hesaplanan aracın id'si (spinner göstermek için). */
  recalculatingVehicleId: string | null;
  /** Haritada odaklanılan araç (null = hepsi). */
  focusedVehicleId: string | null;
  onFocus: (vehicleId: string | null) => void;
  /** Sürükle-bırak sonrası yeni durak sırası. */
  onReorder: (vehicleId: string, newStops: StopItem[]) => void;
  /** Rota başlangıç saati "HH:MM" — ziyaret penceresi ETA hesabı için. */
  startTime?: string;
  /** İsteğe bağlı başlangıç noktası (şoför/depo). */
  origin?: Point | null;
}

/** "HH:MM" → gün-içi dakika (geçersizse 09:00). */
function startMinutesFrom(hhmm: string | undefined): number {
  const m = (hhmm ?? '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 9 * 60;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function formatKm(km: number): string {
  return km >= 10 ? km.toFixed(0) : km.toFixed(1);
}

function formatMin(min: number): string {
  if (min < 60) return `${Math.round(min)} dk`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h} sa ${m} dk`;
}

/** Araç bazlı durak listesi (accordion + sürükle-bırak) — PRD Bölüm 4.4. */
export default function RouteList({
  routes,
  recalculatingVehicleId,
  focusedVehicleId,
  onFocus,
  onReorder,
  startTime,
  origin,
}: RouteListProps) {
  const startMinutes = startMinutesFrom(startTime);
  // Varsayılan: ilk araç açık.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    routes.length > 0 ? { [routes[0].vehicleId]: true } : {},
  );

  const toggle = (vehicleId: string) =>
    setExpanded((e) => ({ ...e, [vehicleId]: !e[vehicleId] }));

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    // Yalnızca aynı araç içinde sıralama (droppableId = vehicleId).
    if (source.droppableId !== destination.droppableId) return;
    if (source.index === destination.index) return;

    const route = routes.find((r) => r.vehicleId === source.droppableId);
    if (!route) return;

    const newStops = Array.from(route.stops);
    const [moved] = newStops.splice(source.index, 1);
    newStops.splice(destination.index, 0, moved);
    onReorder(route.vehicleId, newStops);
  };

  if (routes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
        Rota henüz hesaplanmadı. Araç bilgilerini girip &quot;Rotayı
        Hesapla&quot; deyin.
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-3">
        {routes.map((route) => {
          const isOpen = expanded[route.vehicleId] ?? false;
          const isRecalculating = recalculatingVehicleId === route.vehicleId;
          const isFocused = focusedVehicleId === route.vehicleId;

          // Ziyaret penceresi olan duraklar için tahmini varış (ETA) + uyum.
          const etas = computeStopEtas(
            route.stops.map((s) => ({
              lat: s.location.lat,
              lng: s.location.lng,
            })),
            { startMinutes, origin },
          );
          const fits: WindowFit[] = route.stops.map((s, i) =>
            windowFit(etas[i], s.location.timeWindow),
          );
          const lateCount = fits.filter((f) => f === 'late').length;
          const windowedCount = fits.filter((f) => f !== 'none').length;

          return (
            <div
              key={route.vehicleId}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              style={{ borderLeft: `4px solid ${route.vehicleColor}` }}
            >
              {/* Accordion başlığı */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => toggle(route.vehicleId)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ background: route.vehicleColor }}
                  >
                    <Truck className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-800">
                      {route.vehicleName}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-0.5">
                        <Package className="h-3 w-3" />
                        {route.totalBoxesAssigned}/{route.assignedCapacity}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <RouteIcon className="h-3 w-3" />
                        {formatKm(route.totalDistanceKm)} km
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {formatMin(route.totalDurationMinutes)}
                      </span>
                      <span>{route.stops.length} durak</span>
                      {windowedCount > 0 && (
                        <span
                          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                            lateCount > 0
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                          title="Ziyaret saati penceresi olan duraklar"
                        >
                          <CalendarClock className="h-2.5 w-2.5" />
                          {lateCount > 0
                            ? `${lateCount} pencere dışı`
                            : `${windowedCount} pencere uyumlu`}
                        </span>
                      )}
                    </span>
                  </span>
                </button>

                {isRecalculating && (
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                )}

                {/* Haritada odakla/hepsini göster */}
                <button
                  type="button"
                  onClick={() => onFocus(isFocused ? null : route.vehicleId)}
                  title={isFocused ? 'Tüm araçları göster' : 'Haritada yalnız bunu göster'}
                  className={`rounded-md p-1.5 transition ${
                    isFocused
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                  }`}
                >
                  {isFocused ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => toggle(route.vehicleId)}
                  className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Durak listesi (sürükle-bırak) */}
              {isOpen && (
                <Droppable droppableId={route.vehicleId}>
                  {(provided) => (
                    <ul
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-2 border-t border-slate-100 bg-slate-50/60 p-3"
                    >
                      {route.stops.length === 0 ? (
                        <li className="py-4 text-center text-xs text-slate-400">
                          Bu araca durak atanmadı.
                        </li>
                      ) : (
                        route.stops.map((stop, index) => (
                          <DraggableStopItem
                            key={stop.location.id}
                            vehicleId={route.vehicleId}
                            stop={stop}
                            index={index}
                            color={route.vehicleColor}
                            etaMinutes={etas[index]}
                            windowFit={fits[index]}
                          />
                        ))
                      )}
                      {provided.placeholder}
                    </ul>
                  )}
                </Droppable>
              )}
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
