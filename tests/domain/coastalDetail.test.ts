import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { clipFeatureCollectionToBounds } from '../../scripts/prepare-toulon-coastal-detail.mjs';

const source: FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { source: 'fixture' },
    geometry: {
      type: 'Polygon',
      coordinates: [[[-2, -1], [3, -1], [3, 3], [-2, 3], [-2, -1]]],
    },
  }],
};

describe('clipFeatureCollectionToBounds', () => {
  it('clips a land polygon to the requested local bounds without open rings', () => {
    const result = clipFeatureCollectionToBounds(source, [0, 0, 2, 2]);

    expect(result.features).toHaveLength(1);
    expect(result.bbox).toEqual([0, 0, 2, 2]);
    const geometry = result.features[0].geometry;
    expect(geometry?.type).toBe('Polygon');
    if (geometry?.type !== 'Polygon') throw new Error('Expected Polygon output');

    for (const ring of geometry.coordinates) {
      expect(ring[0]).toEqual(ring.at(-1));
      for (const [longitude, latitude] of ring) {
        expect(longitude).toBeGreaterThanOrEqual(0);
        expect(longitude).toBeLessThanOrEqual(2);
        expect(latitude).toBeGreaterThanOrEqual(0);
        expect(latitude).toBeLessThanOrEqual(2);
      }
    }
  });
});
