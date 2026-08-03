import * as XLSX from 'xlsx';

import type { RawExcelRow, SanitizedAddress } from '@/types/address';
import { generateId, normalizeTr } from '@/lib/utils';
import type { VehicleRoute, StopStatus, DeliveryProof } from '@/types/fleet';
import { sanitizeText, escapeFormula } from '@/lib/security';

/** Aşırı büyük/bozuk dosyaların tarayıcıyı kilitlemesini önleyen satır sınırı. */
const MAX_ROWS = 20000;

/**
 * Excel başlık adları çok çeşitli yazılabildiği için (Ad Soyad, Adı Soyadı,
 * Alıcı, İsim...) her mantıksal alan için olası başlık takma adları tanımlanır.
 * Eşleştirme normalize edilmiş (Türkçe karakter/boşluktan arındırılmış) yapılır.
 */
const COLUMN_ALIASES: Record<keyof RawExcelFieldMap, string[]> = {
  adSoyad: [
    'ad soyad',
    'adsoyad',
    'adi soyadi',
    'ad-soyad',
    'isim',
    'ad',
    'alici',
    'alici adi',
    'alici ad soyad',
    'name',
    'fullname',
    'kisi',
  ],
  telefon: [
    'telefon',
    'tel',
    'tel no',
    'telefon no',
    'gsm',
    'gsm no',
    'cep',
    'cep telefonu',
    'cep no',
    'phone',
    'numara',
  ],
  mahalle: ['mahalle', 'mah', 'mahalle adi', 'semt'],
  caddeSokak: [
    'cadde sokak',
    'cadde/sokak',
    'sokak/cadde',
    'cadde',
    'sokak',
    'sk',
    'cad',
    'cadde adi',
    'sokak adi',
  ],
  binaNo: [
    'bina no',
    'bina',
    'kapi no',
    'dis kapi no',
    'no',
    'bina numarasi',
    'kapi',
  ],
  daireNo: ['daire no', 'daire', 'ic kapi no', 'daire numarasi'],
  acikAdres: [
    'acik adres',
    'adres',
    'adres bilgisi',
    'tam adres',
    'adres tarifi',
    'address',
    'ikamet adresi',
    // Dışa aktarılan raporun tekrar yüklenebilmesi için rapor sütunları.
    'orijinal adres',
    'temizlenmis adres',
  ],
  koliSayisi: [
    'koli sayisi',
    'koli',
    'koli adedi',
    'adet',
    'miktar',
    'koli miktari',
    'paket sayisi',
  ],
  enlem: ['enlem', 'lat', 'latitude', 'y'],
  boylam: ['boylam', 'lng', 'lon', 'long', 'longitude', 'x'],
};

interface RawExcelFieldMap {
  adSoyad?: string;
  telefon?: string;
  mahalle?: string;
  caddeSokak?: string;
  binaNo?: string;
  daireNo?: string;
  acikAdres?: string;
  koliSayisi?: string;
  enlem?: string;
  boylam?: string;
}

/** Ham excel objesindeki başlıkları bilinen alanlarla eşleştirir. */
function detectColumnMapping(headers: string[]): RawExcelFieldMap {
  const mapping: RawExcelFieldMap = {};
  const normalizedHeaders = headers.map((h) => ({
    original: h,
    norm: normalizeTr(String(h)),
  }));

  (Object.keys(COLUMN_ALIASES) as (keyof RawExcelFieldMap)[]).forEach((field) => {
    if (mapping[field]) return;
    const aliases = COLUMN_ALIASES[field];
    // Önce birebir eşleşme, sonra "içerir" eşleşmesi denenir.
    const exact = normalizedHeaders.find((h) => aliases.includes(h.norm));
    const partial =
      exact ??
      normalizedHeaders.find((h) =>
        aliases.some((a) => h.norm === a || h.norm.includes(a)),
      );
    if (partial) mapping[field] = partial.original;
  });

  return mapping;
}

