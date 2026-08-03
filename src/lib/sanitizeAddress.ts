import {
  PENDIK_NEIGHBORHOODS,
  PENDIK_DISTRICT,
  PENDIK_CITY,
  PENDIK_COUNTRY,
} from '@/constants/pendikNeighborhoods';
import type { RawExcelRow, SanitizedAddress } from '@/types/address';
import { generateId, normalizeTr } from '@/lib/utils';

export interface SanitizeResult {
  /** Temizlenmiş ve ", Pendik, İstanbul, Türkiye" eki eklenmiş tam adres. */
  cleanAddress: string;
  /** Adres içinde tespit edilen Pendik mahallesi ('' = bulunamadı). */
  neighborhood: string;
}

/**
 * Geocoding sorgusunu bozan etiket + değer kalıplarını temizleyen regex'ler.
 * Örn: "Kat: 3", "Daire No: 7", "Tel: 0555...", "Blok: A".
 */
const NOISE_PATTERNS: RegExp[] = [
  // Telefon etiketleri ve numaraları
  /\b(tel(?:efon)?|gsm|cep)\b\s*[:.\-]?\s*\+?\d[\d\s().\-]{6,}\d/gi,
  /\+?\(?\d{2,4}\)?[\s.\-]?\d{3}[\s.\-]?\d{2,4}[\s.\-]?\d{2,4}/g,
  // Kat bilgisi
  /\bkat\b\s*[:.\-]?\s*\d+\.?/gi,
  // Daire / iç kapı
  /\b(daire|dair|d)\b\s*(no)?\s*[:.\-]\s*\d+/gi,
  /\bic\s*kapi\b\s*(no)?\s*[:.\-]?\s*\d+/gi,
  // Dış kapı / kapı no etiketi (değeri koru: sadece etiketi düşür)
  /\b(dis\s*kapi)\b\s*(no)?\s*[:.\-]?/gi,
  // Blok etiketi
  /\bblok\b\s*[:.\-]?\s*[a-z0-9]+/gi,
  // Yalnız kalan etiket kelimeleri + iki nokta
  /\b(kat|daire|tel|telefon|gsm|cep|no)\b\s*:/gi,
];

/** İki string arasındaki Levenshtein (düzenleme) mesafesini hesaplar. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // ekleme
        prev[j] + 1, // silme
        prev[j - 1] + cost, // değiştirme
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

// Mahalle adlarını bir kez normalize ederek önbelleğe al.
// `normNoSpace`: "Fevzi Çakmak" ↔ "Fevziçakmak" gibi bitişik/ayrık yazım
// farklarını yakalamak için boşlukları da atılmış hâli.
const NORMALIZED_NEIGHBORHOODS = PENDIK_NEIGHBORHOODS.map((name) => ({
  name,
  norm: normalizeTr(name),
  normNoSpace: normalizeTr(name).replace(/\s+/g, ''),
}));

/**
 * Verilen metin içinde bir Pendik mahallesi tespit eder.
 * Önce doğrudan içerme, ardından yazım hatalarına toleranslı
 * (Levenshtein tabanlı) kayan pencere eşleştirmesi kullanır.
 */
export function detectNeighborhood(text: string): string {
  const normText = normalizeTr(text).replace(/\bmah(?:allesi|\.)?\b/g, ' ');
  const normTextNoSpace = normText.replace(/\s+/g, '');

  // 1) Doğrudan içerme — boşluklu ve boşluksuz biçimlerin ikisini de dener,
  //    en uzun (en spesifik) eşleşmeyi tercih eder.
  const directMatches = NORMALIZED_NEIGHBORHOODS.filter(
    (n) =>
      normText.includes(n.norm) || normTextNoSpace.includes(n.normNoSpace),
  ).sort((a, b) => b.normNoSpace.length - a.normNoSpace.length);
  if (directMatches.length > 0) return directMatches[0].name;

  // 2) Yazım hatası toleranslı eşleşme (kayan kelime penceresi).
  const words = normText.split(' ').filter(Boolean);
  let best: { name: string; distance: number } | null = null;

  for (const { name, norm } of NORMALIZED_NEIGHBORHOODS) {
    const windowSize = norm.split(' ').length;
    for (let i = 0; i + windowSize <= words.length; i++) {
      const candidate = words.slice(i, i + windowSize).join(' ');
      const distance = levenshtein(candidate, norm);
      // Kısa isimlerde 1, uzun isimlerde 2 karaktere kadar hata tolere edilir.
      const threshold = norm.length <= 5 ? 1 : 2;
      if (distance <= threshold && (!best || distance < best.distance)) {
        best = { name, distance };
      }
    }
  }

  return best ? best.name : '';
}

