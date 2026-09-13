const BUILD_ID = '__FAKEMS_BUILD_ID__';
const CACHE_PREFIX = 'fake-ms-shell-';
const LEGACY_TILE_PREFIX = 'fake-ms-tiles-';
const LEGACY_TILE_META_PREFIX = 'fake-ms-tile-meta-';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`;
const STAGING_CACHE_NAME = `${CACHE_NAME}-staging`;
const BASE_PATH = new URL('./', self.location.href).pathname;
const BUILD_ASSETS = /* __FAKEMS_BUILD_ASSETS__ */ [];
const TOULON_COAST_ASSETS = [
  `${BASE_PATH}maps/toulon/manifest.json`,
  `${BASE_PATH}maps/toulon/coast-west.geojson`,
  `${BASE_PATH}maps/toulon/coast-east.geojson`,
];
const REQUIRED_COAST_ASSET_PATHS = new Set(['coast-west.geojson', 'coast-east.geojson']);
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
  ...TOULON_COAST_ASSETS,
  ...BUILD_ASSETS.map(asset => `${BASE_PATH}${asset}`),
];
const PRECACHE_URLS = new Set(PRECACHE_ASSETS.map(asset => new URL(asset, self.location.href).href));

const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isNonEmptyFeatureCollection = value => (
  isRecord(value)
  && value.type === 'FeatureCollection'
  && Array.isArray(value.features)
  && value.features.length > 0
  && value.features.every(feature => (
    isRecord(feature)
    && feature.type === 'Feature'
    && isRecord(feature.geometry)
  ))
);

const isValidCoastFeatureCollection = value => (
  isNonEmptyFeatureCollection(value)
  && value.features.every(feature => {
    const geometry = feature.geometry;
    return geometry.type === 'LineString'
      && Array.isArray(geometry.coordinates)
      && geometry.coordinates.length >= 2
      && geometry.coordinates.every(coordinate => (
        Array.isArray(coordinate)
        && coordinate.length === 2
        && coordinate.every(value => typeof value === 'number' && Number.isFinite(value))
      ));
  })
);

const isOrderedBBox = value => (
  Array.isArray(value)
  && value.length === 4
  && value.every(value => typeof value === 'number' && Number.isFinite(value))
  && value[0] >= -180
  && value[0] < value[2]
  && value[2] <= 180
  && value[1] >= -90
  && value[1] < value[3]
  && value[3] <= 90
);

const bboxContains = (outer, inner) => (
  isOrderedBBox(outer)
  && isOrderedBBox(inner)
  && outer[0] <= inner[0]
  && outer[1] <= inner[1]
  && outer[2] >= inner[2]
  && outer[3] >= inner[3]
);

const isLocalCoastAssetPath = value => (
  typeof value === 'string'
  && value.trim() !== ''
  && !value.includes('\\')
  && !value.startsWith('/')
  && !value.startsWith('../')
  && !value.includes(':')
);

const isValidCoastManifest = value => {
  if (!isRecord(value)
    || value.schema !== 'fakems.coastal-pack'
    || (value.schema_version !== 1 && value.schemaVersion !== 1)
    || typeof value.pack_version !== 'string'
    || !value.pack_version.trim()
    || typeof value.generated_at !== 'string'
    || !value.generated_at.trim()
    || typeof value.crs !== 'string'
    || value.crs.trim().toLowerCase() !== 'wgs84'
    || !isOrderedBBox(value.bbox)
    || !Array.isArray(value.assets)
    || value.assets.length === 0) return false;
  const assetsAreValid = value.assets.every(asset => (
    isRecord(asset)
    && ['id', 'path', 'sector', 'lod'].every(field => (
      typeof asset[field] === 'string' && asset[field].trim() !== ''
    ))
    && isLocalCoastAssetPath(asset.path)
    && isOrderedBBox(asset.bbox)
    && bboxContains(value.bbox, asset.bbox)
  ));
  const assetPaths = new Set(value.assets.map(asset => (isRecord(asset) ? asset.path : undefined)));
  return assetsAreValid && [...REQUIRED_COAST_ASSET_PATHS].every(path => assetPaths.has(path));
};

const isMapAssetRequest = request => {
  const pathname = new URL(request.url).pathname;
  return pathname.includes('/maps/') && (pathname.endsWith('.geojson') || pathname.endsWith('/manifest.json'));
};

const isCoastManifestRequest = request => new URL(request.url).pathname.endsWith('/maps/toulon/manifest.json');

const isCoastGeoJsonRequest = request => {
  const pathname = new URL(request.url).pathname;
  return pathname.endsWith('/maps/toulon/coast-west.geojson')
    || pathname.endsWith('/maps/toulon/coast-east.geojson');
};

const isUsablePrecacheResponse = async (request, response) => {
  if (!response || !response.ok || response.type === 'opaque') return false;
  if (!isMapAssetRequest(request)) return true;

  try {
    const value = await response.clone().json();
    return isCoastManifestRequest(request)
      ? isValidCoastManifest(value)
      : isCoastGeoJsonRequest(request)
        ? isValidCoastFeatureCollection(value)
        : isNonEmptyFeatureCollection(value);
  } catch {
    return false;
  }
};

const offlineResponse = () => new Response('Offline shell unavailable', {
  status: 503,
  statusText: 'Offline shell unavailable',
});

const precacheBuild = async () => {
  const stagingCache = await caches.open(STAGING_CACHE_NAME);
  try {
    const existingCacheKeys = await caches.keys();
    const currentCache = existingCacheKeys.includes(CACHE_NAME)
      ? await caches.open(CACHE_NAME)
      : null;
    if (currentCache) {
      const currentComplete = await Promise.all(PRECACHE_ASSETS.map(async asset => {
        const request = new Request(new URL(asset, self.location.href).href);
        const response = await currentCache.match(request, { ignoreVary: true });
        return response ? isUsablePrecacheResponse(request, response) : false;
      }));

      if (currentComplete.every(Boolean)) {
        await caches.delete(STAGING_CACHE_NAME);
        return;
      }
    }

    for (const asset of PRECACHE_ASSETS) {
      const request = new Request(new URL(asset, self.location.href).href);
      const response = await fetch(request, { cache: 'no-store' });
      if (!(await isUsablePrecacheResponse(request, response))) {
        throw new Error(`Precache asset rejected: ${asset}`);
      }
      await stagingCache.put(request, response.clone());
    }

    const stagedRequests = await stagingCache.keys();
    if (stagedRequests.length !== PRECACHE_ASSETS.length) {
      throw new Error('Precache staging is incomplete');
    }

    const targetCache = currentCache ?? await caches.open(CACHE_NAME);
    for (const request of stagedRequests) {
      const response = await stagingCache.match(request, { ignoreVary: true });
      if (!response || !(await isUsablePrecacheResponse(request, response))) {
        throw new Error(`Precache staging is corrupt: ${request.url}`);
      }
      await targetCache.put(request, response);
    }
  } catch (error) {
    // A failed replacement must not remove the last completed shell cache.
    await caches.delete(STAGING_CACHE_NAME);
    throw error;
  }

  await caches.delete(STAGING_CACHE_NAME);
};

self.addEventListener('install', (event) => {
  event.waitUntil(precacheBuild());
});

const isOwnedObsoleteCache = key => (
  key !== CACHE_NAME
  && (
    key.startsWith(CACHE_PREFIX)
    || key.startsWith(LEGACY_TILE_PREFIX)
    || key.startsWith(LEGACY_TILE_META_PREFIX)
  )
);

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(isOwnedObsoleteCache).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

const findCachedResponse = async request => {
  const keys = await caches.keys();
  const candidateKeys = [
    CACHE_NAME,
    ...keys.filter(key => key !== CACHE_NAME && key.startsWith(CACHE_PREFIX) && key !== STAGING_CACHE_NAME),
  ];

  for (const key of candidateKeys) {
    const cache = await caches.open(key);
    const response = await cache.match(request, { ignoreVary: true });
    if (response && await isUsablePrecacheResponse(request, response)) return response;
  }
  return undefined;
};

const respondWithLocalCache = async request => {
  const cachedResponse = await findCachedResponse(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    if (!(await isUsablePrecacheResponse(request, networkResponse))) {
      return await findCachedResponse(request) ?? offlineResponse();
    }

    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    } catch {
      // A successful local response remains usable if runtime caching is unavailable.
    }
    return networkResponse;
  } catch {
    return await findCachedResponse(request) ?? offlineResponse();
  }
};

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!PRECACHE_URLS.has(event.request.url)) return;

  event.respondWith(respondWithLocalCache(event.request));
});
