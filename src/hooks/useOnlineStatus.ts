'use client';

import { useEffect, useState } from 'react';

/**
 * Tarayıcının çevrimiçi/çevrimdışı durumunu canlı izler (Faz 6.3 rozeti).
 * SSR sırasında varsayılan true; mount sonrası gerçek durumla senkronlanır.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}
