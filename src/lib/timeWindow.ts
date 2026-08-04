// Ziyaret zaman penceresi (time-window) yardımcıları.
//
// Amaç: bazı hanelere yalnızca belirli saat aralığında gidilebilir
// (ör. yaşlı/engelli birey evde). Excel'deki "Ziyaret Saati" sütunu serbest
// yazımla gelebildiğinden burada tek biçime ("HH:MM-HH:MM") indirgenir; rota
// sırasına göre tahmini varış (ETA) hesaplanıp pencereyle karşılaştırılır.

import { haversineKm } from '@/lib/clustering';

export interface Point {
  lat: number;
  lng: number;
}

/** Dakikayı "HH:MM" biçimine çevirir (gün taşmasında 24 saate göre sarmaz). */
export function minutesToHHMM(min: number): string {
  const clamped = Math.max(0, Math.round(min));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "9", "09", "9:30", "09.30" gibi bir saati dakikaya çevirir (yoksa null). */
function parseClock(raw: string): number | null {
  const m = raw.trim().match(/^(\d{1,2})(?:[.:h](\d{1,2}))?$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (!Number.isFinite(h) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Serbest yazılmış ziyaret saatini "HH:MM-HH:MM" biçimine indirger.
 * Kabul edilen örnekler: "09:00-12:00", "9-12", "09.00 - 12.00", "9:30-11".
 * Geçersiz/boşsa '' döner.
 */
export function normalizeTimeWindow(raw: unknown): string {
  if (raw == null) return '';
  const text = String(raw).trim();
  if (!text) return '';

  // Ayırıcı: tire, "ile", "–", "—", "/" veya "arası".
  const parts = text
    .replace(/ile|arası|arasi|—|–|to|\//gi, '-')
    .split('-')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return '';

  const start = parseClock(parts[0]);
  const end = parseClock(parts[1]);
  if (start == null || end == null || end <= start) return '';

  return `${minutesToHHMM(start)}-${minutesToHHMM(end)}`;
}

/** Normalize edilmiş pencereyi başlangıç/bitiş dakikalarına ayrıştırır. */
export function parseTimeWindow(
  tw: string | undefined,
): { startMin: number; endMin: number } | null {
  if (!tw) return null;
  const [a, b] = tw.split('-');
  const startMin = parseClock(a ?? '');
  const endMin = parseClock(b ?? '');
  if (startMin == null || endMin == null) return null;
  return { startMin, endMin };
}

export interface EtaOptions {
  /** Rotanın başlangıç saati (dakika/gün-içi). Varsayılan 09:00. */
  startMinutes?: number;
  /** Ortalama kentsel hız (km/sa). Varsayılan 22. */
  avgSpeedKmh?: number;
  /** Her durakta geçen ortalama teslim süresi (dk). Varsayılan 4. */
  serviceMinutesPerStop?: number;
  /** İsteğe bağlı başlangıç noktası (şoförün/deponun konumu). */
  origin?: Point | null;
}

/**
 * Sıralı duraklar için tahmini varış saatlerini (dakika/gün-içi) hesaplar.
 * Ardışık duraklar arası kuş-uçuşu mesafe + ortalama hız + durak servis süresi
 * kullanılır. OSRM'nin per-leg süresi olmadan makul bir tahmin sağlar.
 */
export function computeStopEtas(
  points: Point[],
  opts: EtaOptions = {},
): number[] {
  const start = opts.startMinutes ?? 9 * 60;
  const speed = opts.avgSpeedKmh ?? 22;
  const service = opts.serviceMinutesPerStop ?? 4;

  const etas: number[] = [];
  let clock = start;
  let prev: Point | null = opts.origin ?? null;

  for (const p of points) {
    if (prev) {
      const km = haversineKm(prev.lat, prev.lng, p.lat, p.lng);
      clock += (km / speed) * 60; // seyahat süresi
    }
    etas.push(clock);
    clock += service; // durakta geçen süre bir sonrakine eklenir
    prev = p;
  }
  return etas;
}

export type WindowFit = 'none' | 'ok' | 'early' | 'late';

/**
 * Tahmini varış, pencereye uyuyor mu?
 *  - 'none'  : pencere tanımlı değil
 *  - 'ok'    : pencere içinde
 *  - 'early' : pencereden önce varılıyor (beklemek gerekir — hafif uyarı)
 *  - 'late'  : pencere kapandıktan sonra (kritik — kaçırıldı)
 */
export function windowFit(arrivalMin: number, tw: string | undefined): WindowFit {
  const parsed = parseTimeWindow(tw);
  if (!parsed) return 'none';
  if (arrivalMin < parsed.startMin - 1) return 'early';
  if (arrivalMin > parsed.endMin + 1) return 'late';
  return 'ok';
}
