import { describe, expect, it } from 'vitest';
import {
  NavigationValidity,
  PositionSource,
  createNavigationState,
  markNavigationError,
  markNavigationUpdate,
  markSimulationUpdate,
  navigationPositionLabel,
  navigationQualificationLabel,
  navigationStatusLabel,
} from '../../domain/navigation';

describe('navigation state', () => {
  const position = { lat: 34, lon: -118 };

  it('starts as an explicit simulation state', () => {
    const state = createNavigationState(position, 1000);

    expect(state.source).toBe<PositionSource>('SIM');
    expect(state.validity).toBe<NavigationValidity>('SIMULATED');
    expect(state.position).toEqual(position);
    expect(state.updatedAt).toBe(1000);
  });

  it('records a valid GPS update with accuracy and timestamp', () => {
    const state = markNavigationUpdate(
      createNavigationState(position, 1000),
      { lat: 48.1, lon: 2.2 },
      2500,
      7,
    );

    expect(state.source).toBe('GPS');
    expect(state.validity).toBe('VALID');
    expect(state.position).toEqual({ lat: 48.1, lon: 2.2 });
    expect(state.updatedAt).toBe(2500);
    expect(state.accuracyMeters).toBe(7);
  });

  it('qualifies a GPS fix with optional speed and heading', () => {
    const state = markNavigationUpdate(
      createNavigationState(position, 1000),
      { lat: 48.1, lon: 2.2 },
      2500,
      7,
      { speedMetersPerSecond: 10, headingDegrees: 0 },
    );

    expect(state.positionSource).toBe('GPS');
    expect(state.positionStatus).toBe('CURRENT');
    expect(state.positionQualification).toBe('MEASURED');
    expect(state.groundSpeed).toMatchObject({
      speedKnots: expect.closeTo(19.4384, 4),
      source: 'GPS',
      qualification: 'MEASURED',
      status: 'AVAILABLE',
    });
    expect(state.headingDegrees).toBe(0);
  });

  it('records simulation movement with a simulated ground-speed source', () => {
    const state = markSimulationUpdate(
      createNavigationState(position, 1000),
      { lat: 34.001, lon: -118.001 },
      1200,
      120,
      0,
    );

    expect(state.source).toBe('SIM');
    expect(state.validity).toBe('SIMULATED');
    expect(state.position).toEqual({ lat: 34.001, lon: -118.001 });
    expect(state.positionSource).toBe('SIM');
    expect(state.positionStatus).toBe('CURRENT');
    expect(state.positionQualification).toBe('SIMULATED');
    expect(state.groundSpeed).toMatchObject({
      speedKnots: 120,
      source: 'SIMULATION',
      qualification: 'SIMULATED',
      status: 'AVAILABLE',
    });
    expect(state.headingDegrees).toBe(0);
    expect(navigationStatusLabel(state)).toBe('SIM');
    expect(navigationPositionLabel(state)).toBe('SIMULATION POSITION');
    expect(navigationQualificationLabel(state)).toBe('SIMULATED MOVEMENT');
  });

  it('retains the last GPS position and names the lost-fix cause', () => {
    const gps = markNavigationUpdate(
      createNavigationState(position, 1000),
      { lat: 48.1, lon: 2.2 },
      2500,
      7,
      { speedMetersPerSecond: 10, headingDegrees: 90 },
    );
    const lost = markNavigationError(gps, 'LOST', 3000);

    expect(lost.position).toEqual(gps.position);
    expect(lost.positionSource).toBe('GPS');
    expect(lost.positionStatus).toBe('RETAINED');
    expect(lost.positionQualification).toBe('RETAINED');
    expect(lost.positionUpdatedAt).toBe(2500);
    expect(lost.updatedAt).toBe(3000);
    expect(lost.groundSpeed?.status).toBe('STALE');
    expect(navigationStatusLabel(lost)).toBe('GPS LOST · POSITION RETAINED');
  });

  it('keeps a simulated fallback when GPS is denied before a first fix', () => {
    const initial = createNavigationState(position, 1000);
    const denied = markNavigationError(initial, 'DENIED', 1100);

    expect(denied.source).toBe('GPS');
    expect(denied.validity).toBe('DENIED');
    expect(denied.position).toEqual(position);
    expect(denied.positionSource).toBe('SIM');
    expect(denied.positionStatus).toBe('CURRENT');
    expect(denied.positionQualification).toBe('SIMULATED');
    expect(navigationPositionLabel(denied)).toBe('SIMULATION POSITION');
    expect(navigationQualificationLabel(denied)).toBe('SIMULATED MOVEMENT');
  });

  it('marks an old GPS fix as retained when it becomes stale', () => {
    const gps = markNavigationUpdate(
      createNavigationState(position, 1000),
      { lat: 48.1, lon: 2.2 },
      2500,
      7,
      { speedMetersPerSecond: 10, headingDegrees: 90 },
    );
    const stale = markNavigationError(gps, 'STALE', 10_000);

    expect(stale).toMatchObject({
      source: 'GPS',
      validity: 'STALE',
      position: { lat: 48.1, lon: 2.2 },
      positionSource: 'GPS',
      positionStatus: 'RETAINED',
      positionQualification: 'RETAINED',
      positionUpdatedAt: 2500,
      updatedAt: 10_000,
    });
    expect(navigationPositionLabel(stale)).toBe('GPS POSITION RETAINED');
    expect(navigationQualificationLabel(stale)).toBe('RETAINED GPS POSITION');
  });

  it('distinguishes denied GPS from a lost GPS fix', () => {
    const initial = createNavigationState(position, 1000);

    expect(markNavigationError(initial, 'DENIED', 1100).validity).toBe('DENIED');
    expect(markNavigationError(initial, 'LOST', 1200).validity).toBe('LOST');
    expect(markNavigationError(initial, 'ACQUIRING', 1300).validity).toBe('ACQUIRING');
  });

  it('does not label a non-valid source as real GPS', () => {
    const initial = createNavigationState(position, 1000);
    expect(navigationStatusLabel(initial)).toBe('SIM');
    expect(navigationStatusLabel(markNavigationError(initial, 'DENIED', 1100))).toBe('GPS DENIED');
    expect(navigationStatusLabel(markNavigationUpdate(initial, position, 1200))).toBe('GPS OK');
  });
});
