import { describe, expect, it } from 'vitest';
import {
  appendTrailSample,
  clearTrail,
  createTrailState,
  getTrailSegments,
  setTrailVisibility,
  TRAIL_MIN_DISTANCE_METERS,
  TRAIL_SAMPLE_INTERVAL_MS,
} from '../../domain/trackTrails';

describe('sampled local track trails', () => {
  const origin = { lat: 34, lon: -118 };

  it('accepts the first point, then enforces time and distance thresholds', () => {
    let state = createTrailState();
    const first = appendTrailSample(state, { targetId: 'BRAVO', label: 'BRAVO', position: origin, atMs: 1_000 });
    expect(first.status).toBe('RECORDED');
    state = first.state;

    const tooSoon = appendTrailSample(state, {
      targetId: 'BRAVO', label: 'BRAVO', position: { lat: 34.0001, lon: -118 }, atMs: 1_000 + TRAIL_SAMPLE_INTERVAL_MS - 1,
    });
    expect(tooSoon.status).toBe('IGNORED');
    state = tooSoon.state;

    const tooClose = appendTrailSample(state, {
      targetId: 'BRAVO', label: 'BRAVO', position: { lat: 34.00002, lon: -118 }, atMs: 1_000 + TRAIL_SAMPLE_INTERVAL_MS,
    });
    expect(tooClose.status).toBe('IGNORED');

    const recorded = appendTrailSample(state, {
      targetId: 'BRAVO', label: 'BRAVO', position: { lat: 34.0001, lon: -118 }, atMs: 1_000 + TRAIL_SAMPLE_INTERVAL_MS,
    });
    expect(recorded.status).toBe('RECORDED');
    expect(recorded.state.trails.BRAVO.points).toHaveLength(2);
    expect(TRAIL_MIN_DISTANCE_METERS).toBeGreaterThan(5 - 0.001);
  });

  it('starts a new segment after a long interruption or time reversal', () => {
    let state = createTrailState();
    state = appendTrailSample(state, { targetId: 'OWNSHIP', label: 'VIPER 1-1', position: origin, atMs: 10_000 }).state;
    state = appendTrailSample(state, {
      targetId: 'OWNSHIP', label: 'VIPER 1-1', position: { lat: 34.001, lon: -118 }, atMs: 50_000,
    }).state;
    state = appendTrailSample(state, {
      targetId: 'OWNSHIP', label: 'VIPER 1-1', position: { lat: 34.002, lon: -118 }, atMs: 49_000,
    }).state;
    expect(getTrailSegments(state.trails.OWNSHIP)).toHaveLength(3);
  });

  it('keeps visibility separate and clears only the requested target', () => {
    let state = createTrailState();
    state = appendTrailSample(state, { targetId: 'OWNSHIP', label: 'VIPER 1-1', position: origin, atMs: 1_000 }).state;
    state = appendTrailSample(state, { targetId: 'BRAVO', label: 'BRAVO', position: origin, atMs: 1_000 }).state;
    state = setTrailVisibility(state, 'BRAVO', true);
    expect(state.trails.BRAVO.visible).toBe(true);
    expect(state.trails.OWNSHIP.visible).toBe(false);
    state = clearTrail(state, 'BRAVO');
    expect(state.trails.BRAVO.points).toHaveLength(0);
    expect(state.trails.OWNSHIP.points).toHaveLength(1);
  });

  it('rejects invalid GPS precision without adding a point', () => {
    const result = appendTrailSample(createTrailState(), {
      targetId: 'OWNSHIP', label: 'VIPER 1-1', position: origin, atMs: 1_000,
      source: 'GPS', accuracyMeters: 101,
    });
    expect(result.status).toBe('IGNORED');
    if (result.status === 'IGNORED') expect(result.reason).toBe('GPS ACCURACY LOW');
    expect(result.state.trails.OWNSHIP).toBeUndefined();
  });
});
