import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Entity, SystemStatus, MapMode, HistoryEntry, NavMode } from '../types';
import { Search, History, MoveRight, CornerDownLeft, Copy } from 'lucide-react';
import { getCommands, CommandOption, CommandContext } from '../utils/CommandRegistry';
import type { MathCommandProvider } from '../utils/mathEvaluator';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import type { MissionActionRequest } from '../domain/missionActions';
import { parseCommand } from '../domain/commandParser';
import type { MissionObjective } from '../domain/intent';
import type { ProjectionPreview, SimulatedDesignation } from '../domain/designations';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  focusMapAt: (position: { lat: number, lon: number }) => void;
  previewProjection?: (preview: ProjectionPreview) => void;
  designations?: SimulatedDesignation[];
  listDesignations?: () => void;
  renameDesignation?: (designationId: string, label: string) => void;
  deleteDesignation?: (designationId: string) => void;
  proposeClearDesignations?: () => void;
  proposeDirectTo: (target: Pick<Entity, 'id' | 'label' | 'position'>) => void;
  proposeRoute: (target: Pick<Entity, 'id' | 'label' | 'position'>, objective?: MissionObjective) => void;
  requestMissionAction: (request: MissionActionRequest) => void;
  entities: Entity[];
  systems: SystemStatus;
  toggleSystem: (sys: keyof SystemStatus) => void;
  setMapMode: (mode: MapMode) => void;
  ownship: Entity;
  openDocument: (filename: string) => void;
  ownshipNavMode: NavMode;
  setOwnshipNavMode: (mode: NavMode) => void;
}

interface VisualViewportRect {
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
}

const COMPACT_VIEWPORT_HEIGHT = 520;

