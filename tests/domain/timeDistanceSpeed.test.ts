import { describe, expect, it } from 'vitest';
import { createTacticalQuantity, type TacticalQuantity } from '../../domain/tacticalUnits';
import {
  formatTimeDistanceSpeed,
  solveTimeDistanceSpeed,
  type TimeDistanceSpeedInput,
} from '../../domain/timeDistanceSpeed';

const quantity = (value: number, unit: string): TacticalQuantity => createTacticalQuantity(value, unit);

describe('time–distance–speed solver', () => {
  it('solves time from distance and speed without rounding early', () => {
    const result = solveTimeDistanceSpeed({
      solveFor: 'TIME',
      distance: quantity(45, 'NM'),
      speed: quantity(120, 'KT'),
    });

    expect(result.timeSeconds).toBe(1350);
    expect(result.distanceNauticalMiles).toBe(45);
    expect(result.speedKnots).toBe(120);
    expect(formatTimeDistanceSpeed(result).time).toBe('22 min 30 s');
  });

  it('solves distance from time and speed with unit conversion', () => {
    const result = solveTimeDistanceSpeed({
      solveFor: 'DISTANCE',
      time: quantity(15, 'MIN'),
      speed: quantity(120, 'KTS'),
    });

    expect(result.distanceNauticalMiles).toBe(30);
    expect(formatTimeDistanceSpeed(result).distance).toBe('30.0 NM');
  });

  it('solves ground speed from distance and time', () => {
    const result = solveTimeDistanceSpeed({
      solveFor: 'SPEED',
      distance: quantity(40, 'NM'),
      time: quantity(20, 'MIN'),
    });

    expect(result.speedKnots).toBe(120);
    expect(formatTimeDistanceSpeed(result).speed).toBe('120.0 KT');
  });

  it('converts units and preserves numeric precision through a round trip', () => {
    const timeResult = solveTimeDistanceSpeed({
      solveFor: 'TIME',
      distance: quantity(9.26, 'KM'),
      speed: quantity(222.24, 'KMH'),
    });

    expect(timeResult.distanceNauticalMiles).toBeCloseTo(5, 10);
    expect(timeResult.speedKnots).toBeCloseTo(120, 10);
    expect(timeResult.timeSeconds).toBeCloseTo(150, 10);
    expect(formatTimeDistanceSpeed(timeResult)).toMatchObject({
      distance: '5.0 NM',
      speed: '120.0 KT',
      time: '2 min 30 s',
    });

    const roundTrip = solveTimeDistanceSpeed({
      solveFor: 'DISTANCE',
      time: quantity(timeResult.timeSeconds, 'S'),
      speed: quantity(timeResult.speedKnots, 'KT'),
    });
    expect(roundTrip.distanceNauticalMiles).toBeCloseTo(timeResult.distanceNauticalMiles, 10);
    expect(formatTimeDistanceSpeed(roundTrip).distance).toBe('5.0 NM');
  });
  it('rejects zero, negative, non-finite, and missing quantities', () => {
    const validSpeed = quantity(120, 'KT');
    const invalidDistance = (value: number): TacticalQuantity => ({
      originalValue: value,
      originalUnit: 'NM',
      value,
      unit: 'NM',
      dimension: 'DISTANCE',
      assumed: false,
    });

    const cases: TimeDistanceSpeedInput[] = [
      { solveFor: 'TIME', distance: invalidDistance(0), speed: validSpeed },
      { solveFor: 'TIME', distance: invalidDistance(-1), speed: validSpeed },
      { solveFor: 'TIME', distance: invalidDistance(Number.NaN), speed: validSpeed },
      { solveFor: 'TIME', distance: undefined, speed: validSpeed },
    ];

    for (const input of cases) {
      expect(() => solveTimeDistanceSpeed(input)).toThrow();
    }
  });
});
