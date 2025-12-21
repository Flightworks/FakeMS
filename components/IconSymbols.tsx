import React from 'react';

// APP-6 Simplified Symbology
// Frame based identification:
// Friendly: Rectangle (Blue/Cyan)
// Hostile: Diamond (Red)
// Control Measure: Circle/Point (Yellow/Amber)

export const HelicopterSymbol = ({ color = "text-cyan-400" }: { color?: string }) => (
  <svg viewBox="0 0 100 100" className={`w-full h-full ${color} fill-none stroke-current drop-shadow-lg overflow-visible`}>
    {/* Friendly Frame: Rectangle */}
    <rect x="15" y="25" width="70" height="50" strokeWidth="6" />
    
    {/* Icon: Rotary Wing (Simplified Bowtie/Hourglass) */}
    <path d="M 50 50 L 35 35 V 65 L 50 50 L 65 35 V 65 Z" strokeWidth="4" fill="currentColor" fillOpacity="0.3" />
    
    {/* Velocity Leader (Static) */}
    <path d="M 50 25 L 50 5" strokeWidth="4" />
  </svg>
);

export const EnemySymbol = ({ selected }: { selected: boolean }) => (
  <svg viewBox="0 0 100 100" className={`w-full h-full transition-colors duration-200 ${selected ? 'text-amber-400' : 'text-red-500'} fill-none stroke-current drop-shadow-lg overflow-visible`}>
    {/* Hostile Frame: Diamond */}
    <path d="M 50 5 L 90 50 L 50 95 L 10 50 Z" strokeWidth="6" fill="currentColor" fillOpacity="0.1" />
    
    {/* Icon: Hostile Text or Symbol */}
    <text x="50" y="60" textAnchor="middle" fontSize="20" stroke="none" fill="currentColor" fontWeight="bold" style={{ userSelect: 'none' }}>ENY</text>

    {selected && (
      <path d="M 50 -5 L 105 50 L 50 105 L -5 50 Z" stroke="white" strokeWidth="2" strokeDasharray="4,4" className="animate-pulse" />
    )}
  </svg>
);

export const WaypointSymbol = ({ selected }: { selected: boolean }) => (
  <svg viewBox="0 0 100 100" className={`w-full h-full overflow-visible transition-colors duration-200 ${selected ? 'text-white' : 'text-amber-400'} fill-none stroke-current`}>
    {/* Control Measure: Point/Circle */}
    <circle cx="50" cy="50" r="15" strokeWidth="6" />
    <circle cx="50" cy="50" r="4" fill="currentColor" stroke="none" />
    
    {/* Label */}
    <text x="50" y="90" textAnchor="middle" fontSize="24" stroke="none" fill="currentColor" fontWeight="bold" style={{ userSelect: 'none' }}>WP</text>

    {selected && <circle cx="50" cy="50" r="25" stroke="white" strokeWidth="2" strokeDasharray="4,4" className="animate-pulse" />}
  </svg>
);

export const AirportSymbol = ({ selected }: { selected: boolean }) => (
  <svg viewBox="0 0 100 100" className={`w-full h-full transition-colors duration-200 ${selected ? 'text-amber-400' : 'text-cyan-400'} fill-none stroke-current drop-shadow-lg overflow-visible`}>
    {/* Installation Frame: Friendly Rectangle + Roof Indicator */}
    <path d="M 15 25 L 50 5 L 85 25" strokeWidth="6" fill="none" />
    <rect x="15" y="25" width="70" height="50" strokeWidth="6" />
    
    {/* Icon: Airfield (Runways) */}
    <path d="M 30 35 L 70 65 M 30 65 L 70 35" strokeWidth="4" />

    {selected && (
       <path d="M 5 25 L 50 -5 L 95 25 V 85 H 5 Z" stroke="white" strokeWidth="2" strokeDasharray="4,4" className="animate-pulse" />
    )}
  </svg>
);