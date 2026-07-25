# PRD (Product Requirements Document)
## Pendik Belediyesi Sosyal Yardım Dağıtım ve Rota Optimizasyon Sistemi

---

## 1. Proje Vizyonu ve Amacı

Pendik Belediyesi Sosyal Yardım Hizmetleri Müdürlüğü, ilçe sınırları içindeki ihtiyaç sahibi vatandaşlara düzenli olarak gıda ve yardım kolisi dağıtımı gerçekleştirmektedir. Mevcut süreçte adres bilgileri Excel tabloları üzerinden manuel olarak işlenmekte ve şoförler hedef adresleri geleneksel yöntemlerle aramaktadır. Bu durum; zaman, yakıt, personel eforu ve kamu kaynaklarının verimsiz kullanımına yol açmaktadır.

**Sistemin Temel Hedefleri:**
* **Adres Doğrulama ve Temizleme:** Excel'den gelen eksik/hatalı adres metinlerini sanitize ederek coğrafi koordinatlara (Enlem/Boylam) dönüştürmek.
* **Kapasite ve Araç Tabanlı Kümeleme (VRP):** Tanımlanan araç sayısı ve koli kapasitelerine göre adresleri mantıksal coğrafi kümelere (cluster) bölmek.
* **Maksimum Rota Verimliliği:** OSRM (Open Source Routing Machine) kullanarak her araç için en kısa mesafe ve süre odaklı durak sıralaması (TSP/VRP çözümü) oluşturmak.
* **Dinamik Müdahale Olanağı:** Dağıtım yöneticisinin harita ve liste üzerinde sürükle-bırak (Drag & Drop) ile durak sırasını ve araç atamalarını anlık güncelleyebilmesini sağlamak.
* **Mobil Şoför Arayüzü & Navigasyon:** Şoförler için QR kod/özel link ile erişilebilen, Yandex Navigasyon ve Google Maps entegrasyonlu basitleştirilmiş mobil ekran sunmak.
* **Saha Takibi ve Raporlama:** Teslimat durumlarının ("Teslim Edildi", "Evde Yok / Ulaşılamadı") canlı takibi ve güncellenmiş durum bilgisi içeren Excel çıktısı üretmek.

---

## 2. Mimari Yapı ve Klasör Şeması

Proje, **Next.js 14+ App Router** mimarisi üzerinde TypeScript, Tailwind CSS ve istemci tarafı (Client-side) harita/durum yönetimi katmanlarıyla inşa edilecektir.

