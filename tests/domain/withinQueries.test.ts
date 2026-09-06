import { describe, expect, it } from 'vitest';
import { EntityType, type Entity } from '../../types';
import { projectTacticalPosition } from '../../domain/tacticalProjection';
import { findWithinEntities } from '../../domain/spatialQueries';

const ownship: Entity = {
  id: 'ownship',
  type: EntityType.OWNSHIP,
  label: 'OWNSHIP',
  position: { lat: 0, lon: 0 },
};

const at = (id: string, label: string, type: EntityType, bearing: number, range: number, metadata?: Record<string, string | number>): Entity => ({
  id,
  type,
  label,
  position: projectTacticalPosition(ownship.position, bearing, range).position,
  metadata,
});

describe('within spatial queries', () => {
  const entities: Entity[] = [
    ownship,
    at('inside', 'INSIDE', EntityType.ENEMY, 90, 4, { quality: 'GOOD', source: 'RADAR' }),
    at('boundary', 'BOUNDARY', EntityType.WAYPOINT, 0, 10),
    at('outside', 'OUTSIDE', EntityType.AIRPORT, 180, 11),
  ];

  it('includes the exact boundary, excludes farther objects, and sorts by range', () => {
    const result = findWithinEntities({
      reference: ownship,
      entities,
      rangeNauticalMiles: 10,
      freshnessOf: entity => entity.id === 'inside' ? 'CURRENT' : 'UNKNOWN',
    });

    expect(result.status).toBe('OK');
    expect(result.candidates.map(candidate => candidate.id)).toEqual(['inside', 'boundary']);
    expect(result.candidates[0]).toMatchObject({
      label: 'INSIDE',
      freshness: 'CURRENT',
      quality: 'GOOD',
      source: 'RADAR',
    });
  });

  it('filters by reference, type, and returns empty when no loaded object matches', () => {
    const result = findWithinEntities({
      reference: ownship,
      entities,
      rangeNauticalMiles: 20,
      category: 'TRACK',
    });
    expect(result.candidates.map(candidate => candidate.id)).toEqual(['inside']);

    const empty = findWithinEntities({
      reference: ownship,
      entities,
      rangeNauticalMiles: 2,
      category: 'AIRPORT',
    });
    expect(empty.status).toBe('EMPTY');
    expect(empty.candidates).toEqual([]);
  });

  it('rejects invalid ranges and invalid reference positions', () => {
    expect(() => findWithinEntities({ reference: ownship, entities, rangeNauticalMiles: 0 })).toThrow();
    expect(() => findWithinEntities({ reference: ownship, entities, rangeNauticalMiles: Number.NaN })).toThrow();
    expect(() => findWithinEntities({
      reference: { ...ownship, position: { lat: 91, lon: 0 } },
      entities,
      rangeNauticalMiles: 1,
    })).toThrow();
  });
});
