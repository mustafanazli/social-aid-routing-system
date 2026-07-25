import type { AddressPriority, GeocodedLocation } from '@/types/address';
import { normalizeTr } from '@/lib/utils';

/**
 * Öncelik yardımcıları (Faz 6.5).
 * URGENT (Acil) > HIGH (Yüksek) > NORMAL. Küçük ağırlık = önce ziyaret.
 */

export const PRIORITY_WEIGHT: Record<AddressPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
};

export const PRIORITY_LABEL: Record<AddressPriority, string> = {
  URGENT: 'Acil',
  HIGH: 'Yüksek',
  NORMAL: 'Normal',
};

/** Excel'den gelen serbest metni öncelik değerine çevirir. */
export function parsePriority(value: unknown): AddressPriority {
  const t = normalizeTr(String(value ?? ''));
  if (!t) return 'NORMAL';
  if (
    t.includes('acil') ||
    t.includes('urgent') ||
    t.includes('yasli') ||
    t.includes('hasta') ||
    t === '2'
  ) {
    return 'URGENT';
  }
  if (t.includes('yuksek') || t.includes('high') || t.includes('oncelik')) {
    return 'HIGH';
  }
  return 'NORMAL';
}

/** Alanı olmayan eski kayıtlar için güvenli okuma. */
export function priorityOf(loc: { priority?: AddressPriority }): AddressPriority {
  return loc.priority ?? 'NORMAL';
}

/**
 * OSRM'in coğrafi olarak optimize ettiği sırayı, önceliğe göre yeniden dizer:
 * önce URGENT, sonra HIGH, sonra NORMAL — her katman KENDİ optimize sırasını
 * korur. Böylece coğrafi verimlilik büyük ölçüde korunurken acil adresler öne
 * çekilir. Değişiklik olup olmadığını da bildirir (geometri yeniden hesabı için).
 */
export function applyPriorityOrder(
  optimized: GeocodedLocation[],
): { ordered: GeocodedLocation[]; changed: boolean } {
  // Stabil sıralama: önce mevcut optimize indeksini sakla.
  const indexed = optimized.map((loc, index) => ({ loc, index }));
  indexed.sort((a, b) => {
    const wa = PRIORITY_WEIGHT[priorityOf(a.loc)];
    const wb = PRIORITY_WEIGHT[priorityOf(b.loc)];
    if (wa !== wb) return wa - wb;
    return a.index - b.index; // aynı öncelik → optimize sırayı koru
  });

  const ordered = indexed.map((x) => x.loc);
  const changed = ordered.some((loc, i) => loc.id !== optimized[i]?.id);
  return { ordered, changed };
}