/**
 * Bir adres metnini temizler ve standardize eder:
 * 1) Geocoding'i zorlaştıran "Kat:", "Daire:", "Tel:" gibi kalıpları siler.
 * 2) İçindeki Pendik mahallesini tespit eder.
 * 3) Eksikse sonuna ", Pendik, İstanbul, Türkiye" ekler.
 */
export function sanitizeAddress(rawText: string): SanitizeResult {
  if (!rawText || !rawText.trim()) {
    return { cleanAddress: '', neighborhood: '' };
  }

  // 1) Gürültü kalıplarını temizle.
  let clean = rawText;
  for (const pattern of NOISE_PATTERNS) {
    clean = clean.replace(pattern, ' ');
  }

  // Noktalama ve boşluk düzeltmeleri.
  clean = clean
    .replace(/[;|]+/g, ',')
    .replace(/\s*,\s*/g, ', ')
    .replace(/(,\s*)+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.\-]+|[\s,.\-]+$/g, '')
    .trim();

  // 2) Mahalle tespiti.
  const neighborhood = detectNeighborhood(clean);

  // 3) İlçe/il/ülke eklerini eksikse tamamla.
  const normClean = normalizeTr(clean);
  const suffixParts: string[] = [];
  if (!normClean.includes(normalizeTr(PENDIK_DISTRICT))) {
    suffixParts.push(PENDIK_DISTRICT);
  }
  if (!normClean.includes(normalizeTr(PENDIK_CITY))) {
    suffixParts.push(PENDIK_CITY);
  }
  if (!normClean.includes(normalizeTr(PENDIK_COUNTRY))) {
    suffixParts.push(PENDIK_COUNTRY);
  }

  const cleanAddress =
    suffixParts.length > 0 ? `${clean}, ${suffixParts.join(', ')}` : clean;

  return { cleanAddress, neighborhood };
}

/**
 * Ham Excel satırını, sanitize edilmiş SanitizedAddress modeline dönüştürür.
 * Adres metni; açık adres, cadde/sokak ve mahalle bilgilerinden birleştirilir.
 */
export function rawRowToSanitized(row: RawExcelRow): SanitizedAddress {
  const segments: string[] = [];
  if (row.acikAdres) segments.push(row.acikAdres.trim());
  if (row.caddeSokak && !containsText(row.acikAdres, row.caddeSokak)) {
    segments.push(row.caddeSokak.trim());
  }
  if (row.mahalle && !containsText(row.acikAdres, row.mahalle)) {
    segments.push(`${row.mahalle.trim()} Mahallesi`);
  }

  const originalText = row.acikAdres?.trim() || segments.join(', ');
  const { cleanAddress, neighborhood } = sanitizeAddress(segments.join(', '));

  // Excel'de geçerli hazır koordinat varsa taşı (geocoding'i atlamak için).
  const hasPresetCoords =
    typeof row.lat === 'number' &&
    Number.isFinite(row.lat) &&
    typeof row.lng === 'number' &&
    Number.isFinite(row.lng) &&
    (row.lat !== 0 || row.lng !== 0);

  return {
    id:
      row.id !== undefined && row.id !== null && row.id !== ''
        ? String(row.id)
        : generateId('addr'),
    originalText,
    cleanAddress,
    neighborhood: neighborhood || row.mahalle?.trim() || '',
    district: PENDIK_DISTRICT,
    city: PENDIK_CITY,
    recipientName: row.adSoyad?.trim() || '',
    phone: row.telefon?.trim() || '',
    boxCount:
      typeof row.koliSayisi === 'number' && row.koliSayisi > 0
        ? row.koliSayisi
        : 1,
    ...(hasPresetCoords
      ? { presetLat: row.lat, presetLng: row.lng }
      : {}),
  };
}

function containsText(haystack: string | undefined, needle: string): boolean {
  if (!haystack) return false;
  return normalizeTr(haystack).includes(normalizeTr(needle));
}
