import { describe, expect, it } from 'vitest';
import {
  MAX_TACTICAL_PROJECTION_NM,
  TACTICAL_PROJECTION_METHOD,
  TacticalProjectionError,
  projectTacticalPosition,
} from '../../domain/tacticalProjection';

const FIXTURE_EARTH_RADIUS_METERS = 6_378_137;
const FIVE_NM_METERS = 9_260;

const toRadians = (degrees: number): number => degrees * Math.PI / 180;

const fixtureDistanceMeters = (
  start: { lat: number; lon: number },
  end: { lat: number; lon: number },
): number => {
  const startLatitude = toRadians(start.lat);
  const endLatitude = toRadians(end.lat);
  const latitudeDelta = toRadians(end.lat - start.lat);
  const longitudeDelta = toRadians(end.lon - start.lon);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * FIXTURE_EARTH_RADIUS_METERS * Math.atan2(
    Math.sqrt(haversine),
    Math.sqrt(1 - haversine),
  );
};

describe('qualified tactical projection', () => {
  it('exposes the spherical direct method without claiming ellipsoidal accuracy', () => {
    const result = projectTacticalPosition({ lat: 0, lon: 0 }, 0, 5);

    expect(TACTICAL_PROJECTION_METHOD).toBe('SPHERICAL DIRECT');
    expect(result.method).toBe('SPHERICAL DIRECT');
  });

  it.each([
    ['north', 0, { lat: 0.083183995309, lon: 0 }],
    ['east', 90, { lat: 0, lon: 0.083183995309 }],
    ['south', 180, { lat: -0.083183995309, lon: 0 }],
    ['west', 270, { lat: 0, lon: -0.083183995309 }],
  ])('projects five nautical miles %s against independent fixtures', (_name, bearing, expected) => {
    const result = projectTacticalPosition({ lat: 0, lon: 0 }, bearing, 5);

    expect(result.position.lat).toBeCloseTo(expected.lat, 10);
    expect(result.position.lon).toBeCloseTo(expected.lon, 10);
    expect(fixtureDistanceMeters({ lat: 0, lon: 0 }, result.position)).toBeCloseTo(FIVE_NM_METERS, 6);
  });

  it('places BRAVO five nautical miles south within the qualified tolerance', () => {
    const bravo = { lat: 48, lon: 2 };
    const result = projectTacticalPosition(bravo, 180, 5);
    const toleranceMeters = Math.max(10, FIVE_NM_METERS * 0.001);

    expect(result.position).toEqual(expect.objectContaining({
      lat: expect.closeTo(47.916816004691, 10),
      lon: expect.closeTo(2, 10),
    }));
    expect(result.position.lat).toBeLessThan(bravo.lat);
    expect(Math.abs(fixtureDistanceMeters(bravo, result.position) - FIVE_NM_METERS))
      .toBeLessThanOrEqual(toleranceMeters);
  });

  it('normalizes an eastbound antimeridian crossing into [-180, 180]', () => {
    const result = projectTacticalPosition({ lat: 0, lon: 179.95 }, 90, 5);

    expect(result.position.lat).toBeCloseTo(0, 10);
    expect(result.position.lon).toBeCloseTo(-179.966816004691, 10);
    expect(result.position.lon).toBeGreaterThanOrEqual(-180);
    expect(result.position.lon).toBeLessThanOrEqual(180);
  });

  it.each([
    [{ lat: 85, lon: 20 }, 90, { lat: 84.999309847336, lon: 20.954341713410 }],
    [{ lat: -85, lon: 20 }, 270, { lat: -84.999309847336, lon: 19.045658286590 }],
  ])('remains stable at high latitude from $start', (start, bearing, expected) => {
    const result = projectTacticalPosition(start, bearing, 5);

    expect(result.position.lat).toBeCloseTo(expected.lat, 10);
    expect(result.position.lon).toBeCloseTo(expected.lon, 10);
    expect(Number.isFinite(result.position.lat)).toBe(true);
    expect(Number.isFinite(result.position.lon)).toBe(true);
  });

  it('accepts the exact maximum range of 500 nautical miles', () => {
    const result = projectTacticalPosition({ lat: 43.3, lon: 5.4 }, 45, 500);

    expect(MAX_TACTICAL_PROJECTION_NM).toBe(500);
    expect(result.position.lat).toBeCloseTo(48.855641762006, 10);
    expect(result.position.lon).toBeCloseTo(14.344685024438, 10);
  });

  it.each([0, -1, 500.000001, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid projection range: %s',
    range => {
      expect(() => projectTacticalPosition({ lat: 0, lon: 0 }, 0, range))
        .toThrow(TacticalProjectionError);
      try {
        projectTacticalPosition({ lat: 0, lon: 0 }, 0, range);
      } catch (error) {
        expect((error as TacticalProjectionError).code).toBe('INVALID_RANGE');
      }
    },
  );

  it.each([-1, 360, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid true bearing: %s',
    bearing => {
      expect(() => projectTacticalPosition({ lat: 0, lon: 0 }, bearing, 5))
        .toThrow(TacticalProjectionError);
      try {
        projectTacticalPosition({ lat: 0, lon: 0 }, bearing, 5);
      } catch (error) {
        expect((error as TacticalProjectionError).code).toBe('INVALID_BEARING');
      }
    },
  );

  it.each([
    { lat: 90.000001, lon: 0 },
    { lat: -90.000001, lon: 0 },
    { lat: Number.NaN, lon: 0 },
    { lat: 0, lon: Number.POSITIVE_INFINITY },
  ])('rejects invalid reference coordinates: $lat, $lon', reference => {
    expect(() => projectTacticalPosition(reference, 0, 5)).toThrow(TacticalProjectionError);
    try {
      projectTacticalPosition(reference, 0, 5);
    } catch (error) {
      expect((error as TacticalProjectionError).code).toBe('INVALID_POSITION');
    }
  });
});
