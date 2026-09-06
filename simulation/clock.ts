export interface SimulationClock {
  simTimeMs: number;
  running: boolean;
  speed: number;
  maxDeltaMs: number;
}

const MIN_SPEED = 0.1;
const MAX_SPEED = 20;
export const MIN_SIMULATION_SPEED = MIN_SPEED;
export const MAX_SIMULATION_SPEED = MAX_SPEED;
export const DEFAULT_MAX_DELTA_MS = 1_000;

export const createSimulationClock = (
  simTimeMs = 0,
  maxDeltaMs = DEFAULT_MAX_DELTA_MS,
): SimulationClock => {
  const safeMaxDeltaMs = Number.isFinite(maxDeltaMs) && maxDeltaMs > 0
    ? maxDeltaMs
    : DEFAULT_MAX_DELTA_MS;

  return {
    simTimeMs,
    running: false,
    speed: 1,
    maxDeltaMs: safeMaxDeltaMs,
  };
};

export const setClockRunning = (clock: SimulationClock, running: boolean): SimulationClock => ({
  ...clock,
  running,
});

export type ClockSpeedUpdate =
  | { status: 'AVAILABLE'; clock: SimulationClock }
  | { status: 'UNAVAILABLE'; clock: SimulationClock; reason: 'NON_FINITE_SPEED' | 'OUT_OF_RANGE' };

export const setClockSpeedValidated = (clock: SimulationClock, speed: number): ClockSpeedUpdate => {
  if (!Number.isFinite(speed)) return { status: 'UNAVAILABLE', clock, reason: 'NON_FINITE_SPEED' };
  if (speed < MIN_SPEED || speed > MAX_SPEED) return { status: 'UNAVAILABLE', clock, reason: 'OUT_OF_RANGE' };
  return { status: 'AVAILABLE', clock: { ...clock, speed } };
};

export const setClockSpeed = (clock: SimulationClock, speed: number): SimulationClock => {
  if (!Number.isFinite(speed)) return clock;

  return {
    ...clock,
    speed: Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed)),
  };
};

export const advanceClock = (clock: SimulationClock, realDeltaMs: number): SimulationClock => {
  if (!clock.running || !Number.isFinite(realDeltaMs) || realDeltaMs <= 0) return clock;
  if (!Number.isFinite(clock.speed) || clock.speed <= 0) return clock;

  const safeMaxDeltaMs = Number.isFinite(clock.maxDeltaMs) && clock.maxDeltaMs > 0
    ? clock.maxDeltaMs
    : DEFAULT_MAX_DELTA_MS;

  return {
    ...clock,
    simTimeMs: clock.simTimeMs + Math.min(realDeltaMs, safeMaxDeltaMs) * clock.speed,
  };
};
