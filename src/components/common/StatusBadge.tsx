import { CheckCircle2, Clock, HomeIcon, XCircle } from 'lucide-react';

import type { StopStatus } from '@/types/fleet';

interface StatusBadgeProps {
  status: StopStatus;
  className?: string;
}

const CONFIG: Record<
  StopStatus,
  { label: string; classes: string; Icon: typeof CheckCircle2 }
> = {
  PENDING: {
    label: 'Bekliyor',
    classes: 'bg-slate-100 text-slate-600',
    Icon: Clock,
  },
  DELIVERED: {
    label: 'Teslim Edildi',
    classes: 'bg-emerald-100 text-emerald-700',
    Icon: CheckCircle2,
  },
  NOT_HOME: {
    label: 'Evde Yok',
    classes: 'bg-amber-100 text-amber-700',
    Icon: HomeIcon,
  },
  CANCELLED: {
    label: 'İptal',
    classes: 'bg-red-100 text-red-700',
    Icon: XCircle,
  },
};

/** Teslimat durum etiketi (PRD Bölüm 2 · common/StatusBadge). */
export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const { label, classes, Icon } = CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${classes} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
