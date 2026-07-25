import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  className?: string;
  label?: string;
}

/** Basit yüklenme göstergesi (PRD Bölüm 2 · common/LoadingSpinner). */
export default function LoadingSpinner({
  className,
  label,
}: LoadingSpinnerProps) {
  return (
    <span className="inline-flex items-center gap-2 text-slate-500">
      <Loader2 className={cn('h-4 w-4 animate-spin', className)} />
      {label && <span className="text-sm">{label}</span>}
    </span>
  );
}
