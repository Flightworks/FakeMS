import { describe, expect, it } from 'vitest';
import { advanceClock, createSimulationClock, setClockRunning, setClockSpeed } from '../../simulation/clock';
import { createSeededRandom } from '../../simulation/random';

describe('deterministic simulation primitives', () => {
  it('produces the same random sequence for the same seed', () => {
    const first = createSeededRandom(42);
    const second = createSeededRandom(42);

    expect([first.next(), first.next(), first.next()]).toEqual([
      second.next(), second.next(), second.next(),
    ]);
  });

  it('advances simulation time only while running', () => {
    const initial = createSimulationClock(1_000);
    const running = setClockRunning(initial, true);
    const advanced = advanceClock(running, 500);
    const paused = setClockRunning(advanced, false);

    expect(advanced.simTimeMs).toBe(1_500);
    expect(advanceClock(paused, 500).simTimeMs).toBe(1_500);
  });

  it('applies a bounded positive time scale', () => {
    const clock = setClockSpeed(createSimulationClock(), 4);
    expect(clock.speed).toBe(4);
    expect(setClockSpeed(clock, 0).speed).toBe(0.1);
    expect(setClockSpeed(clock, 99).speed).toBe(20);
  });

  it('keeps clock values finite when given invalid numeric input', () => {
    const clock = createSimulationClock(0, Number.NaN);
    const withInvalidSpeed = setClockSpeed(clock, Number.NaN);
    const withInvalidDelta = advanceClock(
      setClockRunning(withInvalidSpeed, true),
      Number.NaN,
    );

    expect(clock.maxDeltaMs).toBe(1_000);
    expect(withInvalidSpeed.speed).toBe(1);
    expect(withInvalidDelta.simTimeMs).toBe(0);
  });
});
