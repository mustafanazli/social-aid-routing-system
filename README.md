<div align="center">

# 🚚 Pendik Belediyesi | Akıllı Lojistik ve Sosyal Yardım Rota Optimizasyon Sistemi

**Kirli Excel verisinden → optimize edilmiş, sahada takip edilebilir dağıtım rotalarına.**

Gezgin Satıcı (TSP) ve Araç Rotalama (VRP) algoritmalarıyla sosyal yardım kolilerinin en kısa mesafe, en az yakıt ve en düşük karbon salınımıyla dağıtılmasını sağlayan uçtan uca bir akıllı şehir lojistik platformu.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-Maps-199900?style=for-the-badge&logo=leaflet&logoColor=white)
![OSRM](https://img.shields.io/badge/OSRM-Route_Engine-5A5A5A?style=for-the-badge)
![PWA](https://img.shields.io/badge/PWA-Offline_Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

</div>

---

## 🎯 Projenin Amacı ve Çözülen Problem

Belediyelerin sosyal yardım dağıtımı klasik olarak **hantal ve hataya açık** bir süreçtir:

- 📋 **Kirli veri:** Yardım listeleri elle doldurulmuş, tutarsız ve hatalı yazılmış Excel adreslerinden oluşur ("Pendik/Çınardere Mh 5. sk no12 daire3" gibi).
- ⛽ **Yakıt ve zaman israfı:** Şoförler adresleri sezgisel/rastgele sırayla gezer; aynı mahalleye günde birkaç kez gidilir.
- 🧮 **Manuel planlama:** Hangi aracın nereye gideceği kâğıt üzerinde, optimizasyonsuz planlanır.
- ❓ **Takip yokluğu:** "Koli teslim edildi mi, evde yok muydu?" sorusunun kanıtlanabilir bir yanıtı olmaz.

Bu sistem tüm bu adımları tek bir akışta **otomatikleştirir ve optimize eder:**

> Kirli Excel yüklenir → adresler akıllıca temizlenir (sanitize) → koordinata çevrilir (geocoding) → araç kapasitelerine göre **K-Means ile coğrafi kümelere** ayrılır → her küme **OSRM Trip API (TSP)** ile en kısa rotaya optimize edilir → şoför mobil arayüzden adım adım navigasyonla dağıtımı yapar ve **fotoğraflı/imzalı teslim kanıtı** toplar → gün sonu raporu Excel olarak dışa aktarılır.

Sonuç: **daha az yakıt, daha az CO₂, daha az zaman ve tam izlenebilirlik.**

---

## ✨ Öne Çıkan Özellikler (Key Features)

- 🧹 **Akıllı Adres Sanitize & Hatalı Veri Kurtarma** — Tutarsız/kirli Excel adreslerini normalize eder; Türkçe karakter düzeltme ve Levenshtein tabanlı bulanık (fuzzy) mahalle eşleştirmesiyle "dirty data" satırlarını kurtarır.
- 🗺️ **K-Means Kümeleme + OSRM Rota Optimizasyonu** — Adresleri araç kapasitesine göre coğrafi kümelere ayırır, her araç için TSP (Gezgin Satıcı) çözümü üretir; araç başına ayrı renkli, numaralandırılmış rota çizgisi.
- 📱 **Kurye / Şoför Saha Arayüzü** — Getir / Trendyol Go standartlarında, koyu temalı, dev butonlu ergonomik mobil UI; "Sıradaki Durak X/Y" ilerleme takibi ve Google/Yandex Haritalar navigasyon derin bağlantıları.
- ✍️📸 **Fotoğraflı ve İmzalı Teslimat Kanıtı (Proof of Delivery)** — Her teslimatta imza kanvası + kamera fotoğrafı ile kanıt toplama.
- 🌿 **Akıllı Şehir & Yeşil Belediye Dashboardu** — Optimizasyon sayesinde kazanılan mesafeyi **yakıt (L) ve CO₂ (kg) tasarrufuna** çeviren sürdürülebilirlik kartı.
- 🔄 **Sürükle-Bırak Rota Müdahalesi & Gün Sonu Excel Export** — Yönetici durak sırasını sürükle-bırakla değiştirir; km/dk canlı yeniden hesaplanır. Gün sonunda "Dağıtım Durumu" ve "Atanan Araç/Sıra" sütunlarıyla Excel çıktısı.
- 📴 **PWA & Çevrimdışı (Offline) Çalışma Desteği** — Manifest + Service Worker ile sahada bağlantı koptuğunda dahi çalışabilen, kurulabilir uygulama.
- 🚦 **Öncelikli Adresler & Akış Denetimi** — Normal / Yüksek / Acil öncelik; acil adresler rotada öne alınır. Kapasite aşımı ve coğrafi anomali (yanlış geocode) tespiti yapan güvenlik denetçisi.
- 🛡️ **Kurumsal Güvenlik & Hata Toleransı** — Katı Excel dosya doğrulaması (uzantı/MIME/boyut), XSS & formül-enjeksiyonu temizliği, React/Next.js hata sınırları (beyaz ekran koruması) ve bozulmaya dayanıklı güvenli localStorage.

---

## 📸 Ekran Görüntüleri (Screenshots)

| Yönetici Komuta Merkezi | Mobil Şoför Arayüzü |
| :---: | :---: |
| [![Admin Dashboard Ekranı](docs/dashboard.png)](docs/dashboard.png) | [![Mobil Şoför Arayüzü](docs/mobile.png)](docs/mobile.png) |
| *Akıllı Şehir Komuta Merkezi — KPI kartları, harita, rota konsolu* | *Kurye standardında saha arayüzü — navigasyon & teslim kanıtı* |

> 📌 Görselleri `docs/` klasörüne `dashboard.png` ve `mobile.png` olarak ekleyin; bağlantılar otomatik çalışır.

---

## 🏗️ Mimari ve Kullanılan Teknolojiler (Tech Stack)

| Katman | Teknoloji | Rolü |
| --- | --- | --- |
| **Frontend / Framework** | Next.js 16 (App Router, Turbopack), React 19 | SSR-güvenli sayfa/route yapısı, sunucu proxy'leri |
| **Dil** | TypeScript 5 | Uçtan uca tip güvenliği |
| **Stil / UI** | Tailwind CSS 4, lucide-react, glassmorphism | Kurumsal SaaS & komuta merkezi estetiği |
| **Harita** | Leaflet + react-leaflet 5 | Etkileşimli harita, özel `divIcon` marker'lar, polyline'lar |
| **Rota Motoru (Routing)** | OSRM (Trip API = TSP, Route API = sıra koruma) | Rota optimizasyonu & geometri/mesafe/süre |
| **Geocoding** | OpenStreetMap Nominatim (sunucu proxy) | Adres → koordinat, mahalle-merkezi fallback |
| **Kümeleme (Clustering)** | Kapasite kısıtlı K-Means++ (Haversine) | Adresleri araçlara coğrafi olarak dağıtma |
| **State Management** | Zustand 5 + persist (güvenli storage) | Global akış durumu, kalıcılık ve göç (migration) |
| **Sürükle-Bırak** | @hello-pangea/dnd | Rota durak sırası düzenleme |
| **Excel G/Ç** | SheetJS (xlsx) | Güvenli içe/dışa aktarma, formül-enjeksiyonu koruması |
| **PWA / Offline** | Web App Manifest + Service Worker | Kurulabilirlik & çevrimdışı çalışma |

**Mimari akış:**

```
Excel Yükle ─▶ Sanitize (fuzzy/Türkçe) ─▶ Geocode (Nominatim proxy)
     │                                              │
     ▼                                              ▼
K-Means Kümeleme (kapasite) ─▶ OSRM TSP Optimizasyon ─▶ Harita + Rota Konsolu
                                                          │
                                       ┌──────────────────┴───────────────────┐
                                       ▼                                       ▼
                          Şoför Mobil Arayüzü                       Gün Sonu Excel Raporu
                    (navigasyon · teslim kanıtı · offline)          (durum · araç/sıra sütunları)
```

> ⚙️ Tarayıcının Nominatim/OSRM'e doğrudan `User-Agent` gönderememesi ve CORS kısıtları, Next.js **API route proxy'leri** (`/api/geocode`, `/api/route-optimize`) ile aşılmıştır.

---

## 🚀 Kurulum ve Çalıştırma (Getting Started)

### Ön Gereksinimler

- **Node.js 18.18+** (20 LTS önerilir) ve **npm**

### Adımlar

```bash
# 1) Depoyu klonlayın
git clone https://github.com/<kullanici-adi>/social-aid-routing-system.git
cd social-aid-routing-system

# 2) Bağımlılıkları yükleyin
npm install

# 3) Ortam değişkenlerini hazırlayın (opsiyonel — tanımlanmazsa public servisler kullanılır)
cp .env.example .env.local
#   Windows PowerShell için: Copy-Item .env.example .env.local

# 4) Geliştirme sunucusunu başlatın
npm run dev
```

Ardından tarayıcıdan **[http://localhost:3000](http://localhost:3000)** adresini açın.

### 🔐 Ortam Değişkenleri (Environment Variables)

Tümü **opsiyoneldir**; tanımlanmazsa genel (public) demo servisleri kullanılır. Ayrıntılar için [`.env.example`](.env.example) dosyasına bakın.

| Değişken | Açıklama | Varsayılan |
| --- | --- | --- |
| `NEXT_PUBLIC_OSRM_URL` | OSRM rota optimizasyon sunucusu | `https://router.project-osrm.org` |
| `NEXT_PUBLIC_NOMINATIM_URL` | Nominatim geocoding uç noktası | `https://nominatim.openstreetmap.org/search` |
| `NEXT_PUBLIC_NOMINATIM_RATE_LIMIT_MS` | Geocoding istekleri arası min. gecikme (ms) | `1000` |

> ⚠️ **Üretim notu:** Genel OSRM/Nominatim sunucuları oran-limitlidir ve SLA garantisi vermez. Ölçekli kullanımda kendi OSRM ve Nominatim örneklerinizi kurup bu değişkenlerle bağlamanız önerilir. `NEXT_PUBLIC_` ön ekli değişkenler tarayıcıya gömülür — buraya gizli anahtar koymayın.

### Kullanılabilir Komutlar

```bash
npm run dev      # Geliştirme sunucusu (Turbopack)
npm run build    # Üretim derlemesi
npm run start    # Üretim sunucusu (build sonrası)
npm run lint     # ESLint denetimi
```

---

## 📂 Proje Yapısı (Özet)

```
src/
├── app/                 # App Router: sayfalar, API proxy'leri, hata sınırları
│   ├── api/geocode/         # Nominatim proxy
│   ├── api/route-optimize/  # OSRM proxy (TSP + sıra koruma)
│   └── driver/[routeId]/    # Şoför mobil ekranı
├── components/          # UI (map, route, driver, excel, common)
├── lib/                # Algoritmalar: clustering, priority, security, validator...
├── services/           # nominatimService, osrmService
├── store/              # Zustand global state (güvenli persist)
├── hooks/              # useCountUp, useCurrentLocation, useOnlineStatus...
└── constants/          # config, mahalle verisi
```

---

## 📜 Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır — © 2026 Mustafa Nazlı.

---

<div align="center">

**Bir staj & portföy projesi olarak; akıllı şehir, kamu teknolojisi (GovTech) ve lojistik optimizasyonu alanlarına yönelik geliştirilmiştir.**

</div>
