import { describe, expect, it } from 'vitest';
import { Entity, EntityType, NavMode } from '../types';
import { getCommands, type CommandContext } from '../utils/CommandRegistry';

const ownship: Entity = {
  id: 'ownship',
  label: 'OWNSHIP',
  type: EntityType.FRIENDLY,
  position: { lat: 0, lon: 0 },
  heading: 0,
  speed: 120,
};

const target: Entity = {
  id: 'target',
  label: 'TARGET',
  type: EntityType.ENEMY,
  position: { lat: 0, lon: 1 },
  heading: 90,
  speed: 60,
};

const context: CommandContext = {
  entities: [ownship, target],
  ownship,
  systems: { radar: false, adsb: false, ais: false, eots: false },
  setMapMode: () => undefined,
  toggleSystem: () => undefined,
  focusMapAt: () => undefined,
  history: [],
  openDocument: () => undefined,
  ownshipNavMode: NavMode.REAL,
  toggleNavMode: () => undefined,
  proposeDirectTo: () => undefined,
  proposeRoute: () => undefined,
  requestMissionAction: () => undefined,
};

describe('T04 timing contract at the command boundary', () => {
  it('keeps ETE available when ETA has no absolute scenario clock', () => {
    const command = getCommands('ETA TARGET', {
      ...context,
      groundSpeed: {
        speedKnots: 60,
        source: 'SIMULATION',
        qualification: 'SIMULATED',
      },
      localTimeZone: 'UTC',
    }).find(candidate => candidate.id === 'eta-target');

    expect(command).toBeDefined();
    expect(command?.subLabel).toContain('ETE:');
    expect(command?.subLabel).toContain('ETA UTC: UNAVAILABLE');
    expect(command?.subLabel).toContain('GS: 60.0 KT · SIMULATED');
  });

  it('formats only finite elapsed simulation time as a T+ duration', () => {
    const elapsed = getCommands('SIM STATUS', {
      ...context,
      simulationStatus: 'RUNNING',
      simulationIsRunning: true,
      simulationTimeMs: 3_500,
    }).find(candidate => candidate.id === 'sim-status');
    expect(elapsed?.subLabel).toContain('SIM T+3s');

    const unavailable = getCommands('SIM STATUS', {
      ...context,
      simulationStatus: 'RUNNING',
      simulationIsRunning: true,
      simulationTimeMs: Number.NaN,
    }).find(candidate => candidate.id === 'sim-status');
    expect(unavailable?.subLabel).not.toContain('SIM T+');
  });
});
