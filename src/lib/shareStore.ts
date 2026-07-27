// Canlı şoför paylaşımı için sunucu tarafı depolama katmanı.
//
// İki mod:
//   1) Upstash Redis (REST) — UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//      tanımlıysa. Vercel gibi çok-örnekli (serverless) ortamda admin ve şoför
//      farklı sunucu örneklerine düşse bile veriyi paylaşmayı sağlar. Ekstra
//      npm paketi gerekmez; sade `fetch` ile REST komut uç noktası kullanılır.
//   2) In-memory (yedek) — env tanımlı değilse. Tek süreçli `next dev` için
//      yeterlidir (aynı Wi-Fi / tünel üzerinden telefonla test). Sunucu yeniden
//      başlarsa veya birden fazla örnek çalışırsa paylaşım kaybolur.

import type { SharedRoute } from './shareSerialization';

/** Bir paylaşım oturumunda saklanan tüm veri. */
export interface StoredShare {
  createdAt: string;
  updatedAt: string;
  routes: SharedRoute[];
}

/** Paylaşımların yaşam süresi (saniye) — 24 saat sonra otomatik silinir. */
const SHARE_TTL_SECONDS = 60 * 60 * 24;

const KEY_PREFIX = 'share:';

// --- Upstash yapılandırması ---------------------------------------------

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/** Upstash env ikilisi tanımlıysa kalıcı (çok-örnekli) depolama kullanılır. */
export function isPersistentStore(): boolean {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}

/** Upstash REST komut uç noktasına tek bir Redis komutu gönderir. */
async function upstashCommand(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(UPSTASH_URL as string, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN as string}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Upstash isteği başarısız: ${res.status}`);
  }

  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) {
    throw new Error(`Upstash hatası: ${data.error}`);
  }
  return data.result;
}

// --- In-memory yedek -----------------------------------------------------

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

// `globalThis` üzerinde tutulur ki `next dev` hot-reload sırasında sıfırlanmasın.
const memoryStore: Map<string, MemoryEntry> = (() => {
  const g = globalThis as typeof globalThis & {
    __shareMemoryStore?: Map<string, MemoryEntry>;
  };
  if (!g.__shareMemoryStore) g.__shareMemoryStore = new Map();
  return g.__shareMemoryStore;
})();

function memoryGet(key: string): string | null {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: string): void {
  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + SHARE_TTL_SECONDS * 1000,
  });
}

// --- Genel API -----------------------------------------------------------

/** Yeni/kısa, URL-güvenli bir paylaşım kimliği üretir. */
export function generateShareId(): string {
  // 10 karakterlik base36 → tahmin edilmesi zor, QR/link için kısa.
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 10);
}

/** Bir paylaşımı kaydeder/günceller (TTL yenilenir). */
export async function putShare(id: string, share: StoredShare): Promise<void> {
  const key = KEY_PREFIX + id;
  const value = JSON.stringify(share);
  if (isPersistentStore()) {
    await upstashCommand(['SET', key, value, 'EX', SHARE_TTL_SECONDS]);
  } else {
    memorySet(key, value);
  }
}

/** Bir paylaşımı okur; yoksa/süresi dolmuşsa null döner. */
export async function getShare(id: string): Promise<StoredShare | null> {
  const key = KEY_PREFIX + id;
  let raw: string | null;
  if (isPersistentStore()) {
    const result = await upstashCommand(['GET', key]);
    raw = typeof result === 'string' ? result : null;
  } else {
    raw = memoryGet(key);
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredShare;
  } catch {
    return null;
  }
}
