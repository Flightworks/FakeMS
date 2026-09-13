import React, { useState, useEffect, useRef } from 'react';
import { SystemStatus, Entity, MapMode, NavMode, PrototypeSettings, StabMode } from '../types';
import type { SimulationControls } from '../utils/useSimulation';
import {
  navigationStatusLabel,
  OwnshipNavigationState,
} from '../domain/navigation';
import { createDeclutterState, type DeclutterState } from '../domain/declutter';
import type { TacticalLayerState } from '../domain/layers';
import { X } from 'lucide-react';
import { HMI_CLASSES } from './hmiTokens';
import { HmiSettingsPanel } from './pw/HmiSettingsPanel';
import { StabilizationPanel } from './pw/StabilizationPanel';

const hmiButtonClass = `${HMI_CLASSES.activeTarget} ${HMI_CLASSES.actionText} ${HMI_CLASSES.focusRing}`;

interface TopSystemBarProps {
  systems: SystemStatus;
  navMode: NavMode;
  navigationState: OwnshipNavigationState;
  setNavMode: (mode: NavMode) => void;
  ownship: Entity;
  setOwnship: React.Dispatch<React.SetStateAction<Entity>>;
  gestureSettings: PrototypeSettings;
  setGestureSettings: React.Dispatch<React.SetStateAction<PrototypeSettings>>;
  simulationControls: SimulationControls;
  stabMode: StabMode;
  setStabMode: (mode: StabMode | ((previous: StabMode) => StabMode)) => void;
  mapMode: MapMode;
  setMapMode: (mode: MapMode | ((previous: MapMode) => MapMode)) => void;
  groundAnchor: { lat: number; lon: number } | null;
  onResetStab: () => void;
  layers: TacticalLayerState;
  setLayers: (state: TacticalLayerState) => void;
  declutter?: DeclutterState;
  requestSimulationReset: () => void;
  requestSimulationReplay: () => void;
}

const StatusBlock = ({
  label,
  value,
  detail,
  status = 'default',
  onClick,
  buttonRef,
  ariaLabel,
  ariaDescribedBy,
}: {
  label: string;
  value?: string;
  detail?: string;
  status?: 'default' | 'active' | 'warning';
  onClick?: () => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}) => (
  <button
    ref={buttonRef}
    type="button"
    disabled={!onClick}
    aria-label={ariaLabel ?? (value ? `${label} ${value}` : label)}
    aria-describedby={ariaDescribedBy}
    onClick={onClick}
    className={`
      ${HMI_CLASSES.surfaceRaised} ${hmiButtonClass} h-12 min-w-[4rem] px-3 mx-1 flex flex-col items-center justify-center rounded bg-slate-800 border-2 shadow-md
      ${status === 'active' ? 'border-emerald-600' : status === 'warning' ? 'border-amber-600' : 'border-slate-600'}
      ${onClick ? 'cursor-pointer hover:bg-slate-700 transition-colors active:scale-95' : 'cursor-default'}
    `}
  >
    <span className={`${HMI_CLASSES.actionText} font-bold text-slate-400 uppercase tracking-wider mb-0.5`}>{label}</span>
    {value && <span className={`${HMI_CLASSES.actionText} font-bold text-white leading-tight`}>{value}</span>}
    {detail && <span className={`${HMI_CLASSES.actionText} max-w-[12rem] break-words whitespace-normal text-center font-mono font-bold uppercase leading-tight text-slate-300`} data-testid="nav-source-status">{detail}</span>}
  </button>
);

const ClockWidget = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`h-12 px-4 flex items-center justify-center ${HMI_CLASSES.surfacePanel} border-2 border-slate-600 rounded mr-4 shadow-lg`}>
      <span className="text-xl font-mono font-bold text-white tracking-widest">
        {time.toISOString().substring(11, 19)} <span className="text-sm text-slate-400">Z</span>
      </span>
    </div>
  );
};

