import React, { useMemo, useState, useRef, useEffect } from 'react';
import { X, ChevronRight } from 'lucide-react';

export interface PieMenuOption {
  label: string;
  icon: React.ElementType;
  action?: () => void;
  color?: 'danger' | 'primary' | 'default';
  subOptions?: PieMenuOption[];
}

interface PieMenuProps {
  x: number;
  y: number;
  options: PieMenuOption[];
  onClose: () => void;
  title?: string;
  glowIntensity?: number;
  hapticEnabled?: boolean;
}

// --- Geometry Helpers ---
const toRad = (deg: number) => (deg * Math.PI) / 180;

// Generate SVG Path for a ring sector
const getSectorPath = (
  outerR: number,
  innerR: number,
  startAngleDeg: number,
  endAngleDeg: number,
  gap: number = 2
) => {
  const start = startAngleDeg + gap / 2;
  const end = endAngleDeg - gap / 2;

  // Prevent inverse arcs
  if (start >= end) return '';

  const startRad = toRad(start - 90);
  const endRad = toRad(end - 90);

  const p1x = outerR * Math.cos(startRad);
  const p1y = outerR * Math.sin(startRad);
  const p2x = outerR * Math.cos(endRad);
  const p2y = outerR * Math.sin(endRad);

  const p3x = innerR * Math.cos(endRad);
  const p3y = innerR * Math.sin(endRad);
  const p4x = innerR * Math.cos(startRad);
  const p4y = innerR * Math.sin(startRad);

  const largeArc = (end - start) > 180 ? 1 : 0;

  return `
    M ${p1x} ${p1y}
    A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2x} ${p2y}
    L ${p3x} ${p3y}
    A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4x} ${p4y}
    Z
  `;
};

