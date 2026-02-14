import { Entity, SystemStatus, MapMode } from '../types';
import { Zap, Radio, Anchor, Eye, Navigation, Compass, Target, Calculator, MapPin } from 'lucide-react';
import { evaluate, format, unit } from 'mathjs';
import Fuse from 'fuse.js';

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

const parseCoordinates = (query: string): { width: number, height: number } | null => {
    // Try converting N4505E00621 format
    // N dd mm E ddd mm
    const ddmRegex = /^([NS])(\d{2})(\d{2})([EW])(\d{3})(\d{2})$/i;
    const ddmMatch = query.replace(/\s/g, '').match(ddmRegex);

    if (ddmMatch) {
        const [_, latDir, latDeg, latMin, lonDir, lonDeg, lonMin] = ddmMatch;
        let lat = parseInt(latDeg) + parseInt(latMin) / 60;
        if (latDir.toUpperCase() === 'S') lat = -lat;

        let lon = parseInt(lonDeg) + parseInt(lonMin) / 60;
        if (lonDir.toUpperCase() === 'W') lon = -lon;

        // Convert to game coordinates (assuming simple Mercator-like projection or direct mapping for now)
        // This usually needs a projection utility. For now, returning raw lat/lon as x/y placeholder
        // In a real app, use projection.latLngToPoint.
        return { width: lon * 1000, height: -lat * 1000 }; // Mock conversion
    }

    // Try Decimal Degrees: 45.5, -6.5
    const ddRegex = /^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/;
    const ddMatch = query.match(ddRegex);
    if (ddMatch) {
        const lat = parseFloat(ddMatch[1]);
        const lon = parseFloat(ddMatch[2]);
        return { width: lon * 1000, height: -lat * 1000 };
    }

    return null;
}

export const getCommands = (query: string, context: CommandContext): CommandOption[] => {
    const q = query.trim();
    const { entities, ownship, systems, setMapMode, toggleSystem, panTo } = context;
    const commands: CommandOption[] = [];

    // 1. Calculator & Unit Conversion (Power Palette)
    try {
        // Avoid evaluating simple numbers or short strings that look like commands
        if (q.length > 1 && !/^\d+$/.test(q)) {
            const result = evaluate(q);
            if (typeof result === 'number' || (typeof result === 'object' && result.type === 'Unit')) {
                let label = '';
                let subLabel = 'Calculation';

                if (typeof result === 'number') {
                    label = format(result, { precision: 14 }); // High precision
                } else {
                    label = result.toString();
                    subLabel = 'Unit Conversion';
                }

                commands.push({
                    id: 'calc-result',
                    label: `= ${label}`,
                    subLabel: subLabel,
                    icon: Calculator,
                    action: () => { navigator.clipboard.writeText(label); },
                    keywords: ['calc', 'math'],
                    isPreview: true
                });
            }
        }
    } catch (e) {
        // Ignore evaluation errors
    }

    // 2. Coordinate Parsing
    const coords = parseCoordinates(q);
    if (coords) {
        commands.push({
            id: 'fly-to-coords',
            label: `FLY TO: ${q.toUpperCase()}`,
            subLabel: 'Coordinate Navigation',
            icon: MapPin,
            action: () => panTo(coords.width, coords.height), // Using standard x/y
            keywords: ['fly', 'goto', 'coord'],
            isPreview: true
        });
    }

    // Define Static System Commands for Fuse search
    const systemCommands: CommandOption[] = [];

    const addSystem = (key: keyof SystemStatus, label: string, icon: any, keywords: string[]) => {
        systemCommands.push({
            id: `sys-${key}`,
            label,
            subLabel: systems[key] ? 'ON' : 'OFF',
            icon,
            action: () => toggleSystem(key),
            keywords
        });
    };

    addSystem('radar', 'RADAR', Zap, ['radar', 'rdr', 'sensor']);
    addSystem('adsb', 'ADSB', Radio, ['adsb', 'transponder', 'ident']);
    addSystem('ais', 'AIS', Anchor, ['ais', 'ship', 'marine']);
    addSystem('eots', 'EOTS', Eye, ['eots', 'camera', 'visual']);

    // Map Modes
    systemCommands.push({
        id: 'mode-nup',
        label: 'North Up',
        subLabel: 'Map Mode',
        icon: Navigation,
        action: () => setMapMode(MapMode.NORTH_UP),
        keywords: ['north', 'nup', 'map', 'orientation']
    });

    systemCommands.push({
        id: 'mode-hup',
        label: 'Heading Up',
        subLabel: 'Map Mode',
        icon: Compass,
        action: () => setMapMode(MapMode.HEADING_UP),
        keywords: ['heading', 'hup', 'map', 'orientation']
    });

    // 3. Fuzzy Search (Fuse.js)
    if (q.length > 0) {
        // Combine System Commands and Entities for search
        const searchableItems = [
            ...systemCommands.map(c => ({ ...c, type: 'command' })),
            ...entities.map(e => ({
                id: `dct-${e.id}`,
                label: `DCT ${e.label}`,
                subLabel: e.type,
                icon: Target,
                action: () => {
                    const offsetX = e.position.x - ownship.position.x;
                    const offsetY = e.position.y - ownship.position.y;
                    panTo(offsetX, offsetY);
                },
                keywords: ['dct', 'goto', e.label, e.type],
                type: 'entity'
            }))
        ];

        const fuse = new Fuse(searchableItems, {
            keys: ['label', 'keywords', 'subLabel'],
            threshold: 0.4,
            distance: 100
        });

        const results = fuse.search(q);
        results.forEach(res => commands.push(res.item));

        // ETA Helpers (Special Logic, kept separate as it depends on strict patterns)
        const etaMatch = q.match(/^eta\s+(.+)$/i);
        if (etaMatch) {
            const targetName = etaMatch[1].toLowerCase();
            const target = entities.find(e => e.label.toLowerCase().includes(targetName));
            if (target) {
                const dist = Math.hypot(target.position.x - ownship.position.x, target.position.y - ownship.position.y);
                const speedMps = (ownship.speed || 1) * 0.5144;
                let timeString = "N/A";
                if (ownship.speed && ownship.speed > 0) {
                    const timeSec = dist / speedMps;
                    const timeMin = Math.round(timeSec / 60);
                    timeString = `${timeMin} MIN`;
                } else {
                    timeString = "Inf (Speed 0)";
                }

                commands.unshift({ // Add to top
                    id: `eta-${target.id}`,
                    label: `ETA ${target.label}`,
                    subLabel: `ETE: ${timeString} (${(dist / 1000).toFixed(1)} km)`,
                    icon: Calculator,
                    action: () => { },
                    keywords: ['eta'],
                    isPreview: true
                });
            }
        }

    } else {
        // Default view if query is empty
        commands.push(...systemCommands);
    }

    return commands;
};
