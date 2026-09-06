import { describe, expect, it } from 'vitest';
import { projectTacticalPosition } from '../../domain/tacticalProjection';
import {
  MAX_FUTURE_PROJECTION_MINUTES,
  MAX_FUTURE_PROJECTION_NM,
  projectFuturePosition,
  type FuturePositionTrack,
} from '../../domain/futurePosition';

const freshTrack: FuturePositionTrack = {
  id: 'track-bravo',
  label: 'BRAVO',
  position: { lat: 0, lon: 0 },
  groundTrackDegrees: 90,
  groundSpeedKnots: 120,
  freshness: 'FRESH',
  lastSeenAtMs: 10_000,
};

const project = (track: FuturePositionTrack, value: number, unit: 'MIN' | 'NM', nowMs = 10_000) =>
  projectFuturePosition({ track, horizon: { value, unit }, nowMs });

describe('future simulated position', () => {
  it('projects +2MIN with ground track and ground speed using the F04 convention', () => {
    const result = project(freshTrack, 2, 'MIN');
    const expected = projectTacticalPosition(freshTrack.position, 90, 4);

    expect(result.status).toBe('AVAILABLE');
    expect(result.targetPosition).toEqual(expect.objectContaining({
      lat: expect.closeTo(expected.position.lat, 10),
      lon: expect.closeTo(expected.position.lon, 10),
    }));
    expect(result.projectedRangeNauticalMiles).toBeCloseTo(4, 10);
    expect(result.effectiveHorizonMinutes).toBeCloseTo(2, 10);
    expect(result.method).toBe('SPHERICAL DIRECT');
    expect(result.projectedAtMs).toBe(130_000);
  });

  it('keeps a stationary track at its current position', () => {
    const result = project({ ...freshTrack, groundSpeedKnots: 0 }, 10, 'MIN');

    expect(result.status).toBe('AVAILABLE');
    expect(result.targetPosition).toEqual(freshTrack.position);
    expect(result.projectedRangeNauticalMiles).toBe(0);
  });

  it('converts a distance horizon into time and caps it at 500 NM', () => {
    const result = project({ ...freshTrack, groundSpeedKnots: 600 }, 600, 'NM');

    expect(result.status).toBe('AVAILABLE');
    expect(result.projectedRangeNauticalMiles).toBe(MAX_FUTURE_PROJECTION_NM);
    expect(result.effectiveHorizonMinutes).toBeCloseTo(50, 10);
    expect(result.horizonLimit).toBe('DISTANCE');
  });

  it('caps a time horizon at 60 minutes before projecting', () => {
    const result = project(freshTrack, 120, 'MIN');

    expect(result.status).toBe('AVAILABLE');
    expect(result.effectiveHorizonMinutes).toBe(MAX_FUTURE_PROJECTION_MINUTES);
    expect(result.projectedRangeNauticalMiles).toBe(120);
    expect(result.horizonLimit).toBe('TIME');
  });

  it.each([
    ['STALE', 'STALE_TRACK'],
    [undefined, 'UNKNOWN_FRESHNESS'],
  ] as const)('rejects a track with freshness %s', (freshness, reason) => {
    const result = project({ ...freshTrack, freshness }, 2, 'MIN');

    expect(result).toMatchObject({ status: 'UNAVAILABLE', reason });
  });

  it.each([
    [{ groundTrackDegrees: undefined }, 'MISSING_GROUND_TRACK'],
    [{ groundSpeedKnots: undefined }, 'MISSING_GROUND_SPEED'],
  ] as const)('rejects missing ground kinematics: %s', (change, reason) => {
    const result = project({ ...freshTrack, ...change }, 2, 'MIN');

    expect(result).toMatchObject({ status: 'UNAVAILABLE', reason });
  });

  it('does not substitute heading or airspeed for missing ground data', () => {
    const result = project({
      ...freshTrack,
      groundTrackDegrees: undefined,
      groundSpeedKnots: undefined,
    }, 2, 'MIN');

    expect(result.status).toBe('UNAVAILABLE');
    expect(result.reason).toBe('MISSING_GROUND_TRACK');
  });

  it('does not mutate the source track', () => {
    const source = structuredClone(freshTrack);

    project(source, 2, 'MIN');

    expect(source).toEqual(freshTrack);
  });
});
