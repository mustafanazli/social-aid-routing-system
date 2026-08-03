import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist Node'da kendi worker modülünü dinamik import eder; Next bunu
  // paketlerse worker yolu bozulur. Harici bırakınca node_modules'tan native
  // require ile yüklenir ve PDF metin çıkarımı (/api/pdf-addresses) çalışır.
  serverExternalPackages: ['pdfjs-dist'],
};

export default nextConfig;
