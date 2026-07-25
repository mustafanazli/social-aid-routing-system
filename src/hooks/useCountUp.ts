'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Bir sayıyı 0'dan (veya önceki değerden) hedef değere yumuşakça animasyonla
 * çıkarır (KPI kartları için "counter" efekti). requestAnimationFrame tabanlı.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    // easeOutCubic
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const current = from + (target - from) * ease(progress);
      setValue(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}
