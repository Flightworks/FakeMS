import { describe, expect, it } from 'vitest';
import {
  calculateGradient,
  calculateTopOfDescent,
  calculateVerticalSpeedRequired,
} from '../../domain/verticalCalculations';

describe('vertical tactical calculations', () => {
  it('calculates GRAD from vertical speed and ground speed', () => {
    const result = calculateGradient({ verticalSpeedFpm: -700, groundSpeedKnots: 110 });

    expect(result.status).toBe('AVAILABLE');
    if (result.status === 'AVAILABLE') {
      expect(result.feetPerNauticalMile).toBeCloseTo(-381.818, 3);
      expect(result.percent).toBeCloseTo(-6.28, 2);
      expect(result.angleDegrees).toBeCloseTo(-3.60, 2);
      expect(result.formula).toContain('VS / (GS / 60)');
    }
  });

  it('calculates VSREQ for descent and climb with explicit sign convention', () => {
    const descent = calculateVerticalSpeedRequired({
      altitudeChangeFeet: -3000,
      distanceNauticalMiles: 12,
      groundSpeedKnots: 120,
    });
    expect(descent.status).toBe('AVAILABLE');
    if (descent.status === 'AVAILABLE') {
      expect(descent.timeMinutes).toBeCloseTo(6, 8);
      expect(descent.verticalSpeedFpm).toBeCloseTo(-500, 8);
    }

    const climb = calculateVerticalSpeedRequired({
      altitudeChangeFeet: 3000,
      distanceNauticalMiles: 12,
      groundSpeedKnots: 120,
    });
    expect(climb.status).toBe('AVAILABLE');
    if (climb.status === 'AVAILABLE') expect(climb.verticalSpeedFpm).toBeCloseTo(500, 8);
  });

  it('calculates TOD distance before a reference point', () => {
    const result = calculateTopOfDescent({
      fromAltitudeFeet: 4500,
      toAltitudeFeet: 1500,
      verticalSpeedFpm: -700,
      groundSpeedKnots: 120,
    });
    expect(result.status).toBe('AVAILABLE');
    if (result.status === 'AVAILABLE') {
      expect(result.altitudeChangeFeet).toBe(-3000);
      expect(result.timeMinutes).toBeCloseTo(3000 / 700, 8);
      expect(result.distanceNauticalMiles).toBeCloseTo(8.571, 3);
    }
  });

  it('returns honest unavailable results for invalid or contradictory inputs', () => {
    for (const result of [
      calculateGradient({ verticalSpeedFpm: -700, groundSpeedKnots: 0 }),
      calculateVerticalSpeedRequired({ altitudeChangeFeet: -3000, distanceNauticalMiles: 0, groundSpeedKnots: 120 }),
      calculateVerticalSpeedRequired({ altitudeChangeFeet: -3000, distanceNauticalMiles: 12, groundSpeedKnots: 0 }),
      calculateTopOfDescent({ fromAltitudeFeet: 1500, toAltitudeFeet: 4500, verticalSpeedFpm: -700, groundSpeedKnots: 120 }),
      calculateTopOfDescent({ fromAltitudeFeet: 4500, toAltitudeFeet: 1500, verticalSpeedFpm: 700, groundSpeedKnots: 120 }),
    ]) {
      expect(result.status).toBe('UNAVAILABLE');
    }
  });
});
