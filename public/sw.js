const CACHE_NAME = 'fake-ms-shell-v1';
const TILE_CACHE = 'fake-ms-tiles-v3'; // Increment version to invalidate old tiles

// Assets to pre-cache immediately
const PRECACHE_ASSETS = [
  '/FakeMS/',
  '/FakeMS/index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== TILE_CACHE) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Handle Map Tiles (Cache First, Persistent)
  // Supports OpenStreetMap and CartoDB (Dark Matter)
  if (url.hostname.endsWith('tile.openstreetmap.org') || url.hostname.endsWith('basemaps.cartocdn.com')) {
    event.respondWith(
      caches.open(TILE_CACHE).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then((networkResponse) => {
            // Only cache valid responses
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Return nothing or a transparent pixel if completely offline and missing
            return new Response('', { status: 408, statusText: 'Offline tile missing' });
          });
        });
      })
    );
    return;
  }

  // 2. Handle App Assets & Code (Stale-While-Revalidate)
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok && event.request.method === 'GET') {
             // Cache internal assets and specific CDNs
             if (url.origin === self.location.origin || 
                 url.hostname === 'aistudiocdn.com' || 
                 url.hostname === 'cdn.tailwindcss.com') {
                cache.put(event.request, networkResponse.clone());
             }
          }
          return networkResponse;
        });

        // Return cached response immediately if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      });
    })
  );
});