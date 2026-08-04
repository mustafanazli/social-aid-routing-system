/**
 * Girdi güvenliği yardımcıları (Faz 7.1).
 * Dosya doğrulama, XSS/kontrol-karakter temizliği ve Excel formül enjeksiyonu
 * koruması.
 */

/** İzin verilen tablo uzantıları (.xlsx / .xls / .csv). */
export const ACCEPTED_EXCEL_EXTENSIONS = ['.xlsx', '.xls', '.csv'] as const;

/** İzin verilen MIME tipleri (bazı tarayıcılar boş/octet-stream döndürebilir). */
const ACCEPTED_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls (ve bazı tarayıcılarda .csv)
  'text/csv', // .csv
  'application/csv', // .csv (bazı tarayıcılar)
  'text/plain', // .csv (bazı tarayıcılar düz metin döndürür)
  'application/octet-stream', // bazı tarayıcılar
  '', // MIME belirtmeyen tarayıcılar
]);

/** Açıkça tehlikeli / yürütülebilir MIME tipleri — anında reddedilir. */
const DANGEROUS_MIME = new Set([
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-sh',
  'application/x-bat',
  'text/html',
  'application/javascript',
  'text/javascript',
]);

/** Maksimum dosya boyutu: 5 MB. */
export const MAX_EXCEL_FILE_SIZE = 5 * 1024 * 1024;

export interface FileValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Yüklenen dosyayı uzantı + MIME + boyut açısından denetler.
 * .exe / betik / çok büyük dosyaları reddeder.
 */
export function validateExcelFile(file: File): FileValidationResult {
  const name = file.name.toLowerCase();

  // 1) Uzantı kesin kontrolü.
  const hasValidExt = ACCEPTED_EXCEL_EXTENSIONS.some((ext) =>
    name.endsWith(ext),
  );
  if (!hasValidExt) {
    return {
      ok: false,
      error: 'Yalnızca .xlsx, .xls, .csv veya .pdf dosyaları kabul edilir.',
    };
  }

  // 2) Tehlikeli çift uzantı / betik izleri (örn. "liste.xlsx.exe").
  if (/\.(exe|bat|cmd|sh|js|vbs|scr|msi|html?|php)$/i.test(name)) {
    return { ok: false, error: 'Güvenlik: yürütülebilir dosya reddedildi.' };
  }

  // 3) MIME kontrolü.
  const type = (file.type || '').toLowerCase();
  if (DANGEROUS_MIME.has(type)) {
    return { ok: false, error: 'Güvenlik: bu dosya türü kabul edilmez.' };
  }
  if (type && !ACCEPTED_MIME.has(type)) {
    return {
      ok: false,
      error: 'Dosya türü Excel biçimiyle uyuşmuyor.',
    };
  }

  // 4) Boyut kontrolü.
  if (file.size > MAX_EXCEL_FILE_SIZE) {
    return {
      ok: false,
      error: `Dosya çok büyük (maks. ${Math.round(
        MAX_EXCEL_FILE_SIZE / (1024 * 1024),
      )} MB).`,
    };
  }
  if (file.size === 0) {
    return { ok: false, error: 'Dosya boş görünüyor.' };
  }

  return { ok: true };
}

/** Aşırı uzun metinleri makul bir sınıra çeker (bozuk/dev veriler için). */
const MAX_CELL_LENGTH = 500;

// Kontrol karakterleri: U+0000–U+001F ve U+007F (kaynağa ham bayt koymamak
// için RegExp constructor + unicode escape ile tanımlanır).
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');

/**
 * Bir hücre/metin değerini XSS ve bozuk karakterlere karşı temizler:
 *  - Kontrol karakterlerini kaldırır,
 *  - `<` `>` ve dolayısıyla HTML/script etiketlerini eler,
 *  - `javascript:` benzeri şemaları nötrler,
 *  - fazla boşlukları toparlar ve uzunluğu sınırlar.
 * (React zaten JSX'te kaçış yapar; bu, veri katmanında ek savunmadır.)
 */
export function sanitizeText(input: unknown): string {
  if (input === null || input === undefined) return '';
  let s = String(input);

  s = s.replace(CONTROL_CHARS, ' ');
  s = s.replace(/[<>]/g, ' ');
  s = s.replace(/javascript:/gi, '').replace(/data:text\/html/gi, '');
  s = s.replace(/\s{2,}/g, ' ').trim();

  if (s.length > MAX_CELL_LENGTH) s = s.slice(0, MAX_CELL_LENGTH);
  return s;
}

/**
 * Excel/CSV formül enjeksiyonu koruması: `=`, `+`, `-`, `@` ile başlayan
 * hücreler dışa aktarımda formül olarak çalışmasın diye `'` ile öncelenir.
 */
export function escapeFormula(value: string): string {
  if (value && /^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}
