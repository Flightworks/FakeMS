import React, { useState, useEffect, useRef } from 'react';
import { MapMode, SystemStatus, PrototypeSettings, OwnshipPanelPos, Entity, StabMode } from '../types';
import packageData from '../package.json';
import changelogRaw from '../CHANGELOG.md?raw';
import {
  Menu, ArrowUp, Map as MapIcon, Layers, Crosshair,
  ScanLine, Wrench, Search, Compass, X, Globe, Video, Eye, Target,
  Fingerprint, Timer, Move, MousePointer2, Maximize, Palette, Zap, Smartphone,
  BookOpen, Layout, MoreHorizontal, MapPin, TrendingUp, Info
} from 'lucide-react';

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
}

const SidebarButton: React.FC<SidebarButtonProps> = ({
  label,
  subLabel,
  icon: Icon,
  active = false,
  onClick
}) => (
  <button
    onClick={onClick}
    className={`
      w-16 h-16 flex flex-col items-center justify-center rounded-md border-2 shadow-lg transition-all duration-100 active:scale-95 shrink-0 pointer-events-auto
      ${active
        ? 'bg-emerald-900 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
        : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
      }
    `}
  >
    {Icon && <Icon size={24} className={`mb-0.5 ${active ? 'text-emerald-200' : 'text-slate-400'}`} />}
    {label && <span className="text-[10px] font-bold uppercase leading-none">{label}</span>}
    {subLabel && <span className={`text-[9px] font-bold uppercase leading-none mt-0.5 ${active ? 'text-emerald-300' : 'text-emerald-500'}`}>{subLabel}</span>}
  </button>
);

