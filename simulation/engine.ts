import type { Entity } from '../types';
import { stepEntity } from '../domain/kinematics';
import { advanceClock, createSimulationClock, setClockRunning, type SimulationClock } from './clock';
import { cloneEntity, cloneScenario, type ScenarioDefinition } from './scenario';

export type SimulationEvent =
  | { kind: 'RUNNING_CHANGED'; simTimeMs: number; running: boolean }
  | { kind: 'ADVANCED'; simTimeMs: number; deltaMs: number };

export interface SimulationState {
  scenario: ScenarioDefinition;
  clock: SimulationClock;
  ownship: Entity;
  entities: Entity[];
  eventLog: SimulationEvent[];
}

/**
 * Build a simulation state from an independent snapshot of the scenario.
 *
 * The scenario and its live entities are intentionally cloned separately so
 * changing the live state can never mutate the reset source of truth.
 */
export const createSimulationState = (scenario: ScenarioDefinition): SimulationState => {
  const scenarioSnapshot = cloneScenario(scenario);

  return {
    scenario: scenarioSnapshot,
    clock: createSimulationClock(scenarioSnapshot.startTimeMs),
    ownship: cloneEntity(scenarioSnapshot.ownship),
    entities: scenarioSnapshot.entities.map(cloneEntity),
    eventLog: [],
  };
};

export const setSimulationRunning = (
  state: SimulationState,
  running: boolean,
): SimulationState => {
  if (state.clock.running === running) return state;

  return {
    ...state,
    clock: setClockRunning(state.clock, running),
    eventLog: [
      ...state.eventLog,
      { kind: 'RUNNING_CHANGED', simTimeMs: state.clock.simTimeMs, running },
    ],
  };
};

/**
 * Advance a running simulation by real time.  The clock's speed determines
 * the simulated duration passed to every kinematic step.
 */
export const advanceSimulation = (
  state: SimulationState,
  realDeltaMs: number,
): SimulationState => {
  if (!state.clock.running || realDeltaMs <= 0) return state;

  const clock = advanceClock(state.clock, realDeltaMs);
  const simulatedDeltaSeconds = (clock.simTimeMs - state.clock.simTimeMs) / 1000;

  // A valid running clock has a positive speed.  Keep this guard so a state
  // assembled by a caller with a zero/non-positive speed still cannot move
  // entities without advancing simulation time.
  if (simulatedDeltaSeconds <= 0) {
    return { ...state, clock };
  }

  return {
    ...state,
    clock,
    ownship: stepEntity(state.ownship, simulatedDeltaSeconds),
    entities: state.entities.map(entity => stepEntity(entity, simulatedDeltaSeconds)),
    eventLog: [
      ...state.eventLog,
      {
        kind: 'ADVANCED',
        simTimeMs: clock.simTimeMs,
        deltaMs: clock.simTimeMs - state.clock.simTimeMs,
      },
    ],
  };
};

export const exportSimulationReplay = (state: SimulationState): SimulationEvent[] =>
  state.eventLog.map(event => ({ ...event }));

export const resetSimulation = (state: SimulationState): SimulationState =>
  createSimulationState(state.scenario);
