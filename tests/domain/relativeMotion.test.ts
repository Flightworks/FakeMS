import { describe, expect, it } from 'vitest';
import {
  calculateRelativeMotion,
  type RelativeMotionTrack,
} from '../../domain/relativeMotion';
import { projectTacticalPosition } from '../../domain/tacticalProjection';

const track = (
  id: string,
  position: { lat: number; lon: number },
  groundTrackDegrees: number,
  groundSpeedKnots: number,
  overrides: Partial<RelativeMotionTrack> = {},
): RelativeMotionTrack => ({
  id,
  label: id.toUpperCase(),
  position,
  groundTrackDegrees,
  groundSpeedKnots,
  freshness: 'FRESH',
  ...overrides,
});

const tenNauticalMilesEast = projectTacticalPosition({ lat: 0, lon: 0 }, 90, 10).position;

describe('relative motion and CPA/TCPA', () => {
  it('estimates closure and a future CPA for converging tracks', () => {
    const result = calculateRelativeMotion({
      reference: track('ownship', { lat: 0, lon: 0 }, 90, 60),
      target: track('bravo', tenNauticalMilesEast, 270, 60),
    });

    expect(result.status).toBe('AVAILABLE');
    expect(result.closureRateKnots).toBeCloseTo(120, 5);
    expect(result.tcpaMinutes).toBeCloseTo(5, 5);
    expect(result.cpaDistanceNauticalMiles).toBeCloseTo(0, 5);
    expect(result.cpaStatus).toBe('FUTURE_CPA');
    expect(result.assumption).toBe('CONSTANT VELOCITY');
  });

  it('marks an already-passed CPA instead of presenting a future alert', () => {
    const result = calculateRelativeMotion({
      reference: track('ownship', { lat: 0, lon: 0 }, 90, 60),
      target: track('bravo', tenNauticalMilesEast, 90, 120),
    });

    expect(result.status).toBe('AVAILABLE');
    expect(result.closureRateKnots).toBeCloseTo(-60, 5);
    expect(result.tcpaMinutes).toBeCloseTo(-10, 5);
    expect(result.cpaDistanceNauticalMiles).toBeCloseTo(10, 2);
    expect(result.cpaStatus).toBe('PAST_CPA');
  });

  it('reports no relative motion for parallel equal vectors', () => {
    const result = calculateRelativeMotion({
      reference: track('ownship', { lat: 0, lon: 0 }, 90, 60),
      target: track('bravo', tenNauticalMilesEast, 90, 60),
    });

    expect(result.status).toBe('AVAILABLE');
    expect(result.closureRateKnots).toBeCloseTo(0, 5);
    expect(result.tcpaMinutes).toBeNull();
    expect(result.cpaDistanceNauticalMiles).toBeCloseTo(10, 2);
    expect(result.cpaStatus).toBe('NO_RELATIVE_MOTION');
  });

  it.each([
    [{ freshness: 'STALE' as const }, 'STALE_TRACK'],
    [{ freshness: 'UNKNOWN' as const }, 'UNKNOWN_FRESHNESS'],
    [{ groundTrackDegrees: undefined }, 'MISSING_GROUND_TRACK'],
    [{ groundSpeedKnots: undefined }, 'MISSING_GROUND_SPEED'],
  ])('returns UNAVAILABLE for unqualified input %s', (change, reason) => {
    const result = calculateRelativeMotion({
      reference: track('ownship', { lat: 0, lon: 0 }, 90, 60, change),
      target: track('bravo', tenNauticalMilesEast, 270, 60),
    });

    expect(result).toMatchObject({ status: 'UNAVAILABLE', reason });
  });

  it('does not mutate either source track', () => {
    const reference = track('ownship', { lat: 0, lon: 0 }, 90, 60);
    const target = track('bravo', { lat: 0, lon: 1 / 6 }, 270, 60);
    const before = structuredClone({ reference, target });

    calculateRelativeMotion({ reference, target });

    expect({ reference, target }).toEqual(before);
  });
});
