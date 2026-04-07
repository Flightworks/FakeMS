import React, { useState, useEffect } from 'react';
import { SystemStatus, Entity, NavMode } from '../types';
import { X } from 'lucide-react';

interface TopSystemBarProps {
  systems: SystemStatus;
  navMode: NavMode;
  setNavMode: (mode: NavMode) => void;
  ownship: Entity;
  setOwnship: React.Dispatch<React.SetStateAction<Entity>>;
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

export const TopSystemBar: React.FC<TopSystemBarProps> = ({ systems, navMode, setNavMode, ownship, setOwnship }) => {
  const stopProp = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="absolute top-0 left-0 right-0 z-40 h-20 flex items-center px-4 bg-gradient-to-b from-slate-950/90 to-transparent pointer-events-none">
      <div
        className="flex items-start pt-2 pl-4 pointer-events-auto overflow-visible pb-1"
        onPointerDown={stopProp}
        onMouseDown={stopProp}
        onTouchStart={stopProp}
      >
        <ClockWidget />

        <div className="flex space-x-1">
          {/* SIM/REAL Ownship Control Button (Toolbox) */}
          <SimControlWidget navMode={navMode} setNavMode={setNavMode} ownship={ownship} setOwnship={setOwnship} />

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
    </div>
  );
};

const SimControlWidget = ({ navMode, setNavMode, ownship, setOwnship }: {
  navMode: NavMode;
  setNavMode: (mode: NavMode) => void;
  ownship: Entity;
  setOwnship: React.Dispatch<React.SetStateAction<Entity>>;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempHdg, setTempHdg] = useState<string>(ownship.targetHeading !== undefined ? Math.round(ownship.targetHeading).toString() : '0');
  const [tempSpd, setTempSpd] = useState<string>(ownship.targetSpeed !== undefined ? Math.round(ownship.targetSpeed).toString() : '120');
  const [tempTrn, setTempTrn] = useState<string>(ownship.turnRate !== undefined ? ownship.turnRate.toString() : '3');

  useEffect(() => {
    if (isOpen) {
      setTempHdg(ownship.targetHeading !== undefined ? Math.round(ownship.targetHeading).toString() : (ownship.heading !== undefined ? Math.round(ownship.heading).toString() : '0'));
      setTempSpd(ownship.targetSpeed !== undefined ? Math.round(ownship.targetSpeed).toString() : (ownship.speed !== undefined ? Math.round(ownship.speed).toString() : '120'));
      setTempTrn(ownship.turnRate !== undefined ? ownship.turnRate.toString() : '3');
    }
  }, [isOpen, ownship.targetHeading, ownship.targetSpeed, ownship.heading, ownship.speed, ownship.turnRate]);

  const applyParams = () => {
    const hdg = parseFloat(tempHdg);
    const spd = parseFloat(tempSpd);
    const trn = parseFloat(tempTrn);
    setOwnship(prev => ({
      ...prev,
      targetHeading: !isNaN(hdg) ? hdg : prev.targetHeading,
      targetSpeed: !isNaN(spd) ? spd : prev.targetSpeed,
      turnRate: !isNaN(trn) ? trn : prev.turnRate
    }));
  }

  return (
    <div className="relative">
      <div onPointerDown={() => setIsOpen(!isOpen)} className="cursor-pointer transition-transform active:scale-95">
        <StatusBlock 
          label="NAV" 
          value={navMode === NavMode.SIM ? 'SIM ⚠' : 'REAL'} 
          status={navMode === NavMode.SIM ? 'warning' : 'active'} 
        />
      </div>
      {isOpen && (
        <div className="absolute top-14 left-0 w-64 p-4 bg-slate-900 border border-slate-600 rounded-lg shadow-xl z-50 flex flex-col gap-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white font-bold text-sm uppercase">Sim Toolbox</span>
            <button onPointerDown={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X size={16}/></button>
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
            <span className="text-slate-400 text-[10px] font-bold uppercase">Target Heading (°T)</span>
            <div className="flex gap-2">
              <input 
                 value={tempHdg} 
                 onChange={e => setTempHdg(e.target.value)} 
                 className="flex-1 min-w-0 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm disabled:opacity-50"
                 type="number"
                 disabled={navMode !== NavMode.SIM}
              />
              <button 
                onPointerDown={(e) => { e.stopPropagation(); applyParams(); }}
                className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-3 rounded font-bold text-xs text-white" 
                disabled={navMode !== NavMode.SIM}
              >SET</button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-slate-400 text-[10px] font-bold uppercase">Target Speed (KTS)</span>
            <div className="flex gap-2">
               <input 
                 value={tempSpd} 
                 onChange={e => setTempSpd(e.target.value)} 
                 className="flex-1 min-w-0 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm disabled:opacity-50"
                 type="number"
                 disabled={navMode !== NavMode.SIM}
              />
              <button 
                onPointerDown={(e) => { e.stopPropagation(); applyParams(); }}
                className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-3 rounded font-bold text-xs text-white" 
                disabled={navMode !== NavMode.SIM}
              >SET</button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-slate-400 text-[10px] font-bold uppercase">Turn Rate (°/S)</span>
            <div className="flex gap-2">
               <input 
                 value={tempTrn} 
                 onChange={e => setTempTrn(e.target.value)} 
                 className="flex-1 min-w-0 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm disabled:opacity-50"
                 type="number"
                 disabled={navMode !== NavMode.SIM}
              />
              <button 
                onPointerDown={(e) => { e.stopPropagation(); applyParams(); }}
                className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-3 rounded font-bold text-xs text-white" 
                disabled={navMode !== NavMode.SIM}
              >SET</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};