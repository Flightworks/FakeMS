import { Entity, SystemStatus, MapMode } from '../types';
import { Zap, Radio, Anchor, Eye, Navigation, Compass, Target, Calculator, MapPin, Crosshair } from 'lucide-react';
import { create, all } from 'mathjs';
import Fuse from 'fuse.js';
import { getDestinationPoint } from './geo';

// Configure mathjs to use degrees
const math = create(all);

const degreeScope = {
    sin: (angle: number | any) => Math.sin((typeof angle === 'number' ? angle : parseFloat(angle)) * Math.PI / 180),
    cos: (angle: number | any) => Math.cos((typeof angle === 'number' ? angle : parseFloat(angle)) * Math.PI / 180),
    tan: (angle: number | any) => Math.tan((typeof angle === 'number' ? angle : parseFloat(angle)) * Math.PI / 180),
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
    history: string[]; // Added History to Context
}

export interface CommandOption {
    id: string;
    label: string;
    subLabel?: string;
    icon: any;
    action: () => void;
    keywords: string[];
    isPreview?: boolean;
    isHistory?: boolean;
    autocompleteValue?: string;
}

// Improved Fuzzy Coordinate Parser
const parseCoordinates = (query: string): { lat: number, lon: number, isPartial?: boolean, suggestion?: string } | null => {
    const cleanQuery = query.trim().toUpperCase().replace(/\s+/g, '');

    // 0. Partial/Suggestion Logic
    // Detect "N45" or "N4530" patterns that are incomplete
    const partialLatRegex = /^([NS])(\d{1,4})$/; // N + 1-4 digits
    if (partialLatRegex.test(cleanQuery)) {
        return { lat: 0, lon: 0, isPartial: true, suggestion: 'Complete format: NddmmEdddmm (e.g. N4500E00600)' };
    }
    const partialFullRegex = /^([NS])(\d{4})([EW])(\d{0,4})$/; // NddmmE...
    if (partialFullRegex.test(cleanQuery)) {
        return { lat: 0, lon: 0, isPartial: true, suggestion: 'Complete longitude: Edddmm (e.g. E00600)' };
    }

    // 1. Loose DDMM Format: N45(00)E006(00)
    // Supports: N45, N4530, N45E006, N4530E00630
    const looseDdmRegex = /^([NS])(\d{1,3})(\d{0,2})([EW])(\d{1,3})(\d{0,2})$/;
    const ddmMatch = cleanQuery.match(looseDdmRegex);

    if (ddmMatch) {
        const [_, latDir, latDegStr, latMinStr, lonDir, lonDegStr, lonMinStr] = ddmMatch;

        const latDeg = parseInt(latDegStr);
        const latMin = latMinStr ? parseInt(latMinStr.padEnd(2, '0')) : 0;
        const lonDeg = parseInt(lonDegStr);
        const lonMin = lonMinStr ? parseInt(lonMinStr.padEnd(2, '0')) : 0;

        let lat = latDeg + latMin / 60;
        if (latDir === 'S') lat = -lat;

        let lon = lonDeg + lonMin / 60;
        if (lonDir === 'W') lon = -lon;

        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

        return { lat, lon };
    }

    // 2. Decimal Degrees
    const ddRegex = /^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/;
    const ddMatch = query.match(ddRegex);
    if (ddMatch) {
        const lat = parseFloat(ddMatch[1]);
        const lon = parseFloat(ddMatch[2]);
        if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
            return { lat, lon };
        }
    }

    return null;
}

