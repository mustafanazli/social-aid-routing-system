'use client';

import { useSyncExternalStore } from 'react';

import { useDeliveryStore } from '@/store/useDeliveryStore';

/**
 * Zustand persist store'unun LocalStorage'dan yeniden yüklenip
 * yüklenmediğini bildirir. SSR sırasında sunucu ve istemcinin farklı
 * değerler render etmesinden (hydration mismatch) kaçınmak için kullanılır.
 *
 * `useSyncExternalStore` ile effect'te setState çağırmadan, store'un
 * hydration olayına doğrudan abone olur (React 19 uyumlu, lint-temiz).
 */
export function useHasHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) =>
      useDeliveryStore.persist.onFinishHydration(onStoreChange),
    () => useDeliveryStore.persist.hasHydrated(),
    () => false, // sunucu anlık görüntüsü: her zaman "henüz hydrate olmadı"
  );
}
