'use client';

import { Draggable } from '@hello-pangea/dnd';
import { GripVertical, MapPin, Package, AlertTriangle } from 'lucide-react';

import type { StopItem } from '@/types/fleet';
import { priorityOf } from '@/lib/priority';

interface DraggableStopItemProps {
  vehicleId: string;
  stop: StopItem;
  index: number;
  color: string;
}

/** Sürükle-bırak yapılabilen tek durak satırı (PRD Bölüm 4.4). */
export default function DraggableStopItem({
  vehicleId,
  stop,
  index,
  color,
}: DraggableStopItemProps) {
  const { location } = stop;

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
            <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-800">
              {priorityOf(location) === 'URGENT' && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  ACİL
                </span>
              )}
              {location.recipientName || 'İsimsiz alıcı'}
            </p>
            <p className="truncate text-xs text-slate-500">
              {location.cleanAddress}
            </p>
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
