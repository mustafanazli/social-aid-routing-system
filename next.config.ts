import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker/self-host için minimal üretim çıktısı: `.next/standalone` altında
  // yalnızca gerekli dosyalar + `server.js` üretilir (node_modules'un tamamı
  // kopyalanmadan çalışır). Vercel bunu yok sayar; mevcut dağıtımı etkilemez.
  output: 'standalone',

  // pdfjs-dist Node'da kendi worker modülünü dinamik import eder; Next bunu
  // paketlerse worker yolu bozulur. Harici bırakınca node_modules'tan native
  // require ile yüklenir ve PDF metin çıkarımı (/api/pdf-addresses) çalışır.
  serverExternalPackages: ['pdfjs-dist'],

  // Standalone çıktısında pdfjs-dist'in dinamik require ettiği dosyalar dosya
  // izlemede kaçabilir; PDF rotası için paketi açıkça dahil et.
  outputFileTracingIncludes: {
    '/api/pdf-addresses': ['./node_modules/pdfjs-dist/**/*'],
  },
};

export default nextConfig;
