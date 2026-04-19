const SW_VERSION = 'v4';
const SHELL_CACHE_NAME = `star-wars-shell-${SW_VERSION}`;
const RUNTIME_CACHE_NAME = `star-wars-runtime-${SW_VERSION}`;
const OFFLINE_FALLBACK_URL = '/offline.html';

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  OFFLINE_FALLBACK_URL
];

function isHtmlNavigationRequest(request) {
  return request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html');
}

function isResponseCacheable(request, response) {
  if (!response || !response.ok) return false;
  if (request.method !== 'GET') return false;

  const cacheControl = String(response.headers.get('Cache-Control') || '').toLowerCase();
  if (cacheControl.includes('no-store')) return false;

  const url = new URL(request.url);
  return url.origin === self.location.origin;
}

async function putIntoCache(cacheName, request, response) {
  if (!isResponseCacheable(request, response)) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE_NAME);
      await cache.addAll(PRECACHE_ASSETS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== SHELL_CACHE_NAME && name !== RUNTIME_CACHE_NAME)
          .map((name) => caches.delete(name))
      );

      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {
          // ignore unsupported environments
        }
      }

      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Prevent errors from browser internals for only-if-cached + non same-origin mode
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;

  if (isHtmlNavigationRequest(request)) {
    event.respondWith(
      (async () => {
        try {
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) {
            void putIntoCache(RUNTIME_CACHE_NAME, request, preloadResponse);
            return preloadResponse;
          }

          const networkResponse = await fetch(request);
          void putIntoCache(RUNTIME_CACHE_NAME, request, networkResponse);
          return networkResponse;
        } catch {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;

          const offlineFallback = await caches.match(OFFLINE_FALLBACK_URL);
          if (offlineFallback) return offlineFallback;

          return Response.error();
        }
      })()
    );
    return;
  }

  // Stale-while-revalidate for app assets
  event.respondWith(
    (async () => {
      const runtimeCache = await caches.open(RUNTIME_CACHE_NAME);
      const cachedResponse = await runtimeCache.match(request);

      const networkFetch = fetch(request)
        .then((networkResponse) => {
          void putIntoCache(RUNTIME_CACHE_NAME, request, networkResponse);
          return networkResponse;
        })
        .catch(() => undefined);

      if (cachedResponse) {
        event.waitUntil(networkFetch);
        return cachedResponse;
      }

      const networkResponse = await networkFetch;
      if (networkResponse) return networkResponse;

      const shellResponse = await caches.match(request);
      if (shellResponse) return shellResponse;

      return Response.error();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === 'CLEAR_RUNTIME_CACHE') {
    event.waitUntil(caches.delete(RUNTIME_CACHE_NAME));
  }
});
