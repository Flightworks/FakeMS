import { describe, it, expect, vi } from 'vitest';
import { getCommands, CommandContext } from '../../utils/CommandRegistry';
import { Entity, MapMode } from '../../types';

describe('CommandRegistry', () => {
  const mockOwnship: Entity = {
    id: 'ownship',
    label: 'OWNSHIP',
    type: 'FRIENDLY',
    position: { lat: 0, lon: 0 },
    heading: 0,
    speed: 100,
    status: 'ACTIVE'
  };

  const mockEntities: Entity[] = [
    mockOwnship,
    {
      id: 'target1',
      label: 'TARGET1',
      type: 'HOSTILE',
      position: { lat: 10, lon: 10 },
      heading: 90,
      speed: 300,
      status: 'ACTIVE'
    }
  ];

  const mockContext: CommandContext = {
    entities: mockEntities,
    ownship: mockOwnship,
    systems: {
      radar: false,
      adsb: false,
      ais: false,
      eots: false,
      camera: false,
      acoustic: false
    },
    setMapMode: vi.fn(),
    toggleSystem: vi.fn(),
    panTo: vi.fn(),
    history: [],
    openDocument: vi.fn()
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
      const commands = getCommands('2 + 2', mockContext);
      const mathCmd = commands.find(c => c.id === 'calc-result');
      expect(mathCmd).toBeDefined();
      expect(mathCmd?.label).toBe('2 + 2 = 4');
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

    it('should create direct-to commands', () => {
        const commands = getCommands('dct target', mockContext);
        const dctCmd = commands.find(c => c.id === 'dct-target1');
        expect(dctCmd).toBeDefined();
    });

    it('should create save text fallback for unmatched queries', () => {
        const commands = getCommands('some random text', mockContext);
        const saveCmd = commands.find(c => c.id === 'save-text-note');
        expect(saveCmd).toBeDefined();
        expect(saveCmd?.label).toBe('SAVE: "some random text"');
    });
  });
});
