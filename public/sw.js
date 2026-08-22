/*
 * Minimal app-shell service worker: enough for installability and an
 * offline shell, deliberately no more.
 *
 * - Hashed build assets (/assets/*) are cache-first: immutable by name.
 * - Navigations are network-first with the cached shell as fallback.
 * - Everything else (API, websockets, cross-origin) is untouched.
 */
const SHELL_CACHE = 'arena-shell-v1';
const ASSET_CACHE = 'arena-assets-v1';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(['/', '/manifest.webmanifest', '/favicon.svg']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== SHELL_CACHE && key !== ASSET_CACHE).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin || event.request.method !== 'GET') return;

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(cache =>
        cache.match(event.request).then(hit => hit || fetch(event.request).then(response => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        }))
      )
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then(cache => cache.put('/', copy));
        }
        return response;
      }).catch(() => caches.match('/'))
    );
  }
});
