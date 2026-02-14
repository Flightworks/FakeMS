
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Entity, SystemStatus, MapMode } from '../types';
import { Search, ChevronRight } from 'lucide-react';
import { getCommands, CommandOption, CommandContext } from '../utils/CommandRegistry';

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

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const commands = useMemo(() => {
    const context: CommandContext = {
      entities,
      ownship,
      systems,
      setMapMode,
      toggleSystem,
      panTo: (x, y) => onPan({ x, y })
    };
    return getCommands(query, context);
  }, [query, entities, ownship, systems, mapMode]); // Dependencies might need tuning

  useEffect(() => {
    setSelectedIndex(0);
  }, [commands]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % commands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + commands.length) % commands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (commands[selectedIndex]) {
        commands[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-32 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="w-[600px] max-w-[90vw] bg-slate-950 border border-emerald-500/50 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-slate-800 bg-slate-900/50">
           <Search className="text-emerald-500 mr-3" size={20} />
           <input
             ref={inputRef}
             className="flex-1 bg-transparent border-none outline-none text-slate-100 placeholder-slate-500 font-medium h-6"
             placeholder="Type a command (e.g., 'DCT', 'ETA HO', 'RDR')..."
             value={query}
             onChange={e => setQuery(e.target.value)}
             onKeyDown={handleKeyDown}
             autoFocus
           />
           <div className="flex gap-1">
             <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 text-[10px] font-mono border border-slate-700">ESC</kbd>
           </div>
        </div>

        <ul ref={listRef} className="max-h-[400px] overflow-y-auto py-2">
           {commands.length === 0 ? (
             <li className="px-4 py-8 text-center text-slate-500 text-sm">
               No commands found for "{query}"
             </li>
           ) : (
             commands.map((cmd, idx) => {
               const Icon = cmd.icon;
               const isSelected = idx === selectedIndex;
               return (
                 <li
                   key={cmd.id}
                   className={`
                     px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors
                     ${isSelected ? 'bg-emerald-900/20 border-l-2 border-emerald-500' : 'border-l-2 border-transparent hover:bg-slate-800/50'}
                   `}
                   onClick={() => { cmd.action(); onClose(); }}
                   onMouseEnter={() => setSelectedIndex(idx)}
                 >
                   <div className={`p-2 rounded-md ${isSelected ? 'bg-emerald-900/40 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                      <Icon size={18} />
                   </div>
                   <div className="flex-1 min-w-0 flex justify-between items-center">
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
                   {isSelected && <ChevronRight size={16} className="text-emerald-500" />}
                 </li>
               );
             })
           )}
        </ul>

        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between">
           <span>PRO TIP: Try "ETA [Entity]" or "RDR"</span>
           <span>TACTICAL COMMAND PALETTE</span>
        </div>
      </div>
    </div>
  );
};
