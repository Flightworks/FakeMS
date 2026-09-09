import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { loadTacticalGeoJson } from '../../components/tacticalMapData';

const land: FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
  }],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('loadTacticalGeoJson', () => {
  it('uses a valid Cache Storage response before making a network request', async () => {
    const fetchMock = vi.spyOn(global, 'fetch');
    vi.stubGlobal('caches', { match: vi.fn().mockResolvedValue({
      ok: true,
      json: async () => land,
    }) });

    await expect(loadTacticalGeoJson('/maps/cache-first-land.json')).resolves.toEqual(land);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to Cache Storage when the network is offline', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    vi.stubGlobal('caches', { match: vi.fn().mockResolvedValue({
      ok: true,
      json: async () => land,
    }) });

    await expect(loadTacticalGeoJson('/maps/cache-fallback-land.json')).resolves.toEqual(land);
  });
});
