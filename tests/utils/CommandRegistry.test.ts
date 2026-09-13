import { describe, it, expect, vi } from 'vitest';
import { getCommands, CommandContext } from '../../utils/CommandRegistry';
import { createMathCommandProvider } from '../../utils/mathEvaluator';
import { Entity, EntityType, NavMode } from '../../types';
import type { SimulatedDesignation } from '../../domain/designations';
import { createLayerState } from '../../domain/layers';
import { createDeclutterState } from '../../domain/declutter';
import { createGridState } from '../../domain/grid';
import { createDefaultZones } from '../../domain/zones';
import { createTrailState } from '../../domain/trackTrails';
import { translateScenarioPosition } from '../../domain/missionOrigin';

describe('CommandRegistry', () => {
  const mockOwnship: Entity = {
    id: 'ownship',
    label: 'OWNSHIP',
    type: EntityType.FRIENDLY,
    position: { lat: 0, lon: 0 },
    heading: 0,
    speed: 100
  };

  const mockEntities: Entity[] = [
    mockOwnship,
    {
      id: 'target1',
      label: 'TARGET1',
      type: EntityType.ENEMY,
      position: { lat: 10, lon: 10 },
      heading: 90,
      speed: 300
    }
  ];

  const mockContext: CommandContext = {
    entities: mockEntities,
    ownship: mockOwnship,
    systems: {
      radar: false,
      adsb: false,
      ais: false,
      eots: false
    },
    setMapMode: vi.fn(),
    toggleSystem: vi.fn(),
    history: [],
    openDocument: vi.fn(),
    ownshipNavMode: NavMode.REAL,
    toggleNavMode: vi.fn(),
    focusMapAt: vi.fn(),
    proposeDirectTo: vi.fn(),
    proposeRoute: vi.fn(),
    requestMissionAction: vi.fn()
  };

  const pointOne: SimulatedDesignation = {
    type: 'SIMULATED_DESIGNATION',
    id: 'designation-1',
    label: 'P1',
    position: { lat: 10, lon: 10 },
    source: 'PROJECTION_PREVIEW',
  };
  const pointTwo: SimulatedDesignation = {
    type: 'SIMULATED_DESIGNATION',
    id: 'designation-2',
    label: 'ALPHA',
    position: { lat: 11, lon: 11 },
    source: 'PROJECTION_PREVIEW',
  };

  const createPointContext = () => ({
    ...mockContext,
    designations: [pointOne, pointTwo],
    listDesignations: vi.fn(),
    renameDesignation: vi.fn(),
    deleteDesignation: vi.fn(),
    proposeClearDesignations: vi.fn(),
  });

  describe('getCommands', () => {
    it('should generate history commands when query is empty', () => {
      const historyContext = {
        ...mockContext,
        history: [{ id: '1', timestamp: Date.now(), original: 'test command', canonical: 'TEST COMMAND' }]
      };
      const commands = getCommands('', historyContext);

      const historyCmd = commands.find(c => c.isHistory);
      expect(historyCmd).toBeDefined();
      expect(historyCmd?.label).toBe('test command');
    });

    it('should calculate math expressions', () => {
      const commands = getCommands('2 + 2', mockContext, createMathCommandProvider());
      const mathCmd = commands.find(c => c.id === 'calc-result');
      expect(mathCmd).toBeDefined();
      expect(mathCmd?.label).toBe('2 + 2 = 4');
    });

    it('puts the exact cos45 calculation first', () => {
      const commands = getCommands('cos45', mockContext, createMathCommandProvider());

      expect(commands[0]?.id).toBe('calc-result');
    });

    it('should parse coordinate inputs', () => {
      const commands = getCommands('N45E006', mockContext);
      const flyCmd = commands.find(c => c.id === 'fly-to-coords');
      expect(flyCmd).toBeDefined();
    });

    it('should handle entity projections', () => {
      const commands = getCommands('TARGET1 090/10', mockContext);
      const projCmd = commands.find(c => c.id === 'proj-focus');
      expect(projCmd).toBeDefined();
      expect(projCmd?.label).toContain('PROJ: TARGET1');
    });

    it('sends a projection selection to the temporary preview callback', () => {
      const previewProjection = vi.fn();
      const focusMapAt = vi.fn();
      const projectionContext = {
        ...mockContext,
        focusMapAt,
        previewProjection,
      };
      const projection = getCommands('TARGET1 090/10', projectionContext)
        .find(c => c.id === 'proj-focus');

      expect(projection).toBeDefined();
      projection?.action?.();

      expect(previewProjection).toHaveBeenCalledWith(expect.objectContaining({
        type: 'PROJECTION_PREVIEW',
        referenceLabel: 'TARGET1',
        bearingDegrees: 90,
        rangeNauticalMiles: 10,
      }));
      expect(focusMapAt).not.toHaveBeenCalled();
    });

    it('should find system commands', () => {
      const commands = getCommands('radar', mockContext);
      const radarCmd = commands.find(c => c.id === 'sys-radar');
      expect(radarCmd).toBeDefined();
      expect(radarCmd?.label).toBe('RADAR');
    });

    it('should find entities via fuzzy search', () => {
      const commands = getCommands('target', mockContext);
      const targetCmd = commands.find(c => c.id === 'sel-target1');
      expect(targetCmd).toBeDefined();
      expect(targetCmd?.label).toBe('TARGET1');
    });

    it('puts an exact entity selector before fuzzy results', () => {
      const commands = getCommands('TARGET1', mockContext);

      expect(commands[0]?.id).toBe('sel-target1');
    });

    it('creates direct-to commands', () => {
        const commands = getCommands('dct target', mockContext);
        const dctCmd = commands.find(c => c.id === 'dct-target1');
        expect(dctCmd).toBeDefined();
    });

    it('focuses a track without creating a direct-to proposal', () => {
      const focus = getCommands('focus target', mockContext).find(c => c.id === 'focus-target1');
      expect(focus).toBeDefined();
      focus?.action?.();
      expect(mockContext.focusMapAt).toHaveBeenCalledWith({ lat: 10, lon: 10 });
      expect(mockContext.proposeDirectTo).not.toHaveBeenCalled();
    });

    it('keeps map focus separate from direct-to proposals', () => {
      const focusContext = { ...mockContext, focusMapAt: vi.fn() };
      const focus = getCommands('N45E006', focusContext).find(c => c.id === 'fly-to-coords');
      focus?.action?.();

      expect(focusContext.focusMapAt).toHaveBeenCalledWith({ lat: 45, lon: 6 });

      const dctContext = { ...mockContext, proposeDirectTo: vi.fn() };
      const dct = getCommands('dct target', dctContext).find(c => c.id === 'dct-target1');
      dct?.action?.();

      expect(dctContext.proposeDirectTo).toHaveBeenCalledWith(expect.objectContaining({
        id: 'target1',
        label: 'TARGET1',
      }));
    });

    it('keeps route planning and sensor controls out of the command palette', () => {
      const empty = getCommands('', mockContext);
      const entityResults = getCommands('TARGET1', mockContext);
      const explicitPlan = getCommands('PLAN TARGET1', mockContext);
      const explicitSensors = getCommands('AIS EOTS', mockContext);

      expect(empty.some(command => ['sys-ais', 'sys-eots'].includes(command.id))).toBe(false);
      expect(entityResults.some(command => command.id.startsWith('plan-'))).toBe(false);
      expect(explicitPlan.some(command => command.id.startsWith('plan-'))).toBe(false);
      expect(explicitSensors.some(command => ['sys-ais', 'sys-eots'].includes(command.id))).toBe(false);
      expect(mockContext.proposeRoute).not.toHaveBeenCalled();
    });

    it('should create save text fallback for unmatched queries', () => {
        const commands = getCommands('some random text', mockContext);
        const saveCmd = commands.find(c => c.id === 'save-text-note');
        expect(saveCmd).toBeDefined();
        expect(saveCmd?.label).toBe('SAVE: "some random text"');
    });

    it('renders distinct ETA and ETE results from qualified simulation speed', () => {
      const context = {
        ...mockContext,
        groundSpeed: {
          speedKnots: 120,
          source: 'SIMULATION' as const,
          qualification: 'SIMULATED' as const,
          updatedAt: 1_735_732_800_000,
        },
        scenarioTimeMs: 1_735_732_800_000,
        localTimeZone: 'UTC',
      };

      const eta = getCommands('ETA TARGET1', context).find(command => command.id === 'eta-target1');
      const ete = getCommands('ETE TARGET1', context).find(command => command.id === 'ete-target1');

      expect(eta).toBeDefined();
      expect(eta?.label).toBe('ETA TARGET1');
      expect(eta?.subLabel).toContain('ETE:');
      expect(eta?.subLabel).toContain('ETA UTC:');
      expect(eta?.subLabel).toContain('ETA LOCAL (UTC):');
      expect(eta?.subLabel).toContain('GS: 120.0 KT · SIMULATED');
      expect(ete).toBeDefined();
      expect(ete?.label).toBe('ETE TARGET1');
    });

    it('uses an explicit ETA speed assumption and exposes unavailable speed honestly', () => {
      const assumed = getCommands('ETA TARGET1 @ 140KT', {
        ...mockContext,
        scenarioTimeMs: 1_735_732_800_000,
        localTimeZone: 'UTC',
      }).find(command => command.id === 'eta-target1');
      expect(assumed?.subLabel).toContain('GS: 140.0 KT · USER_ASSUMPTION');

      const unavailable = getCommands('ETA TARGET1', {
        ...mockContext,
        scenarioTimeMs: 1_735_732_800_000,
      }).find(command => command.id === 'eta-target1');
      expect(unavailable).toBeDefined();
      expect(unavailable?.subLabel).toContain('ETA UTC: UNAVAILABLE');
      expect(unavailable?.subLabel).toContain('SPEED_UNAVAILABLE');
    });

    it('does not select an unrelated fuzzy command for an ETA query', () => {
      const commands = getCommands('ETA TARGET1', mockContext);

      expect(commands[0]?.id).toBe('eta-target1');
      expect(commands[0]?.id).not.toBe('save-text-note');
    });

    it('returns only the exact ETE result for a recognized ETE query', () => {
      const commands = getCommands('ETE TARGET1', mockContext);

      expect(commands).toHaveLength(1);
      expect(commands[0]?.id).toBe('ete-target1');
      expect(commands.some(command => command.id === 'save-text-note')).toBe(false);
      expect(commands.some(command => command.id.startsWith('dct-'))).toBe(false);
      expect(commands.some(command => command.id.startsWith('sys-'))).toBe(false);
    });

    it('keeps the implicit-ownship CPA label target-focused when motion is unavailable', () => {
      const commands = getCommands('CPA TARGET1', mockContext);

      expect(commands).toHaveLength(1);
      expect(commands[0]?.label).toBe('CPA TARGET1: UNAVAILABLE');
      expect(commands[0]?.id).toBe('relative-cpa-unavailable-TARGET1');
    });

    it('keeps incomplete and unknown ETE input typed, non-executable, and isolated', () => {
      const incomplete = getCommands('ETE', mockContext);
      expect(incomplete).toHaveLength(1);
      expect(incomplete[0]?.result).toMatchObject({
        state: 'INCOMPLETE',
        kind: 'READ_ONLY',
        reason: { code: 'INPUT_INCOMPLETE' },
      });
      expect(incomplete[0]?.action).toBeUndefined();

      const unknown = getCommands('ETE NOT_PRESENT', mockContext);
      expect(unknown).toHaveLength(1);
      expect(unknown[0]?.label).not.toContain('UNKNOWN_REFERENCE');
      expect(unknown[0]?.result).toMatchObject({
        state: 'UNAVAILABLE',
        reason: {
          code: 'REFERENCE_UNKNOWN',
          rawCode: 'UNKNOWN_REFERENCE',
          remedy: expect.any(String),
        },
      });
      expect(unknown[0]?.action).toBeUndefined();
    });

    it('solves TIME, DIST, and GS locally without changing the map', () => {
      const focusMapAt = vi.fn();
      const context = { ...mockContext, focusMapAt };

      const time = getCommands('TIME 45NM @ 120KT', context).find(command => command.id === 'tds-time');
      const distance = getCommands('DIST 15MIN @ 120KT', context).find(command => command.id === 'tds-dist');
      const speed = getCommands('GS 40NM / 20MIN', context).find(command => command.id === 'tds-gs');

      expect(time?.label).toBe('TIME: 22 min 30 s');
      expect(time?.subLabel).toContain('DIST: 45.0 NM');
      expect(time?.subLabel).toContain('GS: 120.0 KT');
      expect(distance?.label).toBe('DIST: 30.0 NM');
      expect(distance?.subLabel).toContain('TIME: 15 min 0 s');
      expect(speed?.label).toBe('GS: 120.0 KT');
      expect(speed?.subLabel).toContain('DIST: 40.0 NM');
      expect(focusMapAt).not.toHaveBeenCalled();
    });

    it('blocks a time-distance-speed command with a missing unit', () => {
      const commands = getCommands('TIME 45 @ 120KT', mockContext);

      expect(commands.some(command => command.id === 'tds-time')).toBe(false);
      expect(commands.some(command => command.id === 'save-text-note')).toBe(true);
    });


    it('puts an exact projection first and excludes unrelated fallbacks', () => {
      const bravoContext = {
        ...mockContext,
        entities: [
          mockOwnship,
          {
            ...mockEntities[1],
            id: 'bravo',
            label: 'BRAVO',
          },
        ],
      };
      const commands = getCommands('BRAVO 180/5', bravoContext);

      expect(commands[0]?.id).toBe('proj-focus');
      expect(commands.some(command => command.id === 'save-text-note')).toBe(false);
      expect(commands.some(command => command.id.startsWith('sys-'))).toBe(false);
    });

    it('puts an exact coordinate action before copy and save fallbacks', () => {
      const commands = getCommands('N45E006', mockContext);

      expect(commands[0]?.id).toBe('fly-to-coords');
    });

    it('lists confirmed designated points through the list intent callback', () => {
      const context = createPointContext();
      const list = getCommands('LIST POINTS', context).find(command => command.id === 'list-points');

      expect(list).toBeDefined();
      expect(list?.label).toBe('LIST POINTS');
      list?.action?.();

      expect(context.listDesignations).toHaveBeenCalledOnce();
    });

    it('focuses a designated point without proposing a route', () => {
      const focusMapAt = vi.fn();
      const proposeDirectTo = vi.fn();
      const context = {
        ...createPointContext(),
        focusMapAt,
        proposeDirectTo,
      };
      const focus = getCommands('FOCUS P1', context).find(command => command.id === 'focus-point-designation-1');

      expect(focus).toBeDefined();
      focus?.action?.();

      expect(focusMapAt).toHaveBeenCalledWith({ lat: 10, lon: 10 });
      expect(proposeDirectTo).not.toHaveBeenCalled();
    });

    it('renames a designated point through its intent callback', () => {
      const context = createPointContext();
      const rename = getCommands('RENAME P1 ALPHA', context)
        .find(command => command.id === 'rename-point-designation-1');

      expect(rename).toBeDefined();
      rename?.action?.();

      expect(context.renameDesignation).toHaveBeenCalledWith('designation-1', 'ALPHA');
    });

    it('deletes a designated point through its intent callback', () => {
      const context = createPointContext();
      const deletion = getCommands('DELETE alpha', context)
        .find(command => command.id === 'delete-point-designation-2');

      expect(deletion).toBeDefined();
      deletion?.action?.();

      expect(context.deleteDesignation).toHaveBeenCalledWith('designation-2');
    });

    it('proposes clear points instead of clearing immediately', () => {
      const context = createPointContext();
      const clear = getCommands('CLEAR POINTS', context).find(command => command.id === 'clear-points');

      expect(clear).toBeDefined();
      clear?.action?.();

      expect(context.proposeClearDesignations).toHaveBeenCalledOnce();
      expect(context.designations).toHaveLength(2);
    });

    it('lists ambiguous projection candidates without creating a projection action', () => {
      const context = {
        ...mockContext,
        entities: [
          mockOwnship,
          {
            ...mockEntities[1],
            id: 'hostile-1',
            label: 'HOSTILE 1',
          },
          {
            ...mockEntities[1],
            id: 'hostile-2',
            label: 'HOSTILE 2',
            position: { lat: 11, lon: 11 },
          },
        ],
        previewProjection: vi.fn(),
      };

      const commands = getCommands('HOSTILE 180/5', context);

      expect(commands.find(command => command.id === 'proj-focus')).toBeUndefined();
      expect(commands.some(command => command.label.length > 0)).toBe(true);
      expect(commands.some(command => command.label.includes('AMBIGUOUS_REFERENCE'))).toBe(true);
      expect(commands.filter(command => command.id.startsWith('proj-reference-candidate-'))).toHaveLength(2);
      expect(commands.every(command => command.action === undefined)).toBe(true);
      expect(commands[1]?.subLabel).toMatch(/ENEMY|id=|NM/);
      expect(context.previewProjection).not.toHaveBeenCalled();
    });

    it('requires explicit candidate selection before a projection is executable', () => {
      const previewProjection = vi.fn();
      const context = {
        ...mockContext,
        entities: [
          mockOwnship,
          {
            ...mockEntities[1],
            id: 'hostile-1',
            label: 'HOSTILE 1',
          },
          {
            ...mockEntities[1],
            id: 'hostile-2',
            label: 'HOSTILE 2',
            position: { lat: 11, lon: 11 },
          },
        ],
        previewProjection,
      };
      const ambiguous = getCommands('HOSTILE 180/5', context);
      const candidate = ambiguous.find(command => command.id === 'proj-reference-candidate-hostile-1');

      expect(candidate).toBeDefined();
      expect(candidate?.action).toBeUndefined();
      expect(candidate?.autocompleteValue).toMatch(/^PROJ hostile-1 180\/5/);

      const selected = getCommands(candidate?.autocompleteValue ?? '', context)
        .find(command => command.id === 'proj-focus');
      expect(selected).toBeDefined();
      selected?.action?.();
      expect(previewProjection).toHaveBeenCalledOnce();
    });

    it('shows a fuzzy projection suggestion but never executes it automatically', () => {
      const previewProjection = vi.fn();
      const context = {
        ...mockContext,
        entities: [
          mockOwnship,
          {
            ...mockEntities[1],
            id: 'bravo',
            label: 'BRAVO',
          },
        ],
        previewProjection,
      };

      const commands = getCommands('BRAVX 180/5', context);

      expect(commands.find(command => command.id === 'proj-focus')).toBeUndefined();
      expect(commands.some(command => command.label.includes('FUZZY_SUGGESTION'))).toBe(true);
      expect(commands.find(command => command.id === 'proj-reference-candidate-bravo')?.autocompleteValue)
        .toMatch(/^PROJ bravo 180\/5/);
      expect(context.previewProjection).not.toHaveBeenCalled();
    });

    it('keeps exact DCT and FOCUS commands available with projection reference resolution', () => {
      const context = {
        ...mockContext,
        entities: [
          mockOwnship,
          {
            ...mockEntities[1],
            id: 'hostile-1',
            label: 'HOSTILE 1',
          },
          {
            ...mockEntities[1],
            id: 'hostile-2',
            label: 'HOSTILE 2',
            position: { lat: 11, lon: 11 },
          },
        ],
      };

      expect(getCommands('dct hostile-1', context).find(command => command.id === 'dct-hostile-1')).toBeDefined();
      expect(getCommands('focus hostile-1', context).find(command => command.id === 'focus-hostile-1')).toBeDefined();
    });

    it('shows calculated BRG/RNG measurements without a mission action', () => {
      const context = {
        ...mockContext,
        proposeDirectTo: vi.fn(),
        proposeRoute: vi.fn(),
      };
      const commands = getCommands('BRG/RNG TARGET1', context);
      const measurement = commands.find(command => command.id.startsWith('measurement-'));

      expect(measurement).toBeDefined();
      expect(measurement?.label).toContain('BRG/RNG');
      expect(measurement?.subLabel).toContain('TARGET1');
      expect(measurement?.subLabel).toContain('ENTITY_POSITIONS');
      expect(measurement?.subLabel).toContain('CALCULATED');
      expect(measurement?.isPreview).toBe(true);
      expect(context.proposeDirectTo).not.toHaveBeenCalled();
      expect(context.proposeRoute).not.toHaveBeenCalled();
    });

    it('supports single BRG and RNG measurements from the ownship', () => {
      for (const input of ['BRG TARGET1', 'RNG TARGET1']) {
        const measurement = getCommands(input, mockContext)
          .find(command => command.id.startsWith('measurement-'));

        expect(measurement, input).toBeDefined();
        expect(measurement?.subLabel, input).toContain('OWNSHIP');
        expect(measurement?.subLabel, input).toContain('TARGET1');
      }
    });

    it('blocks an ambiguous measurement reference instead of calculating it', () => {
      const context = {
        ...mockContext,
        entities: [
          mockOwnship,
          { ...mockEntities[1], id: 'bravo-1', label: 'BRAVO' },
          { ...mockEntities[1], id: 'bravo-2', label: 'BRAVO', position: { lat: 11, lon: 11 } },
        ],
      };
      const commands = getCommands('RNG BRAVO', context);

      expect(commands.some(command => command.result?.state === 'AMBIGUOUS')).toBe(true);
      expect(commands.filter(command => command.id.startsWith('measurement-result-'))).toHaveLength(0);
    });

    it('offers UNDO LAST DESIGNATION as a local command', () => {
      const undoLastDesignation = vi.fn();
      const context = {
        ...createPointContext(),
        undoLastDesignation,
      };

      const command = getCommands('UNDO LAST DESIGNATION', context)
        .find(candidate => candidate.id === 'undo-last-designation');

      expect(command).toBeDefined();
      command?.action?.();
      expect(undoLastDesignation).toHaveBeenCalledOnce();
      expect(context.proposeClearDesignations).not.toHaveBeenCalled();
    });

    it('reports the absence of an active simulated route', () => {
      const command = getCommands('ROUTE STATUS', mockContext)
        .find(candidate => candidate.id === 'route-status');

      expect(command?.label).toBe('ROUTE STATUS: NO ACTIVE SIM ROUTE');
      expect(command?.subLabel).toContain('READ-ONLY SIMULATION STATE');
    });

    it('summarizes an active hidden route without focusing or changing the map', () => {
      const focusMapAt = vi.fn();
      const context = {
        ...mockContext,
        focusMapAt,
        activeRoute: {
          id: 'route-alpha',
          label: 'ALPHA ROUTE',
          origin: { lat: 0, lon: 0 },
          waypoints: [
            { id: 'wp-1', label: 'BRAVO', position: { lat: 0.1, lon: 0 } },
            { id: 'wp-2', label: 'CHARLIE', position: { lat: 0.2, lon: 0 } },
          ],
          remainingWaypointCount: 2,
          hidden: true,
        },
        groundSpeed: {
          speedKnots: 120,
          source: 'SIMULATION' as const,
          qualification: 'SIMULATED' as const,
        },
        scenarioTimeMs: 1_000,
      };

      const status = getCommands('ROUTE STATUS', context).find(candidate => candidate.id === 'route-status');
      const leg = getCommands('LEG', context).find(candidate => candidate.id === 'route-leg');
      const next = getCommands('NEXT', context).find(candidate => candidate.id === 'route-next');
      const ete = getCommands('ROUTE ETE', context).find(candidate => candidate.id === 'route-ete');

      expect(status?.label).toBe('ROUTE STATUS: ALPHA ROUTE');
      expect(status?.subLabel).toContain('HIDDEN');
      expect(status?.subLabel).toContain('BRANCH 1/2');
      expect(status?.subLabel).toContain('NEXT: BRAVO');
      expect(leg?.label).toBe('LEG 1/2');
      expect(next?.label).toBe('NEXT: BRAVO');
      expect(ete?.label).toContain('ROUTE ETE:');
      expect(status?.subLabel).toContain('ETA UTC:');
      status?.action?.();
      expect(focusMapAt).not.toHaveBeenCalled();
    });

    it('lists nearest entities with read-only focus actions and explicit metadata', () => {
      const focusMapAt = vi.fn();
      const proposeDirectTo = vi.fn();
      const proposeRoute = vi.fn();
      const context = {
        ...mockContext,
        focusMapAt,
        proposeDirectTo,
        proposeRoute,
        entities: [
          mockOwnship,
          {
            id: 'wp-far',
            label: 'FAR',
            type: EntityType.WAYPOINT,
            position: { lat: 0.2, lon: 0 },
          },
          {
            id: 'wp-near',
            label: 'NEAR',
            type: EntityType.WAYPOINT,
            position: { lat: 0.1, lon: 0 },
            metadata: { quality: 'GOOD', source: 'SCENARIO', uncertaintyMeters: 10 },
          },
          {
            id: 'airport',
            label: 'AIRPORT',
            type: EntityType.AIRPORT,
            position: { lat: 0.01, lon: 0 },
          },
        ],
        measurementPositionFreshness: entity => entity.id === 'wp-near' ? 'CURRENT' : 'UNKNOWN',
      };

      const commands = getCommands('NEAREST 2 WAYPOINTS', context);
      const nearest = commands.filter(command => command.id.startsWith('nearest-result-'));

      expect(nearest.map(command => command.label)).toEqual(['NEAR', 'FAR']);
      expect(nearest[0]?.subLabel).toContain('RNG:');
      expect(nearest[0]?.subLabel).toContain('BRG:');
      expect(nearest[0]?.subLabel).toContain('FRESHNESS: CURRENT');
      expect(nearest[0]?.subLabel).toContain('QUALITY: GOOD');
      nearest[0]?.action?.();
      expect(focusMapAt).toHaveBeenCalledWith({ lat: 0.1, lon: 0 });
      expect(proposeDirectTo).not.toHaveBeenCalled();
      expect(proposeRoute).not.toHaveBeenCalled();
    });

    it('preserves nearest result cardinality and distance ordering for an exact list query', () => {
      const context = {
        ...mockContext,
        entities: [
          mockOwnship,
          { id: 'wp-far', label: 'FAR', type: EntityType.WAYPOINT, position: { lat: 0.2, lon: 0 } },
          { id: 'wp-near', label: 'NEAR', type: EntityType.WAYPOINT, position: { lat: 0.1, lon: 0 } },
          { id: 'wp-mid', label: 'MID', type: EntityType.WAYPOINT, position: { lat: 0.15, lon: 0 } },
        ],
      };
      const commands = getCommands('NEAREST 2 WAYPOINTS', context);
      const nearest = commands.filter(command => command.id.startsWith('nearest-result-'));

      expect(nearest).toHaveLength(2);
      expect(nearest.map(command => command.label)).toEqual(['NEAR', 'MID']);
      expect(commands).toHaveLength(2);
      expect(commands.some(command => command.id === 'save-text-note')).toBe(false);
    });

    it('blocks nearest searches when the reference is ambiguous', () => {
      const context = {
        ...mockContext,
        entities: [
          mockOwnship,
          { ...mockEntities[1], id: 'bravo-1', label: 'BRAVO', position: { lat: 1, lon: 1 } },
          { ...mockEntities[1], id: 'bravo-2', label: 'BRAVO', position: { lat: 2, lon: 2 } },
          { id: 'wp-1', label: 'WP1', type: EntityType.WAYPOINT, position: { lat: 0.1, lon: 0 } },
        ],
      };

      const commands = getCommands('NEAREST BRAVO WAYPOINT', context);

      expect(commands.some(command => command.label.includes('AMBIGUOUS_REFERENCE'))).toBe(true);
      expect(commands.filter(command => command.id.startsWith('nearest-result-'))).toHaveLength(0);
    });

    it('formats a referenced position and a literal coordinate locally', () => {
      const context = {
        ...mockContext,
        entities: [
          mockOwnship,
          { ...mockEntities[1], id: 'bravo', label: 'BRAVO', type: EntityType.WAYPOINT },
        ],
      };

      const referenced = getCommands('COORD BRAVO DDM', context)
        .find(command => command.id === 'coord-format-bravo-ddm');
      expect(referenced?.label).toBe("COORD BRAVO: N10°00.00' E010°00.00'");
      expect(referenced?.subLabel).toContain('LOCAL DISPLAY');
      expect(referenced?.subLabel).toContain("ROUNDING: 0.01'");

      const literal = getCommands('COORD 34.08,-118.15 DMS', context)
        .find(command => command.id === 'coord-literal-dms');
      expect(literal?.label).toBe('COORD: N34°04\'48.0" W118°09\'00.0"');
      expect(literal?.subLabel).toContain('ROUNDING: 0.1"');
    });

    it('offers COPY POS without claiming clipboard success', () => {
      const copy = getCommands('COPY POS TARGET1', mockContext)
        .find(command => command.id === 'copy-pos-target1');

      expect(copy?.label).toBe('COPY POS TARGET1: 10.00000, 10.00000');
      expect(copy?.subLabel).toContain('LOCAL CLIPBOARD');
      expect(copy?.subLabel).toContain('ROUNDING: 0.00001°');
      expect(() => copy?.action?.()).not.toThrow();
    });

    it('reports an invalid resolved reference position without throwing', () => {
      const context = {
        ...mockContext,
        entities: [
          mockOwnship,
          { id: 'broken', label: 'BROKEN', type: EntityType.WAYPOINT, position: { lat: Number.NaN, lon: 0 } },
          { id: 'wp-1', label: 'WP1', type: EntityType.WAYPOINT, position: { lat: 0.1, lon: 0 } },
        ],
      };

      const commands = getCommands('NEAREST BROKEN WAYPOINT', context);

      expect(commands.some(command => command.label.includes('INVALID_REFERENCE_POSITION'))).toBe(true);
      expect(commands.filter(command => command.id.startsWith('nearest-result-'))).toHaveLength(0);
    });

    it('offers a local bearing intersection with both legs and no navigation side effect', () => {
      const previewIntersection = vi.fn();
      const context = {
        ...mockContext,
        entities: [
          mockOwnship,
          { id: 'bravo', label: 'BRAVO', type: EntityType.WAYPOINT, position: { lat: 0, lon: 0 } },
          { id: 'g01', label: 'G01', type: EntityType.WAYPOINT, position: { lat: 1, lon: 1 } },
        ],
        previewIntersection,
        proposeDirectTo: vi.fn(),
        proposeRoute: vi.fn(),
      };

      const intersection = getCommands('INT BRAVO/090 G01/180', context)
        .find(command => command.id === 'intersection-bravo-g01');

      expect(intersection?.label).toContain('INT BRAVO/090 G01/180');
      expect(intersection?.label).toContain('0.00000, 1.00000');
      expect(intersection?.subLabel).toContain('BRAVO');
      expect(intersection?.subLabel).toContain('G01');
      expect(intersection?.subLabel).toContain('QUALITY: GOOD');
      intersection?.action?.();
      expect(previewIntersection).toHaveBeenCalledOnce();
      expect(context.proposeDirectTo).not.toHaveBeenCalled();
      expect(context.proposeRoute).not.toHaveBeenCalled();
    });

    it('blocks a weak bearing intersection instead of offering confirmation', () => {
      const context = {
        ...mockContext,
        entities: [
          mockOwnship,
          { id: 'bravo', label: 'BRAVO', type: EntityType.WAYPOINT, position: { lat: 0, lon: 0 } },
          { id: 'g01', label: 'G01', type: EntityType.WAYPOINT, position: { lat: 0.05, lon: 1 } },
        ],
        proposeDirectTo: vi.fn(),
        proposeRoute: vi.fn(),
      };

      const commands = getCommands('INT BRAVO/090 G01/090.5', context);

      expect(commands.some(command => command.label.includes('GEOMETRY WEAK'))).toBe(true);
      expect(commands.filter(command => command.id === 'intersection-bravo-g01')).toHaveLength(0);
      expect(context.proposeDirectTo).not.toHaveBeenCalled();
      expect(context.proposeRoute).not.toHaveBeenCalled();
    });

    it('offers local reciprocal and delta results without mission side effects', () => {
      const reciprocal = getCommands('RECIP 273', mockContext)
        .find(command => command.id === 'angular-reciprocal');
      expect(reciprocal?.label).toContain('093°');
      expect(reciprocal?.subLabel).toContain('HEADING');

      const delta = getCommands('DELTA 350 010', mockContext)
        .find(command => command.id === 'angular-delta');
      expect(delta?.label).toContain('RIGHT 20°');
      expect(delta?.subLabel).toContain('HEADING');
      expect(mockContext.requestMissionAction).not.toHaveBeenCalled();
    });

    it('offers relative bearing only when the observer heading is available', () => {
      const relative = getCommands('REL TARGET1', mockContext)
        .find(command => command.id === 'angular-relative-target1');
      expect(relative?.label).toContain('REL TARGET1');
      expect(relative?.subLabel).toContain('RELATIVE_BEARING');

      const unavailableContext = {
        ...mockContext,
        entities: [
          mockOwnship,
          { id: 'no-heading', label: 'NOHDG', type: EntityType.WAYPOINT, position: { lat: 5, lon: 5 }, heading: undefined },
          { ...mockEntities[1], heading: 90 },
        ],
      };
      const unavailable = getCommands('REL NOHDG TARGET1', unavailableContext);
      expect(unavailable.some(command => command.label.includes('UNAVAILABLE'))).toBe(true);
    });

    it('offers a bounded future-position preview only from explicit ground-track metadata', () => {
      const previewFuturePosition = vi.fn();
      const context = {
        ...mockContext,
        entities: [
          mockOwnship,
          {
            ...mockEntities[1],
            heading: undefined,
            speed: undefined,
            metadata: {
              groundTrackDegrees: 90,
              groundSpeedKnots: 120,
              freshness: 'FRESH',
              ageSeconds: 4,
            },
          },
        ],
        previewFuturePosition,
        scenarioTimeMs: 10_000,
      };

      const prediction = getCommands('PREDICT TARGET1 +2MIN', context)
        .find(command => command.id === 'future-position-target1');
      expect(prediction?.label).toContain('PREDICT TARGET1 +2MIN');
      expect(prediction?.subLabel).toContain('4.0 NM');
      expect(prediction?.subLabel).toContain('AGE: 4 S');
      expect(prediction?.subLabel).toContain('CONSTANT GROUND TRACK / GROUND SPEED');
      expect(prediction?.isPreview).toBe(true);
      prediction?.action?.();
      expect(previewFuturePosition).toHaveBeenCalledOnce();
      expect(mockContext.requestMissionAction).not.toHaveBeenCalled();

      const unavailableContext = {
        ...mockContext,
        entities: [mockOwnship, { ...mockEntities[1], heading: undefined, speed: undefined }],
      };
      const unavailable = getCommands('PREDICT TARGET1 +2MIN', unavailableContext);
      expect(unavailable.some(command => command.label.includes('UNAVAILABLE'))).toBe(true);
      expect(mockContext.requestMissionAction).not.toHaveBeenCalled();
    });

    it('offers closure and CPA as local calculations without navigation side effects', () => {
      const previewRelativeMotion = vi.fn();
      const ownship = {
        ...mockOwnship,
        metadata: {
          groundTrackDegrees: 90,
          groundSpeedKnots: 60,
          freshness: 'FRESH',
        },
      };
      const bravo = {
        ...mockEntities[1],
        label: 'BRAVO',
        position: { lat: 0, lon: 0.1 },
        metadata: {
          groundTrackDegrees: 270,
          groundSpeedKnots: 60,
          freshness: 'FRESH',
        },
      };
      const g01 = {
        ...mockEntities[1],
        id: 'g01',
        label: 'G01',
        position: { lat: 0.1, lon: 0 },
        metadata: {
          groundTrackDegrees: 180,
          groundSpeedKnots: 30,
          freshness: 'FRESH',
        },
      };
      const context = {
        ...mockContext,
        ownship,
        ownshipNavMode: NavMode.SIM,
        entities: [ownship, bravo, g01],
        previewRelativeMotion,
        requestMissionAction: vi.fn(),
        proposeDirectTo: vi.fn(),
        proposeRoute: vi.fn(),
      };

      const closure = getCommands('CLOSURE BRAVO', context)
        .find(command => command.id === 'relative-closure-target1');
      expect(closure?.label).toContain('CLOSURE BRAVO');
      expect(closure?.subLabel).toContain('CLOSURE:');
      closure?.action?.();
      expect(previewRelativeMotion).toHaveBeenCalledWith(expect.objectContaining({
        command: 'CLOSURE',
        result: expect.objectContaining({ status: 'AVAILABLE' }),
      }));

      const cpa = getCommands('CPA G01 BRAVO', context)
        .find(command => command.id === 'relative-cpa-g01-target1');
      expect(cpa?.label).toContain('CPA G01 BRAVO');
      expect(cpa?.subLabel).toContain('TCPA:');
      expect(cpa?.subLabel).toContain('CONSTANT VELOCITY');
      cpa?.action?.();
      expect(previewRelativeMotion).toHaveBeenCalledWith(expect.objectContaining({
        command: 'CPA',
        result: expect.objectContaining({ status: 'AVAILABLE' }),
      }));
      expect(context.requestMissionAction).not.toHaveBeenCalled();
      expect(context.proposeDirectTo).not.toHaveBeenCalled();
      expect(context.proposeRoute).not.toHaveBeenCalled();
    });

    it('exposes explicit track details and stale ordering without mission effects', () => {
      const ownship = {
        ...mockOwnship,
        metadata: {
          source: 'RADAR',
          freshness: 'FRESH',
          ageSeconds: 4,
          quality: 'GOOD',
          uncertaintyMeters: 40,
          classification: 'SUSPECT',
          confidence: 0.7,
        },
      };
      const older = {
        ...mockEntities[1],
        id: 'older',
        label: 'OLDER',
        metadata: {
          source: 'RADAR',
          freshness: 'STALE',
          ageSeconds: 120,
          quality: 'DEGRADED',
          uncertaintyMeters: 250,
          classification: 'HOSTILE',
          confidence: 0.8,
        },
      };
      const old = {
        ...mockEntities[1],
        id: 'old',
        label: 'OLD',
        metadata: { freshness: 'STALE', ageSeconds: 90 },
      };
      const context = {
        ...mockContext,
        ownship,
        entities: [ownship, { ...mockEntities[1], label: 'BRAVO', metadata: ownship.metadata }, older, old],
        requestMissionAction: vi.fn(),
      };

      const info = getCommands('INFO BRAVO', context).find(command => command.id === 'track-info-target1');
      expect(info?.subLabel).toContain('SOURCE: RADAR');
      expect(info?.subLabel).toContain('AGE: 4 S');
      expect(info?.subLabel).toContain('FRESHNESS: FRESH');
      expect(info?.subLabel).toContain('QUALITY: GOOD');
      expect(info?.subLabel).toContain('UNCERTAINTY: 40 M');
      expect(info?.subLabel).toContain('CLASSIFICATION: SUSPECT');
      expect(info?.subLabel).toContain('CONFIDENCE: 70%');

      const age = getCommands('AGE BRAVO', context).find(command => command.id === 'track-age-target1');
      expect(age?.subLabel).toContain('AGE: 4 S');
      const quality = getCommands('QUALITY BRAVO', context).find(command => command.id === 'track-quality-target1');
      expect(quality?.subLabel).toContain('QUALITY: GOOD');

      const stale = getCommands('STALE', context).find(command => command.id === 'track-stale');
      expect(stale?.subLabel).toContain('OLDER');
      expect(stale?.subLabel.indexOf('OLDER AGE')).toBeLessThan(stale?.subLabel.indexOf('OLD AGE'));
      expect(context.requestMissionAction).not.toHaveBeenCalled();
    });

    it('offers local scenario timers without automatic actions', () => {
      const createTimer = vi.fn();
      const cancelTimer = vi.fn();
      const context = {
        ...mockContext,
        createTimer,
        cancelTimer,
        timerState: {
          timers: [{
            id: 1,
            label: 'CHECK BRAVO',
            checkReference: 'BRAVO',
            createdAtSimTimeMs: 1_000,
            dueAtSimTimeMs: 301_000,
            status: 'ACTIVE' as const,
          }],
          events: [],
          nextId: 2,
        },
        scenarioTimeMs: 10_000,
      };

      const timer = getCommands('TIMER 5MIN CHECK BRAVO', context)
        .find(command => command.id === 'timer-create');
      expect(timer?.label).toContain('TIMER +5MIN');
      expect(timer?.subLabel).toContain('CHECK BRAVO');
      timer?.action?.();
      expect(createTimer).toHaveBeenCalledWith(300_000, 'CHECK BRAVO', 'BRAVO');

      const list = getCommands('TIMERS', context).find(command => command.id === 'timer-list');
      expect(list?.subLabel).toContain('CHECK BRAVO');

      const cancel = getCommands('CANCEL TIMER 1', context)
        .find(command => command.id === 'timer-cancel-1');
      expect(cancel?.subLabel).toContain('CHECK BRAVO');
      cancel?.action?.();
      expect(cancelTimer).toHaveBeenCalledWith(1);
      expect(context.requestMissionAction).not.toHaveBeenCalled();
    });

    it('offers explicit unit conversions as local calculations', () => {
      for (const input of [
        '5NM > KM',
        '5NM>KM',
        '5 NM > KM',
        '5 NM>KM',
        '5 NAUTICAL MILES > KM',
        'CONVERT 5 MN > KM',
        'CONVERT 5NM>KM',
      ]) {
        const conversion = getCommands(input, mockContext)
          .find(command => command.id === 'unit-conversion');
        expect(conversion?.label, input).toContain('5 NM');
        expect(conversion?.subLabel, input).toContain('9.260 KM');
        expect(conversion?.subLabel, input).toContain('CALCULATION ONLY');
        expect(conversion?.isPreview, input).toBe(true);
      }

      const incompatible = getCommands('5NM > KT', mockContext)
        .find(command => command.id === 'unit-conversion-unavailable');
      expect(incompatible?.label).toContain('UNAVAILABLE');
      expect(incompatible?.subLabel).toContain('INCOMPATIBLE UNITS');
      expect(mockContext.requestMissionAction).not.toHaveBeenCalled();
    });

    it('offers local favorites as fill-only entries without mission effects', () => {
      const addFavorite = vi.fn();
      const removeFavorite = vi.fn();
      const favoriteState = {
        version: 1 as const,
        nextId: 2,
        items: [{ id: 1, kind: 'COMMAND' as const, label: 'ETA BRAVO', command: 'ETA BRAVO' }],
      };
      const context = {
        ...mockContext,
        favoriteState,
        addFavorite,
        removeFavorite,
      };

      const pin = getCommands('PIN ETA BRAVO', context).find(command => command.id === 'favorite-pin');
      expect(pin?.subLabel).toContain('LOCAL FAVORITE');
      pin?.action?.();
      expect(addFavorite).toHaveBeenCalledWith({ kind: 'COMMAND', label: 'ETA BRAVO', command: 'ETA BRAVO' });

      const favorite = getCommands('FAVORITES', context).find(command => command.id === 'favorite-1');
      expect(favorite?.label).toContain('ETA BRAVO');
      expect(favorite?.autocompleteValue).toBe('ETA BRAVO');
      expect(favorite?.keepPaletteOpen).toBe(true);

      const unpin = getCommands('UNPIN 1', context).find(command => command.id === 'favorite-unpin-1');
      unpin?.action?.();
      expect(removeFavorite).toHaveBeenCalledWith(1);
      expect(mockContext.requestMissionAction).not.toHaveBeenCalled();
    });

    it('offers within results from the loaded scenario without mission effects', () => {
      const context = {
        ...mockContext,
        measurementPositionFreshness: () => 'CURRENT' as const,
      };
      const result = getCommands('WITHIN 1000NM TYPE TRACK', context)
        .find(command => command.id === 'within-result-track-target1');
      expect(result?.label).toBe('TARGET1');
      expect(result?.subLabel).toContain('RNG');
      expect(result?.subLabel).toContain('CURRENT');
      expect(result?.action).toBeUndefined();
      expect(context.requestMissionAction).not.toHaveBeenCalled();
    });

    it('offers vertical calculations as local theoretical results only', () => {
      const gradient = getCommands('GRAD VS-700FPM GS110KT', mockContext)
        .find(command => command.id === 'vertical-grad');
      expect(gradient?.label).toContain('-381.8 FT/NM');
      expect(gradient?.subLabel).toContain('THEORETICAL');
      expect(gradient?.action).toBeUndefined();

      const required = getCommands('VSREQ LOSE3000FT IN12NM @ 120KT', mockContext)
        .find(command => command.id === 'vertical-vsreq');
      expect(required?.label).toContain('-500.0 FPM');
      expect(required?.subLabel).toContain('6.00 MIN');
      expect(required?.action).toBeUndefined();
      expect(mockContext.requestMissionAction).not.toHaveBeenCalled();
    });

    it('exposes simulation controls locally and requires confirmation for reset or replay', () => {
      const pauseSimulation = vi.fn();
      const resumeSimulation = vi.fn();
      const requestSimulationReset = vi.fn();
      const requestSimulationReplay = vi.fn();
      const context = {
        ...mockContext,
        simulationStatus: 'RUNNING' as const,
        simulationIsRunning: true,
        simulationTimeMs: 12_000,
        pauseSimulation,
        resumeSimulation,
        requestSimulationReset,
        requestSimulationReplay,
      };

      const status = getCommands('SIM STATUS', context).find(command => command.id === 'sim-status');
      expect(status?.subLabel).toContain('RUNNING');
      expect(status?.subLabel).toContain('LOCAL SIMULATION');
      expect(status?.action).toBeUndefined();

      getCommands('SIM PAUSE', context).find(command => command.id === 'sim-pause')?.action?.();
      getCommands('SIM RESUME', context).find(command => command.id === 'sim-resume')?.action?.();
      getCommands('SIM RESET', context).find(command => command.id === 'sim-reset')?.action?.();
      getCommands('SIM REPLAY', context).find(command => command.id === 'sim-replay')?.action?.();
      expect(pauseSimulation).toHaveBeenCalledTimes(1);
      expect(resumeSimulation).toHaveBeenCalledTimes(1);
      expect(requestSimulationReset).toHaveBeenCalledTimes(1);
      expect(requestSimulationReplay).toHaveBeenCalledTimes(1);
      expect(mockContext.requestMissionAction).not.toHaveBeenCalled();
    });

    it('exposes one shared scenario time and rejects invalid speed commands', () => {
      const setSimulationSpeed = vi.fn(() => true);
      const context = {
        ...mockContext,
        simulationStatus: 'PAUSED' as const,
        simulationIsRunning: false,
        simulationTimeMs: 90_000,
        simulationSpeed: 0.5,
        setSimulationSpeed,
      };

      const time = getCommands('SIM TIME', context).find(command => command.id === 'sim-time');
      expect(time?.label).toContain('SIM TIME');
      expect(time?.subLabel).toContain('T+90s');
      expect(time?.subLabel).toContain('SPEED 0.5x');
      expect(time?.action).toBeUndefined();

      const speed = getCommands('SIM SPEED 2', context).find(command => command.id === 'sim-speed');
      expect(speed?.label).toContain('SIM SPEED 2.00x');
      speed?.action?.();
      expect(setSimulationSpeed).toHaveBeenCalledWith(2);

      const invalid = getCommands('SIM SPEED 20.1', context)
        .find(command => command.id === 'sim-speed-unavailable');
      expect(invalid?.label).toContain('UNAVAILABLE');
      expect(invalid?.subLabel).toContain('CALCULATION NOT EXECUTED');
    });

    it('lists and changes only the registered local layers', () => {
      const layerState = createLayerState();
      const setLayers = vi.fn();
      const context = { ...mockContext, layers: layerState, setLayers };
      const list = getCommands('LAYERS', context).find(command => command.id === 'layers-list');
      expect(list?.label).toBe('LAYERS');
      expect(list?.subLabel).toContain('TRACKS ON');
      expect(list?.subLabel).toContain('VECTORS ON');
      expect(list?.subLabel).toContain('ROUTE ON');
      expect(list?.action).toBeUndefined();

      const off = getCommands('LAYER TRACKS OFF', context).find(command => command.id === 'layer-tracks-off');
      off?.action?.();
      expect(setLayers).toHaveBeenCalledWith(expect.objectContaining({ TRACKS: expect.objectContaining({ visible: false }) }));

      const unavailable = getCommands('LAYER GRID ON', context)
        .find(command => command.id === 'layer-unavailable');
      expect(unavailable?.label).toContain('LAYER UNAVAILABLE');
      expect(mockContext.requestMissionAction).not.toHaveBeenCalled();
    });

    it('exposes and changes the explicit declutter preset locally', () => {
      const setDeclutter = vi.fn();
      const context = { ...mockContext, declutter: createDeclutterState('FULL'), setDeclutter };
      const minimal = getCommands('DECLUTTER MINIMAL', context).find(command => command.id === 'declutter-minimal');
      expect(minimal?.label).toBe('DECLUTTER MINIMAL');
      expect(minimal?.subLabel).toContain('ACTIVE: FULL');
      expect(minimal?.subLabel).toContain('TRACK_LABELS');
      minimal?.action?.();
      expect(setDeclutter).toHaveBeenCalledWith(expect.objectContaining({ preset: 'MINIMAL' }));

      const invalid = getCommands('DECLUTTER LOW', context).find(command => command.id === 'declutter-unavailable');
      expect(invalid?.label).toBe('DECLUTTER UNAVAILABLE');
      expect(invalid?.subLabel).toContain('LOW/HIGH');
      expect(mockContext.requestMissionAction).not.toHaveBeenCalled();
    });

    it('explains symbols and layers from the shared local legend registry', () => {
      const list = getCommands('LEGEND', mockContext).find(command => command.id === 'legend-list');
      expect(list?.label).toBe('LEGEND');
      expect(list?.subLabel).toContain('HOSTILE: Simulated hostile track symbol');
      expect(list?.subLabel).toContain('SOURCE: LOCAL REGISTRY');

      const hostile = getCommands('LEGEND SYMBOL HOSTILE', mockContext)
        .find(command => command.id === 'legend-symbol_hostile');
      expect(hostile?.subLabel).toContain('Simulated hostile track symbol');
      expect(hostile?.subLabel).toContain('LOCAL SIMULATION SYMBOLOGY');
      expect(hostile?.action).toBeUndefined();

      const layerContext = { ...mockContext, layers: { ...createLayerState(), TRACKS: { ...createLayerState().TRACKS, visible: false } } };
      const tracks = getCommands('LEGEND LAYER TRACKS', layerContext)
        .find(command => command.id === 'legend-layer_tracks');
      expect(tracks?.subLabel).toContain('VISIBILITY: OFF');

      const invalid = getCommands('LEGEND SYMBOL RED', mockContext)
        .find(command => command.id === 'legend-unavailable');
      expect(invalid?.subLabel).toContain('MEANING NOT INFERRED');
      expect(mockContext.requestMissionAction).not.toHaveBeenCalled();
    });

    it('controls only the local latitude/longitude grid', () => {
      const setGrid = vi.fn();
      const context = { ...mockContext, grid: createGridState(), setGrid };
      const enable = getCommands('GRID LATLON ON', context).find(command => command.id === 'grid-latlon-on');
      expect(enable?.subLabel).toContain('LOCAL GRID');
      enable?.action?.();
      expect(setGrid).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));

      const step = getCommands('GRID LATLON STEP 1MIN', context).find(command => command.id === 'grid-latlon-step');
      expect(step?.label).toContain('1MIN');
      step?.action?.();
      expect(setGrid).toHaveBeenCalledWith(expect.objectContaining({ stepMinutes: 1 }));

      const invalid = getCommands('GRID MGRS ON', context).find(command => command.id === 'grid-unavailable');
      expect(invalid?.label).toBe('GRID UNAVAILABLE');
      expect(invalid?.subLabel).toContain('MGRS');
      expect(mockContext.requestMissionAction).not.toHaveBeenCalled();
    });

    it('lists local zones, shows a zone, and checks point membership', () => {
      const zones = createDefaultZones();
      const setVisibleZone = vi.fn();
      const localOwnship = { ...mockOwnship, position: translateScenarioPosition({ lat: 34.05, lon: -118.2 }) };
      const context = { ...mockContext, ownship: localOwnship, zones, setVisibleZone, visibleZoneId: null };
      const list = getCommands('ZONE LIST', context).find(command => command.id === 'zones-list');
      expect(list?.subLabel).toContain('TRAINING-A');
      expect(list?.subLabel).toContain('TRAINING-CIRCLE');

      const show = getCommands('ZONE SHOW TRAINING-A', context).find(command => command.id === 'zone-show');
      expect(show?.subLabel).toContain('RECTANGLE');
      show?.action?.();
      expect(setVisibleZone).toHaveBeenCalledWith('TRAINING-A');

      const inside = getCommands('ZONE CHECK OWNSHIP TRAINING-A', context).find(command => command.id === 'zone-check');
      expect(inside?.subLabel).toContain('INSIDE');
      const outside = getCommands('ZONE CHECK TARGET1 TRAINING-A', context).find(command => command.id === 'zone-check');
      expect(outside?.subLabel).toContain('OUTSIDE');

      const unknown = getCommands('ZONE SHOW UNKNOWN', context).find(command => command.id === 'zone-unavailable');
      expect(unknown?.label).toBe('ZONE UNAVAILABLE');
      expect(mockContext.requestMissionAction).not.toHaveBeenCalled();
    });
    it('controls local route visibility and proposes an authorized clear', () => {
      const activeRoute = {
        id: 'route-1', label: 'SIM ROUTE', origin: { lat: 34, lon: -118 },
        waypoints: [{ id: 'route-1:wp1', label: 'BRAVO', position: { lat: 34.1, lon: -118.1 } }],
        remainingWaypointCount: 1, hidden: false,
      };
      const setRouteVisibility = vi.fn();
      const requestMissionAction = vi.fn();
      const context = { ...mockContext, activeRoute, setRouteVisibility, requestMissionAction };
      const hide = getCommands('ROUTE HIDE', context).find(command => command.id === 'route-hide');
      expect(hide?.subLabel).toContain('ACTIVE');
      hide?.action?.();
      expect(setRouteVisibility).toHaveBeenCalledWith(false);

      const show = getCommands('ROUTE SHOW', { ...context, activeRoute: { ...activeRoute, hidden: true } })
        .find(command => command.id === 'route-show');
      expect(show?.subLabel).toContain('HIDDEN');
      show?.action?.();
      expect(setRouteVisibility).toHaveBeenCalledWith(true);

      const clear = getCommands('ROUTE CLEAR', context).find(command => command.id === 'route-clear');
      expect(clear?.subLabel).toContain('CONFIRMATION REQUIRED');
      clear?.action?.();
      expect(requestMissionAction).toHaveBeenCalledWith(expect.objectContaining({
        label: 'ROUTE CLEAR',
        implementation: 'SIMULATED_EFFECT',
        requiresAuthorization: true,
      }));

      const unavailable = getCommands('ROUTE CLEAR', { ...context, activeRoute: undefined })
        .find(command => command.id === 'route-unavailable');
      expect(unavailable?.label).toBe('NO ACTIVE SIM ROUTE');
    });

    it('controls trail visibility and proposes target-only trail clearing', () => {
      const baseTrailState = createTrailState();
      const trails = {
        trails: {
          ...baseTrailState.trails,
          target1: { targetId: 'target1', label: 'TARGET1', visible: false, limited: true, points: [{ position: { lat: 0, lon: 0 }, atMs: 1, segmentId: 1 }] },
        },
      };
      const setTrailVisibility = vi.fn();
      const requestMissionAction = vi.fn();
      const context = { ...mockContext, trails, setTrailVisibility, requestMissionAction };
      const on = getCommands('TRAIL TARGET1 ON', context).find(command => command.id === 'trail-visibility');
      expect(on?.subLabel).toContain('HIDDEN');
      on?.action?.();
      expect(setTrailVisibility).toHaveBeenCalledWith('target1', true, 'TARGET1');

      const status = getCommands('TRAIL STATUS', context).find(command => command.id === 'trail-status');
      expect(status?.subLabel).toContain('TRAIL LIMITED');

      const clear = getCommands('TRAIL CLEAR TARGET1', context).find(command => command.id === 'trail-clear');
      expect(clear?.subLabel).toContain('CONFIRMATION REQUIRED');
      clear?.action?.();
      expect(requestMissionAction).toHaveBeenCalledWith(expect.objectContaining({
        label: 'TRAIL CLEAR TARGET1', implementation: 'SIMULATED_EFFECT', requiresAuthorization: true
      }));
    });

    it('does not offer an unavailable trail result for incomplete or empty requests', () => {
      const empty = getCommands('TRAIL', mockContext);
      const unknown = getCommands('TRAIL UNKNOWN ON', mockContext);
      const noHistory = getCommands('TRAIL CLEAR TARGET1', mockContext);

      expect(empty.some(command => command.id === 'trail-unavailable')).toBe(false);
      expect(unknown.some(command => command.id === 'trail-unavailable')).toBe(false);
      expect(noHistory.some(command => command.id === 'trail-unavailable')).toBe(false);
    });

    it('limits the empty palette to recent entries instead of a generic catalog', () => {
      const history = Array.from({ length: 5 }, (_, index) => ({
        id: String(index),
        timestamp: Date.now() - index,
        original: `command ${index}`,
        canonical: `COMMAND ${index}`,
      }));

      const commands = getCommands('', { ...mockContext, history });

      expect(commands).toHaveLength(3);
      expect(commands.every(command => command.isHistory)).toBe(true);
      expect(commands.some(command => command.id.startsWith('sys-'))).toBe(false);
    });

    it('uses live simulated kinematics for CPA after a turn and speed update', () => {
      const updatedOwnship = {
        ...mockOwnship,
        position: { lat: 0, lon: 0 },
        heading: 90,
        speed: 120,
        metadata: {
          groundTrackDegrees: 0,
          groundSpeedKnots: 10,
          freshness: 'FRESH',
        },
      };
      const updatedTarget = {
        ...mockEntities[1],
        position: { lat: 0, lon: 1 / 6 },
        heading: 270,
        speed: 120,
        metadata: {
          groundTrackDegrees: 0,
          groundSpeedKnots: 10,
          freshness: 'FRESH',
        },
      };
      const context = {
        ...mockContext,
        ownship: updatedOwnship,
        entities: [updatedOwnship, updatedTarget],
        ownshipNavMode: NavMode.SIM,
      };

      const cpa = getCommands('CPA TARGET1', context)
        .find(command => command.id === 'relative-cpa-ownship-target1');

      expect(cpa?.relativeMotionResult).toMatchObject({
        status: 'AVAILABLE',
        cpaStatus: 'FUTURE_CPA',
      });
      expect(cpa?.relativeMotionResult?.closureRateKnots).toBeGreaterThan(200);
      expect(cpa?.relativeMotionResult?.tcpaMinutes).toBeCloseTo(2.5, 1);
    });

    it('uses live simulated kinematics for future position after a speed and turn update', () => {
      const updatedOwnship = { ...mockOwnship, heading: 0, speed: 120 };
      const updatedTarget = {
        ...mockEntities[1],
        position: { lat: 0, lon: 0 },
        heading: 90,
        speed: 120,
        metadata: {
          groundTrackDegrees: 270,
          groundSpeedKnots: 10,
          freshness: 'FRESH',
          ageSeconds: 90,
        },
      };
      const context = {
        ...mockContext,
        ownship: updatedOwnship,
        entities: [updatedOwnship, updatedTarget],
        ownshipNavMode: NavMode.SIM,
        scenarioTimeMs: 10_000,
      };

      const prediction = getCommands('PREDICT TARGET1 +2MIN', context)
        .find(command => command.id === 'future-position-target1');

      expect(prediction?.futurePositionResult).toMatchObject({
        status: 'AVAILABLE',
        projectedRangeNauticalMiles: 4,
        ageSeconds: 0,
      });
      expect(prediction?.subLabel).toContain('VECTOR: 90.0°T @ 120.0 KT');
      expect(prediction?.subLabel).toContain('RANGE: 4.0 NM');
    });

    it('does not reuse a GPS vector after switching to simulation source', () => {
      const ownship = {
        ...mockOwnship,
        heading: 90,
        speed: 120,
        metadata: {
          groundTrackDegrees: 90,
          groundSpeedKnots: 120,
          freshness: 'FRESH',
        },
      };
      const target = {
        ...mockEntities[1],
        position: { lat: 0, lon: 1 / 6 },
        heading: 270,
        speed: 120,
        metadata: {
          groundTrackDegrees: 0,
          groundSpeedKnots: 10,
          freshness: 'FRESH',
        },
      };
      const baseContext = {
        ...mockContext,
        ownship,
        entities: [ownship, target],
      };

      const gps = getCommands('CPA TARGET1', {
        ...baseContext,
        ownshipNavMode: NavMode.REAL,
      }).find(command => command.relativeMotionResult?.status === 'UNAVAILABLE');
      const simulation = getCommands('CPA TARGET1', {
        ...baseContext,
        ownshipNavMode: NavMode.SIM,
      }).find(command => command.relativeMotionResult?.status === 'AVAILABLE');

      expect(gps?.relativeMotionResult).toMatchObject({
        status: 'UNAVAILABLE',
        reason: 'MISSING_GROUND_SPEED',
      });
      expect(simulation?.relativeMotionResult).toMatchObject({
        status: 'AVAILABLE',
        cpaStatus: 'FUTURE_CPA',
      });
    });

    it('names a stale vector instead of presenting it as a future position', () => {
      const target = {
        ...mockEntities[1],
        heading: undefined,
        speed: undefined,
        metadata: {
          groundTrackDegrees: 90,
          groundSpeedKnots: 120,
          freshness: 'STALE',
        },
      };
      const prediction = getCommands('PREDICT TARGET1 +2MIN', {
        ...mockContext,
        entities: [mockOwnship, target],
      }).find(command => command.id.startsWith('future-position-unavailable-'));

      expect(prediction?.futurePositionResult).toMatchObject({
        status: 'UNAVAILABLE',
        reason: 'STALE_TRACK',
      });
      expect(prediction?.subLabel).toContain('REASON: STALE_TRACK');
    });

    it('names an absent vector while keeping the target position available', () => {
      const target = {
        ...mockEntities[1],
        heading: undefined,
        speed: undefined,
        metadata: undefined,
      };
      const context = {
        ...mockContext,
        entities: [mockOwnship, target],
      };
      const prediction = getCommands('PREDICT TARGET1 +2MIN', context)
        .find(command => command.id.startsWith('future-position-unavailable-'));
      const range = getCommands('RNG TARGET1', context)
        .find(command => command.id.startsWith('measurement-result-'));

      expect(prediction?.futurePositionResult).toMatchObject({
        status: 'UNAVAILABLE',
        reason: 'MISSING_GROUND_TRACK',
      });
      expect(range?.subLabel).toContain('CALCULATED');
      expect(range?.subLabel).toContain('TARGET1');
    });

    it('keeps CPA results in their own command domain', () => {
      const bravo = {
        ...mockEntities[1],
        label: 'BRAVO',
        metadata: {
          groundTrackDegrees: 270,
          groundSpeedKnots: 60,
          freshness: 'FRESH',
        },
      };
      const simulatedOwnship = {
        ...mockOwnship,
        metadata: {
          groundTrackDegrees: 90,
          groundSpeedKnots: 60,
          freshness: 'FRESH',
        },
      };
      const commands = getCommands('CPA BRAVO', {
        ...mockContext,
        ownship: simulatedOwnship,
        ownshipNavMode: NavMode.SIM,
        entities: [simulatedOwnship, bravo],
      });

      expect(commands.length).toBeLessThanOrEqual(3);
      expect(commands.some(command => command.id === 'relative-cpa-ownship-target1')).toBe(true);
      expect(commands.some(command => command.id === 'save-text-note')).toBe(false);
      expect(commands.some(command => command.id.startsWith('dct-'))).toBe(false);
      expect(commands.some(command => command.id.startsWith('plan-'))).toBe(false);
    });

    it('attaches one structured ETA/ETE result with qualified inputs', () => {
      const context = {
        ...mockContext,
        ownshipNavMode: NavMode.REAL,
        groundSpeed: {
          speedKnots: 120,
          source: 'GPS' as const,
          qualification: 'MEASURED' as const,
          updatedAt: 1_735_732_800_000,
        },
        scenarioTimeMs: 1_735_732_800_000,
        localTimeZone: 'UTC',
      };

      const command = getCommands('ETE TARGET1', context)
        .find(candidate => candidate.id === 'ete-target1');

      expect(command?.result).toMatchObject({
        id: 'ete-target1',
        state: 'AVAILABLE',
        kind: 'READ_ONLY',
        primary: { label: 'ETE', unit: 'DURATION' },
      });
      expect(command?.result?.references).toEqual(['ownship', 'target1']);
      expect(command?.result?.qualifications).toEqual(expect.arrayContaining([
        expect.objectContaining({ input: 'POSITION', origin: 'GPS', objectId: 'ownship' }),
        expect.objectContaining({ input: 'SPEED', origin: 'GPS', qualification: 'MEASURED' }),
        expect.objectContaining({ input: 'CLOCK', origin: 'SCENARIO', status: 'AVAILABLE' }),
      ]));
    });

    it('keeps ETE available as a partial result when the scenario clock is absent', () => {
      const command = getCommands('ETA TARGET1', {
        ...mockContext,
        groundSpeed: {
          speedKnots: 120,
          source: 'SIMULATION' as const,
          qualification: 'SIMULATED' as const,
        },
      }).find(candidate => candidate.id === 'eta-target1');

      expect(command?.result).toMatchObject({
        state: 'PARTIAL',
        primary: { label: 'ETA', value: 'UNAVAILABLE', unit: 'UTC' },
        reason: {
          code: 'CLOCK_MISSING',
          rawCode: 'SCENARIO_TIME_UNAVAILABLE',
        },
      });
      expect(command?.result?.secondary).toEqual(expect.arrayContaining([
        expect.objectContaining({ label: 'ETE', unit: 'DURATION' }),
      ]));
    });

    it('attaches structured CPA results and preserves exact ambiguous candidates', () => {
      const ownship = {
        ...mockOwnship,
        metadata: {
          groundTrackDegrees: 90,
          groundSpeedKnots: 60,
          freshness: 'FRESH',
        },
      };
      const target = {
        ...mockEntities[1],
        metadata: {
          groundTrackDegrees: 270,
          groundSpeedKnots: 60,
          freshness: 'FRESH',
        },
      };
      const available = getCommands('CPA TARGET1', {
        ...mockContext,
        ownship,
        entities: [ownship, target],
        ownshipNavMode: NavMode.SIM,
      }).find(candidate => candidate.id === 'relative-cpa-ownship-target1');

      expect(available?.result).toMatchObject({
        state: 'AVAILABLE',
        kind: 'READ_ONLY',
        primary: { label: 'CPA', unit: 'NM' },
        capabilities: ['DETAILS'],
      });

      const bravo = getCommands('CPA BRAVO', {
        ...mockContext,
        ownship,
        entities: [ownship, { ...target, label: 'BRAVO' }],
        ownshipNavMode: NavMode.SIM,
      }).find(candidate => candidate.id === 'relative-cpa-ownship-target1');
      expect(bravo?.label).toBe('CPA BRAVO');

      const ambiguous = getCommands('CPA HOSTILE', {
        ...mockContext,
        entities: [
          mockOwnship,
          { ...mockEntities[1], id: 'hostile-1', label: 'HOSTILE' },
          { ...mockEntities[1], id: 'hostile-2', label: 'HOSTILE', position: { lat: 11, lon: 11 } },
        ],
      }).find(candidate => candidate.id.startsWith('relative-cpa-unavailable-'));

      expect(ambiguous?.result).toMatchObject({
        state: 'AMBIGUOUS',
        reason: { code: 'REFERENCE_AMBIGUOUS', rawCode: 'AMBIGUOUS_REFERENCE' },
      });
      expect(ambiguous?.result?.candidates).toEqual([
        { id: 'hostile-1', label: 'HOSTILE' },
        { id: 'hostile-2', label: 'HOSTILE' },
      ]);
      expect(ambiguous?.result?.id).toBe(ambiguous?.id);
      expect(ambiguous?.action).toBeUndefined();
    });

    it('resolves a multi-word implicit ETE target without inventing an origin', () => {
      const hostile = {
        ...mockEntities[1],
        id: 'hostile-1',
        label: 'HOSTILE 1',
      };
      const command = getCommands('ETE HOSTILE 1 @ 120KT', {
        ...mockContext,
        entities: [mockOwnship, hostile],
        scenarioTimeMs: 1_735_732_800_000,
      }).find(candidate => candidate.id === 'ete-hostile-1');

      expect(command).toBeDefined();
      expect(command?.result).toMatchObject({
        state: 'AVAILABLE',
        references: ['ownship', 'hostile-1'],
      });
      expect(command?.result?.qualifications).toEqual(expect.arrayContaining([
        expect.objectContaining({
          input: 'SPEED',
          origin: 'USER_INPUT',
          qualification: 'USER_ASSUMPTION',
        }),
      ]));
    });

    it('blocks every ambiguous explicit pair segmentation before CPA calculation', () => {
      const context = {
        ...mockContext,
        ownshipNavMode: NavMode.SIM,
        entities: [
          mockOwnship,
          { ...mockEntities[1], id: 'hostile', label: 'HOSTILE' },
          { ...mockEntities[1], id: 'one-bravo', label: '1 BRAVO' },
          { ...mockEntities[1], id: 'hostile-one', label: 'HOSTILE 1' },
          { ...mockEntities[1], id: 'bravo', label: 'BRAVO' },
        ],
      };
      const commands = getCommands('CPA FROM HOSTILE 1 TO BRAVO', context);
      const ambiguous = commands.find(command => command.result?.state === 'AMBIGUOUS');

      expect(ambiguous).toBeDefined();
      expect(ambiguous?.result?.candidates).toHaveLength(2);
      expect(commands.some(command => command.relativeMotionResult?.status === 'AVAILABLE')).toBe(false);
      expect(commands.every(command => command.action === undefined)).toBe(true);
    });

    it('attaches structured future, bearing/range, and track information results', () => {
      const target = {
        ...mockEntities[1],
        heading: undefined,
        speed: undefined,
        metadata: {
          groundTrackDegrees: 90,
          groundSpeedKnots: 120,
          freshness: 'FRESH',
          ageSeconds: 4,
        },
      };
      const context = { ...mockContext, entities: [mockOwnship, target], scenarioTimeMs: 10_000 };

      const future = getCommands('PREDICT TARGET1 +2MIN', context)
        .find(candidate => candidate.id === 'future-position-target1');
      expect(future?.result).toMatchObject({
        state: 'AVAILABLE',
        kind: 'READ_ONLY',
        primary: { label: 'GHOST', unit: 'LAT/LON' },
      });

      const measurement = getCommands('RNG TARGET1', context)
        .find(candidate => candidate.id.startsWith('measurement-result-'));
      expect(measurement?.result).toMatchObject({
        state: 'AVAILABLE',
        primary: { label: 'RNG', unit: 'NM' },
        kind: 'READ_ONLY',
      });

      const info = getCommands('INFO TARGET1', {
        ...context,
        entities: [mockOwnship, { ...target, metadata: { source: 'GPS', freshness: 'FRESH', quality: 'GOOD' } }],
      }).find(candidate => candidate.id === 'track-info-target1');
      expect(info?.result).toMatchObject({
        state: 'AVAILABLE',
        primary: { label: 'TRACK', value: 'TARGET1' },
        kind: 'READ_ONLY',
      });
    });

    it('labels speed hypotheses, missing GPS speed, retained vectors, and fixed-point quality', () => {
      const hypothesis = getCommands('ETE TARGET1 @ 140KT', {
        ...mockContext,
        ownshipNavMode: NavMode.REAL,
        scenarioTimeMs: 1_735_732_800_000,
      }).find(candidate => candidate.id === 'ete-target1');
      expect(hypothesis?.result?.qualifications).toEqual(expect.arrayContaining([
        expect.objectContaining({
          input: 'SPEED',
          origin: 'USER_INPUT',
          qualification: 'USER_ASSUMPTION',
          assumption: 'SPEED HYPOTHESIS',
        }),
      ]));

      const missingGpsSpeed = getCommands('ETE TARGET1', {
        ...mockContext,
        ownshipNavMode: NavMode.REAL,
        scenarioTimeMs: 1_735_732_800_000,
      }).find(candidate => candidate.id === 'ete-target1');
      expect(missingGpsSpeed?.result).toMatchObject({
        state: 'PARTIAL',
        reason: { code: 'SPEED_MISSING', rawCode: 'SPEED_UNAVAILABLE' },
      });
      expect(missingGpsSpeed?.result?.qualifications).toEqual(expect.arrayContaining([
        expect.objectContaining({ input: 'POSITION', origin: 'GPS', objectId: 'ownship' }),
        expect.objectContaining({ input: 'SPEED', origin: 'GPS', status: 'MISSING' }),
      ]));

      const staleTarget = {
        ...mockEntities[1],
        heading: undefined,
        speed: undefined,
        metadata: {
          groundTrackDegrees: 90,
          groundSpeedKnots: 120,
          freshness: 'STALE',
          ageSeconds: 90,
        },
      };
      const stale = getCommands('PREDICT TARGET1 +2MIN', {
        ...mockContext,
        entities: [mockOwnship, staleTarget],
      }).find(candidate => candidate.id.startsWith('future-position-unavailable-'));
      expect(stale?.result).toMatchObject({
        state: 'PARTIAL',
        reason: { code: 'DATA_STALE', rawCode: 'STALE_TRACK' },
      });
      expect(stale?.result?.id).toBe(stale?.id);
      expect(stale?.result?.qualifications).toEqual(expect.arrayContaining([
        expect.objectContaining({ input: 'VECTOR', origin: 'RETAINED_FIX', status: 'STALE' }),
      ]));

      const waypoint = {
        ...mockEntities[1],
        id: 'waypoint-1',
        label: 'WP1',
        type: EntityType.WAYPOINT,
      };
      const quality = getCommands('QUALITY WP1', {
        ...mockContext,
        entities: [mockOwnship, waypoint],
      }).find(candidate => candidate.id === 'track-quality-waypoint-1');
      expect(quality?.result).toMatchObject({
        state: 'PARTIAL',
        primary: { label: 'QUALITY', value: 'N/A' },
        reason: { code: 'QUALITY_NOT_APPLICABLE', rawCode: 'QUALITY_NOT_APPLICABLE' },
      });
    });

    it('marks projection results as explicit map previews', () => {
      const projection = getCommands('TARGET1 090/10', mockContext)
        .find(candidate => candidate.id === 'proj-focus');

      expect(projection?.result).toMatchObject({
        state: 'AVAILABLE',
        kind: 'MAP_PREVIEW',
        primary: { label: 'POSITION', unit: 'LAT/LON' },
        capabilities: ['DETAILS', 'MAP_PREVIEW'],
      });
    });

    it('attaches an incomplete result for a recognized calculation missing its reference', () => {
      const command = getCommands('ETA', mockContext)
        .find(candidate => candidate.result?.state === 'INCOMPLETE');

      expect(command).toBeDefined();
      expect(command?.result).toMatchObject({
        state: 'INCOMPLETE',
        kind: 'READ_ONLY',
        reason: { code: 'INPUT_INCOMPLETE' },
      });
      expect(command?.action).toBeUndefined();
    });
  });
});
