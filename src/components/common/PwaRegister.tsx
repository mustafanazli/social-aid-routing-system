'use client';

import { useEffect } from 'react';

/**
 * Service worker'ı kaydeder (Faz 6.3 · çevrimdışı/PWA desteği).
 * Kayıt başarısız olursa sessiz geçer — uygulama çevrimiçi normal çalışır.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* kayıt başarısız — yoksay */
      });
    };
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }, []);

  return null;
}
