const CACHE_NAME = 'gitpanel-v3';
const SHELL_ASSETS = [
  '/',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        SHELL_ASSETS.map((url) =>
          fetch(url).then((r) => {
            if (r.ok) return cache.put(url, r);
          }).catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept API requests or Vite dev server internals
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/@') || url.pathname.startsWith('/src/') || url.pathname.startsWith('/node_modules/')) return;

  // Network-first for navigation — fall back to cached shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/').then((r) => r ?? Response.error())
      )
    );
    return;
  }

  // Always network-first for JS/CSS/module files (never serve stale code)
  const ext = url.pathname.split('.').pop();
  if (['js', 'mjs', 'ts', 'tsx', 'css'].includes(ext ?? '')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for static assets (icons, images, manifest)
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached ?? fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
    )
  );
});
