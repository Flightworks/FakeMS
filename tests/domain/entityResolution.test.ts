import { describe, expect, it } from 'vitest';
import { Entity, EntityType } from '../../types';
import {
  normalizeEntityReference,
  resolveEntityReference,
} from '../../domain/entityResolution';

const ownship: Entity = {
  id: 'ownship',
  label: 'VIPER 1-1',
  type: EntityType.OWNSHIP,
  position: { lat: 34, lon: -118 },
};

const bravo: Entity = {
  id: 'wp-bravo',
  label: 'BRAVO',
  type: EntityType.WAYPOINT,
  position: { lat: 34.1, lon: -118 },
};

const bravoTwo: Entity = {
  id: 'wp-bravo-2',
  label: 'BRAVO 2',
  type: EntityType.WAYPOINT,
  position: { lat: 34.2, lon: -118 },
};

const base: Entity = {
  id: 'apt-base',
  label: 'BASE',
  type: EntityType.AIRPORT,
  position: { lat: 34, lon: -118.2 },
};

describe('entity reference resolution', () => {
  it('normalizes case, accents, and repeated whitespace without changing the input', () => {
    const input = '  Brävö   2  ';

    expect(normalizeEntityReference(input)).toBe('BRAVO 2');
    expect(input).toBe('  Brävö   2  ');
  });

  it('resolves a unique exact identifier before a duplicated label', () => {
    const result = resolveEntityReference('wp-bravo-2', [bravo, bravoTwo, {
      ...bravo,
      id: 'other-bravo',
    }], ownship);

    expect(result).toMatchObject({
      status: 'RESOLVED',
      code: 'RESOLVED',
      match: 'IDENTIFIER_EXACT',
      executable: true,
    });
    expect(result.entity?.id).toBe('wp-bravo-2');
    expect(result.candidates.map(candidate => candidate.id)).toEqual(['wp-bravo-2']);
  });

  it('resolves a unique normalized label', () => {
    const result = resolveEntityReference('  bAsé  ', [base], ownship);

    expect(result.status).toBe('RESOLVED');
    expect(result.match).toBe('LABEL_EXACT');
    expect(result.entity?.id).toBe('apt-base');
  });

  it('reports duplicate exact labels as AMBIGUOUS_REFERENCE with display candidates', () => {
    const result = resolveEntityReference('bravo', [bravo, {
      ...bravoTwo,
      label: 'BRAVO',
    }], ownship);

    expect(result).toMatchObject({
      status: 'AMBIGUOUS_REFERENCE',
      code: 'AMBIGUOUS_REFERENCE',
      executable: false,
    });
    expect(result.entity).toBeUndefined();
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'BRAVO',
        type: EntityType.WAYPOINT,
        id: 'wp-bravo',
        distanceToOwnshipNm: expect.any(Number),
      }),
      expect.objectContaining({
        label: 'BRAVO',
        type: EntityType.WAYPOINT,
        id: 'wp-bravo-2',
        distanceToOwnshipNm: expect.any(Number),
      }),
    ]));
  });

  it('reports multiple compatible prefixes as AMBIGUOUS_REFERENCE', () => {
    const result = resolveEntityReference('bra', [bravo, bravoTwo], ownship);

    expect(result.status).toBe('AMBIGUOUS_REFERENCE');
    expect(result.match).toBe('PREFIX');
    expect(result.candidates.map(candidate => candidate.id)).toEqual(['wp-bravo', 'wp-bravo-2']);
  });

  it('resolves a unique compatible prefix', () => {
    const result = resolveEntityReference('bas', [base, bravo], ownship);

    expect(result).toMatchObject({
      status: 'RESOLVED',
      match: 'PREFIX',
      executable: true,
    });
    expect(result.entity?.id).toBe('apt-base');
  });

  it('returns non-executable fuzzy suggestions that require explicit selection', () => {
    const result = resolveEntityReference('bravx', [bravo, base], ownship);

    expect(result).toMatchObject({
      status: 'FUZZY_SUGGESTION',
      code: 'FUZZY_SUGGESTION',
      match: 'FUZZY',
      executable: false,
    });
    expect(result.entity).toBeUndefined();
    expect(result.candidates[0]).toMatchObject({ id: 'wp-bravo', label: 'BRAVO' });
  });

  it('returns UNKNOWN_REFERENCE when no entity is a candidate', () => {
    const result = resolveEntityReference('not-present', [bravo, base], ownship);

    expect(result).toMatchObject({
      status: 'UNKNOWN_REFERENCE',
      code: 'UNKNOWN_REFERENCE',
      match: 'NONE',
      executable: false,
      candidates: [],
    });
  });

  it('does not mutate entities or ownship while resolving', () => {
    const entities = [bravo, bravoTwo];
    const entitiesBefore = JSON.parse(JSON.stringify(entities));
    const ownshipBefore = JSON.parse(JSON.stringify(ownship));

    resolveEntityReference('bra', entities, ownship);

    expect(entities).toEqual(entitiesBefore);
    expect(ownship).toEqual(ownshipBefore);
  });
});
