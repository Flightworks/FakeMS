import type { FeatureCollection } from 'geojson';

const DEFAULT_TACTICAL_JSON_CACHE_ENTRIES = 16;

type JsonParser<T> = (value: unknown) => T;

interface JsonCacheEntry {
  promise: Promise<unknown>;
  settled: boolean;
}

const loadedJson = new Map<string, JsonCacheEntry>();

const isFeatureCollection = (value: unknown): value is FeatureCollection => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { type?: unknown; features?: unknown };
  return candidate.type === 'FeatureCollection'
    && Array.isArray(candidate.features)
    && candidate.features.length > 0
    && candidate.features.every(feature => {
      if (!feature || typeof feature !== 'object') return false;
      const featureCandidate = feature as { type?: unknown; geometry?: unknown; properties?: unknown };
      return featureCandidate.type === 'Feature'
        && 'geometry' in featureCandidate
        && 'properties' in featureCandidate;
    });
};

const readCache = async <T>(url: string, parser: JsonParser<T>): Promise<T | undefined> => {
  if (typeof caches === 'undefined') return undefined;
  const response = await caches.match(url);
  if (!response) return undefined;
  if (!response.ok) throw new Error(`Tactical map cache response failed: ${response.status}`);
  return parser(await response.json() as unknown);
};

const trimSettledCache = (maxEntries: number): void => {
  if (!Number.isFinite(maxEntries) || maxEntries < 1) return;
  while (loadedJson.size > Math.floor(maxEntries)) {
    const removable = [...loadedJson.entries()].find(([, entry]) => entry.settled);
    if (!removable) return;
    loadedJson.delete(removable[0]);
  }
};

export interface TacticalJsonLoadOptions {
  maxEntries?: number;
}

export const loadTacticalJson = <T>(
  url: string,
  parser: JsonParser<T>,
  options: TacticalJsonLoadOptions = {},
): Promise<T> => {
  const cached = loadedJson.get(url);
  if (cached) return cached.promise as Promise<T>;

  const maxEntries = options.maxEntries ?? DEFAULT_TACTICAL_JSON_CACHE_ENTRIES;
  const request = (async () => {
    try {
      const cacheHit = await readCache(url, parser);
      if (cacheHit !== undefined) return cacheHit;
    } catch {
      // Ignore a stale or malformed cache entry and try the current resource.
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Tactical map data request failed: ${response.status}`);
      return parser(await response.json() as unknown);
    } catch (error) {
      const cacheFallback = await readCache(url, parser);
      if (cacheFallback !== undefined) return cacheFallback;
      throw error;
    }
  })().catch(error => {
    loadedJson.delete(url);
    throw error;
  });

  const entry: JsonCacheEntry = { promise: request, settled: false };
  loadedJson.set(url, entry);
  request.then(
    () => {
      entry.settled = true;
      trimSettledCache(maxEntries);
    },
    () => {
      loadedJson.delete(url);
    },
  );
  trimSettledCache(maxEntries);
  return request;
};

export const loadTacticalGeoJson = (
  url: string,
  options?: TacticalJsonLoadOptions,
): Promise<FeatureCollection> => loadTacticalJson(url, value => {
  if (!isFeatureCollection(value)) throw new Error('Tactical map data is not a non-empty FeatureCollection');
  return value;
}, options);
