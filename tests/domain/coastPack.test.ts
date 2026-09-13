import { describe, expect, it } from 'vitest';
import {
  beginCoastLayerLoad,
  boundCoastCache,
  createCoastLayerState,
  normalizeCoastManifest,
  normalizeCoastCachePolicy,
  rejectCoastLayerLoad,
  selectCoastAssets,
  validateCoastGeoJson,
} from '../../domain/coastPack';

const manifest = normalizeCoastManifest({
  schema: 'fakems.coastal-pack',
  schema_version: 1,
  pack_version: 'test',
  generated_at: '2026-09-13T00:00:00Z',
  crs: 'WGS84',
  bbox: [4, 42, 8, 45],
  assets: [
    { id: 'east-asset', path: 'renamed-east.geojson', sector: 'east', lod: 'full', bbox: [5.65, 42, 8, 45] },
    { id: 'west-asset', path: 'renamed-west.geojson', sector: 'west', lod: 'full', bbox: [4, 42, 5.65, 45] },
  ],
});

describe('coast pack domain contract', () => {
  it('selects intersecting sectors in geographic order at the qualified zoom', () => {
    const view = {
      center: { lat: 43, lon: 5.65 },
      bbox: [5.65, 42.9, 5.65, 43.1] as const,
      zoom: 8,
    };

    expect(selectCoastAssets(manifest, view).map(asset => asset.id)).toEqual([
      'west-asset',
      'east-asset',
    ]);
  });

  it('rejects malformed manifest CRS, bbox, and external or guessed asset paths', () => {
    const errors = normalizeErrors({
      schema: 'fakems.coastal-pack',
      schema_version: 1,
      pack_version: 'test',
      generated_at: '2026-09-13T00:00:00Z',
      crs: 'EPSG:3857',
      bbox: [4, 45, 4, 42],
      assets: [{
        id: 'one',
        path: 'https://example.test/coast.geojson',
        sector: 'west',
        lod: 'full',
        bbox: [4, 42, 5, 44],
      }],
    });

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('crs'),
      expect.stringContaining('bbox'),
      expect.stringContaining('path'),
    ]));
  });

  it('selects inside, boundary, and outside views without inferring filenames', () => {
    const west = selectCoastAssets(manifest, {
      center: { lat: 43, lon: 5.1 },
      bbox: [5, 42.9, 5.2, 43.1],
      zoom: 8,
    });
    const boundary = selectCoastAssets(manifest, {
      center: { lat: 43, lon: 5.65 },
      bbox: [5.65, 42.9, 5.65, 43.1],
      zoom: 8,
    });
    const outside = selectCoastAssets(manifest, {
      center: { lat: 43, lon: 9 },
      bbox: [8.9, 42.9, 9.1, 43.1],
      zoom: 8,
    });

    expect(west.map(asset => asset.path)).toEqual(['renamed-west.geojson']);
    expect(boundary.map(asset => asset.path)).toEqual(['renamed-west.geojson', 'renamed-east.geojson']);
    expect(outside).toEqual([]);
  });

  it('applies the full-line zoom threshold and supports a custom LOD rule', () => {
    const viewAtThreshold = {
      center: { lat: 43, lon: 5.1 },
      bbox: [5, 42.9, 5.2, 43.1] as const,
      zoom: 8,
    };
    expect(selectCoastAssets(manifest, { ...viewAtThreshold, zoom: 7 })).toEqual([]);
    expect(selectCoastAssets(manifest, viewAtThreshold)).toHaveLength(1);
    expect(selectCoastAssets(manifest, viewAtThreshold, {
      minZoom: 4,
      maxZoom: 12,
      lodMinZoom: { full: 4 },
    })).toHaveLength(1);
  });

  it('allows a lower-detail LOD at its own threshold while full detail stays qualified later', () => {
    const lodManifest = normalizeCoastManifest({
      schema: 'fakems.coastal-pack',
      schema_version: 1,
      pack_version: 'lod-test',
      generated_at: '2026-09-13T00:00:00Z',
      crs: 'WGS84',
      bbox: [4, 42, 8, 45],
      assets: [{ id: 'low-west', path: 'low.geojson', sector: 'west', lod: 'low', bbox: [4, 42, 5.65, 45] }],
    });

    expect(selectCoastAssets(lodManifest, {
      center: { lat: 43, lon: 5.1 },
      bbox: [5, 42.9, 5.2, 43.1],
      zoom: 4,
    })).toHaveLength(1);
  });

  it('validates non-empty LineString assets and rejects polygons, bad CRS, and bad bboxes', () => {
    expect(validateCoastGeoJson(lineData, [4, 42, 5, 44])).toEqual([]);
    expect(validateCoastGeoJson({ ...lineData, features: [] })).toEqual([
      'coast asset must contain at least one feature',
    ]);
    expect(validateCoastGeoJson({
      ...lineData,
      crs: 'EPSG:3857',
    })).toContain('coast asset crs must be WGS84');
    expect(validateCoastGeoJson({
      ...lineData,
      bbox: [5, 42, 4, 44],
    })).toContain('coast asset bbox must be an ordered WGS84 bbox');
    expect(validateCoastGeoJson({
      ...lineData,
      features: [{
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [] },
      }],
    })).toContain('coast feature 0 geometry must be a LineString');
    expect(validateCoastGeoJson({
      ...lineData,
      features: [{ type: 'Feature', geometry: lineData.features[0].geometry }],
    })).toContain('coast feature 0 must include properties');

  });

  it('retains the previous valid layer through pending and failed replacement loads', () => {
    const previous = createCoastLayerState(['west-geometry']);
    const pending = beginCoastLayerLoad(previous, [manifest.assets[1]]);
    const failed = rejectCoastLayerLoad(pending, new Error('offline'));

    expect(pending).toMatchObject({ phase: 'pending', active: ['west-geometry'] });
    expect(failed).toMatchObject({ phase: 'loaded', active: ['west-geometry'], error: 'offline' });
  });

  it('rejects contradictory duplicate count fields in a manifest asset', () => {
    const errors = normalizeErrors({
      schema: 'fakems.coastal-pack',
      schema_version: 1,
      pack_version: 'test',
      generated_at: '2026-09-13T00:00:00Z',
      crs: 'WGS84',
      bbox: [4, 42, 8, 45],
      assets: [{
        id: 'one',
        path: 'one.geojson',
        sector: 'west',
        lod: 'full',
        bbox: [4, 42, 5.65, 45],
        features: 2,
        feature_count: 1,
      }],
    });

    expect(errors).toContain('asset 0 features and feature_count must match');
  });

  it('bounds cache policy inputs to safe positive limits', () => {
    expect(normalizeCoastCachePolicy({
      maxEntries: 0,
      maxFeatures: -1,
      maxBytes: Number.NaN,
      debounceMs: -20,
    })).toEqual({
      maxEntries: 4,
      maxFeatures: 1_500,
      maxBytes: 4 * 1024 * 1024,
      debounceMs: 0,
    });
  });

  it('bounds cache entries by count, features, and bytes while keeping newest entries', () => {
    const bounded = boundCoastCache([
      { key: 'old', featureCount: 2, byteCount: 20, lastUsed: 1 },
      { key: 'new', featureCount: 2, byteCount: 20, lastUsed: 3 },
      { key: 'middle', featureCount: 2, byteCount: 20, lastUsed: 2 },
    ], {
      maxEntries: 2,
      maxFeatures: 4,
      maxBytes: 40,
      debounceMs: 0,
    });

    expect(bounded.map(entry => entry.key)).toEqual(['new', 'middle']);
  });
});

const normalizeErrors = (value: unknown): string[] => {
  try {
    normalizeCoastManifest(value);
    return [];
  } catch (error) {
    return error instanceof Error && 'issues' in error
      ? [...(error as Error & { issues: readonly string[] }).issues]
      : [String(error)];
  }
};

const lineData = {
  type: 'FeatureCollection',
  bbox: [4, 42, 5, 44],
  features: [{
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: [[4.1, 42.1], [4.2, 42.2]],
    },
  }],
};
