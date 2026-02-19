import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Entity, SystemStatus, MapMode } from '../types';
import { Search, ChevronRight, History, MoveRight, CornerDownLeft } from 'lucide-react';
import { getCommands, CommandOption, CommandContext } from '../utils/CommandRegistry';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onPan: (offset: { x: number, y: number }) => void;
  entities: Entity[];
  systems: SystemStatus;
  toggleSystem: (sys: keyof SystemStatus) => void;
  mapMode: MapMode;
  setMapMode: (mode: MapMode) => void;
  ownship: Entity;
  origin: { lat: number, lon: number };
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onPan,
  entities,
  systems,
  toggleSystem,
  mapMode,
  setMapMode,
  ownship,
  origin
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // History State
  const [history, setHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('cmd_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 means typing new command

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setHistoryIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const addToHistory = (cmd: string) => {
    if (!cmd.trim()) return;
    const newHistory = [cmd, ...history.filter(h => h !== cmd)].slice(0, 50);
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
      panTo: (x, y) => onPan({ x, y }),
      history // Pass history to registry
    };
    return getCommands(query, context);
  }, [query, entities, ownship, systems, mapMode, history]);

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
          setQuery(newIndex === -1 ? '' : history[newIndex]);
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
          setQuery(history[newIndex]);
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (commands[selectedIndex]) {
        addToHistory(query);
        commands[selectedIndex].action();
        onClose();
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
      // Trigger Action
      addToHistory(query);
      cmd.action();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-32 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="w-[600px] max-w-[90vw] bg-slate-950 border border-emerald-500/50 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-slate-800 bg-slate-900/50">
          <Search className="text-emerald-500 mr-3" size={20} />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent border-none outline-none text-slate-100 placeholder-slate-500 font-medium h-6"
            placeholder="Type a command (e.g., 'DCT', 'TK2 180 5')..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setHistoryIndex(-1); // Reset history index on type
            }}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <div className="flex gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 text-[10px] font-mono border border-slate-700">ESC</kbd>
          </div>
        </div>

        {/* Suggestion / Tip Area */}
        <div className="px-4 py-2 bg-slate-900/30 border-b border-slate-800 text-[10px] text-emerald-500/70 font-mono flex justify-between">
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

        <ul ref={listRef} className="max-h-[400px] overflow-y-auto py-2 overflow-x-hidden">
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
                    onDragStart={(e: any) => handleDragStart(e, cmd)}
                    className={`
                     px-4 py-3 flex items-center gap-3 cursor-pointer relative
                     ${isSelected ? 'bg-emerald-900/20 border-l-2 border-emerald-500' : 'border-l-2 border-transparent hover:bg-slate-800/50'}
                   `}
                    onClick={() => {
                      if (cmd.isHistory) {
                        setQuery(cmd.label);
                        inputRef.current?.focus();
                      } else {
                        addToHistory(query);
                        cmd.action();
                        onClose();
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
                    {isSelected && <CornerDownLeft size={16} className="text-emerald-500" />}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          )}
        </ul>

        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between">
          <span>PRO TIP: Swipe Right to Execute • Drag to Map</span>
          <span>TACTICAL COMMAND PALETTE</span>
        </div>
      </div>
    </div>
  );
};
