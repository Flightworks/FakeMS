import React, { useState, useEffect, useRef } from 'react';
import { MapMode, SystemStatus, PrototypeSettings, Entity, StabMode } from '../types';
import packageData from '../package.json';
import changelogRaw from '../CHANGELOG.md?raw';
import {
  Menu, ArrowUp, Search, X, Info, BookOpen, Crosshair
} from 'lucide-react';
import { HMI_CLASSES } from './hmiTokens';

interface LeftSidebarProps {
  mapMode: MapMode;
  setMapMode: (mode: MapMode) => void;
  toggleLayer: (layer: string) => void;
  systems: SystemStatus;
  toggleSystem: (sys: keyof SystemStatus) => void;
  isOpen: boolean;
  onToggle: () => void;
  gestureSettings: PrototypeSettings;
  setGestureSettings: React.Dispatch<React.SetStateAction<PrototypeSettings>>;
  onOpenCommandPalette: () => void;
  ownship: Entity;
  stabMode: StabMode;
  setStabMode: (m: StabMode) => void;
  onResetStab: () => void;
  onOpenStabilizationPanel?: () => void;
}

interface QakOption {
  id: string;
  label: string;
  subLabel?: string;
  icon?: any;
  active?: boolean;
  action?: () => void;
  description?: string;
  children?: QakOption[];
}

interface SidebarButtonProps {
  label: string;
  subLabel?: string;
  icon?: any;
  active?: boolean;
  onClick: () => void;
  description?: string;
  descriptionId?: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
}

const SidebarButton: React.FC<SidebarButtonProps> = ({
  label,
  subLabel,
  icon: Icon,
  active = false,
  onClick,
  description,
  descriptionId,
  buttonRef,
}) => (
  <button
    ref={buttonRef}
    type="button"
    aria-label={label || 'Toggle tactical menu'}
    aria-describedby={description && descriptionId ? descriptionId : undefined}
    onClick={onClick}
    className={`
      ${HMI_CLASSES.activeTarget} ${HMI_CLASSES.actionText} ${HMI_CLASSES.focusRing}
      w-16 h-16 flex flex-col items-center justify-center rounded-md border-2 shadow-lg transition-all duration-100 active:scale-95 shrink-0 pointer-events-auto
      ${active
        ? 'bg-emerald-900 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
        : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
      }
    `}
  >
    {Icon && <Icon size={24} className={`mb-0.5 ${active ? 'text-emerald-200' : 'text-slate-400'}`} />}
    {label && <span className={`${HMI_CLASSES.actionText} text-sm font-bold uppercase leading-none`}>{label}</span>}
    {subLabel && <span className={`${HMI_CLASSES.qualification} text-sm font-bold uppercase leading-none mt-0.5 ${active ? 'text-emerald-300' : 'text-emerald-500'}`}>{subLabel}</span>}
    {description && descriptionId && <span id={descriptionId} className="sr-only">{description}</span>}
  </button>
);