```
social-aid-routing-system/
├── public/
│   ├── favicon.ico
│   ├── images/
│   └── leaflet/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Ana layout, fontlar, CSS importları
│   │   ├── page.tsx                    # Yönetici Paneli (Excel Yükleme, Kümeleme, Harita, Rota Özeti)
│   │   ├── driver/
│   │   │   └── [routeId]/
│   │   │       └── page.tsx            # Mobil Şoför Dağıtım Ekranı
│   │   └── api/                        # Gerekli proxy/helper API endpoint'leri
│   │       ├── geocode/route.ts        # Nominatim Proxy & Rate Limit Handler
│   │       └── route-optimize/route.ts # OSRM Proxy & Route calculation logic
│   ├── components/
│   │   ├── common/
│   │   │   ├── Header.tsx              # Belediye logosu ve başlık bileşeni
│   │   │   ├── LoadingSpinner.tsx      # Yüklenme göstergesi
│   │   │   └── StatusBadge.tsx         # Teslimat durum etiketi
│   │   ├── excel/
│   │   │   ├── ExcelUploader.tsx       # Drag-drop Excel dosyası yükleme bileşeni
│   │   │   └── AddressPreviewTable.tsx # Excel'den okunan adreslerin doğrulama tablosu
│   │   ├── fleet/
│   │   │   ├── VehicleConfigForm.tsx   # Araç sayısı ve kapasite giriş formu
│   │   │   └── FleetSummaryCard.tsx    # Araç bazlı rota ve koli dağılım kartları
│   │   ├── map/
│   │   │   ├── MapContainer.tsx        # Dynamic Import ile yüklenen Leaflet Harita kapsayıcısı
│   │   │   ├── RouteMarker.tsx         # Durak pinleri ve araç renk kodları
│   │   │   └── RoutePolyline.tsx       # Araç rotasını çizen çizgi katmanı
│   │   ├── route/
│   │   │   ├── RouteList.tsx           # Araç bazlı durak listesi
│   │   │   ├── DraggableStopItem.tsx   # Sürükle-bırak yapılabilen durak elemanı
│   │   │   └── RouteExportPanel.tsx    # Excel indirme ve QR Kod üretme paneli
│   │   └── driver/
│   │       ├── DriverStopCard.tsx      # Mobil şoför durak kartı
│   │       └── NavButton.tsx           # Yandex & Google Haritalar yönlendirme butonları
│   ├── constants/
│   │   ├── pendikNeighborhoods.ts      # Pendik mahalle listesi ve posta kodları
│   │   └── config.ts                   # API URL'leri, harita varsayılan koordinatları
│   ├── hooks/
│   │   ├── useExcelParser.ts           # SheetJS tabanlı Excel okuma/yazma hook'u
│   │   ├── useGeocoding.ts             # Nominatim geocoding & caching hook'u
│   │   ├── useRouteOptimizer.ts        # OSRM rota hesaplama hook'u
│   │   └── useMediaQuery.ts            # Mobil/Desktop görünüm kontrolü
│   ├── lib/
│   │   ├── clustering.ts               # K-Means / Haversine tabanlı coğrafi kümeleme algoritması
│   │   ├── excelUtils.ts               # SheetJS yardımcı fonksiyonları
│   │   ├── sanitizeAddress.ts          # Metin temizleme ve mahalle eşleştirme mantığı
│   │   └── utils.ts                    # ClassName birleştirme ve genel util'ler
│   ├── services/
│   │   ├── nominatimService.ts         # Nominatim API istek yönetimi ve rate-limiter
│   │   └── osrmService.ts              # OSRM Trip & Route API entegrasyonu
│   ├── store/
│   │   └── useDeliveryStore.ts         # Zustand state yönetimi (LocalStorage destekli)
│   └── types/
│       ├── address.ts                  # Adres ve Geocode tipleri
│       ├── fleet.ts                    # Araç ve Rota tipleri
│       └── delivery.ts                 # Dağıtım ve Durum tipleri
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── PRD.md
```

---

## 3. Veri Modelleri (TypeScript Interfaces)

### `src/types/address.ts`
```typescript
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
  [key: string]: any;
}

export interface SanitizedAddress {
  id: string;
  originalText: string;
  cleanAddress: string;
  neighborhood: string;
  district: string; // Varsayılan: "Pendik"
  city: string;     // Varsayılan: "İstanbul"
  recipientName: string;
  phone: string;
  boxCount: number;
}

export interface GeocodedLocation extends SanitizedAddress {
  lat: number;
  lng: number;
  geocodingStatus: 'SUCCESS' | 'FAILED' | 'PENDING' | 'MANUAL';
  confidenceScore?: number;
  formattedAddressFromAPI?: string;
}
```

### `src/types/fleet.ts`
```typescript
export interface VehicleConfig {
  id: string;
  name: string; // Örn: "Araç 1 (34 BSK 34)"
  capacity: number; // Örn: 50 koli
  color: string; // Haritadaki rota ve marker rengi (hex/hsl)
}

export interface StopItem {
  stopOrder: number; // Rota içindeki durak sırası (1, 2, 3...)
  location: GeocodedLocation;
  estimatedArrivalMinutes?: number;
  distanceFromPreviousKm?: number;
  status: 'PENDING' | 'DELIVERED' | 'NOT_HOME' | 'CANCELLED';
  notes?: string;
  updatedAt?: string;
}

export interface VehicleRoute {
  vehicleId: string;
  vehicleName: string;
  vehicleColor: string;
  assignedCapacity: number;
  totalBoxesAssigned: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  stops: StopItem[];
  driverShareUrl?: string;
}
```

