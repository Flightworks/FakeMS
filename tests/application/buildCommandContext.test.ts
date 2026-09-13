import { describe, expect, it, vi } from 'vitest';
import {
  buildCommandContext,
  createCommandContextFactory,
} from '../../application/buildCommandContext';
import { EntityType, NavMode, type Entity } from '../../types';
import { getCommands, type CommandContext } from '../../utils/CommandRegistry';
import { createLayerState } from '../../domain/layers';
import { createDeclutterState } from '../../domain/declutter';
import { createGridState } from '../../domain/grid';
import { createTimerState } from '../../domain/simulationTimers';
import { createTrailState } from '../../domain/trackTrails';
import { createDefaultZones } from '../../domain/zones';

const ownship: Entity = {
  id: 'ownship',
  type: EntityType.OWNSHIP,
  label: 'VIPER 1-1',
  position: { lat: 43.1, lon: 5.9 },
  heading: 90,
  speed: 120,
};

const target: Entity = {
  id: 'target-1',
  type: EntityType.ENEMY,
  label: 'HOSTILE 1',
  position: { lat: 43.2, lon: 5.8 },
  heading: 180,
  speed: 80,
};

const createContext = (): CommandContext => ({
  entities: [target],
  ownship,
  systems: { radar: true, adsb: true, ais: false, eots: true },
  setMapMode: vi.fn(),
  toggleSystem: vi.fn(),
  focusMapAt: vi.fn(),
  previewProjection: vi.fn(),
  previewIntersection: vi.fn(),
  previewBullseyeProjection: vi.fn(),
  previewFuturePosition: vi.fn(),
  previewRelativeMotion: vi.fn(),
  proposeDirectTo: vi.fn(),
  proposeRoute: vi.fn(),
  requestMissionAction: vi.fn(),
  history: [{ original: 'DCT HOSTILE 1', canonical: 'DCT HOSTILE 1', timestamp: 100 }],
  openDocument: vi.fn(),
  ownshipNavMode: NavMode.SIM,
  toggleNavMode: vi.fn(),
  groundSpeed: {
    speedKnots: 120,
    source: 'SIMULATION',
    qualification: 'SIMULATED',
    updatedAt: 1000,
  },
  scenarioTimeMs: 1000,
  localTimeZone: 'UTC',
  activeRoute: {
    id: 'route-1',
    label: 'PATROL',
    origin: { lat: 43.1, lon: 5.9 },
    waypoints: [{ id: 'wp-1', label: 'WP 1', position: { lat: 43.2, lon: 5.8 } }],
    remainingWaypointCount: 1,
    hidden: false,
  },
  trails: createTrailState(),
  timerState: createTimerState(),
  createTimer: vi.fn(),
  cancelTimer: vi.fn(),
  simulationStatus: 'RUNNING',
  simulationIsRunning: true,
  simulationTimeMs: 1000,
  simulationSpeed: 1,
  pauseSimulation: vi.fn(),
  resumeSimulation: vi.fn(),
  setSimulationSpeed: vi.fn(() => true),
  requestSimulationReset: vi.fn(),
  requestSimulationReplay: vi.fn(),
  layers: createLayerState(),
  setLayers: vi.fn(),
  declutter: createDeclutterState(),
  setDeclutter: vi.fn(),
  grid: createGridState(),
  setGrid: vi.fn(),
  zones: createDefaultZones(),
  visibleZoneId: 'zone-1',
  setVisibleZone: vi.fn(),
  setRouteVisibility: vi.fn(),
  setTrailVisibility: vi.fn(),
});

describe('buildCommandContext', () => {
  it('creates a complete isolated snapshot for every command entry point', () => {
    const source = createContext();
    const context = buildCommandContext(source);

    expect(context).toMatchObject({
      entities: source.entities,
      ownship: source.ownship,
      systems: source.systems,
      ownshipNavMode: NavMode.SIM,
      groundSpeed: source.groundSpeed,
      scenarioTimeMs: 1000,
      simulationTimeMs: 1000,
      activeRoute: source.activeRoute,
      trails: source.trails,
      timerState: source.timerState,
      previewProjection: source.previewProjection,
      previewIntersection: source.previewIntersection,
      previewBullseyeProjection: source.previewBullseyeProjection,
      previewFuturePosition: source.previewFuturePosition,
      previewRelativeMotion: source.previewRelativeMotion,
    });
    expect(context.history).toEqual(source.history);
    expect(context.entities).not.toBe(source.entities);
    expect(context.ownship).not.toBe(source.ownship);
    expect(context.systems).not.toBe(source.systems);
    expect(context.activeRoute).not.toBe(source.activeRoute);

    context.entities[0].position.lat = 0;
    context.ownship.position.lon = 0;
    context.systems.radar = false;
    expect(source.entities[0].position.lat).toBe(43.2);
    expect(source.ownship.position.lon).toBe(5.9);
    expect(source.systems.radar).toBe(true);
  });

  it('lets palette-local state override the same complete drop snapshot', () => {
    const source = createContext();
    const createContextForEntryPoint = createCommandContextFactory(source);
    const dropContext = createContextForEntryPoint();
    const paletteHistory = [{
      original: 'SIM STATUS',
      canonical: 'SIM STATUS',
      timestamp: 200,
    }];
    const paletteContext = createContextForEntryPoint({ history: paletteHistory });

    expect(paletteContext.history).toEqual(paletteHistory);
    expect(dropContext.history).toEqual(source.history);
    expect(paletteContext.entities).toEqual(dropContext.entities);
    expect(paletteContext.ownship).toEqual(dropContext.ownship);
    expect(paletteContext.groundSpeed).toEqual(dropContext.groundSpeed);
    expect(paletteContext.scenarioTimeMs).toBe(dropContext.scenarioTimeMs);
    expect(paletteContext.activeRoute).toEqual(dropContext.activeRoute);
    expect(paletteContext.timerState).toEqual(dropContext.timerState);
    expect(paletteContext.previewFuturePosition).toBe(dropContext.previewFuturePosition);
  });

  it('marks only explicitly supported interactions as executable gestures', () => {
    const context = buildCommandContext(createContext());
    const dct = getCommands('DCT HOSTILE 1', context)
      .find(command => command.id === 'dct-target-1');
    const readOnly = getCommands('SIM STATUS', context)
      .find(command => command.id === 'sim-status');

    expect(dct).toMatchObject({
      dragDropEligible: true,
      swipeCapable: true,
    });
    expect(readOnly?.dragDropEligible).toBe(false);
    expect(readOnly?.swipeCapable).toBe(false);
  });
});
