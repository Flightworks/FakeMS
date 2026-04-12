import React, { useState, useEffect, useRef } from 'react';
import { SystemStatus, Entity, NavMode, PrototypeSettings, OwnshipPanelPos } from '../types';
import {
  X, Layout, Move, Maximize, Eye, TrendingUp, MoreHorizontal,
  MousePointer2, Timer, Fingerprint, Zap, Crosshair, ChevronRight, Info
} from 'lucide-react';

interface TopSystemBarProps {
  systems: SystemStatus;
  navMode: NavMode;
  setNavMode: (mode: NavMode) => void;
  ownship: Entity;
  setOwnship: React.Dispatch<React.SetStateAction<Entity>>;
  gestureSettings: PrototypeSettings;
  setGestureSettings: React.Dispatch<React.SetStateAction<PrototypeSettings>>;
}

const StatusBlock = ({
  label,
  value,
  status = 'default',
  onClick
}: {
  label: string;
  value?: string;
  status?: 'default' | 'active' | 'warning';
  onClick?: () => void;
}) => (
  <div
    onClick={onClick}
    className={`
      h-12 min-w-[4rem] px-3 mx-1 flex flex-col items-center justify-center rounded bg-slate-800 border-2 shadow-md
      ${status === 'active' ? 'border-emerald-600' : status === 'warning' ? 'border-amber-600' : 'border-slate-600'}
      ${onClick ? 'cursor-pointer hover:bg-slate-700 transition-colors active:scale-95' : ''}
    `}
  >
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</span>
    {value && <span className="text-sm font-bold text-white leading-none">{value}</span>}
  </div>
);

const ClockWidget = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-12 px-4 flex items-center justify-center bg-slate-900 border-2 border-slate-600 rounded mr-4 shadow-lg">
      <span className="text-xl font-mono font-bold text-white tracking-widest">
        {time.toISOString().substring(11, 19)} <span className="text-sm text-slate-400">Z</span>
      </span>
    </div>
  );
};

