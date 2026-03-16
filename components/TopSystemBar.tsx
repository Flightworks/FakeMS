import React, { useState, useEffect } from 'react';
import { SystemStatus } from '../types';

interface TopSystemBarProps {
  systems: SystemStatus;
  cycleNavaidFilter: () => void;
}

const StatusBlock = ({
  label,
  value,
  status = 'default',
  onClick
}: {
  label: string;
  value?: string;
  status?: 'default' | 'active' | 'warning',
  onClick?: () => void
}) => (
  <div
    onClick={onClick}
    className={`
      h-12 min-w-[4rem] px-3 mx-1 flex flex-col items-center justify-center rounded bg-slate-800 border-2 shadow-md transition-all select-none
      ${status === 'active' ? 'border-emerald-600' : status === 'warning' ? 'border-amber-600' : 'border-slate-600'}
      ${onClick ? 'cursor-pointer hover:bg-slate-700 active:scale-95' : ''}
    `}
  >
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 pointer-events-none">{label}</span>
    {value && <span className="text-sm font-bold text-white leading-none pointer-events-none">{value}</span>}
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

export const TopSystemBar: React.FC<TopSystemBarProps> = ({ systems, cycleNavaidFilter }) => {
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const stopProp = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="absolute top-0 left-0 right-0 z-40 h-20 flex flex-col items-start px-4 bg-gradient-to-b from-slate-950/90 to-transparent pointer-events-none">
      <div
        className="flex items-start pt-2 pl-4 pointer-events-auto overflow-x-auto no-scrollbar pb-1"
        onPointerDown={stopProp}
        onMouseDown={stopProp}
        onTouchStart={stopProp}
      >
        <ClockWidget />

        <div className="flex space-x-1">
          <StatusBlock
            label="FILTER"
            value={isFilterMenuOpen ? "ON" : "OFF"}
            status={isFilterMenuOpen ? "active" : "default"}
            onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
          />

          <StatusBlock
            label="RDR"
            value="NAV3D"
            status={systems.radar ? 'active' : 'default'}
          />

          <StatusBlock
            label="EWS"
            value="RLM"
            status={systems.eots ? 'warning' : 'default'}
          />

          <StatusBlock
            label="ADBS-IN"
            value={systems.adsb ? 'AIS' : 'OFF'}
            status={systems.adsb ? 'active' : 'default'}
          />

          <StatusBlock
            label="EOS"
            value={systems.eots ? 'ON' : 'STBY'}
            status={systems.eots ? 'active' : 'default'}
          />

          <StatusBlock label="L22" value="LINK" status="active" />
        </div>
      </div>

      {/* Secondary Filter Row */}
      <div
        className={`
          flex items-start pl-[12rem] pointer-events-auto overflow-x-auto no-scrollbar pt-2 transition-all duration-300 ease-in-out origin-top
          ${isFilterMenuOpen ? 'opacity-100 scale-y-100 h-14' : 'opacity-0 scale-y-0 h-0 overflow-hidden'}
        `}
        onPointerDown={stopProp}
        onMouseDown={stopProp}
        onTouchStart={stopProp}
      >
        <div className="flex space-x-1">
          <StatusBlock
            label="NAVAID"
            value={systems.navaid}
            status={systems.navaid === 'ON' ? 'active' : systems.navaid === 'GHOST' ? 'warning' : 'default'}
            onClick={cycleNavaidFilter}
          />
        </div>
      </div>

    </div>
  );
};