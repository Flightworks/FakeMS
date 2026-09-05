import { describe, expect, it } from 'vitest';
import { EntityType, type Entity } from '../../types';
import {
  calculateTacticalMeasurement,
  formatTacticalMeasurement,
} from '../../domain/tacticalMeasurements';

const entity = (id: string, label: string, lat: number, lon: number): Entity => ({
  id,
  label,
  type: EntityType.WAYPOINT,
  position: { lat, lon },
});

const ownship = entity('ownship', 'OWNSHIP', 0, 0);

describe('tactical BRG/RNG measurements', () => {
  it('calculates north, east, south and west true bearings in degrees and NM', () => {
    const cases = [
      { label: 'NORTH', position: { lat: 1, lon: 0 }, bearing: 0 },
      { label: 'EAST', position: { lat: 0, lon: 1 }, bearing: 90 },
      { label: 'SOUTH', position: { lat: -1, lon: 0 }, bearing: 180 },
      { label: 'WEST', position: { lat: 0, lon: -1 }, bearing: 270 },
    ];

    for (const testCase of cases) {
      const result = calculateTacticalMeasurement(
        ownship,
        entity(testCase.label.toLowerCase(), testCase.label, testCase.position.lat, testCase.position.lon),
      );

      expect(result.bearingTrueDegrees, testCase.label).toBeCloseTo(testCase.bearing, 5);
      expect(result.rangeNauticalMiles, testCase.label).toBeGreaterThan(0);
      expect(result.qualification, testCase.label).toBe('CALCULATED');
      expect(result.source, testCase.label).toBe('ENTITY_POSITIONS');
    }
  });

  it('normalizes a computed bearing to the half-open true range', () => {
    const result = calculateTacticalMeasurement(
      ownship,
      entity('target', 'TARGET', 0.1, -0.1),
    );

    expect(result.bearingTrueDegrees).toBeGreaterThanOrEqual(0);
    expect(result.bearingTrueDegrees).toBeLessThan(360);
  });

  it('keeps zero range and marks bearing unavailable for identical positions', () => {
    const result = calculateTacticalMeasurement(
      ownship,
      entity('same', 'SAME', 0, 0),
    );

    expect(result.rangeNauticalMiles).toBe(0);
    expect(result.bearingTrueDegrees).toBeNull();
    expect(result.reason).toBe('IDENTICAL_POSITIONS');
    expect(result.qualification).toBe('CALCULATED');
  });

  it('does not present a stale position as a current calculated measurement', () => {
    const result = calculateTacticalMeasurement(
      ownship,
      entity('stale', 'STALE', 1, 0),
      { toFreshness: 'STALE' },
    );

    expect(result.bearingTrueDegrees).toBeNull();
    expect(result.rangeNauticalMiles).toBeNull();
    expect(result.qualification).toBe('UNAVAILABLE');
    expect(result.reason).toBe('STALE_POSITION');
  });

  it('does not mutate either input entity', () => {
    const from = ownship;
    const to = entity('target', 'TARGET', 1, 1);
    const before = JSON.stringify({ from, to });

    calculateTacticalMeasurement(from, to);

    expect(JSON.stringify({ from, to })).toBe(before);
  });

  it('formats both references, source and qualification for the operator', () => {
    const measurement = calculateTacticalMeasurement(
      ownship,
      entity('target', 'BRAVO', 0, 1),
    );

    const formatted = formatTacticalMeasurement(measurement, 'BRG/RNG');

    expect(formatted).toContain('OWNSHIP');
    expect(formatted).toContain('BRAVO');
    expect(formatted).toContain('BRG');
    expect(formatted).toContain('RNG');
    expect(formatted).toContain('ENTITY_POSITIONS');
    expect(formatted).toContain('CALCULATED');
  });
});
