import { describe, it, expect, vi } from 'vitest';
import { getCommands, CommandContext } from '../../utils/CommandRegistry';
import { createMathCommandProvider } from '../../utils/mathEvaluator';
import { Entity, EntityType, NavMode } from '../../types';
import type { SimulatedDesignation } from '../../domain/designations';

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

    it('creates a deterministic planning command with an explicit objective', () => {
      const plan = getCommands('plan coverage target', mockContext).find(c => c.id === 'plan-coverage-target1');
      expect(plan).toBeDefined();
      plan?.action?.();
      expect(mockContext.proposeRoute).toHaveBeenCalledWith(expect.objectContaining({ id: 'target1' }), 'COVERAGE');
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

      expect(commands.some(command => command.label.includes('AMBIGUOUS_REFERENCE'))).toBe(true);
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
  });
});
