import { describe, expect, it } from 'vitest';
import {
  buildGridLines,
  createGridState,
  setGridEnabled,
  setGridStep,
} from '../../domain/grid';

describe('local latitude/longitude grid', () => {
  it('validates visibility and manual minute steps', () => {
    const initial = createGridState();
    expect(initial).toMatchObject({ enabled: false, stepMinutes: 1 });
    expect(setGridEnabled(initial, true)).toMatchObject({ enabled: true, stepMinutes: 1 });
    expect(setGridStep(initial, 1)).toMatchObject({ status: 'AVAILABLE', state: { stepMinutes: 1 } });
    expect(setGridStep(initial, 0)).toMatchObject({ status: 'UNAVAILABLE', reason: 'INVALID_STEP' });
    expect(setGridStep(initial, 61)).toMatchObject({ status: 'UNAVAILABLE', reason: 'INVALID_STEP' });
  });

  it('builds bounded lines and normalizes antimeridian longitudes', () => {
    const lines = buildGridLines({ lat: 0, lon: 179.9 }, 5, 60);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.flat()).toEqual(expect.arrayContaining([
      expect.objectContaining({ lat: expect.any(Number), lon: expect.any(Number) }),
    ]));
    expect(lines.flat().every(point => point.lon >= -180 && point.lon <= 180)).toBe(true);
    expect(lines.length).toBeLessThanOrEqual(80);
  });
});
