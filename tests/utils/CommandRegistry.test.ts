import { describe, it, expect, vi } from 'vitest';
import { getCommands, CommandContext } from '../../utils/CommandRegistry';
import { Entity, MapMode, EntityType, NavMode } from '../../types';

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
    panTo: vi.fn(),
    history: [],
    openDocument: vi.fn(),
    ownshipNavMode: NavMode.REAL,
    toggleNavMode: vi.fn(),
    updateOwnship: vi.fn(),
    notes: [],
    saveNote: vi.fn(),
    deleteNote: vi.fn()
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
      const dctCmd = commands.find(c => c.id === 'dct-context-target1');
      expect(dctCmd).toBeDefined();
    });

    it('should create save text fallback and call saveNote', () => {
      const commands = getCommands('some random text', mockContext);
      const saveCmd = commands.find(c => c.id === 'save-text-note');
      expect(saveCmd).toBeDefined();
      expect(saveCmd?.label).toBe('SAVE: "some random text"');
      
      saveCmd?.action();
      expect(mockContext.saveNote).toHaveBeenCalledWith('some random text');
    });

    it('should parse kinematic commands (hdg, spd, alt)', () => {
      // hdg
      const hdgCmds = getCommands('hdg 180', mockContext);
      const hdgCmd = hdgCmds.find(c => c.id === 'set-target-hdg');
      expect(hdgCmd).toBeDefined();
      hdgCmd?.action();
      expect(mockContext.updateOwnship).toHaveBeenCalledWith({ targetHeading: 180 });

      // spd
      const spdCmds = getCommands('spd 150', mockContext);
      const spdCmd = spdCmds.find(c => c.id === 'set-target-spd');
      expect(spdCmd).toBeDefined();
      spdCmd?.action();
      expect(mockContext.updateOwnship).toHaveBeenCalledWith({ targetSpeed: 150 });

      // alt
      const altCmds = getCommands('alt 5000', mockContext);
      const altCmd = altCmds.find(c => c.id === 'set-target-alt');
      expect(altCmd).toBeDefined();
      altCmd?.action();
      expect(mockContext.updateOwnship).toHaveBeenCalledWith({ targetAltitude: 5000 });
    });

    it('should support contextual autocomplete for dct and eta', () => {
      // dct
      const dctCmds = getCommands('dct ', mockContext);
      const dctContextCmd = dctCmds.find(c => c.id === 'dct-context-target1');
      expect(dctContextCmd).toBeDefined();
      expect(dctContextCmd?.label).toBe('DCT TARGET1');

      // eta
      const etaCmds = getCommands('eta ', mockContext);
      const etaContextCmd = etaCmds.find(c => c.id === 'eta-context-target1');
      expect(etaContextCmd).toBeDefined();
      expect(etaContextCmd?.label).toBe('ETA TARGET1');
    });

    it('should handle note saving, notes list, notes filtering, and notes actions', () => {
      // save note command
      const noteCmds = getCommands('note bridge down', mockContext);
      const createNoteCmd = noteCmds.find(c => c.id === 'create-note');
      expect(createNoteCmd).toBeDefined();
      createNoteCmd?.action();
      expect(mockContext.saveNote).toHaveBeenCalledWith('bridge down');

      // list notes
      const notesContext = {
        ...mockContext,
        notes: [
          { id: 'n1', text: 'Convoy at 34.05, -118.24', timestamp: Date.now() }
        ]
      };
      const listCmds = getCommands('notes', notesContext);
      const viewNoteCmd = listCmds.find(c => c.id === 'view-note-n1');
      const flyNoteCmd = listCmds.find(c => c.id === 'fly-to-note-n1');
      expect(viewNoteCmd).toBeDefined();
      expect(viewNoteCmd?.label).toBe('Convoy at 34.05, -118.24');
      
      // fly to notes coordinates
      expect(flyNoteCmd).toBeDefined();
      flyNoteCmd?.action();
      expect(notesContext.panTo).toHaveBeenCalledWith(34.05, -118.24);
    });
  });
});
