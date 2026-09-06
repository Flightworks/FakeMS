import { describe, expect, it } from 'vitest';
import {
  BearingIntersectionError,
  intersectBearings,
  type BearingLine,
} from '../../domain/bearingIntersection';

const line = (
  reference: string,
  lat: number,
  lon: number,
  bearingDegrees: number,
): BearingLine => ({
  reference,
  position: { lat, lon },
  bearingDegrees,
});

describe('bearing intersections', () => {
  it('finds an orthogonal crossing and reports both BRG/RNG legs', () => {
    const result = intersectBearings(
      line('BRAVO', 0, 0, 90),
      line('G01', 1, 1, 180),
    );

    expect(result.position.lat).toBeCloseTo(0, 4);
    expect(result.position.lon).toBeCloseTo(1, 4);
    expect(result.quality).toBe('GOOD');
    expect(result.canConfirm).toBe(true);
    expect(result.crossingAngleDegrees).toBeCloseTo(90, 3);
    expect(result.legs.map(leg => leg.reference)).toEqual(['BRAVO', 'G01']);
    expect(result.legs[0].rangeNauticalMiles).toBeCloseTo(60, 0);
    expect(result.legs[1].rangeNauticalMiles).toBeCloseTo(60, 0);
  });

  it('normalizes a crossing through the antimeridian', () => {
    const result = intersectBearings(
      line('WEST', 0, 179, 90),
      line('NORTH', 1, -179, 180),
    );

    expect(result.position.lat).toBeCloseTo(0, 4);
    expect(result.position.lon).toBeCloseTo(-179, 4);
  });

  it('marks a shallow crossing as weak and not confirmable', () => {
    const result = intersectBearings(
      line('BRAVO', 0, 0, 90),
      line('G01', 0.05, 1, 90.5),
    );

    expect(result.quality).toBe('GEOMETRY_WEAK');
    expect(result.canConfirm).toBe(false);
    expect(result.crossingAngleDegrees).toBeLessThan(5);
  });

  it('rejects parallel or coincident bearing lines', () => {
    expect(() => intersectBearings(
      line('BRAVO', 0, 0, 90),
      line('G01', 0, 1, 90),
    )).toThrowError(BearingIntersectionError);
  });

  it('rejects an intersection behind one reference', () => {
    expect(() => intersectBearings(
      line('BRAVO', 0, 0, 90),
      line('G01', 1, 1, 0),
    )).toThrowError(/behind/i);
  });

  it('rejects an intersection farther than 500 NM from either reference', () => {
    expect(() => intersectBearings(
      line('BRAVO', 0, 0, 90),
      line('G01', 10, 1, 180),
    )).toThrowError(/500 NM/i);
  });
});
