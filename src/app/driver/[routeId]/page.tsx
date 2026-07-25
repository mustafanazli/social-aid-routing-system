import DriverScreen from '@/components/driver/DriverScreen';

/**
 * Mobil şoför dağıtım ekranı (PRD Bölüm 5.1).
 * Next 16'da `params` bir Promise'tir; sunucuda çözülüp istemci bileşenine
 * routeId olarak geçilir. Veriler (rotalar) istemcide persist'li Zustand
 * store'undan okunur.
 */
export default async function DriverPage({
  params,
}: {
  params: Promise<{ routeId: string }>;
}) {
  const { routeId } = await params;
  return <DriverScreen routeId={decodeURIComponent(routeId)} />;
}
