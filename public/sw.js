const BUILD_ID = '__FAKEMS_BUILD_ID__';
const CACHE_PREFIX = 'fake-ms-shell-';
const TILE_PREFIX = 'fake-ms-tiles-';
const TILE_META_PREFIX = 'fake-ms-tile-meta-';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`;
const TILE_CACHE = `${TILE_PREFIX}${BUILD_ID}`;
const TILE_META_CACHE = `${TILE_META_PREFIX}${BUILD_ID}`;
const BUILD_ASSETS = /* __FAKEMS_BUILD_ASSETS__ */ [];
const TILE_MAX_ENTRIES = 150;
const TILE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const BASE_PATH = new URL('./', self.location.href).pathname;
const PRECACHE_ASSETS = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}manifest.json`,
  `${BASE_PATH}icons/fakems.svg`,
  `${BASE_PATH}icons/fakems-192.svg`,
  `${BASE_PATH}icons/fakems-512.svg`,
  ...BUILD_ASSETS.map(asset => `${BASE_PATH}${asset}`),
];

const isTileRequest = (url) => (
  url.hostname.endsWith('tile.openstreetmap.org')
  || url.hostname.endsWith('basemaps.cartocdn.com')
);

const trimTileCache = async (tileCache, metadataCache) => {
  const requests = await tileCache.keys();
  if (requests.length <= TILE_MAX_ENTRIES) return;

  const entries = await Promise.all(requests.map(async (request) => {
    const metadataResponse = await metadataCache.match(request.url);
    let storedAt = 0;
    if (metadataResponse) {
      try {
        storedAt = Number((await metadataResponse.json()).storedAt) || 0;
      } catch {
        storedAt = 0;
      }
    }
    return { request, storedAt };
  }));

  entries.sort((left, right) => left.storedAt - right.storedAt);
  await Promise.all(entries.slice(0, entries.length - TILE_MAX_ENTRIES).map(({ request }) => (
    Promise.all([
      tileCache.delete(request),
      metadataCache.delete(request.url),
    ])
  )));
};

const cacheTile = async (request, response) => {
  const tileCache = await caches.open(TILE_CACHE);
  const metadataCache = await caches.open(TILE_META_CACHE);
  await tileCache.put(request, response.clone());
  await metadataCache.put(
    request.url,
    new Response(JSON.stringify({ storedAt: Date.now() }), {
      headers: { 'content-type': 'application/json' },
    }),
  );
  await trimTileCache(tileCache, metadataCache);
};

const serveTile = async (request) => {
  const tileCache = await caches.open(TILE_CACHE);
  const metadataCache = await caches.open(TILE_META_CACHE);
  const cachedResponse = await tileCache.match(request);
  if (cachedResponse) {
    const metadataResponse = await metadataCache.match(request.url);
    let storedAt = 0;
    try {
      storedAt = metadataResponse ? Number((await metadataResponse.json()).storedAt) : 0;
    } catch {
      storedAt = 0;
    }
    if (storedAt > 0 && Date.now() - storedAt <= TILE_MAX_AGE_MS) {
      return cachedResponse;
    }
    await Promise.all([tileCache.delete(request), metadataCache.delete(request.url)]);
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cacheTile(request, networkResponse);
    }
    return networkResponse;
  } catch {
    return new Response('', {
      status: 504,
      statusText: 'Offline tile missing',
      headers: { 'X-FakeMS-Offline-Tile': 'true' },
    });
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map((key) => {
      const isCurrent = key === CACHE_NAME || key === TILE_CACHE || key === TILE_META_CACHE;
      const isFakeMsCache = key.startsWith(CACHE_PREFIX)
        || key.startsWith(TILE_PREFIX)
        || key.startsWith(TILE_META_PREFIX);
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

  if (isTileRequest(url)) {
    event.respondWith(serveTile(event.request));
    return;
  }

  if (url.origin !== self.location.origin) return;

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
