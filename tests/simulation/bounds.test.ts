import { describe, expect, it } from 'vitest';
import { EntityType } from '../../types';
import { advanceSimulation, createSimulationState, setSimulationRunning } from '../../simulation/engine';
import { ScenarioDefinition } from '../../simulation/scenario';

const scenario: ScenarioDefinition = {
  id: 'bounded-scenario',
  name: 'Bounded scenario',
  seed: 8,
  startTimeMs: 0,
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

describe('simulation advance bounds', () => {
  it('limits a single advance to the configured maximum delta', () => {
    const state = advanceSimulation(
      setSimulationRunning(createSimulationState(scenario), true),
      10_000,
    );

    expect(state.clock.simTimeMs).toBeLessThanOrEqual(1_000);
    expect(state.eventLog.at(-1)).toMatchObject({ kind: 'ADVANCED', deltaMs: 1_000 });
  });
});