const readVisualViewportRect = (): VisualViewportRect => {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, offsetTop: 0, offsetLeft: 0 };
  }

  const visualViewport = window.visualViewport;
  return {
    width: visualViewport?.width ?? window.innerWidth,
    height: visualViewport?.height ?? window.innerHeight,
    offsetTop: visualViewport?.offsetTop ?? 0,
    offsetLeft: visualViewport?.offsetLeft ?? 0,
  };
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  focusMapAt,
  previewProjection,
  designations = [],
  listDesignations,
  renameDesignation,
  deleteDesignation,
  proposeClearDesignations,
  proposeDirectTo,
  proposeRoute,
  requestMissionAction,
  entities,
  systems,
  toggleSystem,
  setMapMode,
  ownship,
  openDocument,
  ownshipNavMode,
  setOwnshipNavMode
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [visualViewportRect, setVisualViewportRect] = useState<VisualViewportRect>(readVisualViewportRect);
  const isViewportConstrained = visualViewportRect.height < COMPACT_VIEWPORT_HEIGHT;

  useEffect(() => {
    if (!isOpen) return;

    const updateVisualViewport = () => {
      setVisualViewportRect(readVisualViewportRect());
    };
    const visualViewport = window.visualViewport;

    updateVisualViewport();
    if (visualViewport) {
      visualViewport.addEventListener('resize', updateVisualViewport);
      visualViewport.addEventListener('scroll', updateVisualViewport);
      return () => {
        visualViewport.removeEventListener('resize', updateVisualViewport);
        visualViewport.removeEventListener('scroll', updateVisualViewport);
      };
    }

    window.addEventListener('resize', updateVisualViewport);
    return () => window.removeEventListener('resize', updateVisualViewport);
  }, [isOpen]);

  // History State
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const saved = localStorage.getItem('cmd_history');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      // Migrate old string arrays to objects
      return parsed.map((item: any) => {
        if (typeof item === 'string') return { original: item, timestamp: Date.now() };
        return item;
      });
    } catch { return []; }
  });
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 means typing new command
  const [mathProvider, setMathProvider] = useState<MathCommandProvider | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setHistoryIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 50);

      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    const needsMathProvider = trimmedQuery.length > 1 && (
      /^[-+]?\d|^[.(]/.test(trimmedQuery)
      || /^(sin|cos|tan|asin|acos|atan|sqrt|log|abs|exp)/i.test(trimmedQuery)
      || /\b(?:to|in)\b/i.test(trimmedQuery)
    );
    if (!needsMathProvider || mathProvider) return;

    let cancelled = false;
    void import('../utils/mathEvaluator').then(({ createMathCommandProvider }) => {
      if (!cancelled) setMathProvider(createMathCommandProvider());
    });
    return () => {
      cancelled = true;
    };
  }, [query, mathProvider]);

  const addToHistory = (cmd: string) => {
    if (!cmd.trim()) return;
    const newEntry: HistoryEntry = { original: cmd, timestamp: Date.now() };
    const previousFiltered = history.filter(h => h.original !== cmd);
    const newHistory = [newEntry, ...previousFiltered].slice(0, 50);
    setHistory(newHistory);
    localStorage.setItem('cmd_history', JSON.stringify(newHistory));
  };

  const commands = useMemo(() => {
    const context: CommandContext = {
      entities,
      ownship,
      systems,
      setMapMode,
      toggleSystem,
      focusMapAt,
      previewProjection,
      designations,
      listDesignations,
      renameDesignation,
      deleteDesignation,
      proposeClearDesignations,
      proposeDirectTo,
      proposeRoute,
      requestMissionAction,
      history, // Pass history to registry
      openDocument,
      ownshipNavMode,
      toggleNavMode: () => setOwnshipNavMode(ownshipNavMode === NavMode.REAL ? NavMode.SIM : NavMode.REAL)
    };
    return getCommands(query, context, mathProvider ?? undefined);
  }, [
    query,
    entities,
    ownship,
    systems,
    history,
    setMapMode,
    toggleSystem,
    focusMapAt,
    previewProjection,
    designations,
    listDesignations,
    renameDesignation,
    deleteDesignation,
    proposeClearDesignations,
    proposeDirectTo,
    proposeRoute,
    requestMissionAction,
    openDocument,
    ownshipNavMode,
    setOwnshipNavMode,
    mathProvider,
  ]);

  const projectionErrors = useMemo(() => {
    const parsed = parseCommand(query);
    return parsed.type === 'PROJECTION' ? parsed.errors : [];
  }, [query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [commands]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      // If navigating history (and query matches history), allow moving back down to empty?
      // For now, prioritize list navigation if results exist
      if (commands.length > 0) {
        setSelectedIndex(prev => (prev + 1) % commands.length);
      } else {
        // History navigation down
        if (historyIndex > -1) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setQuery(newIndex === -1 ? '' : history[newIndex].original);
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commands.length > 0 && query !== '') {
        // Navigate list
        setSelectedIndex(prev => (prev - 1 + commands.length) % commands.length);
      } else {
        // History navigation up (only if query is empty or we are already identifying as history nav)
        // Actually, standard terminal behavior: ArrowUp always goes to history if caret at start? 
        // Simplified: If query is empty OR we are already traversing history
        const newIndex = historyIndex + 1;
        if (newIndex < history.length) {
          setHistoryIndex(newIndex);
          setQuery(history[newIndex].original);
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (commands[selectedIndex]) {
        const cmd = commands[selectedIndex];
        if (cmd.isHistory) {
          setQuery(cmd.label);
          inputRef.current?.focus();
          return;
        }
        if (cmd.autocompleteValue) {
          setQuery(cmd.autocompleteValue);
          inputRef.current?.focus();
          return;
        }
        addToHistory(cmd.historyValue || query);
        cmd.action?.();
        if (!cmd.keepPaletteOpen) onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, cmd: CommandOption) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'command',
      id: cmd.id,
      label: cmd.label,
      query: query // Pass the query too in case it's a coordinate
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Swipe Gesture Handler
  const handleSwipe = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo, cmd: CommandOption) => {
    if (info.offset.x > 100) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50); // Haptic feedback on swipe execution
      }
      // Trigger Action
      addToHistory(cmd.historyValue || query);
      cmd.action?.();
      if (!cmd.keepPaletteOpen) onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed z-[100] flex justify-center animate-in fade-in duration-200 ${
        isViewportConstrained
          ? 'items-start p-2'
          : 'items-end pb-8 lg:pb-12'
      }`}
      style={{
        top: visualViewportRect.offsetTop,
        left: visualViewportRect.offsetLeft,
        width: visualViewportRect.width,
        height: visualViewportRect.height,
        ...(isViewportConstrained ? {
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        } : {}),
      }}
      onClick={onClose}
    >
      <div
        className={`w-[600px] max-w-[90vw] bg-slate-950 border border-emerald-500/50 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 duration-200 ${
          isViewportConstrained
            ? 'h-full max-h-full min-h-0'
            : 'h-[60vh] min-h-[400px] max-h-[500px] mb-safe'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Tactical command palette"
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center px-4 py-3 border-b border-slate-800 bg-slate-900/50">
          <Search className="text-emerald-500 mr-3" size={20} />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent border-none outline-none text-base text-slate-100 placeholder-slate-500 font-medium h-6"
            aria-label="Command input"
            placeholder="Type a command (e.g., 'DCT', 'TK2 180 5')..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setHistoryIndex(-1); // Reset history index on type
            }}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <div className="flex gap-2 items-center text-slate-400">
            {query && (
              <div
                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(query); }}
                className="cursor-pointer hover:text-emerald-400 transition-colors p-1"
                title="Copy Input"
              >
                <Copy size={16} />
              </div>
            )}
            <button
              type="button"
              aria-label="Close command palette"
              onClick={onClose}
              className="px-2 py-1 flex items-center justify-center rounded bg-slate-800 text-[10px] font-mono border border-slate-700 hover:bg-slate-700 active:bg-slate-600 transition-colors cursor-pointer min-h-[30px] min-w-[40px]"
            >
              ESC
            </button>
          </div>
        </div>



        {/* Suggestion / Tip Area */}
        {!isViewportConstrained && (
          <div className="shrink-0 px-4 py-2 bg-slate-900/30 border-b border-slate-800 text-[10px] text-emerald-500/70 font-mono flex justify-between">
            <span>
              {commands.length > 0 && (commands[0].id === 'coord-suggestion' || commands[0].id === 'calc-hint') ? (
                <span className="text-emerald-400 font-bold animate-pulse">{commands[0].label}</span>
              ) : (
                <>
                  {query === '' && "TYPE TO SEARCH COMMANDS OR ENTITIES"}
                  {query.length > 0 && !query.includes('/') && !query.match(/^\d/) && !query.match(/^[a-z]/i) && "TRY: '12*5', '10km to nm', 'TK2 180 5'"}
                  {(query.match(/^\d/) || (query.length > 0 && commands.some(c => c.id === 'calc-result'))) && "CALCULATOR MODE ACTIVE"}
                  {query.includes('/') && "BEARING/RANGE PROJECTION MODE"}
                </>
              )}
            </span>
            {historyIndex > -1 && <span className="flex items-center gap-1 text-slate-400"><History size={10} /> HISTORY ({historyIndex + 1})</span>}
          </div>
        )}
        {projectionErrors.length > 0 && (
          <div
            role="alert"
            aria-live="polite"
            className="shrink-0 px-4 py-2 border-b border-amber-500/40 bg-amber-950/30 text-amber-200 text-xs font-mono"
          >
            {projectionErrors.map(error => (
              <div key={`${error.code}-${error.message}`}>{error.message}</div>
            ))}
          </div>
        )}

        <ul ref={listRef} className="flex-1 min-h-0 overflow-y-auto py-2 overflow-x-hidden" role="listbox" aria-label="Command results">
          {commands.length === 0 ? (
            <li className="px-4 py-8 text-center text-slate-500 text-sm">
              No commands found for "{query}"
            </li>
          ) : (
            <AnimatePresence>
              {commands.map((cmd, idx) => {
                const Icon = cmd.icon;
                const isSelected = idx === selectedIndex;
                return (
                  <motion.li
                    key={cmd.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={{ right: 0.5, left: 0.1 }} // Allow drag right
                    onDragEnd={(e, info) => handleSwipe(e, info, cmd)}
                    draggable="true"
                    role="option"
                    aria-selected={isSelected}
                    aria-label={cmd.subLabel ? `${cmd.label} · ${cmd.subLabel}` : cmd.label}
                    onDragStart={(e: any) => handleDragStart(e, cmd)}
                    className={`
                     group px-4 py-4 min-h-[60px] flex items-center gap-4 cursor-pointer relative
                     ${isSelected ? 'bg-emerald-900/20 border-l-4 border-emerald-500' : 'border-l-4 border-transparent hover:bg-slate-800/50'}
                   `}
                    onClick={() => {
                      if (cmd.isHistory) {
                        setQuery(cmd.label);
                        inputRef.current?.focus();
                      } else if (cmd.autocompleteValue) {
                        setQuery(cmd.autocompleteValue);
                        inputRef.current?.focus();
                      } else {
                        addToHistory(cmd.historyValue || query);
                        cmd.action?.();
                        if (!cmd.keepPaletteOpen) onClose();
                      }
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{ touchAction: 'pan-y' }} // Allow vertical scroll, horizontal swipe handled by Framer
                  >
                    {/* Swift Right Action Background */}
                    <div className="absolute inset-y-0 left-0 w-full bg-emerald-600/20 -z-10 flex items-center pl-4 opacity-0 motion-safe:group-active:opacity-100">
                      <MoveRight size={24} className="text-emerald-400" />
                      <span className="ml-2 font-bold text-emerald-400">DIRECT TO</span>
                    </div>

                    <div className={`p-2 rounded-md ${isSelected ? 'bg-emerald-900/40 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0 flex justify-between items-center pointer-events-none">
                      <div>
                        <div className={`text-sm font-medium truncate ${isSelected ? 'text-emerald-100' : 'text-slate-200'}`}>
                          {cmd.label}
                        </div>
                        {cmd.subLabel && !cmd.isPreview && (
                          <div className="text-xs text-slate-500 truncate mt-0.5">
                            {cmd.subLabel}
                          </div>
                        )}
                      </div>

                      {/* Preview Pane logic: Show prominently if isPreview (Calculator result) */}
                      {cmd.isPreview && cmd.subLabel && (
                        <div className="bg-emerald-900/40 text-emerald-400 px-2 py-1 rounded text-xs font-bold border border-emerald-500/30">
                          {cmd.subLabel}
                        </div>
                      )}
                    </div>
                    {cmd.isHistory && (
                      <div
                        className="ml-2 text-slate-500 hover:text-emerald-400 cursor-pointer p-2 z-10 relative opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(cmd.label);
                        }}
                        title="Copy History Item"
                      >
                        <Copy size={16} />
                      </div>
                    )}
                    {isSelected && <CornerDownLeft size={16} className={`text-emerald-500 ${cmd.isHistory ? 'ml-1' : 'ml-2'}`} />}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          )}
        </ul>

        {!isViewportConstrained && (
          <div className="shrink-0 px-4 py-2 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between">
            <span>PRO TIP: Swipe Right to Execute • Drag to Map</span>
            <span>TACTICAL COMMAND PALETTE</span>
          </div>
        )}
      </div>
    </div>
  );
};
