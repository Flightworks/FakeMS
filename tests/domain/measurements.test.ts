import { describe, expect, it } from 'vitest';
import { EntityType } from '../../types';
import { calculateEta, deriveHeightAboveTerrain } from '../../domain/measurements';

describe('traceable measurements', () => {
  it('does not invent HGT from barometric altitude', () => {
    const ownship = {
      id: 'ownship',
      label: 'VIPER',
      type: EntityType.OWNSHIP,
      position: { lat: 34, lon: -118 },
      altitude: 3_428,
    };

    expect(deriveHeightAboveTerrain(ownship)).toEqual({
      value: null,
      unit: 'ft',
      source: 'UNAVAILABLE',
      qualification: 'UNAVAILABLE',
    });
  });

  it('uses explicitly provided simulated terrain data for HGT', () => {
    const ownship = {
      id: 'ownship',
      label: 'VIPER',
      type: EntityType.OWNSHIP,
      position: { lat: 34, lon: -118 },
      altitude: 3_428,
      metadata: { hgtFt: 1_200 },
    };

    expect(deriveHeightAboveTerrain(ownship)).toMatchObject({
      value: 1_200,
      unit: 'ft',
      source: 'SIMULATED_TERRAIN',
      qualification: 'SIMULATED',
    });
  });

  it('calculates ETA from geodesic distance and speed in knots', () => {
    const eta = calculateEta(
      { lat: 34, lon: -118 },
      { lat: 34.1, lon: -118 },
      60,
    );

    expect(eta.value).toBeGreaterThan(5);
    expect(eta.value).toBeLessThan(7);
    expect(eta.unit).toBe('min');
    expect(eta.source).toBe('DERIVED_POSITION_SPEED');
    expect(eta.qualification).toBe('CALCULATED');
  });

  it('does not claim an ETA when speed is unavailable', () => {
    expect(calculateEta(
      { lat: 34, lon: -118 },
      { lat: 34.1, lon: -118 },
      0,
    ).value).toBeNull();
  });
});
