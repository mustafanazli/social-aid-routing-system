// Canlı şoför paylaşımı istemci servisi.
// Yönetici paneli ve şoför ekranı bu fonksiyonlar üzerinden `/api/share`
// uç noktalarıyla konuşur.

import type {
  SharedRoute,
  StopPatch,
  DriverLocation,
  DriverLocationPatch,
} from '@/lib/shareSerialization';
import type { VehicleRoute } from '@/types/fleet';

export interface CreateShareResult {
  shareId: string;
  /** Kalıcı (Upstash) depolama mı, yoksa geçici in-memory mi? */
  persistent: boolean;
  createdAt: string;
}

export interface ShareSnapshot {
  routes: SharedRoute[];
  driverLocations?: DriverLocation[];
  createdAt: string;
  updatedAt: string;
}

/** Mevcut rotaları sunucuya yayınlar; kısa bir shareId döner. */
export async function createShare(
  routes: VehicleRoute[],
): Promise<CreateShareResult> {
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ routes }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error ?? `Paylaşım oluşturulamadı (${res.status}).`);
  }
  return (await res.json()) as CreateShareResult;
}

/** Bir paylaşımın güncel halini çeker (polling). */
export async function fetchShare(shareId: string): Promise<ShareSnapshot> {
  const res = await fetch(`/api/share/${encodeURIComponent(shareId)}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error ?? `Paylaşım okunamadı (${res.status}).`);
  }
  return (await res.json()) as ShareSnapshot;
}

/** Tek bir durağın durumunu sunucuya yazar. Güncellenmiş rotaları döner. */
export async function patchStop(
  shareId: string,
  patch: StopPatch,
): Promise<SharedRoute[]> {
  const res = await fetch(`/api/share/${encodeURIComponent(shareId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error ?? `Güncelleme başarısız (${res.status}).`);
  }
  const result = (await res.json()) as { routes: SharedRoute[] };
  return result.routes;
}

/** Şoförün canlı konumunu sunucuya yazar (araç bazında son konum güncellenir). */
export async function patchDriverLocation(
  shareId: string,
  patch: DriverLocationPatch,
): Promise<void> {
  const res = await fetch(`/api/share/${encodeURIComponent(shareId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error ?? `Konum gönderilemedi (${res.status}).`);
  }
}