// ── STAB CONTROL WIDGET ──────────────────────────────────────────────────────
const StabControlWidget = ({ stabMode, mapMode, isOpen, onToggle, buttonRef }: {
  stabMode: StabMode;
  mapMode: MapMode;
  isOpen: boolean;
  onToggle: () => void;
  buttonRef: React.Ref<HTMLButtonElement>;
}) => {
  const anchorLabel = stabMode === StabMode.GND ? 'SOL' : 'SUIVI';
  const orientationLabel = mapMode === MapMode.NORTH_UP ? 'NORD' : 'CAP';

  return (
    <div className="relative">
      <StatusBlock
        label="STABLN"
        value={`${anchorLabel} · ${orientationLabel}`}
        status={isOpen ? 'active' : 'default'}
        onClick={onToggle}
        buttonRef={buttonRef}
        ariaLabel="STABLN CFG"
        ariaDescribedBy="stabilisation-trigger-description"
      />
      <span id="stabilisation-trigger-description" className="sr-only">
        {`Current stabilisation: ${stabMode === StabMode.GND ? 'GND fixed-ground anchor' : 'HELICO ownship follow'}, ${mapMode === MapMode.NORTH_UP ? 'NORTH UP' : 'HEADING UP'}. Open for controls.`}
      </span>
    </div>
  );
};

// ── HMI CONFIG WIDGET ─────────────────────────────────────────────────────────
interface HmiControlWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  buttonRef: React.Ref<HTMLButtonElement>;
}

const HmiControlWidget = ({ isOpen, onToggle, buttonRef }: HmiControlWidgetProps) => {
  return (
    <div className="relative">
      <StatusBlock
        label="HMI"
        value="CFG"
        status={isOpen ? 'active' : 'default'}
        onClick={onToggle}
        buttonRef={buttonRef}
        ariaLabel="HMI CFG"
      />
    </div>
  );
};

// ── SIM CONTROL WIDGET ────────────────────────────────────────────────────────
const SimControlWidget = ({ navigationState, navMode, simulationStatus, simulationIsRunning, onToggle, isOpen }: {
  navigationState: OwnshipNavigationState;
  navMode: NavMode;
  simulationStatus: SimulationControls['status'];
  simulationIsRunning: boolean;
  onToggle: () => void;
  isOpen: boolean;
}) => {
  const statusLabel = navigationStatusLabel(navigationState);
  const status = navigationState.source === 'GPS' && navigationState.validity === 'VALID' ? 'active' : 'warning';
  const positionSource = (navigationState.positionSource ?? navigationState.source) === 'GPS'
    ? navigationState.positionStatus === 'RETAINED' ? 'GPS RETAINED' : 'GPS'
    : 'SIMULATION';
  const speedSource = navigationState.groundSpeed?.source
    ?? (navMode === NavMode.SIM ? 'SIMULATION' : 'GPS');
  const speedQualification = navigationState.groundSpeed?.qualification ?? 'UNAVAILABLE';
  const scenarioStatus = simulationStatus === 'REPLAY · RUNNING'
    ? 'REPLAY'
    : simulationIsRunning
      ? 'RUNNING'
      : 'PAUSED';
  const detail = `POS ${positionSource} · GS ${speedSource}/${speedQualification} · SIM ${scenarioStatus}`;

  return (
    <div className="relative">
      <StatusBlock
        label="NAV"
        value={statusLabel}
        detail={detail}
        status={status}
        onClick={onToggle}
      />
    </div>
  );
};

