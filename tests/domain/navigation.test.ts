import { describe, expect, it } from 'vitest';
import {
  NavigationValidity,
  PositionSource,
  createNavigationState,
  markNavigationError,
  markNavigationUpdate,
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
