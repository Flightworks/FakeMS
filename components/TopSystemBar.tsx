import React, { useState, useEffect } from 'react';
import { SystemStatus } from '../types';

interface TopSystemBarProps {
  systems: SystemStatus;
}

const StatusBlock = ({ 
  label, 
  value, 
  status = 'default' 
}: { 
  label: string; 
  value?: string; 
  status?: 'default' | 'active' | 'warning' 
}) => (
  <div className={`
    h-12 min-w-[4rem] px-3 mx-1 flex flex-col items-center justify-center rounded bg-slate-800 border-2 shadow-md
    ${status === 'active' ? 'border-emerald-600' : status === 'warning' ? 'border-amber-600' : 'border-slate-600'}
  `}>
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

export const TopSystemBar: React.FC<TopSystemBarProps> = ({ systems }) => {
  const stopProp = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="absolute top-0 left-0 right-0 z-40 h-20 flex items-center px-4 bg-gradient-to-b from-slate-950/90 to-transparent pointer-events-none">
      <div 
        className="flex items-start pt-2 pl-4 pointer-events-auto overflow-x-auto no-scrollbar pb-1"
        onPointerDown={stopProp}
        onMouseDown={stopProp}
        onTouchStart={stopProp}
      >
        <ClockWidget />

        <div className="flex space-x-1">
          <StatusBlock label="FILTER" value="1" />
          
          <StatusBlock 
            label="RDR" 
            value="MRMS" 
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
    </div>
  );
};