const ParameterHelper: React.FC<{ activeCategory: QakOption | undefined }> = ({ activeCategory }) => {
  if (!activeCategory || !activeCategory.children) return null;

  return (
    <div className="fixed right-6 top-24 w-64 bg-slate-950/90 border-2 border-emerald-600/50 rounded-lg p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-right-4 duration-300 pointer-events-none">
      <div className="flex items-center gap-2 mb-3 border-b border-emerald-900/50 pb-2">
        <BookOpen size={16} className="text-emerald-400" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">REF: {activeCategory.label}</span>
      </div>
      <div className="flex flex-col gap-3">
        {activeCategory.children?.map(child => (
          <div key={child.id} className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-white bg-emerald-900/40 px-1 rounded">{child.label}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase">{child.subLabel}</span>
            </div>
            <p className="text-[10px] text-slate-300 mt-1 leading-relaxed font-medium">
              {child.description}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-2 border-t border-slate-800 text-[8px] font-mono text-slate-500 text-right">
        REF
      </div>
    </div>
  );
};

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  mapMode, setMapMode, toggleLayer, systems, toggleSystem, isOpen, onToggle,
  gestureSettings, setGestureSettings, onOpenCommandPalette, ownship,
  stabMode, setStabMode, onResetStab, onOpenStabilizationPanel,
}) => {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const lastTopRef = useRef(0);
  const compassAngleRef = useRef(0);
  const versionButtonRef = useRef<HTMLButtonElement>(null);
  const changelogCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) setActiveCategoryId(null);
  }, [isOpen]);

  const closeChangelog = React.useCallback(() => {
    setShowChangelog(false);
    versionButtonRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!showChangelog) return undefined;

    changelogCloseRef.current?.focus({ preventScroll: true });
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      closeChangelog();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [closeChangelog, showChangelog]);

  const handleCategoryClick = (item: QakOption) => {
    if (activeCategoryId === item.id) {
      setActiveCategoryId(null);
    } else {
      setActiveCategoryId(item.id);
    }
    if (!item.children && item.action) item.action();
  };

  const menuConfig: QakOption[] = [
    {
      id: 'stab',
      label: 'STAB',
      subLabel: stabMode === StabMode.GND ? 'GND' : 'H/C',
      icon: Crosshair,
      active: stabMode === StabMode.GND,
      action: () => {
        if (onOpenStabilizationPanel) {
          onOpenStabilizationPanel();
          return;
        }
        if (stabMode === StabMode.GND) onResetStab();
        else setStabMode(StabMode.GND);
      },
      description: stabMode === StabMode.GND
        ? 'GND fixed-ground anchor active. Open STABLN controls.'
        : 'H/C ownship-follow mode active. Open STABLN controls.',
    },
    {
      id: 'search',
      label: 'FIND',
      subLabel: 'CMD',
      icon: Search,
      action: onOpenCommandPalette,
      description: 'Open the tactical command palette.',
    },
    {
      id: 'version',
      label: 'VER',
      subLabel: `v${packageData.version}`,
      icon: Info,
      action: () => setShowChangelog(true),
      active: showChangelog,
      description: 'Open the served version and changelog.',
    }
  ];

  const activeCategory = menuConfig.find(c => c.id === activeCategoryId);
  let currentTopRem = lastTopRef.current;

  if (activeCategory) {
    const idx = menuConfig.findIndex(c => c.id === activeCategory.id);
    const childCount = activeCategory.children?.length || 0;
    currentTopRem = 2.25 * (1 + 2 * idx - childCount);
    lastTopRef.current = currentTopRem;
  }

  const rawCompass = mapMode === MapMode.NORTH_UP ? 0 : -(ownship.heading || 0);
  const compassDelta = ((rawCompass - compassAngleRef.current + 180) % 360 + 360) % 360 - 180;
  compassAngleRef.current = compassAngleRef.current + compassDelta;
  const compassRotation = compassAngleRef.current;

  return (
    <>
      <div className="absolute z-30 left-2 flex flex-col gap-2 items-start pointer-events-none" style={{ top: 'calc(5rem + env(safe-area-inset-top))' }}>
        <div className="flex flex-row gap-2">
          <SidebarButton label="" icon={isOpen ? X : Menu} onClick={onToggle} active={isOpen} />
          <button
            onClick={() => setMapMode(mapMode === MapMode.NORTH_UP ? MapMode.HEADING_UP : MapMode.NORTH_UP)}
            className={`
              w-16 h-16 flex items-center justify-center rounded-full border-2 shadow-lg transition-all duration-100 active:scale-95 shrink-0 pointer-events-auto backdrop-blur-md
              ${mapMode === MapMode.NORTH_UP 
                ? 'bg-emerald-900 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700/90'}
            `}
            title={`Active: ${mapMode === MapMode.NORTH_UP ? 'NORTH UP' : 'HEADING UP'}`}
          >
            <div className="relative flex items-center justify-center w-full h-full">
              {mapMode === MapMode.NORTH_UP && (
                <span className="absolute top-1 text-[9px] font-bold text-emerald-200 uppercase tracking-tighter">N</span>
              )}
              <ArrowUp
                size={34}
                className={mapMode === MapMode.NORTH_UP ? "text-white" : "text-slate-400"}
                style={{ transform: `rotate(${compassRotation}deg)`, transition: 'transform 0.3s ease-out' }}
              />
            </div>
          </button>
        </div>
        <div className="relative flex flex-row items-start gap-2">
          <nav
            data-testid="quick-access-keys"
            aria-label="Quick access keys"
            className={`flex flex-col gap-2 p-1 bg-slate-950/80 backdrop-blur-md rounded-lg border border-slate-800/50 ${isOpen ? 'border-emerald-800/60' : ''}`}
          >
            {menuConfig.map(item => (
              <SidebarButton
                key={item.id}
                label={item.label}
                subLabel={item.subLabel}
                icon={item.icon}
                active={item.active}
                onClick={() => handleCategoryClick(item)}
                description={item.description}
                descriptionId={`qak-${item.id}-description`}
                buttonRef={item.id === 'version' ? versionButtonRef : undefined}
              />
            ))}
          </nav>
          <div className={`absolute left-[calc(100%+0.5rem)] flex flex-col gap-2 p-1 bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700/50 shadow-2xl transition-all duration-200 ease-out origin-left ${activeCategory && !activeCategory.action ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 -translate-x-4 scale-95 pointer-events-none'}`} style={{ top: `${currentTopRem}rem` }}>
            {(activeCategory?.children || menuConfig.find(c => c.id === activeCategoryId)?.children)?.map(sub => (
              <SidebarButton key={sub.id} label={sub.label} subLabel={sub.subLabel} icon={sub.icon} active={sub.active} onClick={sub.action || (() => { })} />
            ))}
          </div>
        </div>
      </div>
      <ParameterHelper activeCategory={activeCategory} />

      {/* Changelog Modal */}
      {showChangelog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Changelog"
          onClick={closeChangelog}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-slate-950 border border-emerald-500/50 rounded-xl shadow-2xl w-[600px] max-w-[90vw] h-[70vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-2">
                <Info className="text-emerald-400" size={20} />
                <h2 className="text-emerald-400 font-bold uppercase tracking-widest text-sm">Changelog</h2>
              </div>
              <button
                ref={changelogCloseRef}
                type="button"
                aria-label="Close changelog"
                onClick={closeChangelog}
                className={`${HMI_CLASSES.activeTarget} ${HMI_CLASSES.focusRing} min-w-[48px] min-h-[48px] flex items-center justify-center rounded text-slate-400 hover:text-white transition-colors`}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap flex-1 scrollbar-thin scrollbar-thumb-emerald-900 scrollbar-track-transparent">
              {changelogRaw}
            </div>
          </div>
        </div>
      )}
    </>
  );
};