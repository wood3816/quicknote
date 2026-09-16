importScripts("./config.js");
const CACHE_NAME = `suishouji-cache-v${APP_CONFIG.VERSION}`;
const PRECACHE = ["./","./index.html","./styles.css","./config.js","./app.js","./manifest.webmanifest","./version.json","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.endsWith("/version.json")) {
    event.respondWith(fetch(event.request, {cache:"no-store"}).catch(() => caches.match("./version.json")));
    return;
  }
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(res => {
      const clone = res.clone(); caches.open(CACHE_NAME).then(cache => cache.put("./index.html", clone)); return res;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
    if (res && res.status === 200 && res.type === "basic") { const clone = res.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)); }
    return res;
  })));
});
self.addEventListener("message", event => { if (event.data?.type === "SKIP_WAITING") self.skipWaiting(); });
