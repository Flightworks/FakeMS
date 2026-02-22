
import React from 'react';
import { Entity, PrototypeSettings } from '../types';
import { Target, Navigation, Check } from 'lucide-react';
import { distanceBetween, bearingBetween } from '../utils/geo';

const DataField = ({ label, value, unit }: { label: string; value: string | number; unit?: string }) => (
  <div className="flex flex-col">
    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{label}</span>
    <span className="text-white font-mono text-base font-bold leading-tight">
      {value}<span className="text-[10px] text-slate-400 ml-0.5 font-normal">{unit}</span>
    </span>
  </div>
);

const stopProp = (e: React.SyntheticEvent) => e.stopPropagation();

export const OwnshipPanel = React.memo(({
  ownship,
  origin,
  prototypeSettings
}: {
  ownship: Entity,
  origin: { lat: number, lon: number },
  prototypeSettings: PrototypeSettings
}) => {
  const { animationSpeed, ownshipPanelPos, ownshipPanelScale, ownshipPanelOpacity, ownshipShowCoords, ownshipShowDetails } = prototypeSettings;

  const latDisplay = `N${Math.floor(origin.lat)}°${(origin.lat % 1 * 60).toFixed(2)}'`;
  const lonDisplay = `E${Math.floor(Math.abs(origin.lon))}°${(Math.abs(origin.lon) % 1 * 60).toFixed(2)}'`;

  /**
   * HUD Safe Zones:
   * TopSystemBar: ~80px (5rem) height at top.
   * LeftSidebar: ~80px (5rem) top offset, 64px (4rem) width.
   * TargetPanel (Bottom Right): Bottom-most anchor.
   */
  const getPositionStyles = () => {
    switch (ownshipPanelPos) {
      case 'TL':
        // Must clear TopSystemBar and LeftSidebar Trigger
        return {
          top: 'calc(5.5rem + env(safe-area-inset-top))',
          left: 'calc(5.5rem + env(safe-area-inset-left))'
        };
      case 'TR':
        // Must clear TopSystemBar
        return {
          top: 'calc(5.5rem + env(safe-area-inset-top))',
          right: 'calc(1rem + env(safe-area-inset-right))'
        };
      case 'BR':
        // Stacked above TargetPanel if that panel were active (approx height 140px / 9rem)
        return {
          bottom: 'calc(10rem + env(safe-area-inset-bottom))',
          right: 'calc(1rem + env(safe-area-inset-right))'
        };
      case 'BL':
      default:
        // Bottom Left is clear, can be flush as requested
        return {
          bottom: 'calc(1rem + env(safe-area-inset-bottom))',
          left: 'calc(1rem + env(safe-area-inset-left))'
        };
    }
  };

  return (
    <div
      className="absolute z-20 bg-slate-900 border-2 border-slate-600 rounded shadow-xl flex flex-col w-auto min-w-[200px] pointer-events-auto overflow-hidden transition-all ease-out"
      style={{
        ...getPositionStyles(),
        opacity: ownshipPanelOpacity,
        transform: `scale(${ownshipPanelScale})`,
        transformOrigin: ownshipPanelPos.includes('L') ? (ownshipPanelPos.includes('T') ? 'top left' : 'bottom left') : (ownshipPanelPos.includes('T') ? 'top right' : 'bottom right'),
        transitionDuration: `${animationSpeed}ms`
      }}
      onPointerDown={stopProp}
      onMouseDown={stopProp}
      onTouchStart={stopProp}
    >
      <div className="bg-slate-800 px-3 py-1 flex items-center justify-between border-b border-slate-600">
        <div className="flex items-center space-x-2">
          <Check size={14} className="text-white" />
          <span className="text-white font-mono font-bold text-xs uppercase tracking-tight">
            {ownship.label}
            {ownshipShowCoords && <span className="text-slate-400 ml-2 font-normal hidden sm:inline">{latDisplay} {lonDisplay}</span>}
          </span>
        </div>
        <Navigation size={12} className="text-emerald-500" />
      </div>

      {ownshipShowDetails && (
        <div className="p-2 grid grid-cols-4 gap-4 bg-slate-950/90 animate-in fade-in slide-in-from-top-2 duration-300">
          <DataField label="HDG" value={Math.round(ownship.heading || 0).toString().padStart(3, '0')} unit="°" />
          <DataField label="HGT" value={Math.round((ownship.altitude || 0) * 0.8)} unit="ft" />
          <DataField label="TAS" value={Math.round(ownship.speed || 0)} unit="kt" />
          <DataField label="ALT" value={Math.round(ownship.altitude || 0)} unit="ft" />
        </div>
      )}

      {!ownshipShowDetails && (
        <div className="px-3 py-1 bg-slate-950/90 text-[10px] text-slate-500 font-mono italic">
          TELEMETRY_MINIMIZED
        </div>
      )}
    </div>
  );
});

export const TargetPanel = React.memo(({ ownship, entity, animationSpeed = 300 }: { ownship: Entity | null, entity: Entity | null, animationSpeed?: number }) => {
  if (!entity || !ownship) return null;

  // Real-time calculations
  const distanceMeters = distanceBetween(
    ownship.position.lat, ownship.position.lon,
    entity.position.lat, entity.position.lon
  );

  const distanceNm = (distanceMeters / 1852).toFixed(1);
  const bearingStr = Math.round(bearingBetween(
    ownship.position.lat, ownship.position.lon,
    entity.position.lat, entity.position.lon
  )).toString().padStart(3, '0');

  const latDisplay = `N${Math.floor(Math.abs(entity.position.lat))}°${(Math.abs(entity.position.lat) % 1 * 60).toFixed(3)}'`;
  const lonDisplay = `E${Math.floor(Math.abs(entity.position.lon))}°${(Math.abs(entity.position.lon) % 1 * 60).toFixed(3)}'`;

  return (
    <div
      className="absolute z-20 bg-slate-900 border-2 border-slate-600 rounded shadow-xl flex flex-col w-auto min-w-[280px] animate-in slide-in-from-right fade-in pointer-events-auto"
      style={{
        bottom: 'calc(1rem + env(safe-area-inset-bottom))',
        right: 'calc(1rem + env(safe-area-inset-right))',
        animationDuration: `${animationSpeed}ms`
      }}
      onPointerDown={stopProp}
      onMouseDown={stopProp}
      onTouchStart={stopProp}
    >
      <div className="bg-slate-800 px-3 py-1 flex items-center justify-between border-b border-slate-600">
        <span className="text-[10px] text-amber-500 font-bold tracking-widest uppercase">FROM H/C</span>
        <Target size={12} className="text-amber-500" />
      </div>

      <div className="p-2 grid grid-cols-3 gap-3 bg-slate-950/90">
        <DataField label="BRG" value={bearingStr} unit="°" />
        <DataField label="DIST" value={distanceNm} unit="NM" />
        <DataField label="ALT" value={Math.round(entity.altitude || 0).toString().padStart(5, '0')} unit="ft" />
      </div>
      <div className="px-2 pb-1 bg-slate-950/90">
        <div className="text-right text-[10px] font-mono text-slate-400">
          {latDisplay} {lonDisplay}
        </div>
      </div>
    </div>
  );
});
