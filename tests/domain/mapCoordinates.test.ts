import { describe, expect, it } from 'vitest';
import { meterOffsetToPosition, positionToMeterOffset } from '../../domain/mapCoordinates';

describe('map coordinate contract', () => {
  const reference = { lat: 34, lon: -118 };

  it('converts geographic positions to explicit east/north meters', () => {
    const offset = positionToMeterOffset(reference, { lat: 34.01, lon: -117.99 });

    expect(offset.eastMeters).toBeGreaterThan(0);
    expect(offset.northMeters).toBeGreaterThan(0);
    expect(offset).not.toEqual({ x: 34.01, y: -117.99 });
  });

  it('round-trips a local meter offset without confusing it with lat/lon', () => {
    const target = { lat: 34.01, lon: -117.99 };
    const offset = positionToMeterOffset(reference, target);
    const restored = meterOffsetToPosition(reference, offset);

    expect(restored.lat).toBeCloseTo(target.lat, 8);
    expect(restored.lon).toBeCloseTo(target.lon, 8);
  });

  it('uses the shortest longitude delta across the antimeridian', () => {
    const reference = { lat: 0, lon: 179.9 };
    const target = { lat: 0, lon: -179.9 };
    const offset = positionToMeterOffset(reference, target);

    expect(offset.eastMeters).toBeGreaterThan(0);
    expect(offset.eastMeters).toBeLessThan(30_000);
    expect(meterOffsetToPosition(reference, offset).lon).toBeCloseTo(-179.9, 8);
  });
});
