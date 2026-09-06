import { describe, expect, it, vi } from 'vitest';
import { getCommands, type CommandContext } from '../../utils/CommandRegistry';
import { createBullseye } from '../../domain/bullseye';
import { EntityType, NavMode, type Entity } from '../../types';

const ownship: Entity = {
  id: 'ownship',
  label: 'OWNSHIP',
  type: EntityType.FRIENDLY,
  position: { lat: 48, lon: 2 },
  heading: 0,
  speed: 100,
};

const bravo: Entity = {
  id: 'wp-2',
  label: 'BRAVO',
  type: EntityType.WAYPOINT,
  position: { lat: 48, lon: 2.25 },
};

const hostile: Entity = {
  id: 'en-1',
  label: 'HOSTILE 1',
  type: EntityType.ENEMY,
  position: { lat: 48, lon: 1.75 },
};

const createContext = (overrides: Partial<CommandContext> = {}): CommandContext => ({
  entities: [ownship, bravo, hostile],
  ownship,
  systems: { radar: false, adsb: false, ais: false, eots: false },
  setMapMode: vi.fn(),
  toggleSystem: vi.fn(),
  focusMapAt: vi.fn(),
  proposeDirectTo: vi.fn(),
  proposeRoute: vi.fn(),
  requestMissionAction: vi.fn(),
  history: [],
  openDocument: vi.fn(),
  ownshipNavMode: NavMode.REAL,
  toggleNavMode: vi.fn(),
  ...overrides,
});

describe('Bullseye command registry integration', () => {
  it('proposes SET BULL with a copied scenario reference instead of mutating immediately', () => {
    const proposeSetBullseye = vi.fn();
    const context = createContext({ proposeSetBullseye });
    const command = getCommands('SET BULL BRAVO', context)
      .find(option => option.id === 'set-bullseye');

    expect(command).toBeDefined();
    command?.action?.();

    expect(proposeSetBullseye).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SIMULATED_BULLSEYE',
      entityId: 'wp-2',
      label: 'BRAVO',
      source: 'SCENARIO_ENTITY',
      state: 'SET',
    }));
  });

  it('reports a BRG/RNG measurement from the explicit Bullseye without map or mission effects', () => {
    const bullseye = createBullseye(bravo);
    const focusMapAt = vi.fn();
    const requestMissionAction = vi.fn();
    const command = getCommands('BULL HOSTILE 1', createContext({
      bullseye,
      focusMapAt,
      requestMissionAction,
    })).find(option => option.id === 'bull-measure-en-1');

    expect(command).toBeDefined();
    expect(command?.label).toContain('BULL HOSTILE 1');
    expect(command?.subLabel).toContain('BRG:');
    expect(command?.subLabel).toContain('RNG:');
    command?.action?.();

    expect(focusMapAt).not.toHaveBeenCalled();
    expect(requestMissionAction).not.toHaveBeenCalled();
  });

  it('sends BULL bearing/range to a temporary local preview callback', () => {
    const bullseye = createBullseye(bravo);
    const previewBullseyeProjection = vi.fn();
    const focusMapAt = vi.fn();
    const command = getCommands('BULL 270/15', createContext({
      bullseye,
      previewBullseyeProjection,
      focusMapAt,
    })).find(option => option.id === 'bull-projection');

    expect(command).toBeDefined();
    command?.action?.();

    expect(previewBullseyeProjection).toHaveBeenCalledWith(expect.objectContaining({
      type: 'BULLSEYE_PROJECTION_PREVIEW',
      referenceLabel: 'BRAVO',
      bearingDegrees: 270,
      rangeNauticalMiles: 15,
    }));
    expect(focusMapAt).not.toHaveBeenCalled();
  });

  it('proposes CLEAR BULL only when an explicit Bullseye exists', () => {
    const proposeClearBullseye = vi.fn();
    const bullseye = createBullseye(bravo);
    const command = getCommands('CLEAR BULL', createContext({
      bullseye,
      proposeClearBullseye,
    })).find(option => option.id === 'clear-bullseye');

    expect(command).toBeDefined();
    command?.action?.();
    expect(proposeClearBullseye).toHaveBeenCalledTimes(1);

    const absent = getCommands('CLEAR BULL', createContext({
      proposeClearBullseye,
    }));
    expect(absent.some(option => option.id === 'clear-bullseye')).toBe(false);
    expect(absent.some(option => option.label.includes('NO BULLSEYE'))).toBe(true);
  });
});
