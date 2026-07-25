/*
 * Pendik Sosyal Yardım Rota — Service Worker (Faz 6.3, çevrimdışı destek).
 *
 * Strateji: network-first. Çevrimiçiyken her zaman güncel içerik gelir ve
 * başarılı yanıtlar önbelleğe alınır; internet kesildiğinde son önbellek
 * sunulur. Bu yaklaşım geliştirme (HMR) sırasında bayat parça sorunlarına yol
 * açmaz. Uygulama verisi zaten localStorage'da (Zustand persist) tutulur.
 */

const CACHE = 'pendik-rota-v1';
const PRECACHE = ['/', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // yalnızca kendi origin
  if (url.pathname.startsWith('/api/')) return; // API'yi önbelleğe alma

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          // Gezinme (sayfa) isteği çevrimdışıysa ana kabuğa düş.
          if (req.mode === 'navigate') return caches.match('/');
          return Response.error();
        }),
      ),
  );
});
