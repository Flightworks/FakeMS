import { describe, expect, it } from 'vitest';
import {
  calculateEtaEte,
  formatEtaEte,
} from '../../domain/etaEte';

const scenarioTimeMs = Date.UTC(2026, 0, 1, 12, 0, 0);

const simulatedSpeed = {
  speedKnots: 60,
  source: 'SIMULATION' as const,
  qualification: 'SIMULATED' as const,
  updatedAt: scenarioTimeMs,
};

describe('reliable ETA and ETE calculations', () => {
  it('calculates distance, ETE, and ETA from a qualified ground speed', () => {
    const result = calculateEtaEte(
      { lat: 0, lon: 0 },
      { lat: 0, lon: 1 },
      simulatedSpeed,
      scenarioTimeMs,
    );

    expect(result.status).toBe('AVAILABLE');
    expect(result.distanceNauticalMiles).toBeGreaterThan(60);
    expect(result.distanceNauticalMiles).toBeLessThan(61);
    expect(result.eteSeconds).toBeCloseTo((result.distanceNauticalMiles / 60) * 3600, 8);
    expect(result.etaUtcMs).toBe(scenarioTimeMs + result.eteSeconds * 1000);
    expect(result.speedSource).toBe('SIMULATION');
    expect(result.speedQualification).toBe('SIMULATED');
  });

  it('marks an explicit speed as a user assumption', () => {
    const result = calculateEtaEte(
      { lat: 0, lon: 0 },
      { lat: 0, lon: 1 },
      {
        speedKnots: 140,
        source: 'USER_INPUT',
        qualification: 'USER_ASSUMPTION',
      },
      scenarioTimeMs,
    );

    expect(result.status).toBe('AVAILABLE');
    expect(result.speedKnots).toBe(140);
    expect(result.speedSource).toBe('USER_INPUT');
    expect(result.speedQualification).toBe('USER_ASSUMPTION');
  });

  it('does not produce ETA or ETE without a positive qualified speed', () => {
    const result = calculateEtaEte(
      { lat: 0, lon: 0 },
      { lat: 0, lon: 1 },
      undefined,
      scenarioTimeMs,
    );

    expect(result).toMatchObject({
      status: 'UNAVAILABLE',
      distanceNauticalMiles: expect.any(Number),
      eteSeconds: null,
      etaUtcMs: null,
      speedKnots: null,
      reason: 'SPEED_UNAVAILABLE',
    });
  });

  it('rejects a stale speed instead of presenting a current ETA', () => {
    const result = calculateEtaEte(
      { lat: 0, lon: 0 },
      { lat: 0, lon: 1 },
      {
        ...simulatedSpeed,
        updatedAt: scenarioTimeMs - 10_001,
        staleAfterMs: 10_000,
      },
      scenarioTimeMs,
    );

    expect(result.status).toBe('UNAVAILABLE');
    expect(result.reason).toBe('SPEED_STALE');
    expect(result.etaUtcMs).toBeNull();
  });

  it('formats UTC as primary and local time with an explicit timezone', () => {
    const result = calculateEtaEte(
      { lat: 0, lon: 0 },
      { lat: 0, lon: 1 },
      simulatedSpeed,
      scenarioTimeMs,
    );

    const display = formatEtaEte(result, 'Europe/Paris');

    expect(display.distance).toMatch(/NM$/);
    expect(display.ete).toMatch(/^ETE:/);
    expect(display.etaUtc).toContain('UTC');
    expect(display.etaLocal).toContain('Europe/Paris');
    expect(display.speed).toContain('60.0 KT');
  });
});
