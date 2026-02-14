
import { Entity, SystemStatus, MapMode } from '../types';
import { Zap, Radio, Anchor, Eye, Navigation, Compass, Target, Clock, Calculator, Map } from 'lucide-react';
import { latLonToMeters, projectPoint } from './geo';

export interface CommandContext {
  entities: Entity[];
  ownship: Entity;
  systems: SystemStatus;
  setMapMode: (mode: MapMode) => void;
  toggleSystem: (sys: keyof SystemStatus) => void;
  panTo: (x: number, y: number) => void;
}

export interface CommandOption {
  id: string;
  label: string;
  subLabel?: string;
  icon: any;
  action: () => void;
  keywords: string[];
  isPreview?: boolean;
}

export const getCommands = (query: string, context: CommandContext): CommandOption[] => {
  const q = query.toLowerCase().trim();
  const { entities, ownship, systems, setMapMode, toggleSystem, panTo } = context;
  const commands: CommandOption[] = [];

  // Helper to add system commands
  const addSystemToggle = (key: keyof SystemStatus, label: string, icon: any, keywords: string[]) => {
    if (q === '' || label.toLowerCase().includes(q) || keywords.some(k => k.includes(q))) {
        commands.push({
            id: `sys-${key}`,
            label: label,
            subLabel: systems[key] ? 'ON' : 'OFF',
            icon: icon,
            action: () => toggleSystem(key),
            keywords: keywords
        });
    }
  };

  addSystemToggle('radar', 'RDR', Zap, ['radar', 'rdr']);
  addSystemToggle('adsb', 'ADSB', Radio, ['adsb', 'transponder']);
  addSystemToggle('ais', 'AIS', Anchor, ['ais', 'ship']);
  addSystemToggle('eots', 'EOTS', Eye, ['eots', 'camera']);

  // Map Modes
  if (q === '' || 'north'.includes(q) || 'nup'.includes(q)) {
      commands.push({
          id: 'mode-nup',
          label: 'North Up',
          subLabel: 'Map Mode',
          icon: Navigation,
          action: () => setMapMode(MapMode.NORTH_UP),
          keywords: ['north', 'nup']
      });
  }
  if (q === '' || 'heading'.includes(q) || 'hup'.includes(q)) {
      commands.push({
          id: 'mode-hup',
          label: 'Heading Up',
          subLabel: 'Map Mode',
          icon: Compass,
          action: () => setMapMode(MapMode.HEADING_UP),
          keywords: ['heading', 'hup']
      });
  }

  // Calculator: ETA [Entity]
  const etaMatch = q.match(/^eta\s+(.+)$/);
  if (etaMatch) {
      const targetName = etaMatch[1];
      const matchedEntities = entities.filter(e => e.label.toLowerCase().includes(targetName));

      matchedEntities.forEach(target => {
          const dist = Math.hypot(target.position.x - ownship.position.x, target.position.y - ownship.position.y);
          // Assume speed is in knots. 1 knot = 0.5144 m/s
          const speedMps = (ownship.speed || 1) * 0.5144; // Avoid div by zero, default to small speed or show inf

          let timeString = "N/A";
          if (ownship.speed && ownship.speed > 0) {
              const timeSec = dist / speedMps;
              const timeMin = Math.round(timeSec / 60);
              timeString = `${timeMin} MIN`;
          } else {
              timeString = "Inf (Speed 0)";
          }

          commands.push({
              id: `eta-${target.id}`,
              label: `ETA ${target.label}`,
              subLabel: `ETE: ${timeString} (${(dist/1000).toFixed(1)} km)`,
              icon: Calculator,
              action: () => {}, // Just a calculator
              keywords: ['eta'],
              isPreview: true
          });
      });

      return commands; // Return immediately if in calculator mode to avoid clutter? Or just prepend?
  }

  // Entity Search (DCT)
  entities.forEach(e => {
      // If query matches entity name or type
      if (q === '' || e.label.toLowerCase().includes(q) || e.type.toLowerCase().includes(q)) {
          commands.push({
              id: `dct-${e.id}`,
              label: `DCT ${e.label}`,
              subLabel: e.type,
              icon: Target,
              action: () => {
                  const offsetX = e.position.x - ownship.position.x;
                  const offsetY = e.position.y - ownship.position.y;
                  panTo(offsetX, offsetY);
              },
              keywords: ['dct', 'goto', e.label.toLowerCase()]
          });
      }
  });

  return commands;
};
