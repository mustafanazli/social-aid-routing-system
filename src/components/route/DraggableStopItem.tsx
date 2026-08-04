'use client';

import { Draggable } from '@hello-pangea/dnd';
import { GripVertical, MapPin, Package, Clock } from 'lucide-react';

import type { StopItem } from '@/types/fleet';
import { minutesToHHMM, type WindowFit } from '@/lib/timeWindow';

interface DraggableStopItemProps {
  vehicleId: string;
  stop: StopItem;
  index: number;
  color: string;
  /** Bu durak için tahmini varış (gün-içi dakika). */
  etaMinutes?: number;
  /** Tahmini varışın ziyaret penceresine uyumu. */
  windowFit?: WindowFit;
}

/** Sürükle-bırak yapılabilen tek durak satırı (PRD Bölüm 4.4). */
export default function DraggableStopItem({
  vehicleId,
  stop,
  index,
  color,
  etaMinutes,
  windowFit,
}: DraggableStopItemProps) {
  const { location } = stop;
  const tw = location.timeWindow;
  const fitCls =
    windowFit === 'late'
      ? 'bg-rose-100 text-rose-700'
      : windowFit === 'early'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-emerald-100 text-emerald-700';

  return (
    <Draggable draggableId={`${vehicleId}:${location.id}`} index={index}>
      {(provided, snapshot) => (
        <li
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`flex items-center gap-3 rounded-xl border bg-white p-2.5 transition ${
            snapshot.isDragging
              ? 'border-emerald-400 shadow-lg ring-2 ring-emerald-100'
              : 'border-slate-200'
          }`}
        >
          {/* Sürükleme tutamacı */}
          <span
            {...provided.dragHandleProps}
            className="cursor-grab text-slate-300 transition hover:text-slate-500 active:cursor-grabbing"
            title="Sürükleyerek sırasını değiştir"
          >
            <GripVertical className="h-4 w-4" />
          </span>

          {/* Sıra numarası rozeti (araç renginde) */}
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: color }}
          >
            {stop.stopOrder}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">
              {location.recipientName || 'İsimsiz alıcı'}
            </p>
            <p className="truncate text-xs text-slate-500">
              {location.cleanAddress}
            </p>
            {(tw || etaMinutes != null) && (
              <p className="mt-1 flex flex-wrap items-center gap-1.5">
                {etaMinutes != null && (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    <Clock className="h-2.5 w-2.5" />~{minutesToHHMM(etaMinutes)}
                  </span>
                )}
                {tw && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${fitCls}`}
                    title={
                      windowFit === 'late'
                        ? 'Tahmini varış pencereden sonra — sırayı öne alın'
                        : windowFit === 'early'
                          ? 'Pencereden önce varış — beklemek gerekebilir'
                          : 'Ziyaret penceresine uygun'
                    }
                  >
                    {tw}
                    {windowFit === 'late' ? ' ✕' : windowFit === 'ok' ? ' ✓' : ''}
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
              <Package className="h-3 w-3" />
              {location.boxCount}
            </span>
            {location.neighborhood && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                <MapPin className="h-2.5 w-2.5" />
                {location.neighborhood}
              </span>
            )}
          </div>
        </li>
      )}
    </Draggable>
  );
}