/** "5", "5 koli", "3 adet" gibi değerleri sayıya çevirir. */
function parseBoxCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.round(value));
  }
  const match = String(value ?? '').match(/\d+/);
  const parsed = match ? parseInt(match[0], 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function cellToString(value: unknown): string {
  // XSS / kontrol-karakter temizliği veri katmanında uygulanır (Faz 7.1).
  return sanitizeText(value);
}

/**
 * Enlem/boylam hücresini sayıya çevirir. Türkçe Excel'lerde ondalık ayıracı
 * virgül olabildiğinden ("40,8879") virgül noktaya çevrilir. Geçersizse null.
 */
function parseCoord(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const num =
    typeof value === 'number'
      ? value
      : parseFloat(String(value).trim().replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

/**
 * Yüklenen Excel/CSV dosyasını okur ve satırları RawExcelRow[] olarak döndürür.
 * İlk çalışma sayfası (sheet) kullanılır, ilk satır başlık kabul edilir.
 */
export async function parseExcelFile(file: File): Promise<RawExcelRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Excel dosyasında çalışma sayfası bulunamadı.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  if (rows.length === 0) {
    throw new Error('Excel dosyasında veri satırı bulunamadı.');
  }

  // Güvenlik: path'olojik büyüklükteki dosyalarda satır sayısını sınırla.
  const safeRows = rows.length > MAX_ROWS ? rows.slice(0, MAX_ROWS) : rows;

  const headers = Object.keys(safeRows[0]);
  const mapping = detectColumnMapping(headers);

  return safeRows.map((row, index): RawExcelRow => {
    const get = (field: keyof RawExcelFieldMap): string => {
      const col = mapping[field];
      return col ? cellToString(row[col]) : '';
    };

    const acikAdres = get('acikAdres');
    const caddeSokak = get('caddeSokak');
    const mahalle = get('mahalle');
    const binaNo = get('binaNo');
    const daireNo = get('daireNo');

    // Hazır koordinat (varsa) — daha önce elle düzeltilip dışa aktarılmış olabilir.
    const lat = mapping.enlem ? parseCoord(row[mapping.enlem]) : null;
    const lng = mapping.boylam ? parseCoord(row[mapping.boylam]) : null;

    // Açık adres sütunu yoksa parça sütunlardan adres metni oluştur.
    const composedAddress =
      acikAdres ||
      [caddeSokak, binaNo && `No ${binaNo}`, mahalle && `${mahalle} Mahallesi`]
        .filter(Boolean)
        .join(' ')
        .trim();

    return {
      id: index + 1,
      adSoyad: get('adSoyad'),
      telefon: get('telefon'),
      mahalle,
      caddeSokak,
      binaNo,
      daireNo,
      acikAdres: composedAddress,
      koliSayisi: mapping.koliSayisi
        ? parseBoxCount(row[mapping.koliSayisi])
        : 1,
      ...(lat !== null && lng !== null ? { lat, lng } : {}),
      __rowKey: generateId('row'),
    };
  });
}

/**
 * Kullanıcıların doldurup deneyebileceği örnek dağıtım listesi (şablon) üretir
 * ve indirir. Başlıklar COLUMN_ALIASES ile birebir tanınacak biçimde seçilmiştir;
 * satırlar gerçek Pendik mahallelerinden + serbest yazım örneklerinden oluşur.
 */
export function downloadSampleTemplate(): void {
  // Tüm satırlar GERÇEK Pendik adresleridir (mahalle + cadde/sokak + bina no),
  // her biri Google Haritalar'da bina/sokak seviyesinde doğrulanmıştır. Enlem/
  // Boylam BİLEREK boş bırakılmıştır → uygulama bu adresleri canlı olarak Google
  // ile konumlar. (İstenirse elle düzeltilen koordinatlar dışa aktarımda bu iki
  // sütuna yazılır ve tekrar yüklemede aynen korunur.)
  const sampleRows = [
    {
      'Ad Soyad': 'Ayşe Yılmaz',
      Telefon: '0532 111 22 33',
      Mahalle: 'Fevzi Çakmak',
      'Cadde/Sokak': 'Selanik Sokak',
      'Bina No': '5',
      'Daire No': 3,
      'Açık Adres': 'Fevzi Çakmak Mah. Selanik Sokak No:5 Daire 3',
      'Koli Sayısı': 2,
    },
    {
      'Ad Soyad': 'Mehmet Demir',
      Telefon: '0505 444 55 66',
      Mahalle: 'Fevzi Çakmak',
      'Cadde/Sokak': 'Tophane Sokak',
      'Bina No': '4A',
      'Daire No': 20,
      'Açık Adres': 'Fevzi Çakmak Mah. Tophane Sokak No:4A Daire 20',
      'Koli Sayısı': 1,
    },
    {
      'Ad Soyad': 'Fatma Kaya',
      Telefon: '0543 777 88 99',
      Mahalle: 'Batı',
      'Cadde/Sokak': '23 Nisan Caddesi',
      'Bina No': '10',
      'Daire No': 5,
      'Açık Adres': 'Batı Mah. 23 Nisan Caddesi No:10 Daire 5',
      'Koli Sayısı': 3,
    },
    {
      'Ad Soyad': 'Hasan Şahin',
      Telefon: '0555 123 45 67',
      Mahalle: 'Kaynarca',
      'Cadde/Sokak': 'Barbaros Caddesi',
      'Bina No': '25',
      'Daire No': 8,
      'Açık Adres': 'Kaynarca Mah. Barbaros Caddesi No:25 Daire 8',
      'Koli Sayısı': 1,
    },
    {
      'Ad Soyad': 'Zeynep Aydın',
      Telefon: '0530 998 76 54',
      Mahalle: 'Güzelyalı',
      'Cadde/Sokak': 'Sahil Yolu Caddesi',
      'Bina No': '8',
      'Daire No': 2,
      'Açık Adres': 'Güzelyalı Mah. Sahil Yolu Caddesi No:8 Daire 2',
      'Koli Sayısı': 2,
    },
    {
      'Ad Soyad': 'Ali Öztürk',
      Telefon: '0542 321 00 11',
      Mahalle: 'Dumlupınar',
      'Cadde/Sokak': 'İnönü Caddesi',
      'Bina No': '30',
      'Daire No': 12,
      'Açık Adres': 'Dumlupınar Mah. İnönü Caddesi No:30 Daire 12',
      'Koli Sayısı': 1,
    },
    {
      'Ad Soyad': 'Emine Çelik',
      Telefon: '0533 654 32 10',
      Mahalle: 'Yenişehir',
      'Cadde/Sokak': 'Dedepaşa Caddesi',
      'Bina No': '10',
      'Daire No': 4,
      'Açık Adres': 'Yenişehir Mah. Dedepaşa Caddesi No:10 Daire 4',
      'Koli Sayısı': 2,
    },
    {
      'Ad Soyad': 'Mustafa Arslan',
      Telefon: '0544 220 11 88',
      Mahalle: 'Ertuğrul Gazi',
      'Cadde/Sokak': 'Bora Sokak',
      'Bina No': '3',
      'Daire No': 1,
      'Açık Adres': 'Ertuğrul Gazi Mah. Bora Sokak No:3 Daire 1',
      'Koli Sayısı': 1,
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows);
  worksheet['!cols'] = [
    { wch: 18 }, // Ad Soyad
    { wch: 16 }, // Telefon
    { wch: 14 }, // Mahalle
    { wch: 18 }, // Cadde/Sokak
    { wch: 9 }, // Bina No
    { wch: 9 }, // Daire No
    { wch: 44 }, // Açık Adres
    { wch: 11 }, // Koli Sayısı
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dağıtım Listesi');
  XLSX.writeFile(workbook, 'Pendik_Ornek_Dagitim_Listesi.xlsx');
}

/** Teslimat durumunu Türkçe rapor etiketine çevirir. */
export function stopStatusToTr(status: StopStatus): string {
  switch (status) {
    case 'DELIVERED':
      return 'Teslim Edildi';
    case 'NOT_HOME':
      return 'Evde Yok / Ulaşılamadı';
    case 'CANCELLED':
      return 'İptal Edildi';
    default:
      return 'Bekliyor';
  }
}

/** Teslim kanıtı notunu Türkçe rapor metnine çevirir. */
function proofToTr(proof: DeliveryProof | undefined): string {
  if (!proof) return '';
  return proof.type === 'SIGNATURE'
    ? 'İmzalı Kanıt Alındı'
    : 'Fotoğraflı Kanıt Alındı';
}

/** Rapor satırı — sütun başlıkları doğrudan Excel'e yansır. */
interface ReportRow {
  'Atanan Araç': string;
  'Durak Sırası': number | string;
  'Alıcı Adı': string;
  Telefon: string;
  'Orijinal Adres': string;
  'Temizlenmiş Adres': string;
  Mahalle: string;
  'Koli Sayısı': number;
  Enlem: number | string;
  Boylam: number | string;
  'Dağıtım Durumu': string;
  'Teslim Kanıtı': string;
  'Güncelleme Tarihi': string;
}

/**
 * Dağıtım raporunu Excel olarak indirir (PRD Bölüm 6.1).
 *
 * Orijinal listeye "Atanan Araç", "Durak Sırası", "Dağıtım Durumu",
 * "Enlem/Boylam" ve "Güncelleme Tarihi" sütunları eklenir. Rotaya
 * atanmamış (ör. geocode başarısız) adresler de "Atanmadı" olarak eklenir.
 */
export function exportDeliveryReportToExcel(
  routes: VehicleRoute[],
  unassigned: SanitizedAddress[] = [],
): void {
  const rows: ReportRow[] = [];

  for (const route of routes) {
    for (const stop of route.stops) {
      const loc = stop.location;
      rows.push({
        'Atanan Araç': escapeFormula(route.vehicleName),
        'Durak Sırası': stop.stopOrder,
        'Alıcı Adı': escapeFormula(loc.recipientName),
        Telefon: escapeFormula(loc.phone),
        'Orijinal Adres': escapeFormula(loc.originalText),
        'Temizlenmiş Adres': escapeFormula(loc.cleanAddress),
        Mahalle: escapeFormula(loc.neighborhood),
        'Koli Sayısı': loc.boxCount,
        Enlem: loc.lat,
        Boylam: loc.lng,
        'Dağıtım Durumu': stopStatusToTr(stop.status),
        'Teslim Kanıtı': proofToTr(stop.proof),
        'Güncelleme Tarihi': stop.updatedAt
          ? new Date(stop.updatedAt).toLocaleString('tr-TR')
          : '',
      });
    }
  }

  for (const a of unassigned) {
    rows.push({
      'Atanan Araç': '—',
      'Durak Sırası': '',
      'Alıcı Adı': escapeFormula(a.recipientName),
      Telefon: escapeFormula(a.phone),
      'Orijinal Adres': escapeFormula(a.originalText),
      'Temizlenmiş Adres': escapeFormula(a.cleanAddress),
      Mahalle: escapeFormula(a.neighborhood),
      'Koli Sayısı': a.boxCount,
      Enlem: '',
      Boylam: '',
      'Dağıtım Durumu': 'Atanmadı',
      'Teslim Kanıtı': '',
      'Güncelleme Tarihi': '',
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 12 }, // Araç
    { wch: 11 }, // Sıra
    { wch: 20 }, // Alıcı
    { wch: 15 }, // Telefon
    { wch: 40 }, // Orijinal Adres
    { wch: 45 }, // Temizlenmiş Adres
    { wch: 16 }, // Mahalle
    { wch: 10 }, // Koli
    { wch: 11 }, // Enlem
    { wch: 11 }, // Boylam
    { wch: 22 }, // Durum
    { wch: 20 }, // Teslim Kanıtı
    { wch: 20 }, // Güncelleme
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dağıtım Raporu');

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `Pendik_Sosyal_Yardim_Dagitim_Raporu_${date}.xlsx`);
}