export const PieMenu: React.FC<PieMenuProps> = ({ x, y, options, onClose, title, glowIntensity = 1, hapticEnabled = true }) => {
  const [activeInnerIndex, setActiveInnerIndex] = useState<number | null>(null);
  const [activeOuterIndex, setActiveOuterIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const mountTime = useRef(Date.now());

  // Dimensions
  const INNER_R_IN = 25;
  const INNER_R_OUT = 95;
  const OUTER_R_IN = 100;
  const OUTER_R_OUT = 175;
  const SECTOR_ANGLE = 50;

  const vib = (pattern: number | number[]) => { if (hapticEnabled && navigator.vibrate) navigator.vibrate(pattern); };

  // --- Smart Orientation Logic ---
  const startAngle = useMemo(() => {
    // Fixed Orientation: 10 o'clock position
    const fanCenterDeg = -60;
    const totalFanAngle = options.length * SECTOR_ANGLE;
    return fanCenterDeg - (totalFanAngle / 2);
  }, [options.length]);


  // --- Helper: Logic to determine indices from coordinates ---
  const calculateIndices = (clientX: number, clientY: number) => {
    const dx = clientX - x;
    const dy = clientY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let nextInner: number | null = null;
    let nextOuter: number | null = null;

    // Strict distance gating
    if (dist < INNER_R_IN || dist > OUTER_R_OUT + 20) {
      return { nextInner: null, nextOuter: null, dist };
    }

    // Angle (0 = Up/North, 90 = Right, 180 = Down)
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;

    // Check Inner Ring Bounds
    if (dist >= INNER_R_IN && dist <= INNER_R_OUT + 5) {
      for (let i = 0; i < options.length; i++) {
        const s = startAngle + (i * SECTOR_ANGLE);
        const e = s + SECTOR_ANGLE;

        let testAngle = angle;
        while (testAngle < s - 180) testAngle += 360;
        while (testAngle > s + 180) testAngle -= 360;

        if (testAngle >= s && testAngle < e) {
          nextInner = i;
          break;
        }
      }
    }

    // Check Outer Ring (only if a parent is selected or active)
    if (dist >= OUTER_R_IN - 5 && dist <= OUTER_R_OUT + 15) {
      // Check against active parent index first for stability
      const parentIdx = nextInner !== null ? nextInner : activeInnerIndex;
      if (parentIdx !== null) {
        const parent = options[parentIdx];
        if (parent.subOptions && parent.subOptions.length > 0) {
          const subCount = parent.subOptions.length;
          const parentMid = startAngle + (parentIdx * SECTOR_ANGLE) + (SECTOR_ANGLE / 2);
          const subStep = Math.min(45, 120 / subCount);
          const totalSubArc = subCount * subStep;
          const subStart = parentMid - (totalSubArc / 2);

          for (let j = 0; j < subCount; j++) {
            const s = subStart + (j * subStep);
            const e = s + subStep;

            let testAngle = angle;
            while (testAngle < s - 180) testAngle += 360;
            while (testAngle > s + 180) testAngle -= 360;

            if (testAngle >= s && testAngle < e) {
              nextOuter = j;
              nextInner = parentIdx;
              break;
            }
          }
        }
      }
    }

    return { nextInner, nextOuter, dist };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { nextInner, nextOuter, dist } = calculateIndices(e.clientX, e.clientY);

    // If user taps clearly outside the menu, close immediately
    if (nextInner === null && dist > OUTER_R_OUT) {
      onClose();
      return;
    }

    if (nextInner !== null) {
      setActiveInnerIndex(nextInner);
      if (nextOuter !== null) setActiveOuterIndex(nextOuter);
      vib(5);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const { nextInner, nextOuter, dist } = calculateIndices(e.clientX, e.clientY);

    if (dist < INNER_R_IN) {
      if (activeInnerIndex !== null) {
        setActiveInnerIndex(null);
        setActiveOuterIndex(null);
      }
    } else {
      if (nextInner !== null && nextInner !== activeInnerIndex) {
        setActiveInnerIndex(nextInner);
        setActiveOuterIndex(null);
        vib(10);
      }
      if (dist > INNER_R_OUT) {
        if (nextOuter !== activeOuterIndex) {
          setActiveOuterIndex(nextOuter);
          if (nextOuter !== null) vib(15);
        }
      } else {
        if (activeOuterIndex !== null) setActiveOuterIndex(null);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const { nextInner, nextOuter, dist } = calculateIndices(e.clientX, e.clientY);

    // If outside boundary, treat as close request
    if (dist > OUTER_R_OUT + 10) {
      // Prevent closing immediately after auto-open (HLD trigger)
      if (Date.now() - mountTime.current < 400) return;
      onClose();
      return;
    }

    let finalInner = nextInner;
    let finalOuter = nextOuter;

    // Small recovery logic: if we just let go and were over something, use it
    if (finalInner === null && dist > INNER_R_IN && dist < OUTER_R_OUT) {
      finalInner = activeInnerIndex;
      if (finalOuter === null) finalOuter = activeOuterIndex;
    }

    if (finalInner !== null) {
      const parent = options[finalInner];
      if (finalOuter !== null && parent.subOptions && parent.subOptions[finalOuter]) {
        const sub = parent.subOptions[finalOuter];
        if (sub.action) sub.action();
        onClose();
      }
      else if (finalOuter === null) {
        if (!parent.subOptions || parent.subOptions.length === 0) {
          if (parent.action) parent.action();
          onClose();
        } else {
          // If we tapped a parent with sub-options, make sure it's active
          if (finalInner !== activeInnerIndex) {
            setActiveInnerIndex(finalInner);
          }
        }
      }
    } else {
      // Released in center -> Close (if not immediate post-open release)
      if (dist < INNER_R_IN) {
        if (Date.now() - mountTime.current > 400) {
          onClose();
        }
        return;
      }
      // Released in gaps without selection -> Stay Open
      return;
    }
  };

  const innerSlices = useMemo(() => {
    return options.map((opt, i) => {
      const s = startAngle + (i * SECTOR_ANGLE);
      const e = s + SECTOR_ANGLE;
      const path = getSectorPath(INNER_R_OUT, INNER_R_IN, s, e, 2);
      const mid = s + (SECTOR_ANGLE / 2);
      const r = (INNER_R_IN + INNER_R_OUT) / 2;
      const rad = toRad(mid - 90);
      return { ...opt, path, iconX: r * Math.cos(rad), iconY: r * Math.sin(rad), midAngle: mid };
    });
  }, [options, startAngle]);

  const activeSubSlices = useMemo(() => {
    if (activeInnerIndex === null) return [];
    const parent = options[activeInnerIndex];
    if (!parent.subOptions) return [];

    const subCount = parent.subOptions.length;
    const parentMid = innerSlices[activeInnerIndex].midAngle;
    const subStep = Math.min(45, 120 / subCount);
    const totalSubArc = subCount * subStep;
    const subStart = parentMid - (totalSubArc / 2);

    return parent.subOptions.map((sub, j) => {
      const s = subStart + (j * subStep);
      const e = s + subStep;
      const path = getSectorPath(OUTER_R_OUT, OUTER_R_IN, s, e, 2);
      const mid = s + (subStep / 2);
      const r = (OUTER_R_IN + OUTER_R_OUT) / 2;
      const rad = toRad(mid - 90);
      return { ...sub, path, iconX: r * Math.cos(rad), iconY: r * Math.sin(rad) };
    });
  }, [options, activeInnerIndex, startAngle, innerSlices]);

  return (
    <div
      className="fixed inset-0 z-[60] overflow-hidden touch-none select-none pointer-events-auto"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => {
        e.stopPropagation();
        if (Date.now() - mountTime.current < 400) return;
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="absolute inset-0 bg-black/20 animate-in fade-in duration-200" />
      <div className="absolute w-0 h-0" style={{ left: x, top: y }}>
        <svg
          width="600"
          height="600"
          viewBox="-300 -300 600 600"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible drop-shadow-2xl pointer-events-none"
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation={2.5 * glowIntensity} result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {innerSlices.map((slice, i) => {
            const isActive = activeInnerIndex === i;
            return (
              <g key={i} className="transition-all duration-150">
                <path
                  d={slice.path}
                  className={`
                      stroke-[1px] transition-all duration-150
                      ${isActive
                      ? slice.color === 'danger' ? 'fill-red-900/90 stroke-red-400' : 'fill-emerald-900/90 stroke-emerald-400'
                      : 'fill-slate-900/80 stroke-slate-600'
                    }
                    `}
                  style={{ filter: isActive ? 'url(#glow)' : 'none' }}
                />
              </g>
            );
          })}

          {activeSubSlices.map((slice, i) => {
            const isActive = activeOuterIndex === i;
            return (
              <g key={`sub-${i}`} className="animate-in zoom-in-90 fade-in duration-150 origin-center">
                <path
                  d={slice.path}
                  className={`
                      stroke-[1px] transition-all duration-100
                      ${isActive
                      ? slice.color === 'danger' ? 'fill-red-800/90 stroke-red-300' : 'fill-emerald-800/90 stroke-emerald-300'
                      : 'fill-slate-800/90 stroke-slate-500'
                    }
                    `}
                />
              </g>
            );
          })}
        </svg>

        {innerSlices.map((slice, i) => {
          const isActive = activeInnerIndex === i;
          return (
            <div
              key={i}
              className="absolute w-20 h-20 -ml-10 -mt-10 top-0 left-0 flex flex-col items-center justify-center pointer-events-none"
              style={{ transform: `translate(${slice.iconX}px, ${slice.iconY}px)` }}
            >
              <slice.icon size={22} className={`mb-1 drop-shadow-md ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className={`text-[9px] font-bold uppercase tracking-wider leading-none drop-shadow-md ${isActive ? 'text-white' : 'text-slate-400'}`}>
                {slice.label}
              </span>
              {slice.subOptions && (
                <ChevronRight size={10} className={`mt-1 opacity-60 ${isActive ? 'text-emerald-300' : 'text-slate-600'}`} />
              )}
            </div>
          );
        })}

        {activeSubSlices.map((slice, i) => {
          const isActive = activeOuterIndex === i;
          return (
            <div
              key={`lsub-${i}`}
              className="absolute w-20 h-20 -ml-10 -mt-10 top-0 left-0 flex flex-col items-center justify-center pointer-events-none animate-in zoom-in-90 fade-in duration-150"
              style={{ transform: `translate(${slice.iconX}px, ${slice.iconY}px)` }}
            >
              <slice.icon size={18} className={`mb-1 drop-shadow-md ${isActive ? 'text-white' : 'text-slate-300'}`} />
              <span className={`text-[8px] font-bold uppercase tracking-wider leading-none drop-shadow-md ${isActive ? 'text-white' : 'text-slate-300'}`}>
                {slice.label}
              </span>
            </div>
          );
        })}

        <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-slate-600 bg-slate-950 flex items-center justify-center shadow-lg z-10 pointer-events-none">
          <X size={16} className="text-slate-500" />
        </div>

        {title && (
          <div
            className="absolute top-0 left-0 -translate-x-1/2 pointer-events-none bg-slate-950/80 border border-slate-700 px-2 py-1 rounded text-[10px] text-emerald-500 font-mono font-bold tracking-widest whitespace-nowrap shadow-lg backdrop-blur-md"
            style={{ marginTop: '-200px' }}
          >
            {title}
          </div>
        )}
      </div>
    </div>
  );
};