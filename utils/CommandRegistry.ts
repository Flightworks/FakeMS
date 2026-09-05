import { Entity, SystemStatus, MapMode, HistoryEntry, NavMode, Position } from '../types';
import { Zap, Radio, Anchor, Eye, Navigation, Compass, Target, Calculator, MapPin, Crosshair, History, FileText, Copy } from 'lucide-react';
import Fuse from 'fuse.js';
import { getDestinationPoint, distanceBetween } from './geo';
import { calculateEta } from '../domain/measurements';
import { METERS_PER_NAUTICAL_MILE } from '../domain/tacticalUnits';
import type { MathCommandProvider } from './mathEvaluator';
import type { MissionActionCategory, MissionActionRequest } from '../domain/missionActions';
import type { MissionObjective } from '../domain/intent';
import {
    rankCommandOptions,
    type CommandRankingMetadata,
} from '../domain/commandRanking';

// Configure math evaluation in the lazy-loaded `mathEvaluator` module.

export interface CommandContext {
    entities: Entity[];
    ownship: Entity;
    systems: SystemStatus;
    setMapMode: (mode: MapMode) => void;
    toggleSystem: (sys: keyof SystemStatus) => void;
    focusMapAt: (position: Position) => void;
    proposeDirectTo: (target: Pick<Entity, 'id' | 'label' | 'position'>) => void;
    proposeRoute: (target: Pick<Entity, 'id' | 'label' | 'position'>, objective?: MissionObjective) => void;
    requestMissionAction: (request: MissionActionRequest) => void;
    history: HistoryEntry[]; // Added History to Context
    openDocument: (filename: string) => void;
    ownshipNavMode: NavMode;
    toggleNavMode: () => void;
}

export interface CommandOption {
    id: string;
    label: string;
    subLabel?: string;
    icon: any;
    action?: () => void;
    keywords: string[];
    isPreview?: boolean;
    isHistory?: boolean;
    autocompleteValue?: string;
    historyValue?: string;
    ranking?: CommandRankingMetadata;
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

        const distMeters = range * METERS_PER_NAUTICAL_MILE;
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
        const distMeters = range * METERS_PER_NAUTICAL_MILE;

        // Use geodesic math to find proper destination lat/lon
        const dest = getDestinationPoint(ent.position.lat, ent.position.lon, distMeters, bearing);

        return {
            target: { lat: dest.lat, lon: dest.lon },
            label: `PROJ: ${ent.label} BRG ${bearing}°/RNG ${range}NM`
        };
    }

    return null;
}

const normalizeRankingText = (value: string): string => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

const createStructuredRanking = (
    query: string,
    label: string,
    completeness = 3,
): CommandRankingMetadata => {
    const normalizedQuery = normalizeRankingText(query);
    const normalizedLabel = normalizeRankingText(label);
    const exact = normalizedQuery.length > 0 && normalizedQuery === normalizedLabel;
    const prefix = normalizedQuery.length > 0 && normalizedLabel.startsWith(normalizedQuery);
    const match = exact ? 'EXACT' : prefix ? 'PREFIX' : 'FUZZY';

    return {
        category: exact ? 'STRUCTURED_EXACT' : prefix ? 'STRUCTURED_PARTIAL' : 'FUZZY',
        completeness: exact ? completeness : Math.max(0, completeness - 1),
        match,
    };
};

const createEntityRanking = (query: string, entity: Entity): CommandRankingMetadata => {
    const normalizedQuery = normalizeRankingText(query);
    const candidates = [normalizeRankingText(entity.label), normalizeRankingText(entity.id)];
    const exact = normalizedQuery.length > 0 && candidates.includes(normalizedQuery);
    const prefix = normalizedQuery.length > 0
        && candidates.some(candidate => candidate.startsWith(normalizedQuery));

    return {
        category: exact ? 'ENTITY_EXACT' : prefix ? 'ENTITY_AMBIGUOUS' : 'FUZZY',
        completeness: exact ? 3 : prefix ? 2 : 0,
        match: exact ? 'EXACT' : prefix ? 'PREFIX' : 'FUZZY',
    };
};

const projectionRanking = (): CommandRankingMetadata => ({
    category: 'STRUCTURED_EXACT',
    completeness: 3,
    match: 'EXACT',
    intent: 'PROJECTION',
});

const saveRanking = (): CommandRankingMetadata => ({
    category: 'SAVE',
    completeness: 0,
    match: 'FUZZY',
});

