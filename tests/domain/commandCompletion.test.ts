import { describe, expect, it } from 'vitest';
import { EntityType, type Entity } from '../../types';
import { getTacticalCompletions } from '../../domain/commandCompletion';

const ownship: Entity = {
  id: 'ownship',
  label: 'OWNSHIP',
  type: EntityType.OWNSHIP,
  position: { lat: 0, lon: 0 },
};

const bravo: Entity = {
  id: 'wp-bravo',
  label: 'BRAVO',
  type: EntityType.WAYPOINT,
  position: { lat: 1, lon: 1 },
};

const hostileOne: Entity = {
  id: 'en-1',
  label: 'HOSTILE 1',
  type: EntityType.ENEMY,
  position: { lat: 2, lon: 2 },
};

const hostileTwo: Entity = {
  id: 'en-2',
  label: 'HOSTILE 2',
  type: EntityType.ENEMY,
  position: { lat: 3, lon: 3 },
};

const entities = [ownship, bravo, hostileOne, hostileTwo];

describe('tactical command completion', () => {
  it('completes a unique reference prefix without executing anything', () => {
    const completions = getTacticalCompletions('BRA', entities, ownship);

    expect(completions).toEqual([
      expect.objectContaining({
        stage: 'REFERENCE',
        label: 'BRAVO',
        value: 'BRAVO ',
      }),
    ]);
  });

  it('offers the bearing/range scaffold after a completed reference', () => {
    const completions = getTacticalCompletions('BRAVO ', entities, ownship);

    expect(completions).toEqual([
      expect.objectContaining({
        stage: 'BEARING_RANGE',
        label: 'CAP/PORTÉE',
        value: 'BRAVO 000/',
      }),
    ]);
  });

  it('offers a range placeholder after the bearing separator', () => {
    const completions = getTacticalCompletions('BRAVO 180/', entities, ownship);

    expect(completions).toEqual([
      expect.objectContaining({
        stage: 'RANGE',
        value: 'BRAVO 180/5',
      }),
    ]);
  });

  it('offers all supported units after a numeric range', () => {
    const completions = getTacticalCompletions('BRAVO 180/5', entities, ownship);

    expect(completions.map(completion => completion.value)).toEqual([
      'BRAVO 180/5NM',
      'BRAVO 180/5KM',
      'BRAVO 180/5M',
    ]);
    expect(completions.every(completion => completion.stage === 'UNIT')).toBe(true);
  });

  it('does not guess when a reference prefix is ambiguous', () => {
    expect(getTacticalCompletions('HOSTILE', entities, ownship)).toEqual([]);
  });
});