### `src/types/delivery.ts`
```typescript
export interface DeliverySession {
  sessionId: string;
  createdAt: string;
  totalAddresses: number;
  totalVehicles: number;
  routes: VehicleRoute[];
  unassignedLocations: GeocodedLocation[];
  globalStatus: 'DRAFT' | 'OPTIMIZED' | 'IN_PROGRESS' | 'COMPLETED';
}
```

---

## 4. Modüller Arası Akış Şeması (Flow Diagram)

```mermaid
flowchart TD
    A[Excel Dosyası Yükleme (.xlsx)] --> B[SheetJS ile Veri Parse Etme]
    B --> C[Adres Sanitize & Temizleme Motoru]
    C -->|Pendik, İstanbul Eki & Mahalle Eşleşmesi| D[Nominatim Geocoding API Servisi]
    D -->|Başarılı Koordinatlar| E[Coğrafi Kümeleme Motoru - K-Means/Haversine]
    D -->|Hatalı Adresler| D1[Manuel Pin Ayarlama & Adres Düzeltme]
    D1 --> E
    E -->|Araç Kapasitelerine Göre Bölümleme| F[OSRM Rota Optimizasyonu Servisi]
    F --> G[Harita & İnteraktif Yönetici Paneli]
    G -->|Drag & Drop Durak Değişimi| F
    G --> H[Şoför Linki / QR Kod Üretimi]
    H --> I[Mobil Şoför Ekranı /driver/routeId]
    I -->|Yandex Navigasyon / Google Maps Entegrasyonu| J[Saha Dağıtımı & Durum Güncelleme]
    J -->|Teslim Edildi / Evde Yok| K[Canlı Rapor & Excel Export]
```

---

## 5. Sistemin Yenilikçi ve Öne Çıkan Özellikleri

### 1. Akıllı Adres Sanitize Etme (Temizleme Motoru)
* **Otomatik Şehir/İlçe Eki:** Excel'deki metin ne olursa olsun adres sonuna otomatik olarak `, Pendik, İstanbul, Türkiye` string'i eklenir.
* **Pendik Mahalle Eşleştirme:** Pre-defined Pendik mahalle listesi (`pendikNeighborhoods.ts` - Örn: *Batı, Ahmet Yesevi, Çamlık, Kurtköy, Güzelyalı, Velibaba, Kaynarca...*) kullanılarak adres metninde geçen yazım hatalı mahalle isimleri fuzzy matching / regex ile düzeltilir.
* **Regex Temizliği:** "Daire:", "Kat:", "Telefon:" gibi geocoding sorgusunu bozan gereksiz karakter ve detaylar temizlenerek ana sokak, bina ve mahalle bilgisi süzülür.

### 2. Araç Kapasite ve Coğrafi Kümeleme Yönetimi (VRP)
* Yönetici sisteme dağıtıma çıkacak araç sayısını (örn: 3 araç) ve her bir aracın koli kapasitesini (örn: Araç 1: 40 koli, Araç 2: 40 koli, Araç 3: 30 koli) girer.
* Algoritma, adreslerin enlem/boylam koordinatlarını baz alarak coğrafi yakınlıklarına göre (K-Means kümeleme / Haversine mesafe algoritması) adresleri araç kapasitelerini aşmayacak şekilde mantıksal bölgelere böler.