const ParameterHelper: React.FC<{ activeCategory: QakOption | undefined }> = ({ activeCategory }) => {
  if (!activeCategory || !['prot', 'vis', 'hud'].includes(activeCategory.id)) return null;

  return (
    <div className="fixed right-6 top-24 w-64 bg-slate-950/90 border-2 border-emerald-600/50 rounded-lg p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-right-4 duration-300 pointer-events-none">
      <div className="flex items-center gap-2 mb-3 border-b border-emerald-900/50 pb-2">
        <BookOpen size={16} className="text-emerald-400" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">DATA REF: {activeCategory.label}</span>
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
        MISSION_SYSTEM_MANUAL_V2.5
      </div>
    </div>
  );
};

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  mapMode, setMapMode, toggleLayer, systems, toggleSystem, isOpen, onToggle,
  gestureSettings, setGestureSettings, onOpenCommandPalette, ownship,
  stabMode, setStabMode, onResetStab
}) => {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const lastTopRef = useRef(0);

  useEffect(() => {
    if (!isOpen) setActiveCategoryId(null);
  }, [isOpen]);

  const handleCategoryClick = (item: QakOption) => {
    if (activeCategoryId === item.id) {
      setActiveCategoryId(null);
    } else {
      setActiveCategoryId(item.id);
    }
    if (!item.children && item.action) item.action();
  };

  const vib = (pattern: number | number[]) => { if (gestureSettings.hapticEnabled && navigator.vibrate) navigator.vibrate(pattern); };

  const cycleTap = () => {
    const vals = [150, 250, 300, 400, 500];
    const next = vals[(vals.indexOf(gestureSettings.tapThreshold) + 1) % vals.length];
    setGestureSettings(s => ({ ...s, tapThreshold: next }));
    vib([10, 5, 10]);
  };

  const cycleInd = () => {
    const vals = [250, 400, 600, 700, 800, 1000];
    const next = vals[(vals.indexOf(gestureSettings.indicatorDelay) + 1) % vals.length];
    setGestureSettings(s => ({ ...s, indicatorDelay: next }));
    vib(10);
  };

  const cycleHld = () => {
    const vals = [800, 1000, 1200, 1500, 2000];
    const next = vals[(vals.indexOf(gestureSettings.longPressDuration) + 1) % vals.length];
    setGestureSettings(s => ({ ...s, longPressDuration: next }));
    vib(20);
  };

  const cycleScl = () => {
    const vals = [0.8, 0.9, 1.0, 1.1, 1.25, 1.5];
    const next = vals[(vals.indexOf(gestureSettings.uiScale) + 1) % vals.length];
    setGestureSettings(s => ({ ...s, uiScale: next }));
    vib(5);
  };

  const cycleGlo = () => {
    const vals = [0, 0.3, 0.6, 1.0, 1.5];
    const next = vals[(vals.indexOf(gestureSettings.glowIntensity) + 1) % vals.length];
    setGestureSettings(s => ({ ...s, glowIntensity: next }));
    vib(5);
  };

  const cycleAni = () => {
    const vals = [0, 150, 300, 600, 1000];
    const next = vals[(vals.indexOf(gestureSettings.animationSpeed) + 1) % vals.length];
    setGestureSettings(s => ({ ...s, animationSpeed: next }));
    vib(5);
  };

  const cycleDim = () => {
    const vals = [0.2, 0.4, 0.6, 0.8, 1.0];
    const next = vals[(vals.indexOf(gestureSettings.mapDim) + 1) % vals.length];
    setGestureSettings(s => ({ ...s, mapDim: next }));
    vib(5);
  };

  // HUD Cycling Helpers
  const cycleHudPos = () => {
    const vals: OwnshipPanelPos[] = ['BL', 'TL', 'TR', 'BR'];
    const next = vals[(vals.indexOf(gestureSettings.ownshipPanelPos) + 1) % vals.length];
    setGestureSettings(s => ({ ...s, ownshipPanelPos: next }));
    vib(5);
  };

  const cycleHudScale = () => {
    const vals = [0.75, 1.0, 1.25, 1.5];
    const next = vals[(vals.indexOf(gestureSettings.ownshipPanelScale) + 1) % vals.length];
    setGestureSettings(s => ({ ...s, ownshipPanelScale: next }));
    vib(5);
  };

  const cycleHudAlpha = () => {
    const vals = [0.4, 0.6, 0.8, 0.95];
    const next = vals[(vals.indexOf(gestureSettings.ownshipPanelOpacity) + 1) % vals.length];
    setGestureSettings(s => ({ ...s, ownshipPanelOpacity: next }));
    vib(5);
  };

  const menuConfig: QakOption[] = [
    {
      id: 'stab',
      label: 'STAB',
      subLabel: stabMode === StabMode.GND ? 'GND' : 'HELICO',
      icon: Crosshair,
      active: activeCategoryId === 'stab' || stabMode === StabMode.GND,
      action: () => { if (stabMode === StabMode.GND) onResetStab(); },
      description: "Recenter and anchor the tactical map to the ownship.",
      children: [
        { id: 'st-gnd', label: 'GND', icon: MapPin, active: stabMode === StabMode.GND, action: () => { setStabMode(StabMode.GND); onResetStab(); }, description: "Ground stabilized mode. Detaches from ownship." },
        { id: 'st-heli', label: 'HELICO', icon: Target, active: stabMode === StabMode.HELICO, action: () => { setStabMode(StabMode.HELICO); onResetStab(); }, description: "Anchors to the ownship." },
        { id: 'st-flex', label: 'FLEX', subLabel: gestureSettings.flexibleHelicoStab ? 'ON' : 'OFF', icon: Move, active: gestureSettings.flexibleHelicoStab, action: () => setGestureSettings(s => ({ ...s, flexibleHelicoStab: !s.flexibleHelicoStab })), description: "If ON, panning maintains HELICO with offset until ownship is out of view." }
      ]
    },
    {
      id: 'hud',
      label: 'HUD',
      subLabel: 'MSN',
      icon: Layout,
      active: activeCategoryId === 'hud',
      children: [
        { id: 'hpos', label: 'POS', subLabel: gestureSettings.ownshipPanelPos, icon: Move, action: cycleHudPos, description: "Change the anchor position of the Ownship Infobox." },
        { id: 'hscl', label: 'SCL', subLabel: `${gestureSettings.ownshipPanelScale}X`, icon: Maximize, action: cycleHudScale, description: "Scale the Ownship Infobox for readability." },
        { id: 'halp', label: 'ALP', subLabel: `${Math.round(gestureSettings.ownshipPanelOpacity * 100)}%`, icon: Eye, action: cycleHudAlpha, description: "Adjust the transparency of the HUD elements." },
        { id: 'hvec', label: 'VEC', subLabel: gestureSettings.showSpeedVectors ? 'ON' : 'OFF', icon: TrendingUp, active: gestureSettings.showSpeedVectors, action: () => setGestureSettings(s => ({ ...s, showSpeedVectors: !s.showSpeedVectors })), description: "Toggle velocity leaders (speed vectors) for all tracked entities." },
        { id: 'hgeo', label: 'GEO', subLabel: gestureSettings.ownshipShowCoords ? 'ON' : 'OFF', icon: MapPin, active: gestureSettings.ownshipShowCoords, action: () => setGestureSettings(s => ({ ...s, ownshipShowCoords: !s.ownshipShowCoords })), description: "Toggle coordinate display in the ownship header." },
        { id: 'hdet', label: 'DET', subLabel: gestureSettings.ownshipShowDetails ? 'FULL' : 'MIN', icon: MoreHorizontal, active: gestureSettings.ownshipShowDetails, action: () => setGestureSettings(s => ({ ...s, ownshipShowDetails: !s.ownshipShowDetails })), description: "Declutter toggle: Hide or show telemetry details (Speed, Alt, etc.)." }
      ]
    },
    {
      id: 'prot',
      label: 'GEST',
      subLabel: 'CFG',
      icon: Fingerprint,
      active: activeCategoryId === 'prot',
      children: [
        { id: 'ptap', label: 'TAP', subLabel: `${gestureSettings.tapThreshold}MS`, icon: MousePointer2, action: cycleTap, description: "Threshold to distinguish a 'Click' from a 'Hold' action." },
        { id: 'pind', label: 'IND', subLabel: `${gestureSettings.indicatorDelay}MS`, icon: Timer, action: cycleInd, description: "Delay before the emerald visual progress ring appears." },
        { id: 'phld', label: 'HLD', subLabel: `${gestureSettings.longPressDuration}MS`, icon: Fingerprint, action: cycleHld, description: "Total duration required to trigger the Contextual Pie Menu." },
        { id: 'phap', label: 'HAP', subLabel: gestureSettings.hapticEnabled ? 'ON' : 'OFF', icon: Smartphone, active: gestureSettings.hapticEnabled, action: () => setGestureSettings(s => ({ ...s, hapticEnabled: !s.hapticEnabled })), description: "Master toggle for tactile vibration feedback signals." }
      ]
    },
    {
      id: 'vis',
      label: 'VIS',
      subLabel: 'UI',
      icon: Palette,
      active: activeCategoryId === 'vis',
      children: [
        { id: 'vscl', label: 'SCL', subLabel: `${gestureSettings.uiScale}X`, icon: Maximize, action: cycleScl, description: "Resizes all UI elements to test ergonomic fit for various hardware." },
        { id: 'vglo', label: 'GLO', subLabel: `${Math.round(gestureSettings.glowIntensity * 100)}%`, icon: Zap, action: cycleGlo, description: "Adjusts the bloom intensity for HUD-style light effects." },
        { id: 'vani', label: 'ANI', subLabel: `${gestureSettings.animationSpeed}MS`, icon: Move, action: cycleAni, description: "Duration for system transitions like map centering." },
        { id: 'vdim', label: 'DIM', subLabel: `${Math.round(gestureSettings.mapDim * 100)}%`, icon: Eye, action: cycleDim, description: "Luminosity filter for the map layer to enhance data focus." }
      ]
    },
    {
      id: 'version',
      label: 'VER',
      subLabel: `v${packageData.version}`,
      icon: Info,
      action: () => setShowChangelog(true),
      active: showChangelog
    },
    {
      id: 'search',
      label: 'FIND',
      subLabel: 'CMD',
      icon: Search,
      action: onOpenCommandPalette,
      active: activeCategoryId === 'search'
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

  const compassRotation = mapMode === MapMode.NORTH_UP ? 0 : -(ownship.heading || 0);

  return (
    <>
      <div className="absolute z-30 left-2 flex flex-col gap-2 items-start pointer-events-none" style={{ top: 'calc(5rem + env(safe-area-inset-top))' }}>
        <div className="flex flex-row gap-2">
          <SidebarButton label="" icon={isOpen ? X : Menu} onClick={onToggle} active={isOpen} />
          <button
            onClick={() => setMapMode(mapMode === MapMode.NORTH_UP ? MapMode.HEADING_UP : MapMode.NORTH_UP)}
            className="w-16 h-16 flex items-center justify-center rounded-full border-2 border-slate-600 shadow-lg transition-all duration-100 active:scale-95 shrink-0 pointer-events-auto bg-slate-800/90 backdrop-blur-md text-slate-300 hover:bg-slate-700/90"
            title={`Active: ${mapMode === MapMode.NORTH_UP ? 'NORTH UP' : 'HEADING UP'}`}
          >
            <div className="relative flex items-center justify-center w-full h-full">
              <ArrowUp
                size={32}
                className="text-slate-200"
                style={{ transform: `rotate(${compassRotation}deg)`, transition: 'transform 0.3s ease-out' }}
              />
            </div>
          </button>
        </div>
        <div className="relative flex flex-row items-start gap-2">
          <div className={`flex flex-col gap-2 p-1 bg-slate-950/80 backdrop-blur-md rounded-lg border border-slate-800/50 transition-all duration-300 ease-in-out origin-top-left ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-0 pointer-events-none'}`}>
            {menuConfig.map(item => (
              <SidebarButton key={item.id} label={item.label} subLabel={item.subLabel} icon={item.icon} active={item.active} onClick={() => handleCategoryClick(item)} />
            ))}
          </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto" onClick={() => setShowChangelog(false)}>
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
                onClick={() => setShowChangelog(false)}
                className="text-slate-400 hover:text-white transition-colors"
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