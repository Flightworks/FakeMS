import { describe, expect, it } from 'vitest';
import {
  checkZoneContainment,
  createDefaultZones,
  getZone,
  validateZone,
} from '../../domain/zones';
import { translateScenarioPosition } from '../../domain/missionOrigin';

describe('local named zones', () => {
  it('checks rectangle, circle, and polygon including their boundary', () => {
    const zones = createDefaultZones();
    const rectangle = getZone(zones, 'TRAINING-A');
    expect(rectangle).not.toBeNull();
    const translatedCenter = translateScenarioPosition({ lat: 34.05, lon: -118.2 });
    const translatedBoundary = translateScenarioPosition({ lat: 34.2, lon: -118.2 });
    expect(checkZoneContainment(rectangle!, translatedCenter)).toBe('INSIDE');
    expect(checkZoneContainment(rectangle!, { lat: 45, lon: 5.9 })).toBe('OUTSIDE');
    expect(checkZoneContainment(rectangle!, translatedBoundary)).toBe('ON BOUNDARY');

    const circle = getZone(zones, 'TRAINING-CIRCLE');
    expect(checkZoneContainment(circle!, circle!.geometry.kind === 'CIRCLE'
      ? circle!.geometry.center
      : { lat: 0, lon: 0 })).toBe('INSIDE');

    const polygon = getZone(zones, 'TRAINING-POLYGON');
    expect(checkZoneContainment(polygon!, translatedCenter)).toBe('INSIDE');
  });

  it('rejects unknown, empty, and self-intersecting zones', () => {
    const zones = createDefaultZones();
    expect(getZone(zones, 'UNKNOWN')).toBeNull();
    expect(validateZone({
      id: 'INVALID', label: 'INVALID', source: 'LOCAL', simulatedState: 'SIMULATED',
      geometry: { kind: 'POLYGON', points: [] },
    }).valid).toBe(false);
    expect(validateZone({
      id: 'BOWTIE', label: 'BOWTIE', source: 'LOCAL', simulatedState: 'SIMULATED',
      geometry: { kind: 'POLYGON', points: [
        { lat: 0, lon: 0 }, { lat: 1, lon: 1 }, { lat: 0, lon: 1 }, { lat: 1, lon: 0 },
      ] },
    }).valid).toBe(false);
  });
});