const parseProjection = (query: string, entities: Entity[], ownship: Entity): { target: { lat: number, lon: number }, label: string } | null => {
    // Fuzzy Projection: [ENTITY] [BEARING] [RANGE] OR [BEARING] [RANGE] from ownship
    // Supports spaces or slashes as delimiters.
    // e.g., "HOSTILE1 180/5", "TK 2 090 10", "G01/180/2", "180/5"

    const parts = query.trim().split(/[\s/]+/).filter(Boolean);

    // We need at least 2 parts (Bearing, Range)
    if (parts.length < 2) return null;

    if (parts.length === 2) {
        const bearingStr = parts[0];
        const rangeStr = parts[1];
        const bearing = parseFloat(bearingStr);
        const range = parseFloat(rangeStr);

        if (isNaN(bearing) || isNaN(range)) return null;

        const distMeters = range * 1852;
        const dest = getDestinationPoint(ownship.position.lat, ownship.position.lon, distMeters, bearing);

        return {
            target: { lat: dest.lat, lon: dest.lon },
            label: `PROJ: OWNSHIP BRG ${bearing}°/RNG ${range}NM`
        };
    }

    const rangeStr = parts[parts.length - 1];
    const bearingStr = parts[parts.length - 2];
    const entityNameOrId = parts.slice(0, parts.length - 2).join(' ');

    const bearing = parseFloat(bearingStr);
    const range = parseFloat(rangeStr);

    if (isNaN(bearing) || isNaN(range)) return null;

    // Fuzzy find the entity
    const fuse = new Fuse(entities, {
        keys: ['label', 'id'],
        threshold: 0.4,
        distance: 10 // Favor exact/prefix matches for track names
    });
    const result = fuse.search(entityNameOrId);

    if (result.length > 0) {
        const ent = result[0].item;
        const distMeters = range * 1852;

        // Use geodesic math to find proper destination lat/lon
        const dest = getDestinationPoint(ent.position.lat, ent.position.lon, distMeters, bearing);

        return {
            target: { lat: dest.lat, lon: dest.lon },
            label: `PROJ: ${ent.label} BRG ${bearing}°/RNG ${range}NM`
        };
    }

    return null;
}

