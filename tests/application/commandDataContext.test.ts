import { describe, expect, it, vi } from 'vitest';
import { Entity, EntityType, NavMode, SystemStatus } from '../../types';
import { createKinematicsSnapshot, projectKinematicsToEntity } from '../../domain/kinematics';
import { getCommands, type CommandContext } from '../../utils/CommandRegistry';

const systems: SystemStatus = {
  radar: true,
  adsb: true,
  ais: false,
  eots: true,
};

const createContext = () => {
  const sourceOwnship: Entity = {
    id: 'ownship',
    label: 'OWNSHIP',
    type: EntityType.OWNSHIP,
    position: { lat: 0, lon: 0 },
    heading: 90,
    speed: 120,
    metadata: {
      groundTrackDegrees: 0,
      groundSpeedKnots: 10,
      freshness: 'FRESH',
    },
  };
  const sourceTarget: Entity = {
    id: 'target1',
    label: 'TARGET1',
    type: EntityType.ENEMY,
    position: { lat: 0, lon: 1 / 6 },
    heading: 270,
    speed: 120,
    metadata: {
      groundTrackDegrees: 0,
      groundSpeedKnots: 10,
      freshness: 'FRESH',
    },
  };
  const sourceBefore = structuredClone({ sourceOwnship, sourceTarget });
  const ownshipSnapshot = createKinematicsSnapshot(sourceOwnship, {
    source: 'SIMULATION',
    qualification: 'SIMULATED',
    timestampMs: 10_000,
    freshness: 'FRESH',
    ageSeconds: 0,
    allowMetadataVector: false,
  });
  const targetSnapshot = createKinematicsSnapshot(sourceTarget, {
    source: 'SCENARIO',
    qualification: 'SIMULATED',
    timestampMs: 10_000,
    freshness: 'FRESH',
    ageSeconds: 0,
  });
  const ownship = projectKinematicsToEntity(sourceOwnship, ownshipSnapshot);
  const target = projectKinematicsToEntity(sourceTarget, targetSnapshot);
  const previewFuturePosition = vi.fn();
  const previewRelativeMotion = vi.fn();
  const context: CommandContext = {
    entities: [ownship, target],
    ownship,
    systems,
    setMapMode: vi.fn(),
    toggleSystem: vi.fn(),
    focusMapAt: vi.fn(),
    previewFuturePosition,
    previewRelativeMotion,
    proposeDirectTo: vi.fn(),
    proposeRoute: vi.fn(),
    requestMissionAction: vi.fn(),
    history: [],
    openDocument: vi.fn(),
    ownshipNavMode: NavMode.SIM,
    toggleNavMode: vi.fn(),
    groundSpeed: {
      speedKnots: 120,
      source: 'SIMULATION',
      qualification: 'SIMULATED',
      updatedAt: 10_000,
    },
    scenarioTimeMs: 10_000,
    localTimeZone: 'UTC',
  };

  return {
    context,
    sourceOwnship,
    sourceTarget,
    sourceBefore,
    ownship,
    target,
    previewFuturePosition,
    previewRelativeMotion,
  };
};

describe('application command data context', () => {
  it('keeps map-facing vectors, CPA, future position, ETE, and callbacks on one snapshot', () => {
    const fixture = createContext();
    const cpa = getCommands('CPA TARGET1', fixture.context)
      .find(command => command.relativeMotionResult?.status === 'AVAILABLE');
    const future = getCommands('PREDICT TARGET1 +2MIN', fixture.context)
      .find(command => command.futurePositionPreview);
    const ete = getCommands('ETE TARGET1', fixture.context)
      .find(command => command.id === 'ete-target1');

    expect(cpa?.relativeMotionPreview?.result).toMatchObject({
      referencePosition: fixture.ownship.position,
      targetPosition: fixture.target.position,
      status: 'AVAILABLE',
      closureRateKnots: expect.closeTo(240, 5),
      assumption: 'CONSTANT VELOCITY',
    });
    expect(future?.futurePositionPreview).toMatchObject({
      groundTrackDegrees: fixture.target.heading,
      groundSpeedKnots: fixture.target.speed,
      result: expect.objectContaining({
        referencePosition: fixture.target.position,
        projectedRangeNauticalMiles: expect.closeTo(4, 5),
      }),
    });
    expect(ete?.subLabel).toContain('GS: 120.0 KT · SIMULATED');
    expect(ete?.subLabel).toContain('SRC: SIMULATION');

    cpa?.action?.();
    future?.action?.();
    expect(fixture.previewRelativeMotion).toHaveBeenCalledWith(expect.objectContaining({
      command: 'CPA',
      result: expect.objectContaining({ referencePosition: fixture.ownship.position }),
    }));
    expect(fixture.previewFuturePosition).toHaveBeenCalledWith(expect.objectContaining({
      groundTrackDegrees: fixture.target.heading,
      groundSpeedKnots: fixture.target.speed,
    }));
    expect({ sourceOwnship: fixture.sourceOwnship, sourceTarget: fixture.sourceTarget })
      .toEqual(fixture.sourceBefore);
  });

  it('keeps position-only measurements available when a vector is absent', () => {
    const fixture = createContext();
    const positionOnlyTarget: Entity = {
      ...fixture.target,
      heading: undefined,
      speed: undefined,
      metadata: undefined,
    };
    const context = {
      ...fixture.context,
      entities: [fixture.ownship, positionOnlyTarget],
    };

    const range = getCommands('RNG TARGET1', context)
      .find(command => command.id.startsWith('measurement-result-'));
    const future = getCommands('PREDICT TARGET1 +2MIN', context)
      .find(command => command.id.startsWith('future-position-unavailable-'));

    expect(range?.subLabel).toContain('CALCULATED');
    expect(future?.futurePositionResult).toMatchObject({
      status: 'UNAVAILABLE',
      reason: 'MISSING_GROUND_TRACK',
    });
  });
});
