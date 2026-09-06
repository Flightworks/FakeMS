import { describe, expect, it } from 'vitest';
import {
  MAX_SIMULATION_SPEED,
  MIN_SIMULATION_SPEED,
  advanceClock,
  createSimulationClock,
  setClockRunning,
  setClockSpeedValidated,
} from '../../simulation/clock';

describe('simulation clock speed', () => {
  it('accepts every inclusive speed bound and advances the shared clock', () => {
    expect(MIN_SIMULATION_SPEED).toBe(0.1);
    expect(MAX_SIMULATION_SPEED).toBe(20);

    for (const speed of [0.1, 0.5, 1, 2, 20]) {
      const result = setClockSpeedValidated(createSimulationClock(), speed);
      expect(result.status, String(speed)).toBe('AVAILABLE');
      if (result.status === 'AVAILABLE') {
        const advanced = advanceClock(setClockRunning(result.clock, true), 1_000);
        expect(advanced.speed, String(speed)).toBe(speed);
        expect(advanced.simTimeMs, String(speed)).toBe(1_000 * speed);
      }
    }
  });

  it('rejects out-of-range, NaN, and infinite values without changing the clock', () => {
    const initial = createSimulationClock(42);
    for (const speed of [0, -1, 20.1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const result = setClockSpeedValidated(initial, speed);
      expect(result.status, String(speed)).toBe('UNAVAILABLE');
      if (result.status === 'UNAVAILABLE') expect(result.clock).toEqual(initial);
    }
  });
});