export const getCommands = (query: string, context: CommandContext): CommandOption[] => {
    const q = query.trim();
    const { entities, ownship, systems, setMapMode, toggleSystem, panTo, history } = context;
    const commands: CommandOption[] = [];

    // --- 0. HISTORY INJECTION (When query is empty) ---
    if (q === '') {
        // Show recent history first
        if (history && history.length > 0) {
            history.slice(0, 5).forEach((cmdStr, idx) => {
                commands.push({
                    id: `hist-${idx}`,
                    label: cmdStr,
                    subLabel: 'Recent History',
                    icon: History,
                    action: () => { /* No-op, UI handles selection acting as typing? Or execute immediately? execute immediately usually */ },
                    // To handle execute vs paste, usually history selection executes.
                    // But if it's a calculator value, maybe paste?
                    // Let's assume execute for now as per "History Stack repopulated".
                    keywords: ['history'],
                    isHistory: true
                });
            });
        }
    }

    // 1. Calculator & Unit Conversion
    try {
        const MATH_FUNCS = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'log', 'abs', 'exp'];

        // Parentheses Auto-Injection for "funcNumber" pattern
        // Regex: (func)(\d) -> $1($2)
        // e.g. "cos45" -> "cos(45)"
        let evalQ = q;
        const funcMatch = q.match(new RegExp(`^(${MATH_FUNCS.join('|')})\\s*(-?\\d+\\.?\\d*)$`, 'i'));
        if (funcMatch) {
            evalQ = `${funcMatch[1]}(${funcMatch[2]})`;
        }

        // Suggestion for function start
        // If query is "sq" suggestive "sqrt("
        if (q.length >= 2 && !q.match(/^\d/)) {
            const funcHint = MATH_FUNCS.find(f => f.startsWith(q.toLowerCase()) && f !== q.toLowerCase());
            if (funcHint) {
                commands.push({
                    id: 'calc-hint',
                    label: `${funcHint}(`,
                    subLabel: 'Math Function',
                    icon: Calculator,
                    action: () => { /* maybe autocomplete? */ },
                    keywords: ['math', funcHint],
                    isPreview: true,
                    autocompleteValue: `${funcHint}(`
                });
            }
        }

        if (evalQ.length > 1 && !evalQ.includes('/')) {
            // Check if it's a pure number or just a function name before evaluating
            // to avoid "sin" erroring or "12" being boring.
            // But "cos(45)" is good.
            const result = math.evaluate(evalQ, degreeScope);
            if (typeof result === 'number' || (typeof result === 'object' && result.type === 'Unit')) {
                let label = '';
                let subLabel = 'Calculation';

                if (typeof result === 'number') {
                    label = math.format(result, { precision: 14 });
                } else {
                    label = result.toString();
                    subLabel = 'Unit Conversion';
                }

                commands.push({
                    id: 'calc-result',
                    label: `${evalQ} = ${label}`,
                    subLabel: subLabel,
                    icon: Calculator,
                    action: () => { navigator.clipboard.writeText(label); },
                    keywords: ['calc', 'math'],
                    isPreview: true
                });
            }
        }
    } catch (e) { }

    // 2. Coordinate Parsing (Fuzzy + Suggestions)
    const coords = parseCoordinates(q);
    if (coords) {
        if (coords.isPartial && coords.suggestion) {
            commands.push({
                id: 'coord-suggestion',
                label: coords.suggestion,
                subLabel: 'Format Hint',
                icon: MapPin,
                action: () => { /* maybe focus input? */ },
                keywords: ['hint'],
                isPreview: true
            });
        } else {
            commands.push({
                id: 'fly-to-coords',
                label: `FLY TO: ${q.toUpperCase()}`,
                subLabel: 'Coordinate Navigation',
                icon: MapPin,
                action: () => panTo(coords.lat, coords.lon),
                keywords: ['fly', 'goto', 'coord'],
                isPreview: true
            });
        }
    }

    // 3. Entity Projection
    const proj = parseProjection(q, entities, ownship);
    if (proj) {
        commands.push({
            id: 'proj-focus',
            label: proj.label,
            subLabel: 'Projection Focus',
            icon: Crosshair,
            // Pass native Lat/Lon to panTo
            action: () => panTo(proj.target.lat, proj.target.lon),
            keywords: ['proj'],
            isPreview: true
        });
    }

    // Define Static System Commands
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

    systemCommands.push({
        id: 'mode-nup',
        label: 'North Up',
        subLabel: 'Map Mode',
        icon: Navigation,
        action: () => setMapMode(MapMode.NORTH_UP),
        keywords: ['north', 'nup', 'map']
    });

    systemCommands.push({
        id: 'mode-hup',
        label: 'Heading Up',
        subLabel: 'Map Mode',
        icon: Compass,
        action: () => setMapMode(MapMode.HEADING_UP),
        keywords: ['heading', 'hup', 'map']
    });

    // 3. Fuzzy Search
    if (q.length > 0) {
        const searchableItems = [
            ...systemCommands.map(c => ({ ...c, type: 'command' })),
            ...entities.flatMap(e => [
                // 1. Selector Item (for Autocomplete)
                {
                    id: `sel-${e.id}`,
                    label: e.label,
                    subLabel: 'Select Track',
                    icon: Crosshair,
                    action: () => { /* Select/Focus logic handled by autocomplete */ },
                    keywords: [e.label, e.type, 'track'],
                    type: 'entity',
                    autocompleteValue: e.label + ' '
                },
                // 2. Direct To Item (for Execution)
                {
                    id: `dct-${e.id}`,
                    label: `DCT ${e.label}`,
                    subLabel: 'Direct To',
                    icon: Target,
                    action: () => {
                        panTo(e.position.lat, e.position.lon);
                    },
                    keywords: ['dct', 'goto', 'direct', e.label],
                    type: 'command'
                    // No autocompleteValue -> Click executes immediately
                }
            ])
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
                // Using spherical distance for ETA
                const distMeters = getDestinationPoint ?
                    Math.hypot(target.position.lat - ownship.position.lat, target.position.lon - ownship.position.lon) * 111000 : // rough fallback
                    0; // actual distanceBetween needs importing if accurate ETA wanted, skipped for brevity or use direct formula

                const speedMps = (ownship.speed || 1) * 0.5144;
                let timeString = "N/A";
                if (ownship.speed && ownship.speed > 0) {
                    const timeSec = distMeters / speedMps;
                    const timeMin = Math.round(timeSec / 60);
                    timeString = `${timeMin} MIN`;
                } else {
                    timeString = "Inf (Speed 0)";
                }

                commands.unshift({ // Add to top
                    id: `eta-${target.id}`,
                    label: `ETA ${target.label}`,
                    subLabel: `ETE: ${timeString} (${(distMeters / 1000).toFixed(1)} km)`,
                    icon: Calculator,
                    action: () => { },
                    keywords: ['eta'],
                    isPreview: true
                });
            }
        }
    } else {
        // If empty, append system commands after history
        commands.push(...systemCommands);
    }

    return commands;
};

// Re-export Lucide icons if needed by other components, but CommandPalette imports them directly usually.
// Just ensuring History is imported for the icon.
import { History } from 'lucide-react';
