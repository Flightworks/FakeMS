import { describe, expect, it } from 'vitest';
import { EntityType } from '../../types';
import {
  advanceSimulation,
  createSimulationState,
  resetSimulation,
  setSimulationRunning,
} from '../../simulation/engine';
import { ScenarioDefinition } from '../../simulation/scenario';

const scenario: ScenarioDefinition = {
  id: 'test-scenario',
  name: 'Test scenario',
  seed: 12,
  startTimeMs: 1_000,
  ownship: {
    id: 'ownship',
    type: EntityType.OWNSHIP,
    label: 'VIPER',
    position: { lat: 34, lon: -118 },
    heading: 0,
    speed: 100,
    targetHeading: 0,
    targetSpeed: 100,
  },
  entities: [],
};

describe('simulation engine', () => {
  it('replays the same scenario deterministically', () => {
    const first = advanceSimulation(setSimulationRunning(createSimulationState(scenario), true), 1_000);
    const second = advanceSimulation(setSimulationRunning(createSimulationState(scenario), true), 1_000);

    expect(first.clock.simTimeMs).toBe(2_000);
    expect(first.ownship).toEqual(second.ownship);
    expect(first.eventLog).toEqual(second.eventLog);
  });

  it('does not move the scenario while paused', () => {
    const initial = createSimulationState(scenario);
    const paused = advanceSimulation(initial, 1_000);

    expect(paused).toEqual(initial);
  });

  it('resets to the exact scenario start state', () => {
    const running = setSimulationRunning(createSimulationState(scenario), true);
    const advanced = advanceSimulation(running, 1_000);

    expect(resetSimulation(advanced)).toEqual(createSimulationState(scenario));
  });
});
