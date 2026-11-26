// Service worker for Shuffle 15. Bump VERSION on every release: the page then shows "New version available".
const VERSION = '1.2.2';
const CACHE = 'shuffle-15-' + VERSION;
const FILES = ['./', './index.html', './style.css', './game.js', './pwa.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];

// No skipWaiting() here: a new version waits until the page asks for it (after the user taps Update).
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES).catch(() => {})));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('shuffle-15-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'GET_VERSION' && event.ports[0]) event.ports[0].postMessage(VERSION);
});

// Cache first; anything new (fonts, the Tailwind script) is cached the first time it is fetched, so the game works offline afterwards.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {}); }
      return res;
    }).catch(() => cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
