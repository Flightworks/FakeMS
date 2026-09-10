const BUILD_ID = '__FAKEMS_BUILD_ID__';
const CACHE_PREFIX = 'fake-ms-shell-';
const LEGACY_TILE_PREFIX = 'fake-ms-tiles-';
const LEGACY_TILE_META_PREFIX = 'fake-ms-tile-meta-';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`;
const BASE_PATH = new URL('./', self.location.href).pathname;
const BUILD_ASSETS = /* __FAKEMS_BUILD_ASSETS__ */ [];
const PRECACHE_ASSETS = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}manifest.json`,
  `${BASE_PATH}icons/fakems.svg`,
  `${BASE_PATH}icons/fakems-192.svg`,
  `${BASE_PATH}icons/fakems-512.svg`,
  `${BASE_PATH}maps/ne_110m_land.geojson`,
  `${BASE_PATH}maps/ne_10m_land_toulon.geojson`,
  `${BASE_PATH}maps/ne_10m_airports_major.geojson`,
  ...BUILD_ASSETS.map(asset => `${BASE_PATH}${asset}`),
];
const PRECACHE_URLS = new Set(PRECACHE_ASSETS.map(asset => new URL(asset, self.location.href).href));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map((key) => {
      const isCurrent = key === CACHE_NAME;
      const isFakeMsCache = key.startsWith(CACHE_PREFIX)
        || key.startsWith(LEGACY_TILE_PREFIX)
        || key.startsWith(LEGACY_TILE_META_PREFIX);
      return !isCurrent && isFakeMsCache ? caches.delete(key) : undefined;
    }))),
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!PRECACHE_URLS.has(event.request.url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(event.request);
    if (cachedResponse) return cachedResponse;

    try {
      const networkResponse = await fetch(event.request);
      if (networkResponse.ok) {
        await cache.put(event.request, networkResponse.clone());
      }
      return networkResponse;
    } catch {
      return new Response('Offline shell unavailable', {
        status: 503,
        statusText: 'Offline shell unavailable',
      });
    }
  })());
});
