import type { NextRequest } from 'next/server';

/**
 * PDF'ten adres çıkarma uç noktası (POST /api/pdf-addresses).
 *
 * Sosyal yardım listeleri bazen Excel değil PDF olarak gelir. Bu uç nokta
 * METİN TABANLI bir PDF'i alır, pdf.js ile metnini çıkarır, satırlara böler ve
 * adres gibi görünen satırları döndürür. İstemci bu satırları mevcut adres
 * temizleme + Google geocoding hattına verir.
 *
 * Sınır: Taranmış (görüntü) PDF'lerde metin katmanı yoktur → OCR gerekir, bu
 * uç nokta onları çözemez ve boş döner (istemci kullanıcıyı uyarır).
 *
 * pdf.js Node'da ana iş parçacığında ("fake worker") çalışır; ayrı worker
 * dosyası gerektirmez. Node runtime zorunludur (Edge'de çalışmaz).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// pdf.js, `Promise.withResolvers` kullanır (Node 22+). Bazı Vercel/eski Node
// çalışma zamanlarında bulunmayabilir; güvence için hafif bir polyfill.
const P = Promise as unknown as {
  withResolvers?: <T>() => {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
  };
};
if (typeof P.withResolvers !== 'function') {
  P.withResolvers = function <T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

const MAX_PDF_SIZE = 8 * 1024 * 1024; // 8 MB
const MAX_LINES = 2000; // aşırı büyük PDF'lerde bellek koruması

/** Bir metin satırının adres gibi görünüp görünmediğine karar verir. */
function looksLikeAddress(line: string): boolean {
  const t = line.toLocaleLowerCase('tr');
  if (t.length < 8) return false;
  const hasDigit = /\d/.test(t);
  const hasKeyword =
    /(mah\.|mahalle|mahallesi|sok\.|sokak|cad\.|cadde|caddesi|bulvar|no[:\s]|daire|blok|sitesi|apt|kat\b)/.test(
      t,
    );
  // Adres = ya bir anahtar kelime içerir ya da (rakam + yeterli uzunluk).
  return hasKeyword || (hasDigit && t.length >= 12);
}

/** pdf.js metin öğesi (kullandığımız alanlar). */
interface PdfTextItem {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
}

/** Bir PDF satırı: birleşik metin + sütunlara (hücrelere) ayrılmış parçalar. */
export interface PdfRow {
  text: string;
  cells: string[];
}

/**
 * Bir satırın öğelerini x-boşluklarına göre HÜCRELERE (sütun) böler. Tablo
 * biçimli PDF'lerde ("Ad Soyad | Adres") sütunlar arası boşluk, kelime arası
 * boşluktan belirgin büyüktür; eşik yazı tipi boyutuna göre uyarlanır.
 */
function segmentCells(parts: PdfTextItem[]): string[] {
  const sorted = parts.sort(
    (a, b) => (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0),
  );
  const cells: string[] = [];
  let current = '';
  let prevEnd: number | null = null;

  for (const it of sorted) {
    const x = it.transform?.[4] ?? 0;
    const size = Math.abs(it.transform?.[0] ?? 0) || it.height || 10;
    const gap = prevEnd === null ? 0 : x - prevEnd;
    const columnBreak = prevEnd !== null && gap > Math.max(12, size * 1.4);

    if (columnBreak) {
      if (current.trim()) cells.push(current.trim());
      current = it.str;
    } else {
      current = current ? `${current} ${it.str}` : it.str;
    }
    prevEnd = x + (it.width ?? it.str.length * size * 0.5);
  }
  if (current.trim()) cells.push(current.trim());
  return cells.map((c) => c.replace(/\s{2,}/g, ' ').trim()).filter(Boolean);
}

function itemsToRows(items: PdfTextItem[]): PdfRow[] {
  // y'ye göre grupla (aynı satır ~ aynı y). transform[5] = y.
  const byY = new Map<number, PdfTextItem[]>();
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = Math.round((it.transform?.[5] ?? 0) / 2) * 2; // 2px tolerans
    const arr = byY.get(y) ?? [];
    arr.push(it);
    byY.set(y, arr);
  }
  // y azalan (sayfa üstten alta).
  return [...byY.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, parts]) => {
      const cells = segmentCells(parts);
      return { cells, text: cells.join(' ').replace(/\s{2,}/g, ' ').trim() };
    })
    .filter((r) => r.text);
}

async function extractRows(data: Uint8Array): Promise<PdfRow[]> {
  // Legacy build Node ortamında (DOM'suz) çalışır.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const rows: PdfRow[] = [];
  for (let p = 1; p <= doc.numPages && rows.length < MAX_LINES; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    rows.push(...itemsToRows(content.items as PdfTextItem[]));
  }
  await doc.destroy();
  return rows;
}

export async function POST(request: NextRequest) {
  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get('file');
    if (f instanceof File) file = f;
  } catch {
    return Response.json({ error: 'Geçersiz form verisi.' }, { status: 400 });
  }

  if (!file) {
    return Response.json({ error: 'PDF dosyası bulunamadı.' }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: 'Dosya boş görünüyor.' }, { status: 400 });
  }
  if (file.size > MAX_PDF_SIZE) {
    return Response.json(
      { error: 'PDF çok büyük (maks. 8 MB).' },
      { status: 400 },
    );
  }
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return Response.json(
      { error: 'Yalnızca .pdf dosyaları kabul edilir.' },
      { status: 400 },
    );
  }

  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const allRows = await extractRows(buffer);
    // Adres gibi görünen satırlar; hem birleşik metni hem sütun hücrelerini taşır.
    const rows = allRows.filter((r) => looksLikeAddress(r.text));

    return Response.json({
      totalLines: allRows.length,
      rows,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'PDF okunamadı.';
    return Response.json(
      { error: `PDF işlenemedi: ${message}` },
      { status: 502 },
    );
  }
}
