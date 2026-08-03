import type { RawExcelRow } from '@/types/address';
import { generateId } from '@/lib/utils';

/** Sunucudan gelen PDF satırı (birleşik metin + sütun hücreleri). */
interface PdfRow {
  text: string;
  cells: string[];
}

/** Bir hücre adres gibi mi görünüyor? (rakam ya da adres anahtar kelimesi) */
function isAddressCell(s: string): boolean {
  const t = s.toLocaleLowerCase('tr');
  return (
    /\d/.test(t) ||
    /(mah\.|mahalle|sok\.|sokak|cad\.|cadde|bulvar|no[:\s]|daire|blok|sitesi|apt)/.test(
      t,
    )
  );
}

/** Bir hücre isim gibi mi? (yalnızca harf, 1–4 kelime, rakamsız) */
function looksLikeName(s: string): boolean {
  const t = s.trim();
  if (!t || /\d/.test(t)) return false;
  const words = t.split(/\s+/);
  return words.length <= 4 && /^[\p{L}.\s]+$/u.test(t);
}

/**
 * Bir PDF satırından alıcı adı + adres ayırır. Tablo biçimli listelerde
 * ("Ad Soyad | Adres") ismi yakalar; tek sütunlu satırlarda ismi boş bırakıp
 * tüm satırı adres kabul eder (güvenli geri düşüş).
 */
function splitNameAddress(row: PdfRow): { name: string; address: string } {
  let cells = row.cells.slice();

  // Baştaki saf sıra numarası hücresini at ("1", "12)", "3.").
  if (cells.length > 1 && /^\d{1,3}[).\-]?$/.test(cells[0].trim())) {
    cells = cells.slice(1);
  }

  if (cells.length >= 2) {
    const addrIdx = cells.findIndex(isAddressCell);
    if (addrIdx > 0) {
      const name = cells.slice(0, addrIdx).join(' ').trim();
      const address = cells.slice(addrIdx).join(' ').trim();
      if (looksLikeName(name)) return { name, address };
    }
  }

  return { name: '', address: row.text };
}

/**
 * PDF'ten adres içe aktarma (istemci tarafı).
 *
 * Dosyayı /api/pdf-addresses uç noktasına gönderir; dönen satırlardan alıcı adı
 * (varsa) ve adresi ayırarak RawExcelRow[] üretir. Sonuç mevcut temizleme +
 * Google konumlama hattına girer; kullanıcı önizleme tablosundan düzenleyebilir.
 */
export async function parsePdfFile(file: File): Promise<RawExcelRow[]> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch('/api/pdf-addresses', {
    method: 'POST',
    body: form,
  });

  let data: { rows?: PdfRow[]; error?: string };
  try {
    data = await res.json();
  } catch {
    throw new Error('PDF sunucu yanıtı okunamadı.');
  }

  if (!res.ok) {
    throw new Error(data.error ?? 'PDF okunamadı.');
  }

  const rows = Array.isArray(data.rows) ? data.rows : [];
  if (rows.length === 0) {
    throw new Error(
      'PDF içinde adres bulunamadı. Taranmış (görüntü) bir PDF olabilir — metin tabanlı bir PDF ya da Excel deneyin.',
    );
  }

  return rows.map((row) => {
    const { name, address } = splitNameAddress(row);
    return {
      adSoyad: name,
      acikAdres: address,
      __rowKey: generateId('pdf'),
    } as RawExcelRow;
  });
}
