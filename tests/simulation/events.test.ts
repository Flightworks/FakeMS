import { describe, expect, it } from 'vitest';
import { EntityType } from '../../types';
import {
  advanceSimulation,
  createSimulationState,
  exportSimulationReplay,
  setSimulationRunning,
  type SimulationEvent,
} from '../../simulation/engine';
import { ScenarioDefinition } from '../../simulation/scenario';

const scenario: ScenarioDefinition = {
  id: 'event-scenario',
  name: 'Event scenario',
  seed: 1,
  startTimeMs: 5_000,
  ownship: {
    id: 'ownship',
    type: EntityType.OWNSHIP,
    label: 'VIPER',
    position: { lat: 34, lon: -118 },
    heading: 0,
    speed: 0,
  },
  entities: [],
};

describe('simulation event log', () => {
  it('records deterministic lifecycle events in simulation time', () => {
    const running = setSimulationRunning(createSimulationState(scenario), true);
    const state = advanceSimulation(running, 500);
    const replay = exportSimulationReplay(state);

    expect(replay).toEqual<SimulationEvent[]>([
      { kind: 'RUNNING_CHANGED', simTimeMs: 5_000, running: true },
      { kind: 'ADVANCED', simTimeMs: 5_500, deltaMs: 500 },
    ]);
  });
});
