import { describe, expect, it } from 'vitest';
import {
  qualifyGpsGroundSpeed,
  qualifySimulationGroundSpeed,
  selectGroundSpeedInput,
  toGroundSpeedInput,
} from '../../domain/navigationInputs';

describe('navigation input qualification', () => {
  it('converts a browser GPS speed in metres per second to measured knots', () => {
    const result = qualifyGpsGroundSpeed(10);

    expect(result.speedKnots).toBeCloseTo(19.4384, 4);
    expect(result.source).toBe('GPS');
    expect(result.qualification).toBe('MEASURED');
    expect(result.status).toBe('AVAILABLE');
  });

  it('identifies an absent browser speed separately', () => {
    expect(qualifyGpsGroundSpeed(undefined)).toMatchObject({
      speedKnots: null,
      source: 'GPS',
      qualification: 'UNAVAILABLE',
      status: 'ABSENT',
      reason: 'SPEED_ABSENT',
    });
  });

  it('labels a positive simulation speed as simulated ground speed', () => {
    expect(qualifySimulationGroundSpeed(120)).toEqual({
      speedKnots: 120,
      source: 'SIMULATION',
      qualification: 'SIMULATED',
      status: 'AVAILABLE',
    });
  });

  it('exposes only an available source-qualified speed to timing consumers', () => {
    const gps = qualifyGpsGroundSpeed(10, 1000);

    expect(toGroundSpeedInput(gps)).toEqual({
      speedKnots: expect.closeTo(19.4384, 4),
      source: 'GPS',
      qualification: 'MEASURED',
      updatedAt: 1000,
    });
    expect(toGroundSpeedInput(qualifyGpsGroundSpeed(null))).toBeUndefined();
  });

  it('selects simulation or GPS speed without silently crossing sources', () => {
    const gps = qualifyGpsGroundSpeed(10, 2500);

    expect(selectGroundSpeedInput('GPS', 120, gps)).toEqual({
      speedKnots: expect.closeTo(19.4384, 4),
      source: 'GPS',
      qualification: 'MEASURED',
      updatedAt: 2500,
    });
    expect(selectGroundSpeedInput('SIM', 120, gps)).toEqual({
      speedKnots: 120,
      source: 'SIMULATION',
      qualification: 'SIMULATED',
    });
    expect(selectGroundSpeedInput('GPS', 120, undefined)).toBeUndefined();
  });

  it('distinguishes zero GPS speed from an absent speed', () => {
    expect(qualifyGpsGroundSpeed(0)).toMatchObject({
      speedKnots: 0,
      source: 'GPS',
      qualification: 'MEASURED',
      status: 'ZERO',
      reason: 'SPEED_ZERO',
    });
  });

  it('does not qualify a negative GPS speed', () => {
    expect(qualifyGpsGroundSpeed(-1)).toMatchObject({
      speedKnots: null,
      source: 'GPS',
      qualification: 'UNAVAILABLE',
      status: 'NEGATIVE',
      reason: 'SPEED_NEGATIVE',
    });
  });

  it('does not qualify a non-finite GPS speed', () => {
    expect(qualifyGpsGroundSpeed(Number.POSITIVE_INFINITY)).toMatchObject({
      speedKnots: null,
      source: 'GPS',
      qualification: 'UNAVAILABLE',
      status: 'NON_FINITE',
      reason: 'SPEED_NON_FINITE',
    });
  });

  it('distinguishes a browser null speed from an available speed', () => {
    expect(qualifyGpsGroundSpeed(null)).toMatchObject({
      speedKnots: null,
      source: 'GPS',
      qualification: 'UNAVAILABLE',
      status: 'NULL',
      reason: 'SPEED_NULL',
    });
  });
});
