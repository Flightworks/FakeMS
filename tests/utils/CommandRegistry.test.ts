import { describe, it, expect, vi } from 'vitest';
import { getCommands, CommandContext } from '../../utils/CommandRegistry';
import { createMathCommandProvider } from '../../utils/mathEvaluator';
import { Entity, EntityType, NavMode } from '../../types';

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

  describe('getCommands', () => {
    it('should generate history commands when query is empty', () => {
      const historyContext = {
        ...mockContext,
        history: [{ id: '1', timestamp: Date.now(), original: 'test command' }]
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

    it('puts the exact coordinate action before copy and save fallbacks', () => {
      const commands = getCommands('N45E006', mockContext);

      expect(commands[0]?.id).toBe('fly-to-coords');
    });
  });
});
