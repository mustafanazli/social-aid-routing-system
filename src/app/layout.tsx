import type { Metadata, Viewport } from "next";
import { Lexend, Geist_Mono } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/common/PwaRegister";

// Lexend: okunabilirlik için tasarlanmış, kamu/erişilebilirlik odaklı sans.
// latin-ext, Türkçe karakterleri (ğ, ş, ı, İ) kapsar.
const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pendik Belediyesi | Sosyal Yardım Rota Yönetimi",
  description:
    "Pendik Belediyesi Sosyal Yardım Dağıtım ve Rota Optimizasyon Sistemi — adres doğrulama, araç kümeleme ve OSRM tabanlı rota optimizasyonu.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pendik Rota",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${lexend.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
