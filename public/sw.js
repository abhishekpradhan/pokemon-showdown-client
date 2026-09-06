/* Build-time manifest: the installed shell and its chunks always belong together. */
const BUILD = /* @arena-manifest */ { revision: 'development', assets: ['/', '/favicon.svg', '/manifest.webmanifest', '/icon-512.png'] };
const PREFIX = 'arena-build-';
const CACHE = `${PREFIX}${BUILD.revision}`;
const CORE = new Set(BUILD.assets);
const isAppPath = pathname => /^\/(?:index\.html|teambuilder|settings|rooms|battles|ladder|replays)?$/.test(pathname) || /^\/(?:room|battle)\/[^/]+$/.test(pathname) || /^\/(?:battle-[a-z0-9-]+|pm-[a-z0-9]+|lobby)$/.test(pathname);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      // A deployment may change while this worker installs. Reject a mixed shell.
      const shell = await fetch('/', { cache: 'no-store' });
      const html = await shell.clone().text();
      if (!shell.ok || !html.includes(`name="arena-build" content="${BUILD.revision}"`)) throw new Error('Deployment changed during install');
      await cache.put('/', shell);
      const resources = BUILD.assets.filter(path => path !== '/');
      await cache.addAll(resources);
      // Some SPA hosts return their HTML fallback with 200 for missing chunks.
      // Such a cache must never become the installed offline application.
      for (const path of resources) {
        const response = await cache.match(path);
        const type = response?.headers.get('Content-Type') || '';
        if (!response || (/\.js$/.test(path) && !/(java|ecma)script/i.test(type)) || (/\.css$/.test(path) && !/text\/css/i.test(type))) {
          throw new Error('Incomplete deployment resources');
        }
      }
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
    // Updates wait for user approval or all old tabs to close. First install
    // activates naturally; an active battle must not be reloaded underneath it.
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ARENA_APPLY_UPDATE') event.waitUntil(self.skipWaiting());
  if (event.data?.type === 'ARENA_OFFLINE_STATUS' && event.ports?.[0]) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const present = await Promise.all(BUILD.assets.map(path => cache.match(path)));
      event.ports[0].postMessage({ revision: BUILD.revision, ready: present.every(Boolean) });
    })());
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const path = event.notification.data?.path;
  if (typeof path !== 'string' || !/^\/(?:room|battle)\/[a-z0-9-]+$/.test(path)) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === location.origin);
    if (existing) { await existing.navigate(path); await existing.focus(); }
    else await self.clients.openWindow(path);
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const previous = keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).at(-1);
    await Promise.all(keys.filter(key =>
      ((key.startsWith(PREFIX) && key !== CACHE && key !== previous) || /^arena-(shell|assets)-/.test(key))
    ).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin || event.request.method !== 'GET') return;
  // OAuth, API responses, arbitrary documents and external media are never cached.
  if (event.request.mode === 'navigate' && isAppPath(url.pathname)) {
    event.respondWith((async () => {
      const shell = await (await caches.open(CACHE)).match('/');
      return shell || fetch(event.request);
    })());
    return;
  }
  if (!CORE.has(url.pathname) && !url.pathname.startsWith('/assets/')) return;
  event.respondWith((async () => {
    const current = await (await caches.open(CACHE)).match(url.pathname);
    if (current) return current;
    // The immediately previous release supports a tab still running old code.
    for (const key of await caches.keys()) {
      if (!key.startsWith(PREFIX) || key === CACHE) continue;
      const previous = await (await caches.open(key)).match(url.pathname);
      if (previous) return previous;
    }
    // No opportunistic caching: retained entries are bounded by two manifests.
    return fetch(event.request);
  })());
});
