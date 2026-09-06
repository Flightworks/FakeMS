import { describe, expect, it } from 'vitest';
import {
  addScenarioTimer,
  advanceScenarioTimers,
  cancelScenarioTimer,
  createTimerState,
  resetScenarioTimers,
} from '../../domain/simulationTimers';

describe('scenario timers', () => {
  it('creates a timer from scenario time and preserves its check reference', () => {
    const result = addScenarioTimer(createTimerState(), {
      durationMs: 5 * 60_000,
      label: 'CHECK BRAVO',
      checkReference: 'BRAVO',
    }, 10_000);

    expect(result.status).toBe('AVAILABLE');
    expect(result.state.timers).toEqual([
      expect.objectContaining({
        id: 1,
        label: 'CHECK BRAVO',
        checkReference: 'BRAVO',
        createdAtSimTimeMs: 10_000,
        dueAtSimTimeMs: 310_000,
        status: 'ACTIVE',
      }),
    ]);
  });

  it('does not expire while the simulation clock is paused', () => {
    const created = addScenarioTimer(createTimerState(), {
      durationMs: 60_000,
      label: 'PAUSED',
    }, 10_000).state;

    const paused = advanceScenarioTimers(created, 100_000, false);

    expect(paused.timers[0].status).toBe('ACTIVE');
    expect(paused.events).toEqual([]);
  });

  it('expires once when running time reaches the due time', () => {
    const created = addScenarioTimer(createTimerState(), {
      durationMs: 60_000,
      label: 'ONE SHOT',
    }, 10_000).state;

    const expired = advanceScenarioTimers(created, 70_000, true);
    const repeated = advanceScenarioTimers(expired, 80_000, true);

    expect(expired.timers[0]).toMatchObject({ status: 'EXPIRED', expiredAtSimTimeMs: 70_000 });
    expect(expired.events).toEqual([{ type: 'EXPIRED', timerId: 1, simTimeMs: 70_000 }]);
    expect(repeated.events).toEqual(expired.events);
  });

  it('cancels a timer without producing an expiration event', () => {
    const created = addScenarioTimer(createTimerState(), {
      durationMs: 60_000,
      label: 'CANCELLED',
    }, 10_000).state;
    const cancelled = cancelScenarioTimer(created, 1);
    const advanced = advanceScenarioTimers(cancelled, 100_000, true);

    expect(cancelled.timers[0].status).toBe('CANCELLED');
    expect(advanced.timers[0].status).toBe('CANCELLED');
    expect(advanced.events).toEqual([]);
  });

  it('resets all scenario timers without mutating the previous state', () => {
    const created = addScenarioTimer(createTimerState(), {
      durationMs: 60_000,
      label: 'RESET',
    }, 10_000).state;
    const reset = resetScenarioTimers(created);

    expect(reset).toEqual(createTimerState());
    expect(created.timers).toHaveLength(1);
  });
});