### 3. OSRM Rota Optimizasyonu & Dinamik Sürükle-Bırak (Drag & Drop)
* Her araç kümesi için OSRM `/trip/v1/driving` API'sine istek atılarak duraklar en ideal sürüş sırasına sokulur.
* Yönetici sol paneldeki durak listesinden herhangi bir durağı fareyle yukarı-aşağı sürüklediğinde (Drag & Drop):
  * Durak sırası anlık olarak güncellenir.
  * Yeni sıra için OSRM `/route/v1/driving` API'si çağrılarak toplam kilometre, tahmini süre (dakika) ve haritadaki polylines anında yeniden çizilir.

### 4. Şoför Ekranı ve Mobil Navigasyon Entegrasyonu
* Her rota için benzersiz bir `routeId` oluşturulur ve `http://domain.com/driver/[routeId]` linki/QR kodu üretilir.
* Mobil cihazından linki açan şoför, sıralı durak listesini kartlar halinde görür.
* **Yandex Navigasyon Butonu:** `yandexnavi://build_route_on_map?lat_to={lat}&lon_to={lng}` veya Yandex Maps web fallback linki tetiklenir.
* **Google Maps Butonu:** `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}` linki ile cihazın harita uygulaması doğrudan başlatılır.

### 5. Canlı Saha Dağıtım Takibi ve Excel Export
* Şoför mobil ekranda durak kartı üzerinden "Teslim Edildi" veya "Evde Yok / Ulaşılamadı" butonlarına basarak anlık durum kaydeder.
* Veriler Zustand store ve LocalStorage üzerinden senkronize edilir.
* Yönetici tek bir tıkla `Sosyal_Yardim_Dagitim_Raporu_[Tarih].xlsx` dosyasını indirir. Bu Excel dosyasında orijinal verilerin yanında `Temizlenmiş Adres`, `Enlem`, `Boylam`, `Atanan Araç`, `Durak Sırası` ve `Teslimat Durumu` sütunları yer alır.

---

## 6. Geliştirme Kuralları ve Teknik Uyarılar

1. **Leaflet SSR Uyarısı:**
   * React Leaflet ve Leaflet Kütüphanesi `window` objesine bağımlıdır. Next.js App Router üzerinde sayfa çökmelerini önlemek için harita bileşenleri **MUTLAKA** `dynamic(() => import('../components/map/MapContainer'), { ssr: false })` şeklinde yüklenmelidir.
2. **Nominatim API Rate Limit & Scoping:**
   * OpenStreetMap Nominatim API ücretsizdir ancak saniyede maksimum 1 istek (1 req/sec) kuralı vardır. Geocoding servisinde istekler arasına `await new Promise(res => setTimeout(res, 1000))` gecikmesi eklenmeli veya batch istekler sırayla işlenmelidir.
   * Sorgularda öncelikli sonuç almak için `format=json&addressdetails=1&viewbox=29.20,40.85,29.35,40.95&bounded=0` veya `city=İstanbul&county=Pendik` parametreleri kullanılmalıdır.
3. **Hata Yakalama (Try-Catch) & Fallback:**
   * Tüm API çağrıları (Geocoding, OSRM Rota) `try-catch` blokları ile sarmalanmalıdır. Bulunamayan adresler için sistem çökmemeli, durum `FAILED` olarak işaretlenip haritada manuel konum seçme imkanı sunulmalıdır.
4. **State Yönetimi ve LocalStorage:**
   * Zustand store'da `persist` middleware'i kullanılarak kullanıcının Excel yükleme, kümeleme ve rota aşamalarındaki verileri tarayıcı yenilense dahi korunmalıdır.
5. **Mobil Uyum ve Dokunmatik Dostu Arayüz:**
   * Şoför ekranı (`/driver/[routeId]`) 320px-430px ekran genişliklerine tam uyumlu olmalı, butonlar büyük, okunabilir ve sahada kullanımı kolay olacak şekilde tasarlanmalıdır.
6. **Kod Standartları:**
   * `any` tipi kullanımından kaçınılmalı, tüm tipler `src/types` altında tanımlanmalıdır.
   * Tailwind CSS sınıfları düzenli ve okunabilir tutulmalıdır.
