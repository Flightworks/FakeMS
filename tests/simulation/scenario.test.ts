import { describe, expect, it } from 'vitest';
import { EntityType } from '../../types';
import { parseScenario, parseScenarioJson } from '../../simulation/scenario';

describe('scenario input validation', () => {
  it('parses a valid JSON-shaped scenario and clones mutable values', () => {
    const input = {
      id: 'json-scenario',
      name: 'JSON scenario',
      seed: 4,
      startTimeMs: 0,
      ownship: {
        id: 'ownship',
        type: EntityType.OWNSHIP,
        label: 'VIPER',
        position: { lat: 34, lon: -118 },
        waypoints: [{ lat: 35, lon: -119 }],
      },
      entities: [],
    };
    const scenario = parseScenario(input);

    expect(scenario).toEqual(input);
    expect(scenario).not.toBe(input);
    expect(scenario.ownship.position).not.toBe(input.ownship.position);
    expect(scenario.ownship.waypoints).not.toBe(input.ownship.waypoints);
  });

  it('parses JSON text through the same validation boundary', () => {
    const scenario = parseScenarioJson(JSON.stringify({
      id: 'json-text',
      name: 'JSON text',
      seed: 2,
      startTimeMs: 0,
      ownship: {
        id: 'ownship',
        type: EntityType.OWNSHIP,
        label: 'VIPER',
        position: { lat: 34, lon: -118 },
      },
      entities: [],
    }));

    expect(scenario.id).toBe('json-text');
  });

  it('rejects malformed scenario input instead of silently inventing defaults', () => {
    expect(() => parseScenario({ id: 'missing-fields' })).toThrow(/scenario/i);
  });
});
