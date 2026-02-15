import { Entity, SystemStatus, MapMode } from '../types';
import { Zap, Radio, Anchor, Eye, Navigation, Compass, Target, Calculator, MapPin, Crosshair } from 'lucide-react';
import { create, all } from 'mathjs';
import Fuse from 'fuse.js';

// Configure mathjs to use degrees
const math = create(all);

const degreeScope = {
    sin: (angle: number | any) => {
        // Handle check if it's a number (mathjs might pass Unit or BigNumber)
        const val = typeof angle === 'number' ? angle : parseFloat(angle);
        return Math.sin(val * Math.PI / 180);
    },
    cos: (angle: number | any) => {
        const val = typeof angle === 'number' ? angle : parseFloat(angle);
        return Math.cos(val * Math.PI / 180);
    },
    tan: (angle: number | any) => {
        const val = typeof angle === 'number' ? angle : parseFloat(angle);
        return Math.tan(val * Math.PI / 180);
    },
    asin: (val: number | any) => Math.asin(val) * 180 / Math.PI,
    acos: (val: number | any) => Math.acos(val) * 180 / Math.PI,
    atan: (val: number | any) => Math.atan(val) * 180 / Math.PI,
};

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

const parseProjection = (query: string, entities: Entity[]): { target: { x: number, y: number }, label: string } | null => {
    // Format: Entity/Bearing/Range (e.g. "hos1/180/10")
    const projMatch = query.match(/^(.+)\/(\d+(\.\d+)?)\/(\d+(\.\d+)?)$/);
    if (projMatch) {
        const [_, entityName, bearingStr, __, rangeStr] = projMatch;
        const bearing = parseFloat(bearingStr);
        const range = parseFloat(rangeStr);

        // Fuzzy find entity
        const fuse = new Fuse(entities, { keys: ['label'], threshold: 0.4 });
        const result = fuse.search(entityName);

        if (result.length > 0) {
            const ent = result[0].item;
            // Wait, standard bearing: 0 is North, 90 is East.
            // Screen coords: x right, y down.
            // North (0 deg) -> y decreases. East (90 deg) -> x increases.
            // x = x0 + r * sin(theta)
            // y = y0 - r * cos(theta)

            // range is in NM? Let's assume input is NM and map unit is meters (approx 1852m per NM)
            const distMeters = range * 1852;

            const newX = ent.position.x + distMeters * Math.sin(bearing * Math.PI / 180);
            const newY = ent.position.y - distMeters * Math.cos(bearing * Math.PI / 180);

            return {
                target: { x: newX, y: newY },
                label: `FOCUS: ${ent.label} + ${range}NM @ ${bearing}°`
            };
        }
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
        // Also ensure it's not a projection query (contains '/')
        if (q.length > 1 && !/^\d+$/.test(q) && !q.includes('/')) {
            const result = math.evaluate(q, degreeScope);
            if (typeof result === 'number' || (typeof result === 'object' && result.type === 'Unit')) {
                let label = '';
                let subLabel = 'Calculation';

                if (typeof result === 'number') {
                    label = math.format(result, { precision: 14 }); // High precision
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

    // 3. Entity Projection (Bearing/Range)
    const proj = parseProjection(q, entities);
    if (proj) {
        commands.push({
            id: 'proj-focus',
            label: proj.label,
            subLabel: 'Projection Focus',
            icon: Crosshair,
            action: () => panTo(proj.target.x - ownship.position.x, proj.target.y - ownship.position.y), // PanTo expects offset?
            keywords: ['proj', 'bearing', 'range'],
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
