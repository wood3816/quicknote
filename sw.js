const CACHE = 'quicknote-v1.1.6';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=1.1.6',
  './app.js?v=1.1.6',
  './manifest.webmanifest?v=1.1.6',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const fresh = await fetch(event.request, { cache: 'no-store' });
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(event.request, fresh.clone()).catch(() => {});
      }
      return fresh;
    } catch (_) {
      const cached = await caches.match(event.request, { ignoreSearch: false }) ||
                     await caches.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      if (event.request.mode === 'navigate') return caches.match('./index.html');
      return Response.error();
    }
  })());
});