const SimToolbox = ({ navMode, setNavMode, ownship, setOwnship, onClose, simulationControls, requestSimulationReset, requestSimulationReplay }: {
  navMode: NavMode;
  setNavMode: (mode: NavMode) => void;
  ownship: Entity;
  setOwnship: React.Dispatch<React.SetStateAction<Entity>>;
  onClose: () => void;
  simulationControls: SimulationControls;
  requestSimulationReset: () => void;
  requestSimulationReplay: () => void;
}) => {
  const [tempHdg, setTempHdg] = useState<string>('0');
  const [tempSpd, setTempSpd] = useState<string>('120');
  const [tempTrn, setTempTrn] = useState<string>('3');
  const [isHeadingLocked, setIsHeadingLocked] = useState(false);

  const prevIsOpen = useRef(false);
  useEffect(() => {
    setTempHdg(ownship.targetHeading !== undefined ? Math.round(ownship.targetHeading).toString() : (ownship.heading !== undefined ? Math.round(ownship.heading).toString() : '0'));
    setTempSpd(ownship.targetSpeed !== undefined ? Math.round(ownship.targetSpeed).toString() : (ownship.speed !== undefined ? Math.round(ownship.speed).toString() : '120'));
    setTempTrn(ownship.turnRate !== undefined ? ownship.turnRate.toString() : '3');
  }, [ownship.targetHeading, ownship.targetSpeed, ownship.heading, ownship.speed, ownship.turnRate]);

  useEffect(() => {
    if (!isHeadingLocked || navMode !== NavMode.SIM) return;
    setOwnship(prev => ({ ...prev, targetHeading: prev.heading ?? prev.targetHeading, continuousTurn: null }));
  }, [isHeadingLocked, ownship.heading, navMode, setOwnship]);

  const applyParams = () => {
    const hdg = parseFloat(tempHdg);
    const spd = parseFloat(tempSpd);
    const trn = parseFloat(tempTrn);
    setOwnship(prev => ({
      ...prev,
      targetHeading: !isNaN(hdg) ? hdg : prev.targetHeading,
      targetSpeed: !isNaN(spd) ? spd : prev.targetSpeed,
      turnRate: !isNaN(trn) ? trn : prev.turnRate,
      continuousTurn: null // Clear continuous turn on manual override
    }));
    setIsHeadingLocked(false);
  };

  const applyHeadingPreset = (delta: number) => {
    const base = parseFloat(tempHdg);
    const newHdg = Math.round(((isNaN(base) ? 0 : base) + delta + 360) % 360);
    setTempHdg(newHdg.toString());
  };

  const setContinuousTurn = (dir: 'L' | 'R' | null) => {
    setOwnship(prev => ({ ...prev, continuousTurn: dir }));
    if (dir) setIsHeadingLocked(false);
  };

  const actualHdg = Math.round(ownship.heading ?? 0);
  const targetHdg = Math.round(ownship.targetHeading ?? actualHdg);
  const hdgDiff = ((targetHdg - actualHdg + 180 + 360) % 360) - 180;
  const turnIndicator = ownship.continuousTurn === 'R' ? '↻ R (CONT)' : ownship.continuousTurn === 'L' ? '↺ L (CONT)' : Math.abs(hdgDiff) < 1 ? '—' : hdgDiff > 0 ? '↻ R' : '↺ L';

  const actualSpd = Math.round(ownship.speed ?? 0);
  const targetSpd = Math.round(ownship.targetSpeed ?? actualSpd);
  const spdIndicator = Math.abs(targetSpd - actualSpd) < 1 ? '—' : targetSpd > actualSpd ? '▲' : '▼';

  return (
    <div
      className={`w-64 p-4 ${HMI_CLASSES.surfacePanel} border border-slate-600 rounded-lg shadow-xl flex flex-col gap-3 pointer-events-auto`}
      role="region"
      aria-label="Simulation toolbox"
    >
      <div className="flex justify-between items-center mb-2">
        <span className="text-white font-bold text-sm uppercase">SIM</span>
        <button onClick={onClose} aria-label="Close panel" className={`${hmiButtonClass} text-slate-400 hover:text-white transition-colors`}><X size={16}/></button>
      </div>
      <div className="flex items-center justify-between gap-2 rounded border border-amber-500/50 bg-amber-950/30 px-2 py-2" aria-live="polite">
        <span className="text-[10px] font-bold uppercase text-amber-200">CLOCK</span>
        <span className="text-[10px] font-mono font-bold text-amber-300">{simulationControls.status}</span>
      </div>
      <div className="grid grid-cols-3 gap-1" aria-label="Simulation playback controls">
        {simulationControls.isRunning ? (
          <button
            type="button"
            aria-label="Pause simulation"
            onClick={(e) => { e.stopPropagation(); simulationControls.pause(); }}
            className={`${hmiButtonClass} rounded border border-amber-500/70 bg-amber-950/40 px-2 py-2 text-[10px] font-bold text-amber-200 hover:bg-amber-900`}
          >PAUSE</button>
        ) : (
          <button
            type="button"
            aria-label="Resume simulation"
            onClick={(e) => { e.stopPropagation(); simulationControls.resume(); }}
            className={`${hmiButtonClass} rounded border border-emerald-500/70 bg-emerald-950/40 px-2 py-2 text-[10px] font-bold text-emerald-200 hover:bg-emerald-900`}
          >RESUME</button>
        )}
        <button
          type="button"
          aria-label="Reset simulation"
          onClick={(e) => { e.stopPropagation(); requestSimulationReset(); }}
          className={`${hmiButtonClass} rounded border border-slate-500/70 bg-slate-800 px-2 py-2 text-[10px] font-bold text-slate-200 hover:bg-slate-700`}
        >RESET</button>
        <button
          type="button"
          aria-label="Replay simulation"
          onClick={(e) => { e.stopPropagation(); requestSimulationReplay(); }}
          className={`${hmiButtonClass} rounded border border-cyan-500/70 bg-cyan-950/40 px-2 py-2 text-[10px] font-bold text-cyan-200 hover:bg-cyan-900`}
        >REPLAY</button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-slate-300 text-xs font-bold uppercase">MODE</span>
        <div className="flex bg-slate-800 rounded p-1 border border-slate-700">
          <button
            className={`${hmiButtonClass} px-3 py-1 text-xs font-bold rounded ${navMode === NavMode.REAL ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
            onClick={(e) => { e.stopPropagation(); setNavMode(NavMode.REAL); }}
          >REAL</button>
          <button
            className={`${hmiButtonClass} px-3 py-1 text-xs font-bold rounded ${navMode === NavMode.SIM ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
            onClick={(e) => { e.stopPropagation(); setNavMode(NavMode.SIM); }}
          >SIM</button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[10px] font-bold uppercase">HDG (°T)</span>
          <span className="text-[10px] font-mono">
            <span className="text-slate-500">{actualHdg}° →</span>
            <span className={`ml-1 ${ownship.continuousTurn ? 'text-emerald-400' : Math.abs(hdgDiff) < 1 ? 'text-slate-500' : 'text-amber-400'}`}>{turnIndicator}</span>
          </span>
        </div>
        <input
          aria-label="Simulation target heading"
          value={tempHdg}
          onChange={e => setTempHdg(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm disabled:opacity-50"
          type="number" min="0" max="359"
          disabled={navMode !== NavMode.SIM}
        />
        <div className="flex gap-1 mt-0.5">
          {[{label: '+90', delta: 90}, {label: '+180', delta: 180}, {label: 'RCPL', delta: 180}].map(p => (
            <button
              key={p.label}
              onClick={(e) => { e.stopPropagation(); applyHeadingPreset(p.delta); }}
              disabled={navMode !== NavMode.SIM}
              className={`${hmiButtonClass} flex-1 py-0.5 text-[10px] font-bold rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 transition-colors`}
            >{p.label}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-slate-400 text-[10px] font-bold uppercase">TURN</span>
        <div className="flex gap-1">
          <button
            onClick={() => setContinuousTurn('L')}
            disabled={navMode !== NavMode.SIM}
            className={`${hmiButtonClass} flex-1 py-1 text-[10px] font-bold rounded border transition-colors ${ownship.continuousTurn === 'L' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
          >↺ L</button>
          <button
            onClick={() => setContinuousTurn(null)}
            disabled={navMode !== NavMode.SIM}
            className={`${hmiButtonClass} flex-1 py-1 text-[10px] font-bold rounded border transition-colors ${!ownship.continuousTurn ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
          >OFF</button>
          <button
            onClick={() => setContinuousTurn('R')}
            disabled={navMode !== NavMode.SIM}
            className={`${hmiButtonClass} flex-1 py-1 text-[10px] font-bold rounded border transition-colors ${ownship.continuousTurn === 'R' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
          >↻ R</button>
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); setIsHeadingLocked(v => !v); }}
        disabled={navMode !== NavMode.SIM}
        className={`${hmiButtonClass} w-full py-1.5 text-xs font-bold rounded border transition-colors disabled:opacity-40 ${
          isHeadingLocked
            ? 'bg-amber-600/20 border-amber-500 text-amber-400'
            : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-amber-600 hover:text-amber-400'
        }`}
      >
        {isHeadingLocked ? '🔒 HDG LOCKED' : 'LOCK HDG'}
      </button>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[10px] font-bold uppercase">SPD (KTS)</span>
          <span className="text-[10px] font-mono">
            <span className="text-slate-500">{actualSpd}kt →</span>
            <span className={`ml-1 ${Math.abs(targetSpd - actualSpd) < 1 ? 'text-slate-500' : 'text-blue-400'}`}>{spdIndicator}</span>
          </span>
        </div>
        <input
          aria-label="Simulation target speed"
          value={tempSpd}
          onChange={e => setTempSpd(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm disabled:opacity-50"
          type="number"
          disabled={navMode !== NavMode.SIM}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-slate-400 text-[10px] font-bold uppercase">RATE (°/S)</span>
        <input
          aria-label="Simulation turn rate"
          value={tempTrn}
          onChange={e => setTempTrn(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm disabled:opacity-50"
          type="number"
          disabled={navMode !== NavMode.SIM}
        />
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); applyParams(); }}
        className={`${hmiButtonClass} w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded font-bold text-xs text-white transition-colors uppercase tracking-wider`}
        disabled={navMode !== NavMode.SIM}
      >APPLY</button>
    </div>
  );
};

// ── MAIN TOP SYSTEM BAR ────────────────────────────────────────────────────────
export const TopSystemBar: React.FC<TopSystemBarProps> = ({
  systems,
  navMode,
  navigationState,
  setNavMode,
  ownship,
  setOwnship,
  gestureSettings,
  setGestureSettings,
  simulationControls,
  stabMode,
  setStabMode,
  mapMode,
  setMapMode,
  groundAnchor,
  onResetStab,
  layers,
  setLayers,
  declutter = createDeclutterState(),
  requestSimulationReset,
  requestSimulationReplay,
}) => {
  type ToolboxId = 'sim' | 'stab' | 'hmi';
  const [openToolboxes, setOpenToolboxes] = useState<Set<ToolboxId>>(new Set());
  const stabTriggerRef = useRef<HTMLButtonElement>(null);
  const stabPanelRef = useRef<HTMLDivElement>(null);
  const hmiTriggerRef = useRef<HTMLButtonElement>(null);
  const hmiPanelRef = useRef<HTMLDivElement>(null);
  const stopProp = (e: React.SyntheticEvent) => e.stopPropagation();

  const toggleToolbox = (id: ToolboxId) => {
    setOpenToolboxes(prev => {
      if (prev.has(id)) return new Set();
      return new Set([id]);
    });
  };

  const closeToolbox = React.useCallback((id: ToolboxId) => {
    setOpenToolboxes(prev => {
      if (!prev.has(id)) return prev;
      return new Set();
    });
    if (id === 'stab') stabTriggerRef.current?.focus();
    if (id === 'hmi') hmiTriggerRef.current?.focus();
  }, []);

  const isSimOpen = openToolboxes.has('sim');
  const isStabOpen = openToolboxes.has('stab');
  const isHmiOpen = openToolboxes.has('hmi');

  useEffect(() => {
    if (!isStabOpen) return undefined;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (stabPanelRef.current?.contains(target) || stabTriggerRef.current?.contains(target)) return;

      closeToolbox('stab');
      // Do not let an outside close become a map tap or pan. Other top-bar
      // controls still receive their own pointer event and can open normally.
      if (!target.closest('[data-top-system-bar]')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
  }, [closeToolbox, isStabOpen]);

  useEffect(() => {
    if (!isStabOpen) return undefined;
    const handleStabKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeToolbox('stab');
    };
    document.addEventListener('keydown', handleStabKeyDown);
    return () => document.removeEventListener('keydown', handleStabKeyDown);
  }, [closeToolbox, isStabOpen]);

  useEffect(() => {
    if (!isHmiOpen) return undefined;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (hmiPanelRef.current?.contains(target) || hmiTriggerRef.current?.contains(target)) return;
      // Other top-bar controls still receive their own pointer event and can
      // replace the transient HMI panel. Map input must not leak through it.
      if (!target.closest('[data-top-system-bar]')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
  }, [isHmiOpen]);

  useEffect(() => {
    if (!isHmiOpen) return undefined;
    const handleHmiKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeToolbox('hmi');
    };
    document.addEventListener('keydown', handleHmiKeyDown);
    return () => document.removeEventListener('keydown', handleHmiKeyDown);
  }, [closeToolbox, isHmiOpen]);

  return (
    <div data-top-system-bar className="absolute top-0 left-0 right-0 z-40 flex flex-col pointer-events-none">
      {/* Top Bar Background Gradient removed */}

      {/* Main Bar */}
      <div className="h-20 flex items-center px-4">
        <div
          className="flex items-start pt-2 pl-4 pointer-events-auto overflow-visible pb-1"
          onPointerDown={stopProp}
          onMouseDown={stopProp}
          onTouchStart={stopProp}
        >
          <ClockWidget />

          <div className="flex space-x-1">
            <SimControlWidget
              navigationState={navigationState}
              navMode={navMode}
              simulationStatus={simulationControls.status}
              simulationIsRunning={simulationControls.isRunning}
              isOpen={isSimOpen}
              onToggle={() => toggleToolbox('sim')}
            />

            <StabControlWidget
              stabMode={stabMode}
              mapMode={mapMode}
              isOpen={isStabOpen}
              buttonRef={stabTriggerRef}
              onToggle={() => toggleToolbox('stab')}
            />

            <HmiControlWidget
              isOpen={isHmiOpen}
              buttonRef={hmiTriggerRef}
              onToggle={() => toggleToolbox('hmi')}
            />
          </div>
        </div>
      </div>

      {/* Toolbox Container Area (Non-overlapping) */}
      {(isSimOpen || isStabOpen || isHmiOpen) && (
        <div 
          className="mt-2 pl-44 pr-8 flex flex-row flex-wrap items-start gap-4 pointer-events-auto"
          onPointerDown={stopProp}
        >
          {isSimOpen && (
            <SimToolbox
              navMode={navMode}
              setNavMode={setNavMode}
              ownship={ownship}
              setOwnship={setOwnship}
              simulationControls={simulationControls}
              requestSimulationReset={requestSimulationReset}
              requestSimulationReplay={requestSimulationReplay}
              onClose={() => toggleToolbox('sim')}
            />
          )}
          {isStabOpen && (
            <StabilizationPanel
              stabMode={stabMode}
              setStabMode={setStabMode}
              mapMode={mapMode}
              setMapMode={setMapMode}
              groundAnchor={groundAnchor}
              onResetStab={onResetStab}
              gestureSettings={gestureSettings}
              setGestureSettings={setGestureSettings}
              panelRef={stabPanelRef}
              onClose={() => closeToolbox('stab')}
            />
          )}
          {isHmiOpen && (
            <HmiSettingsPanel
              gestureSettings={gestureSettings}
              setGestureSettings={setGestureSettings}
              layers={layers}
              setLayers={setLayers}
              declutter={declutter}
              panelRef={hmiPanelRef}
              onClose={() => closeToolbox('hmi')}
            />
          )}
        </div>
      )}
    </div>
  );
};