// ── STAB CONTROL WIDGET ──────────────────────────────────────────────────────
const StabControlWidget = ({ gestureSettings, setGestureSettings, isOpen, onToggle }: {
  gestureSettings: PrototypeSettings;
  setGestureSettings: React.Dispatch<React.SetStateAction<PrototypeSettings>>;
  isOpen: boolean;
  onToggle: () => void;
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const toggleStabParam = (key: keyof PrototypeSettings) => {
    setGestureSettings(s => ({ ...s, [key]: !s[key as keyof PrototypeSettings] }));
  };

  const cycleDelay = () => {
    const vals = [0, 5000, 10000, 15000];
    setGestureSettings(s => ({ ...s, stabAutoRecenterDelay: vals[(vals.indexOf(s.stabAutoRecenterDelay) + 1) % vals.length] }));
  };

  const delayLabel = (ms: number) => ms === 0 ? 'OFF' : `${ms / 1000}s`;

  const toggles: { key: keyof PrototypeSettings; label: string; description: string }[] = [
    { key: 'stabAutoGndOnPan', label: 'Auto GND on Pan', description: 'Automatically switch to GND stabilisation when the ownship drifts out of the viewport during a pan gesture.' },
    { key: 'stabFreezeHeadingDrop', label: 'Freeze HDG (GND)', description: 'Freeze the map heading at the current ownship heading when dropping into GND stab. In HUP, the map rotation locks so the view stays oriented.' },
    { key: 'stabSnapRecenter', label: 'Snap Recenter', description: 'Skip the fly-back animation when recentering. The map jumps instantly to the ownship position.' },
    { key: 'stabRecenterOnOrientSwitch', label: 'Recenter on Orient', description: 'Automatically return to the ownship when toggling between North-Up and Heading-Up orientation modes.' },
    { key: 'stabSmoothUnfreeze', label: 'Smooth Unfreeze', description: 'When recentering from GND mode, smoothly animate the map rotation back to the live heading instead of snapping.' },
    { key: 'stabMaintainScreenPosOnOrient', label: 'Maintain Pos on Orient', description: 'When switching between North-Up and Heading-Up, rotate the map around the current helicopter position on screen so it stays in the same place.' },
  ];

  return (
    <div className="relative">
      <div onPointerDown={onToggle} className="cursor-pointer transition-transform active:scale-95">
        <StatusBlock label="STABLN" value="CFG" status={isOpen ? 'active' : 'default'} />
      </div>
    </div>
  );
};

const StabToolbox = ({ gestureSettings, setGestureSettings, onClose }: {
  gestureSettings: PrototypeSettings;
  setGestureSettings: React.Dispatch<React.SetStateAction<PrototypeSettings>>;
  onClose: () => void;
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const toggleStabParam = (key: keyof PrototypeSettings) => {
    setGestureSettings(s => ({ ...s, [key]: !s[key as keyof PrototypeSettings] }));
  };

  const cycleDelay = () => {
    const vals = [0, 5000, 10000, 15000];
    setGestureSettings(s => ({ ...s, stabAutoRecenterDelay: vals[(vals.indexOf(s.stabAutoRecenterDelay) + 1) % vals.length] }));
  };

  const delayLabel = (ms: number) => ms === 0 ? 'OFF' : `${ms / 1000}s`;

  const toggles: { key: keyof PrototypeSettings; label: string; description: string }[] = [
    { key: 'stabAutoGndOnPan', label: 'Auto GND on Pan', description: 'Automatically switch to GND stabilisation when the ownship drifts out of the viewport during a pan gesture.' },
    { key: 'stabFreezeHeadingDrop', label: 'Freeze HDG (GND)', description: 'Freeze the map heading at the current ownship heading when dropping into GND stab. In HUP, the map rotation locks so the view stays oriented.' },
    { key: 'stabSnapRecenter', label: 'Snap Recenter', description: 'Skip the fly-back animation when recentering. The map jumps instantly to the ownship position.' },
    { key: 'stabRecenterOnOrientSwitch', label: 'Recenter on Orient', description: 'Automatically return to the ownship when toggling between North-Up and Heading-Up orientation modes.' },
    { key: 'stabSmoothUnfreeze', label: 'Smooth Unfreeze', description: 'When recentering from GND mode, smoothly animate the map rotation back to the live heading instead of snapping.' },
    { key: 'stabMaintainScreenPosOnOrient', label: 'Maintain Pos on Orient', description: 'When switching between North-Up and Heading-Up, rotate the map around the current helicopter position on screen so it stays in the same place.' },
  ];

  return (
    <div className="w-80 p-4 bg-slate-900 border border-slate-600 rounded-lg shadow-xl flex flex-col gap-3 pointer-events-auto">
      <div className="flex justify-between items-center mb-1">
        <span className="text-white font-bold text-sm uppercase flex items-center gap-2">
          <Crosshair size={14} className="text-indigo-400" /> Stab Options
        </span>
        <button onPointerDown={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={16}/></button>
      </div>
      <div className="flex flex-col gap-1 pt-1 border-t border-slate-700">
        {toggles.map(p => (
          <div key={p.key} className="relative flex items-center justify-between gap-2 py-1.5 px-1 rounded hover:bg-slate-800/50">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-slate-200 text-xs font-bold uppercase truncate">{p.label}</span>
              <span
                className="text-slate-500 hover:text-indigo-400 cursor-default shrink-0 transition-colors"
                onMouseEnter={() => setHoveredKey(p.key)}
                onMouseLeave={() => setHoveredKey(null)}
              >
                <Info size={11} />
              </span>
            </div>
            <button
              className={`px-3 py-1 text-xs font-bold rounded shrink-0 transition-colors ${gestureSettings[p.key] ? 'bg-indigo-600 text-white' : 'text-slate-400 bg-slate-800 hover:bg-slate-700'}`}
              onPointerDown={(e) => { e.stopPropagation(); toggleStabParam(p.key); }}
            >
              {gestureSettings[p.key] ? 'ON' : 'OFF'}
            </button>
            {hoveredKey === p.key && (
              <div className="absolute left-0 top-full mt-1 w-72 p-2.5 bg-slate-950 border border-indigo-500/40 rounded-md shadow-2xl z-[60] pointer-events-none">
                <p className="text-[10px] text-slate-300 leading-relaxed">{p.description}</p>
              </div>
            )}
          </div>
        ))}
        <div className="relative flex items-center justify-between gap-2 py-1.5 px-1 rounded hover:bg-slate-800/50">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-slate-200 text-xs font-bold uppercase truncate">Auto Recenter</span>
            <span
              className="text-slate-500 hover:text-indigo-400 cursor-default shrink-0 transition-colors"
              onMouseEnter={() => setHoveredKey('stabAutoRecenterDelay')}
              onMouseLeave={() => setHoveredKey(null)}
            >
              <Info size={11} />
            </span>
          </div>
          <button
            className="px-3 py-1 text-xs font-bold rounded shrink-0 transition-colors text-emerald-400 bg-slate-800 hover:bg-slate-700 font-mono"
            onPointerDown={(e) => { e.stopPropagation(); cycleDelay(); }}
          >
            {delayLabel(gestureSettings.stabAutoRecenterDelay)}
          </button>
          {hoveredKey === 'stabAutoRecenterDelay' && (
            <div className="absolute left-0 top-full mt-1 w-72 p-2.5 bg-slate-950 border border-indigo-500/40 rounded-md shadow-2xl z-[60] pointer-events-none">
              <p className="text-[10px] text-slate-300 leading-relaxed">After this period of inactivity in GND mode, the map automatically recenters on the ownship. Set to OFF to disable.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── HMI CONFIG WIDGET ─────────────────────────────────────────────────────────
interface HmiCategory {
  id: string;
  label: string;
  children: HmiOption[];
}

interface HmiOption {
  id: string;
  label: string;
  subLabel: string;
  description: string;
  action: () => void;
}

const HmiControlWidget = ({ isOpen, onToggle }: {
  isOpen: boolean;
  onToggle: () => void;
}) => {
  return (
    <div className="relative">
      <div onPointerDown={onToggle} className="cursor-pointer transition-transform active:scale-95">
        <StatusBlock label="HMI" value="CFG" status={isOpen ? 'active' : 'default'} />
      </div>
    </div>
  );
};

const HmiToolbox = ({ gestureSettings, setGestureSettings, onClose }: {
  gestureSettings: PrototypeSettings;
  setGestureSettings: React.Dispatch<React.SetStateAction<PrototypeSettings>>;
  onClose: () => void;
}) => {
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const vib = (pattern: number | number[]) => {
    if (gestureSettings.hapticEnabled && navigator.vibrate) navigator.vibrate(pattern);
  };

  const cycleTap = () => {
    const vals = [150, 250, 300, 400, 500];
    setGestureSettings(s => ({ ...s, tapThreshold: vals[(vals.indexOf(s.tapThreshold) + 1) % vals.length] }));
    vib([10, 5, 10]);
  };
  const cycleInd = () => {
    const vals = [250, 400, 600, 700, 800, 1000];
    setGestureSettings(s => ({ ...s, indicatorDelay: vals[(vals.indexOf(s.indicatorDelay) + 1) % vals.length] }));
    vib(10);
  };
  const cycleHld = () => {
    const vals = [800, 1000, 1200, 1500, 2000];
    setGestureSettings(s => ({ ...s, longPressDuration: vals[(vals.indexOf(s.longPressDuration) + 1) % vals.length] }));
    vib(20);
  };
  const cycleScl = () => {
    const vals = [0.8, 0.9, 1.0, 1.1, 1.25, 1.5];
    setGestureSettings(s => ({ ...s, uiScale: vals[(vals.indexOf(s.uiScale) + 1) % vals.length] }));
    vib(5);
  };
  const cycleGlo = () => {
    const vals = [0, 0.3, 0.6, 1.0, 1.5];
    setGestureSettings(s => ({ ...s, glowIntensity: vals[(vals.indexOf(s.glowIntensity) + 1) % vals.length] }));
    vib(5);
  };
  const cycleAni = () => {
    const vals = [0, 150, 300, 600, 1000];
    setGestureSettings(s => ({ ...s, animationSpeed: vals[(vals.indexOf(s.animationSpeed) + 1) % vals.length] }));
    vib(5);
  };
  const cycleDim = () => {
    const vals = [0.2, 0.4, 0.6, 0.8, 1.0];
    setGestureSettings(s => ({ ...s, mapDim: vals[(vals.indexOf(s.mapDim) + 1) % vals.length] }));
    vib(5);
  };
  const cycleHudPos = () => {
    const vals: OwnshipPanelPos[] = ['BL', 'TL', 'TR', 'BR'];
    setGestureSettings(s => ({ ...s, ownshipPanelPos: vals[(vals.indexOf(s.ownshipPanelPos) + 1) % vals.length] }));
    vib(5);
  };
  const cycleHudScale = () => {
    const vals = [0.75, 1.0, 1.25, 1.5];
    setGestureSettings(s => ({ ...s, ownshipPanelScale: vals[(vals.indexOf(s.ownshipPanelScale) + 1) % vals.length] }));
    vib(5);
  };
  const cycleHudAlpha = () => {
    const vals = [0.4, 0.6, 0.8, 0.95];
    setGestureSettings(s => ({ ...s, ownshipPanelOpacity: vals[(vals.indexOf(s.ownshipPanelOpacity) + 1) % vals.length] }));
    vib(5);
  };

  const categories: HmiCategory[] = [
    {
      id: 'hud',
      label: 'HUD',
      children: [
        { id: 'hpos', label: 'POS', subLabel: gestureSettings.ownshipPanelPos, description: 'Ownship infobox corner position.', action: cycleHudPos },
        { id: 'hscl', label: 'SCL', subLabel: `${gestureSettings.ownshipPanelScale}X`, description: 'Ownship infobox scale.', action: cycleHudScale },
        { id: 'halp', label: 'ALP', subLabel: `${Math.round(gestureSettings.ownshipPanelOpacity * 100)}%`, description: 'HUD panel transparency.', action: cycleHudAlpha },
        { id: 'hvec', label: 'VEC', subLabel: gestureSettings.showSpeedVectors ? 'ON' : 'OFF', description: 'Speed vectors for all tracks.', action: () => setGestureSettings(s => ({ ...s, showSpeedVectors: !s.showSpeedVectors })) },
        { id: 'hdet', label: 'DET', subLabel: gestureSettings.ownshipShowDetails ? 'FULL' : 'MIN', description: 'Declutter HUD telemetry.', action: () => setGestureSettings(s => ({ ...s, ownshipShowDetails: !s.ownshipShowDetails })) },
      ]
    },
    {
      id: 'gest',
      label: 'GEST',
      children: [
        { id: 'ptap', label: 'TAP', subLabel: `${gestureSettings.tapThreshold}MS`, description: 'Click vs hold threshold.', action: cycleTap },
        { id: 'pind', label: 'IND', subLabel: `${gestureSettings.indicatorDelay}MS`, description: 'Pie menu ring delay.', action: cycleInd },
        { id: 'phld', label: 'HLD', subLabel: `${gestureSettings.longPressDuration}MS`, description: 'Long press trigger duration.', action: cycleHld },
      ]
    },
    {
      id: 'vis',
      label: 'VIS',
      children: [
        { id: 'vscl', label: 'VSCL', subLabel: `${gestureSettings.uiScale}X`, description: 'Overall UI scale factor.', action: cycleScl },
        { id: 'vglo', label: 'GLO', subLabel: `${Math.round(gestureSettings.glowIntensity * 100)}%`, description: 'HUD glow intensity.', action: cycleGlo },
        { id: 'vdim', label: 'DIM', subLabel: `${Math.round(gestureSettings.mapDim * 100)}%`, description: 'Map layer luminosity.', action: cycleDim },
        { id: 'vani', label: 'ANI', subLabel: `${gestureSettings.animationSpeed}MS`, description: 'UI animation speed.', action: cycleAni },
      ]
    }
  ];

  const activeCategory = categories.find(c => c.id === activeCat);

  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg shadow-xl flex flex-col min-w-[16rem] pointer-events-auto">
      <div className="flex justify-between items-center px-4 py-3 border-b border-slate-700">
        <span className="text-white font-bold text-sm uppercase flex items-center gap-2">
          <Layout size={14} className="text-indigo-400" /> HMI Config
        </span>
        <button onPointerDown={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={16}/></button>
      </div>

      <div className="flex">
        <div className="flex flex-col gap-1 p-2 border-r border-slate-700 min-w-[7rem]">
          {categories.map(cat => (
            <button
              key={cat.id}
              onPointerDown={(e) => { e.stopPropagation(); setActiveCat(activeCat === cat.id ? null : cat.id); }}
              className={`flex items-center justify-between w-full px-3 py-2 rounded text-xs font-bold uppercase transition-colors ${activeCat === cat.id ? 'bg-indigo-700 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              {cat.label}
              <ChevronRight size={12} className={`transition-transform ${activeCat === cat.id ? 'rotate-90' : ''}`} />
            </button>
          ))}
        </div>

        {activeCategory && (
          <div className="flex flex-col gap-1 p-2 min-w-[11rem]">
            {activeCategory.children.map(opt => (
              <button
                key={opt.id}
                onPointerDown={(e) => { e.stopPropagation(); opt.action(); }}
                className="flex items-center justify-between w-full px-3 py-2 rounded text-xs font-bold uppercase text-slate-200 hover:bg-slate-800 transition-colors group"
                title={opt.description}
              >
                <span className="text-slate-400 group-hover:text-slate-200">{opt.label}</span>
                <span className="text-emerald-400 font-mono">{opt.subLabel}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── SIM CONTROL WIDGET ────────────────────────────────────────────────────────
const SimControlWidget = ({ navMode, onToggle, isOpen }: {
  navMode: NavMode;
  onToggle: () => void;
  isOpen: boolean;
}) => {
  return (
    <div className="relative">
      <div onPointerDown={onToggle} className="cursor-pointer transition-transform active:scale-95">
        <StatusBlock
          label="NAV"
          value={navMode === NavMode.SIM ? 'SIM ⚠' : 'REAL'}
          status={navMode === NavMode.SIM ? 'warning' : 'active'}
        />
      </div>
    </div>
  );
};

const SimToolbox = ({ navMode, setNavMode, ownship, setOwnship, onClose }: {
  navMode: NavMode;
  setNavMode: (mode: NavMode) => void;
  ownship: Entity;
  setOwnship: React.Dispatch<React.SetStateAction<Entity>>;
  onClose: () => void;
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
    <div className="w-64 p-4 bg-slate-900 border border-slate-600 rounded-lg shadow-xl flex flex-col gap-3 pointer-events-auto">
      <div className="flex justify-between items-center mb-2">
        <span className="text-white font-bold text-sm uppercase">Sim Toolbox</span>
        <button onPointerDown={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={16}/></button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-slate-300 text-xs font-bold uppercase">Mode:</span>
        <div className="flex bg-slate-800 rounded p-1 border border-slate-700">
          <button
            className={`px-3 py-1 text-xs font-bold rounded ${navMode === NavMode.REAL ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
            onPointerDown={(e) => { e.stopPropagation(); setNavMode(NavMode.REAL); }}
          >REAL</button>
          <button
            className={`px-3 py-1 text-xs font-bold rounded ${navMode === NavMode.SIM ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
            onPointerDown={(e) => { e.stopPropagation(); setNavMode(NavMode.SIM); }}
          >SIM</button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[10px] font-bold uppercase">Target Heading (°T)</span>
          <span className="text-[10px] font-mono">
            <span className="text-slate-500">{actualHdg}° →</span>
            <span className={`ml-1 ${ownship.continuousTurn ? 'text-emerald-400' : Math.abs(hdgDiff) < 1 ? 'text-slate-500' : 'text-amber-400'}`}>{turnIndicator}</span>
          </span>
        </div>
        <input
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
              onPointerDown={(e) => { e.stopPropagation(); applyHeadingPreset(p.delta); }}
              disabled={navMode !== NavMode.SIM}
              className="flex-1 py-0.5 text-[10px] font-bold rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 transition-colors"
            >{p.label}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-slate-400 text-[10px] font-bold uppercase">Continuous Turn</span>
        <div className="flex gap-1">
          <button
            onPointerDown={() => setContinuousTurn('L')}
            disabled={navMode !== NavMode.SIM}
            className={`flex-1 py-1 text-[10px] font-bold rounded border transition-colors ${ownship.continuousTurn === 'L' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
          >↺ L</button>
          <button
            onPointerDown={() => setContinuousTurn(null)}
            disabled={navMode !== NavMode.SIM}
            className={`flex-1 py-1 text-[10px] font-bold rounded border transition-colors ${!ownship.continuousTurn ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
          >OFF</button>
          <button
            onPointerDown={() => setContinuousTurn('R')}
            disabled={navMode !== NavMode.SIM}
            className={`flex-1 py-1 text-[10px] font-bold rounded border transition-colors ${ownship.continuousTurn === 'R' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
          >↻ R</button>
        </div>
      </div>

      <button
        onPointerDown={(e) => { e.stopPropagation(); setIsHeadingLocked(v => !v); }}
        disabled={navMode !== NavMode.SIM}
        className={`w-full py-1.5 text-xs font-bold rounded border transition-colors disabled:opacity-40 ${
          isHeadingLocked
            ? 'bg-amber-600/20 border-amber-500 text-amber-400'
            : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-amber-600 hover:text-amber-400'
        }`}
      >
        {isHeadingLocked ? '🔒 HDG LOCKED — Flying Straight' : 'LOCK HDG (Stop Rotation)'}
      </button>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[10px] font-bold uppercase">Target Speed (KTS)</span>
          <span className="text-[10px] font-mono">
            <span className="text-slate-500">{actualSpd}kt →</span>
            <span className={`ml-1 ${Math.abs(targetSpd - actualSpd) < 1 ? 'text-slate-500' : 'text-blue-400'}`}>{spdIndicator}</span>
          </span>
        </div>
        <input
          value={tempSpd}
          onChange={e => setTempSpd(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm disabled:opacity-50"
          type="number"
          disabled={navMode !== NavMode.SIM}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-slate-400 text-[10px] font-bold uppercase">Turn Rate (°/S)</span>
        <input
          value={tempTrn}
          onChange={e => setTempTrn(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm disabled:opacity-50"
          type="number"
          disabled={navMode !== NavMode.SIM}
        />
      </div>

      <button
        onPointerDown={(e) => { e.stopPropagation(); applyParams(); }}
        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded font-bold text-xs text-white transition-colors uppercase tracking-wider"
        disabled={navMode !== NavMode.SIM}
      >Apply All</button>
    </div>
  );
};

// ── MAIN TOP SYSTEM BAR ────────────────────────────────────────────────────────
export const TopSystemBar: React.FC<TopSystemBarProps> = ({
  systems, navMode, setNavMode, ownship, setOwnship, gestureSettings, setGestureSettings
}) => {
  const [openToolboxes, setOpenToolboxes] = useState<Set<string>>(new Set());
  const stopProp = (e: React.SyntheticEvent) => e.stopPropagation();

  const toggleToolbox = (id: string) => {
    setOpenToolboxes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isSimOpen = openToolboxes.has('sim');
  const isStabOpen = openToolboxes.has('stab');
  const isHmiOpen = openToolboxes.has('hmi');

  return (
    <div className="absolute top-0 left-0 right-0 z-40 flex flex-col pointer-events-none">
      {/* Top Bar Background Gradient */}
      <div className="absolute inset-0 h-40 bg-gradient-to-b from-slate-950/80 to-transparent -z-10" />

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
              navMode={navMode}
              isOpen={isSimOpen}
              onToggle={() => toggleToolbox('sim')}
            />

            <StabControlWidget
              gestureSettings={gestureSettings}
              setGestureSettings={setGestureSettings}
              isOpen={isStabOpen}
              onToggle={() => toggleToolbox('stab')}
            />

            <HmiControlWidget
              isOpen={isHmiOpen}
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
              onClose={() => toggleToolbox('sim')}
            />
          )}
          {isStabOpen && (
            <StabToolbox
              gestureSettings={gestureSettings}
              setGestureSettings={setGestureSettings}
              onClose={() => toggleToolbox('stab')}
            />
          )}
          {isHmiOpen && (
            <HmiToolbox
              gestureSettings={gestureSettings}
              setGestureSettings={setGestureSettings}
              onClose={() => toggleToolbox('hmi')}
            />
          )}
        </div>
      )}
    </div>
  );
};