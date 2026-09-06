import { describe, expect, it } from 'vitest';
import type { GroundSpeedInput } from '../../domain/etaEte';
import {
  summarizeRoute,
  type ActiveSimulatedRoute,
} from '../../domain/routeSummary';

const simulationSpeed: GroundSpeedInput = {
  speedKnots: 120,
  source: 'SIMULATION',
  qualification: 'SIMULATED',
};

const route: ActiveSimulatedRoute = {
  id: 'route-alpha',
  label: 'ALPHA ROUTE',
  origin: { lat: 0, lon: 0 },
  waypoints: [
    { id: 'wp-1', label: 'BRAVO', position: { lat: 0.1, lon: 0 } },
    { id: 'wp-2', label: 'CHARLIE', position: { lat: 0.2, lon: 0 } },
  ],
  remainingWaypointCount: 2,
  hidden: true,
};

describe('simulated route summary', () => {
  it('reports no active route without inventing a branch', () => {
    const summary = summarizeRoute(undefined, {
      currentPosition: { lat: 0, lon: 0 },
      speed: simulationSpeed,
      scenarioTimeMs: 1_000,
    });

    expect(summary.status).toBe('NO_ACTIVE_ROUTE');
    expect(summary.message).toBe('NO ACTIVE SIM ROUTE');
    expect(summary.activeBranch).toBeNull();
    expect(summary.nextPoint).toBeNull();
  });

  it('summarizes the active branch, next point, distances, heading, ETE and ETA', () => {
    const summary = summarizeRoute(route, {
      currentPosition: { lat: 0, lon: 0 },
      speed: simulationSpeed,
      scenarioTimeMs: 1_000,
    });

    expect(summary.status).toBe('ACTIVE');
    expect(summary.hidden).toBe(true);
    expect(summary.activeBranch).toBe(1);
    expect(summary.totalBranches).toBe(2);
    expect(summary.nextPoint).toMatchObject({ id: 'wp-1', label: 'BRAVO' });
    expect(summary.desiredHeadingDegrees).toBeCloseTo(0, 5);
    expect(summary.branchDistanceNauticalMiles).toBeCloseTo(6, 1);
    expect(summary.cumulativeDistanceNauticalMiles).toBeCloseTo(6, 1);
    expect(summary.remainingDistanceNauticalMiles).toBeCloseTo(12, 1);
    expect(summary.eteSeconds).toBeCloseTo((summary.remainingDistanceNauticalMiles / 120) * 3600, 10);
    expect(summary.etaUtcMs).toBeCloseTo(1_000 + (summary.eteSeconds ?? 0) * 1_000, 5);
  });

  it('advances to the second branch and does not present a completed branch as next', () => {
    const activeSecondBranch = summarizeRoute({
      ...route,
      remainingWaypointCount: 1,
    }, {
      currentPosition: { lat: 0.1, lon: 0 },
      speed: simulationSpeed,
      scenarioTimeMs: 2_000,
    });

    expect(activeSecondBranch.activeBranch).toBe(2);
    expect(activeSecondBranch.nextPoint?.label).toBe('CHARLIE');

    const completed = summarizeRoute({
      ...route,
      remainingWaypointCount: 0,
    }, {
      currentPosition: { lat: 0.2, lon: 0 },
      speed: undefined,
      scenarioTimeMs: 3_000,
    });

    expect(completed.status).toBe('COMPLETED');
    expect(completed.message).toBe('ROUTE COMPLETE');
    expect(completed.activeBranch).toBeNull();
    expect(completed.nextPoint).toBeNull();
  });

  it('keeps the route summary visible while reporting unavailable timing data', () => {
    const summary = summarizeRoute(route, {
      currentPosition: { lat: 0, lon: 0 },
      speed: undefined,
      scenarioTimeMs: 1_000,
    });

    expect(summary.status).toBe('ACTIVE');
    expect(summary.nextPoint?.label).toBe('BRAVO');
    expect(summary.eteSeconds).toBeNull();
    expect(summary.etaUtcMs).toBeNull();
    expect(summary.timingReason).toBe('SPEED_UNAVAILABLE');
  });
});
