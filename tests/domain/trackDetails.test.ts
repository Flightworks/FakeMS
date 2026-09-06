import { describe, expect, it } from 'vitest';
import { EntityType } from '../../types';
import {
  createEntityTrackDetails,
  createTrackDetails,
  listStaleEntityDetails,
  type TrackDisplayDetails,
} from '../../domain/trackDetails';
import type { Track } from '../../domain/mission';

const track: Track = {
  id: 'track-1',
  label: 'BRAVO',
  position: { lat: 34, lon: -118 },
  sources: ['RADAR'],
  firstSeenAt: 8_000,
  lastSeenAt: 10_000,
  quality: 'GOOD',
  uncertainty: { horizontalMeters: 40 },
  classification: {
    affiliation: 'SUSPECT',
    confidence: 0.7,
    assessedAt: 10_000,
    evidence: [],
    alternatives: [],
  },
};

const entity = (id: string, label: string, metadata?: Record<string, string | number>) => ({
  id,
  label,
  type: EntityType.ENEMY,
  position: { lat: 34, lon: -118 },
  metadata,
});

describe('track details and freshness', () => {
  it('creates complete display details from a qualified Track', () => {
    const details = createTrackDetails(track, 12_000, 5);

    expect(details).toMatchObject<Partial<TrackDisplayDetails>>({
      trackId: 'track-1',
      label: 'BRAVO',
      sourceLabel: 'RADAR',
      ageSeconds: 2,
      freshness: 'FRESH',
      quality: 'GOOD',
      uncertaintyMeters: 40,
      classification: 'SUSPECT',
      confidence: 0.7,
    });
  });

  it('returns UNKNOWN freshness when no stale threshold is qualified', () => {
    const details = createTrackDetails(track, 12_000);

    expect(details.freshness).toBe('UNKNOWN');
    expect(details.ageSeconds).toBe(2);
  });

  it('classifies a Track as stale only after the supplied threshold', () => {
    const details = createTrackDetails(track, 16_000, 5);

    expect(details.ageSeconds).toBe(6);
    expect(details.freshness).toBe('STALE');
  });

  it('does not invent metadata missing from an Entity', () => {
    const details = createEntityTrackDetails(entity('unknown', 'UNKNOWN'));

    expect(details.sourceLabel).toBeNull();
    expect(details.ageSeconds).toBeNull();
    expect(details.freshness).toBe('UNKNOWN');
    expect(details.quality).toBe('UNKNOWN');
    expect(details.uncertaintyMeters).toBeNull();
    expect(details.classification).toBe('UNKNOWN');
    expect(details.confidence).toBeNull();
  });

  it('lists stale entities from explicit metadata in descending age order', () => {
    const stale = listStaleEntityDetails([
      entity('fresh', 'FRESH', { freshness: 'FRESH', ageSeconds: 2 }),
      entity('old', 'OLD', { freshness: 'STALE', ageSeconds: 90 }),
      entity('older', 'OLDER', { freshness: 'STALE', ageSeconds: 120 }),
      entity('unknown', 'UNKNOWN'),
    ]);

    expect(stale.map(item => item.label)).toEqual(['OLDER', 'OLD']);
    expect(stale.map(item => item.ageSeconds)).toEqual([120, 90]);
  });
});
