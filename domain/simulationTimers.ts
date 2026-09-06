export type ScenarioTimerStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface ScenarioTimer {
  id: number;
  label: string;
  checkReference?: string;
  createdAtSimTimeMs: number;
  dueAtSimTimeMs: number;
  status: ScenarioTimerStatus;
  expiredAtSimTimeMs?: number;
}

export interface ScenarioTimerExpirationEvent {
  type: 'EXPIRED';
  timerId: number;
  simTimeMs: number;
}

export interface ScenarioTimerState {
  timers: ScenarioTimer[];
  events: ScenarioTimerExpirationEvent[];
  nextId: number;
}

export interface ScenarioTimerRequest {
  durationMs: number;
  label: string;
  checkReference?: string;
}

export type ScenarioTimerCreationResult =
  | { status: 'AVAILABLE'; state: ScenarioTimerState; timer: ScenarioTimer }
  | { status: 'UNAVAILABLE'; state: ScenarioTimerState; reason: 'INVALID_DURATION' | 'INVALID_TIME' };

export const createTimerState = (): ScenarioTimerState => ({
  timers: [],
  events: [],
  nextId: 1,
});

const cloneState = (state: ScenarioTimerState): ScenarioTimerState => ({
  timers: state.timers.map(timer => ({ ...timer })),
  events: state.events.map(event => ({ ...event })),
  nextId: state.nextId,
});

export const addScenarioTimer = (
  state: ScenarioTimerState,
  request: ScenarioTimerRequest,
  simTimeMs: number,
): ScenarioTimerCreationResult => {
  if (!Number.isFinite(simTimeMs)) {
    return { status: 'UNAVAILABLE', state: cloneState(state), reason: 'INVALID_TIME' };
  }
  if (!Number.isFinite(request.durationMs) || request.durationMs <= 0) {
    return { status: 'UNAVAILABLE', state: cloneState(state), reason: 'INVALID_DURATION' };
  }

  const next = cloneState(state);
  const timer: ScenarioTimer = {
    id: next.nextId,
    label: request.label,
    checkReference: request.checkReference,
    createdAtSimTimeMs: simTimeMs,
    dueAtSimTimeMs: simTimeMs + request.durationMs,
    status: 'ACTIVE',
  };
  next.nextId += 1;
  next.timers.push(timer);
  return { status: 'AVAILABLE', state: next, timer: { ...timer } };
};

export const advanceScenarioTimers = (
  state: ScenarioTimerState,
  simTimeMs: number,
  running: boolean,
): ScenarioTimerState => {
  if (!running || !Number.isFinite(simTimeMs)) return cloneState(state);

  const next = cloneState(state);
  next.timers = next.timers.map(timer => {
    if (timer.status !== 'ACTIVE' || simTimeMs < timer.dueAtSimTimeMs) return timer;
    next.events.push({ type: 'EXPIRED', timerId: timer.id, simTimeMs });
    return { ...timer, status: 'EXPIRED', expiredAtSimTimeMs: simTimeMs };
  });
  return next;
};

export const cancelScenarioTimer = (
  state: ScenarioTimerState,
  timerId: number,
): ScenarioTimerState => {
  const next = cloneState(state);
  next.timers = next.timers.map(timer => (
    timer.id === timerId && timer.status === 'ACTIVE'
      ? { ...timer, status: 'CANCELLED' }
      : timer
  ));
  return next;
};

export const resetScenarioTimers = (_state: ScenarioTimerState): ScenarioTimerState => createTimerState();