export const getCommands = (
    query: string,
    context: CommandContext,
    mathProvider?: MathCommandProvider,
): CommandOption[] => {
    const q = query.trim();
    const { entities, ownship, systems, setMapMode, toggleSystem, focusMapAt, proposeDirectTo, proposeRoute, requestMissionAction, history, openDocument } = context;
    const commands: CommandOption[] = [];

    const proposeUnavailableAction = (
        category: MissionActionCategory,
        actionId: string,
        label: string,
        targetId?: string,
    ) => {
        const issuedAt = Date.now();
        requestMissionAction({
            id: `command:${category.toLowerCase()}:${actionId}:${targetId ?? 'none'}:${issuedAt}`,
            label,
            category,
            ...(targetId ? { targetId } : {}),
            issuedAt,
            implementation: 'NOT_IMPLEMENTED',
            requiresAuthorization: true,
        });
    };

    // --- 0. HISTORY INJECTION (When query is empty) ---
    if (q === '') {
        // Show recent history first
        if (history && history.length > 0) {
            history.slice(0, 5).forEach((entry, idx) => {
                const date = new Date(entry.timestamp);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                commands.push({
                    id: `hist-${idx}`,
                    label: entry.original,
                    subLabel: timeStr,
                    icon: History,
                    // Selecting a history entry only repopulates the input.
                    keywords: ['history'],
                    isHistory: true,
                    autocompleteValue: entry.original
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
                    keywords: ['math', funcHint],
                    isPreview: true,
                    autocompleteValue: `${funcHint}(`,
                    ranking: {
                        category: 'STRUCTURED_PARTIAL',
                        completeness: 1,
                        match: 'PREFIX',
                    },
                });
            }
        }

        if (evalQ.length > 1 && !evalQ.includes('/')) {
            // Check if it's a pure number or just a function name before evaluating
            // to avoid "sin" erroring or "12" being boring.
            // But "cos(45)" is good.
            const mathResult = mathProvider?.evaluate(evalQ);
            if (mathResult) {
                commands.push({
                    id: 'calc-result',
                    label: `${evalQ} = ${mathResult.label}`,
                    subLabel: mathResult.subLabel,
                    icon: Calculator,
                    action: () => { void navigator.clipboard?.writeText(mathResult.label); },
                    keywords: ['calc', 'math'],
                    isPreview: true,
                    ranking: {
                        category: 'STRUCTURED_EXACT',
                        completeness: 3,
                        match: 'EXACT',
                    },
                });
            }
        }
    } catch {
        // Invalid math expressions simply produce no calculator suggestion.
    }

    // 2. Coordinate Parsing (Fuzzy + Suggestions)
    const coords = parseCoordinates(q);
    if (coords) {
        if (coords.isPartial && coords.suggestion) {
            commands.push({
                id: 'coord-suggestion',
                label: coords.suggestion,
                subLabel: 'Format Hint',
                icon: MapPin,
                keywords: ['hint'],
                isPreview: true,
                ranking: {
                    category: 'STRUCTURED_PARTIAL',
                    completeness: 1,
                    match: 'PREFIX',
                },
            });
        } else {
            // Add option to copy coordinates
            commands.push({
                id: 'coord-copy-pos',
                label: `COPY POS: ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`,
                subLabel: 'Copy Parsed Coordinates',
                icon: Copy,
                action: () => { navigator.clipboard.writeText(`${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`); },
                keywords: ['copy', 'coord', 'pos'],
                isPreview: false,
                ranking: {
                    category: 'STRUCTURED_PARTIAL',
                    completeness: 1,
                    match: 'EXACT',
                },
            });
            // Add option to copy original text
            commands.push({
                id: 'coord-copy-text',
                label: `COPY TEXT: "${q}"`,
                subLabel: 'Copy Original Input',
                icon: Copy,
                action: () => { navigator.clipboard.writeText(q); },
                keywords: ['copy', 'text'],
                isPreview: false,
                ranking: {
                    category: 'STRUCTURED_PARTIAL',
                    completeness: 1,
                    match: 'EXACT',
                },
            });

            commands.push({
                id: 'fly-to-coords',
                label: `FLY TO: ${q.toUpperCase()}`,
                subLabel: 'Coordinate Navigation',
                icon: MapPin,
                action: () => focusMapAt(coords),
                keywords: ['fly', 'goto', 'coord'],
                isPreview: true,
                ranking: {
                    category: 'STRUCTURED_EXACT',
                    completeness: 3,
                    match: 'EXACT',
                },
            });
        }
    }

    // 3. Explicit map focus: it never creates a navigation proposal.
  const focusMatch = q.match(/^focus(?:\s+track)?\s+(.+)$/i);
  if (focusMatch) {
    const focusTarget = new Fuse(entities, {
      keys: ['label', 'id'],
      threshold: 0.4,
      distance: 10,
    }).search(focusMatch[1])[0]?.item;

    if (focusTarget) {
      commands.push({
        id: `focus-${focusTarget.id}`,
        label: `FOCUS ${focusTarget.label}`,
        subLabel: 'Map focus only',
        icon: Crosshair,
        action: () => focusMapAt({ ...focusTarget.position }),
        keywords: ['focus', 'center', focusTarget.label],
        historyValue: `FOCUS ${focusTarget.label}`,
        ranking: createStructuredRanking(q, `FOCUS ${focusTarget.label}`),
      });
    }
  }

  // 4. Entity Projection
    const proj = parseProjection(q, entities, ownship);
    if (proj) {
        commands.push({
            id: 'proj-focus',
            label: proj.label,
            subLabel: 'Projection Focus',
            icon: Crosshair,
            action: () => focusMapAt(proj.target),
            keywords: ['proj'],
            isPreview: true,
            ranking: projectionRanking(),
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
            keywords,
            historyValue: label,
            ranking: createStructuredRanking(q, label),
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
        keywords: ['north', 'nup', 'map'],
        historyValue: 'North Up',
        ranking: createStructuredRanking(q, 'North Up'),
    });

    systemCommands.push({
        id: 'mode-hup',
        label: 'Heading Up',
        subLabel: 'Map Mode',
        icon: Compass,
        action: () => setMapMode(MapMode.HEADING_UP),
        keywords: ['heading', 'hup', 'map'],
        historyValue: 'Heading Up',
        ranking: createStructuredRanking(q, 'Heading Up'),
    });

    // 3. Fuzzy Search
    if (q.length > 0) {
        // Define file commands
        const knownFiles = [
            'optask.md',
            'README.md',
            'CHANGELOG.md',
            'docs/01-introduction.md',
            'docs/02-getting-started.md',
            'docs/03-interface-guide.md',
            'docs/04-configuration.md',
            'docs/05-scratchpad-guide.md',
            'docs/README.md'
        ];
        const fileCommands = knownFiles.map(file => ({
            id: `open-file-${file}`,
            label: `Open: ${file}`,
            subLabel: 'Scratchpad Document',
            icon: FileText,
            action: () => openDocument(file),
            keywords: ['open', 'file', 'read', 'doc', 'scratchpad', file, file.replace('.md', '')],
            isHistory: false,
            historyValue: `OPEN ${file}`,
            type: 'command'
        }));

        const searchableItems = [
            ...fileCommands,
            ...systemCommands.map(c => ({ ...c, type: 'command' })),
            ...entities.flatMap(e => [
                // 1. Selector Item (for Autocomplete)
                {
                    id: `sel-${e.id}`,
                    label: e.label,
                    subLabel: 'Select Track',
                    icon: Crosshair,
                    keywords: [e.label, e.type, 'track'],
                    type: 'entity',
                    autocompleteValue: e.label + ' ',
                    ranking: createEntityRanking(q, e),
                },
                // 2. Direct To Item (for Execution)
                {
                    id: `dct-${e.id}`,
                    label: `DCT ${e.label}`,
                    subLabel: 'Direct To',
                    icon: Target,
                    action: () => {
                        proposeDirectTo({
                            id: e.id,
                            label: e.label,
                            position: { ...e.position },
                        });
                    },
                    keywords: ['dct', 'goto', 'direct', e.label],
                    type: 'command',
                    historyValue: `DCT ${e.label}`,
                    ranking: createStructuredRanking(q, `DCT ${e.label}`),
                    // No autocompleteValue -> Click executes immediately
                },
                {
                    id: `plan-${e.id}`,
                    label: `PLAN ${e.label}`,
                    subLabel: 'Two deterministic route proposals · THREAT',
                    icon: Calculator,
                    action: () => proposeRoute({
                        id: e.id,
                        label: e.label,
                        position: { ...e.position },
                    }, 'THREAT_PRIORITY'),
                    keywords: ['plan', 'route', 'proposal', e.label],
                    type: 'command',
                    historyValue: `PLAN ${e.label}`,
                    ranking: createStructuredRanking(q, `PLAN ${e.label}`),
                },
                ...( ['THREAT_PRIORITY', 'COVERAGE', 'ENDURANCE'] as MissionObjective[]).map(objective => ({
                    id: `plan-${objective.toLowerCase()}-${e.id}`,
                    label: `PLAN ${objective === 'THREAT_PRIORITY' ? 'THREAT' : objective} ${e.label}`,
                    subLabel: 'Two deterministic route proposals',
                    icon: Calculator,
                    action: () => proposeRoute({
                        id: e.id,
                        label: e.label,
                        position: { ...e.position },
                    }, objective),
                    keywords: ['plan', 'route', 'proposal', objective.toLowerCase(), e.label],
                    type: 'command' as const,
                    historyValue: `PLAN ${objective} ${e.label}`,
                    ranking: createStructuredRanking(
                        q,
                        `PLAN ${objective === 'THREAT_PRIORITY' ? 'THREAT' : objective} ${e.label}`,
                    ),
                }))
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
                const eta = calculateEta(
                    ownship.position,
                    target.position,
                    ownship.speed || 0,
                );
                const distanceKm = distanceBetween(
                    ownship.position.lat,
                    ownship.position.lon,
                    target.position.lat,
                    target.position.lon,
                ) / 1000;
                const timeString = eta.value === null
                    ? 'N/A (SPEED UNAVAILABLE)'
                    : `${Math.round(eta.value)} MIN`;

                const etaLabel = `ETA ${target.label}`;
                commands.unshift({ // Add to top
                    id: `eta-${target.id}`,
                    label: etaLabel,
                    subLabel: `ETE: ${timeString} (${distanceKm.toFixed(1)} km) · SRC: ${eta.source} · QUAL: ${eta.qualification}`,
                    icon: Calculator,
                    action: () => {
                        if (navigator.clipboard) void navigator.clipboard.writeText(`${etaLabel}: ${timeString}`);
                    },
                    keywords: ['eta'],
                    isPreview: true,
                    ranking: createStructuredRanking(q, etaLabel),
                });
            }
        }

        // 4. Navigation Mode Toggling
        const navRealMatch = q.match(/^nav\s+real$/i);
        if (navRealMatch) {
            commands.push({
                id: 'nav-mode-real',
                label: 'NAV: REAL (GPS)',
                subLabel: 'Live Ownship Tracking',
                icon: Navigation,
                action: () => { if (context.ownshipNavMode !== NavMode.REAL) context.toggleNavMode(); },
                keywords: ['nav', 'real', 'gps'],
                historyValue: 'NAV REAL',
                ranking: {
                    category: 'STRUCTURED_EXACT',
                    completeness: 3,
                    match: 'EXACT',
                },
            });
        }
        const navSimMatch = q.match(/^nav\s+sim$/i);
        if (navSimMatch) {
            commands.push({
                id: 'nav-mode-sim',
                label: 'NAV: SIM (DR)',
                subLabel: 'Simulator / Dead Reckoning',
                icon: Compass,
                action: () => { if (context.ownshipNavMode !== NavMode.SIM) context.toggleNavMode(); },
                keywords: ['nav', 'sim', 'dr', 'simulation'],
                historyValue: 'NAV SIM',
                ranking: {
                    category: 'STRUCTURED_EXACT',
                    completeness: 3,
                    match: 'EXACT',
                },
            });
        }

        // 5. Kinematic Controls (HDG/SPD) for SIM Mode
        const hdgMatch = q.match(/^hdg\s+(\d+)$/i);
        if (hdgMatch) {
            const targetHdg = parseInt(hdgMatch[1]);
            if (!isNaN(targetHdg)) {
                commands.push({
                    id: 'set-target-hdg',
                    label: `SET HDG: ${targetHdg}°`,
                    subLabel: context.ownshipNavMode === NavMode.SIM ? 'SIM Kinematics' : 'WARN: Simulation Mode Off',
                    icon: Compass,
                    action: () => proposeUnavailableAction('NAV', 'set-heading', `SET HDG: ${targetHdg}°`),
                    keywords: ['hdg', 'heading', 'steer'],
                    isPreview: true,
                    ranking: {
                        category: 'STRUCTURED_EXACT',
                        completeness: 3,
                        match: 'EXACT',
                    },
                });
            }
        }

        const spdMatch = q.match(/^spd\s+(\d+)$/i);
        if (spdMatch) {
            const targetSpd = parseInt(spdMatch[1]);
            if (!isNaN(targetSpd)) {
                commands.push({
                    id: 'set-target-spd',
                    label: `SET SPD: ${targetSpd} KTS`,
                    subLabel: context.ownshipNavMode === NavMode.SIM ? 'SIM Kinematics' : 'WARN: Simulation Mode Off',
                    icon: Zap,
                    action: () => proposeUnavailableAction('NAV', 'set-speed', `SET SPD: ${targetSpd} KTS`),
                    keywords: ['spd', 'speed', 'throttle'],
                    isPreview: true,
                    ranking: {
                        category: 'STRUCTURED_EXACT',
                        completeness: 3,
                        match: 'EXACT',
                    },
                });
            }
        }

        // Add plain text fallback ALWAYS at the bottom so we can save anything
        commands.push({
            id: 'save-text-note',
            label: `SAVE: "${q}"`,
            subLabel: 'Save text to history',
            icon: FileText,
            action: () => {
                if (navigator.clipboard) void navigator.clipboard.writeText(q);
            },
            keywords: [],
            isHistory: false,
            ranking: saveRanking(),
        });

    } else {
        // If empty, append system commands after history
        commands.push(...systemCommands);
    }
    return q.length > 0 ? rankCommandOptions(q, commands) : commands;
};
