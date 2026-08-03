// Adres ve Geocode tipleri — PRD Bölüm 3

/** Excel dosyasından okunan ham satır. */
export interface RawExcelRow {
  id?: string | number;
  adSoyad: string;
  telefon?: string;
  mahalle?: string;
  caddeSokak?: string;
  binaNo?: string;
  daireNo?: string;
  acikAdres: string;
  koliSayisi?: number;
  /** Excel'de hazır koordinat varsa (ör. daha önce elle düzeltilip dışa aktarılmış). */
  lat?: number;
  lng?: number;
  [key: string]: unknown;
}

/** Sanitize edilmiş (temizlenmiş / standardize edilmiş) adres. */
export interface SanitizedAddress {
  id: string;
  originalText: string;
  cleanAddress: string;
  neighborhood: string;
  district: string; // Varsayılan: "Pendik"
  city: string; // Varsayılan: "İstanbul"
  recipientName: string;
  phone: string;
  boxCount: number;
  /**
   * Excel'den gelen hazır koordinat (varsa). Doluysa geocoding atlanır ve
   * konum doğrudan MANUAL olarak işaretlenir — daha önce elle düzeltilmiş
   * adreslerin tekrar yüklemede korunmasını sağlar.
   */
  presetLat?: number;
  presetLng?: number;
}

export type GeocodingStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'MANUAL';

/** Adresi çözen otomatik konum sağlayıcısı. */
export type GeocodeProvider = 'yandex' | 'google' | 'osm';

/** Coğrafi koordinata çözümlenmiş adres. */
export interface GeocodedLocation extends SanitizedAddress {
  lat: number;
  lng: number;
  geocodingStatus: GeocodingStatus;
  confidenceScore?: number;
  formattedAddressFromAPI?: string;
  /** Konumu hangi servis buldu (yandex/google/osm) — UI rozetinde gösterilir. */
  provider?: GeocodeProvider;
}
