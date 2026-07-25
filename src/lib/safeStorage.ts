import type { StateStorage } from 'zustand/middleware';

/**
 * Güvenli localStorage katmanı (Faz 7.5).
 *
 * - Okuma: değeri doğrular (JSON.parse). Bozuksa (corrupted) sessizce siler ve
 *   null döner → uygulama çökmez, güvenli varsayılanlarla başlar.
 * - Yazma: kota aşımı / gizli mod / erişim hatalarını yakalar (sessiz geçer),
 *   böylece büyük imza/fotoğraf verisi kaydı uygulamayı kilitlemez.
 * - SSR: `localStorage` yoksa no-op davranır.
 */

const memoryFallback = new Map<string, string>();

function getStore(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Bazı tarayıcılar gizli modda erişimde hata fırlatır.
    return null;
  }
}

export function createSafeStorage(): StateStorage {
  return {
    getItem: (name) => {
      const store = getStore();
      try {
        const raw = store
          ? store.getItem(name)
          : (memoryFallback.get(name) ?? null);
        if (raw === null) return null;
        // Doğrula: bozuk JSON ise hata fırlatır → catch bloğunda temizlenir.
        JSON.parse(raw);
        return raw;
      } catch {
        // Bozuk veri → sessizce temizle.
        try {
          store?.removeItem(name);
          memoryFallback.delete(name);
        } catch {
          /* yoksay */
        }
        return null;
      }
    },

    setItem: (name, value) => {
      const store = getStore();
      try {
        if (store) store.setItem(name, value);
        else memoryFallback.set(name, value);
      } catch {
        // Kota aşımı (QuotaExceededError) vb. → bellek yedeğine yaz, çökme.
        try {
          memoryFallback.set(name, value);
        } catch {
          /* yoksay */
        }
      }
    },

    removeItem: (name) => {
      const store = getStore();
      try {
        store?.removeItem(name);
        memoryFallback.delete(name);
      } catch {
        /* yoksay */
      }
    },
  };
}
