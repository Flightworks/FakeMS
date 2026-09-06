import { describe, expect, it } from 'vitest';
import { EntityType, type Entity } from '../../types';
import {
  findNearestEntities,
  type NearestCategory,
} from '../../domain/spatialQueries';

const ownship: Entity = {
  id: 'ownship',
  type: EntityType.OWNSHIP,
  label: 'OWNSHIP',
  position: { lat: 0, lon: 0 },
};

const entities: Entity[] = [
  ownship,
  {
    id: 'z-waypoint',
    type: EntityType.WAYPOINT,
    label: 'ZULU',
    position: { lat: 0.1, lon: 0 },
  },
  {
    id: 'a-waypoint',
    type: EntityType.WAYPOINT,
    label: 'ALPHA',
    position: { lat: 0, lon: 0.1 },
    metadata: { quality: 'GOOD', source: 'RADAR', uncertaintyMeters: 25 },
  },
  {
    id: 'track-1',
    type: EntityType.ENEMY,
    label: 'HOSTILE 1',
    position: { lat: 0.2, lon: 0 },
  },
  {
    id: 'airport-1',
    type: EntityType.AIRPORT,
    label: 'BASE',
    position: { lat: 1, lon: 0 },
  },
];

describe('nearest spatial queries', () => {
  it('filters by category, excludes the reference, sorts ties by stable id, and reports metadata', () => {
    const result = findNearestEntities({
      reference: ownship,
      entities,
      category: 'WAYPOINT',
      limit: 2,
      freshnessOf: entity => entity.id === 'a-waypoint' ? 'STALE' : 'UNKNOWN',
    });

    expect(result.status).toBe('OK');
    expect(result.candidates.map(candidate => candidate.id)).toEqual(['a-waypoint', 'z-waypoint']);
    expect(result.candidates[0]).toMatchObject({
      label: 'ALPHA',
      bearingTrueDegrees: 90,
      freshness: 'STALE',
      quality: 'GOOD',
      source: 'RADAR',
      uncertaintyMeters: 25,
    });
    expect(result.candidates[0]?.rangeNauticalMiles).toBeCloseTo(6, 1);
  });

  it('returns an empty result for a category with no loaded scenario objects', () => {
    const result = findNearestEntities({
      reference: ownship,
      entities,
      category: 'TRACK',
      limit: 3,
      freshnessOf: () => 'UNKNOWN',
    });

    expect(result.status).toBe('OK');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.label).toBe('HOSTILE 1');

    const airportOnly = findNearestEntities({
      reference: ownship,
      entities: entities.filter(entity => entity.type !== EntityType.AIRPORT),
      category: 'AIRPORT',
      limit: 1,
    });
    expect(airportOnly.status).toBe('EMPTY');
    expect(airportOnly.candidates).toEqual([]);
  });

  it('rejects a non-positive or non-integer result count', () => {
    for (const limit of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => findNearestEntities({
        reference: ownship,
        entities,
        category: 'WAYPOINT' as NearestCategory,
        limit,
      })).toThrow();
    }
  });
});
