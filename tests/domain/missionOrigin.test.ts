import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MISSION_AIRPORT,
  DEFAULT_MISSION_ORIGIN,
  LEGACY_SCENARIO_ORIGIN,
  translateScenarioPosition,
} from '../../domain/missionOrigin';

describe('default maritime mission origin', () => {
  it('uses the military port of Toulon when GPS is unavailable', () => {
    expect(DEFAULT_MISSION_ORIGIN).toEqual({ lat: 43.1183, lon: 5.9098 });
    expect(DEFAULT_MISSION_AIRPORT).toEqual({ lat: 43.0973, lon: 6.146 });
  });

  it('translates the seeded scenario while preserving relative coordinates', () => {
    const legacyPoint = { lat: 34.1, lon: -118.2 };
    const translated = translateScenarioPosition(legacyPoint);

    expect(translated.lat).toBeCloseTo(43.1661, 10);
    expect(translated.lon).toBeCloseTo(5.9535, 10);
    expect(legacyPoint).toEqual({ lat: 34.1, lon: -118.2 });
    expect(LEGACY_SCENARIO_ORIGIN).toEqual({ lat: 34.0522, lon: -118.2437 });
  });
});
