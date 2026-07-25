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
  oncelik?: string;
  [key: string]: unknown;
}

/**
 * Adres öncelik durumu (Faz 6.5).
 * URGENT = Acil (yaşlı/hasta) → rotada öne alınır ve haritada kırmızı vurgulanır.
 */
export type AddressPriority = 'NORMAL' | 'HIGH' | 'URGENT';

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
  /** Öncelik; alan yoksa NORMAL kabul edilir (geriye dönük uyumlu). */
  priority?: AddressPriority;
}

export type GeocodingStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'MANUAL';

/** Coğrafi koordinata çözümlenmiş adres. */
export interface GeocodedLocation extends SanitizedAddress {
  lat: number;
  lng: number;
  geocodingStatus: GeocodingStatus;
  confidenceScore?: number;
  formattedAddressFromAPI?: string;
}
