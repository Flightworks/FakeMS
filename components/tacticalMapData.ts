import type { FeatureCollection } from 'geojson';

const loadedGeoJson = new Map<string, Promise<FeatureCollection>>();

const isFeatureCollection = (value: unknown): value is FeatureCollection => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { type?: unknown; features?: unknown };
  return candidate.type === 'FeatureCollection'
    && Array.isArray(candidate.features)
    && candidate.features.length > 0;
};

const parseFeatureCollection = async (response: Response): Promise<FeatureCollection> => {
  if (!response.ok) throw new Error(`Tactical map data request failed: ${response.status}`);
  const data = await response.json() as unknown;
  if (!isFeatureCollection(data)) throw new Error('Tactical map data is not a non-empty FeatureCollection');
  return data;
};

const readCache = async (url: string): Promise<FeatureCollection | undefined> => {
  if (typeof caches === 'undefined') return undefined;
  const response = await caches.match(url);
  return response ? parseFeatureCollection(response) : undefined;
};

export const loadTacticalGeoJson = (url: string): Promise<FeatureCollection> => {
  const cached = loadedGeoJson.get(url);
  if (cached) return cached;

  const request = (async () => {
    try {
      const cacheHit = await readCache(url);
      if (cacheHit) return cacheHit;
    } catch {
      // Ignore a stale or malformed cache entry and try the current resource.
    }

    try {
      return await parseFeatureCollection(await fetch(url));
    } catch (error) {
      const cacheFallback = await readCache(url);
      if (cacheFallback) return cacheFallback;
      throw error;
    }
  })().catch(error => {
    loadedGeoJson.delete(url);
    throw error;
  });

  loadedGeoJson.set(url, request);
  return request;
};
