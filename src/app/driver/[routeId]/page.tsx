import DriverScreen from '@/components/driver/DriverScreen';

/**
 * Mobil şoför dağıtım ekranı (PRD Bölüm 5.1).
 * Next 16'da `params` ve `searchParams` birer Promise'tir; sunucuda çözülüp
 * istemci bileşenine geçilir.
 *
 * İki mod:
 *   - `?sid=<paylaşımId>` varsa → CANLI mod: rota sunucudan (paylaşım) çekilir,
 *     böylece başka bir cihazda (telefon) da açılır ve güncellemeler senkronlanır.
 *   - `sid` yoksa → yerel mod: rota bu cihazın Zustand/localStorage deposundan
 *     okunur (geriye dönük uyumlu).
 */
export default async function DriverPage({
  params,
  searchParams,
}: {
  params: Promise<{ routeId: string }>;
  searchParams: Promise<{ sid?: string | string[] }>;
}) {
  const { routeId } = await params;
  const { sid } = await searchParams;
  const shareId = Array.isArray(sid) ? sid[0] : sid;

  return (
    <DriverScreen
      routeId={decodeURIComponent(routeId)}
      shareId={shareId ?? null}
    />
  );
}
