import { Entity, SystemStatus, MapMode, HistoryEntry, NavMode, Position } from '../types';
import { Zap, Radio, Anchor, Eye, Navigation, Compass, Target, Calculator, MapPin, Crosshair, History, FileText, Copy, Trash2 } from 'lucide-react';
import Fuse from 'fuse.js';
import {
    calculateEtaEte,
    formatEtaEte,
    type GroundSpeedInput,
} from '../domain/etaEte';
import {
    convertTacticalQuantity,
    createTacticalQuantity,
} from '../domain/tacticalUnits';
import { parseCommand } from '../domain/commandParser';
import {
    formatEntityReferenceCandidate,
    resolveEntityReference,
    type EntityReferenceResolution,
} from '../domain/entityResolution';
import {
    calculateTacticalMeasurement,
    formatTacticalMeasurement,
    type TacticalPositionFreshness,
} from '../domain/tacticalMeasurements';
import { createProjectionPreview } from '../domain/designations';
import { formatTimeDistanceSpeed, solveTimeDistanceSpeed } from '../domain/timeDistanceSpeed';
import {
    formatRouteSummary,
    summarizeRoute,
    type ActiveSimulatedRoute,
    type RouteSummaryCommand,
} from '../domain/routeSummary';
import type { ProjectionPreview, SimulatedDesignation } from '../domain/designations';
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
    previewProjection?: (preview: ProjectionPreview) => void;
    proposeDirectTo: (target: Pick<Entity, 'id' | 'label' | 'position'>) => void;
    proposeRoute: (target: Pick<Entity, 'id' | 'label' | 'position'>, objective?: MissionObjective) => void;
    requestMissionAction: (request: MissionActionRequest) => void;
    history: HistoryEntry[]; // Added History to Context
    openDocument: (filename: string) => void;
    ownshipNavMode: NavMode;
    toggleNavMode: () => void;
    designations?: SimulatedDesignation[];
    listDesignations?: () => void;
    renameDesignation?: (designationId: string, label: string) => void;
    deleteDesignation?: (designationId: string) => void;
    proposeClearDesignations?: () => void;
    undoLastDesignation?: () => void;
    measurementPositionFreshness?: (entity: Entity) => TacticalPositionFreshness;
    groundSpeed?: GroundSpeedInput;
    scenarioTimeMs?: number;
    localTimeZone?: string;
    activeRoute?: ActiveSimulatedRoute;
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
    keepPaletteOpen?: boolean;
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

interface ParsedProjection {
    label?: string;
    preview?: ProjectionPreview;
    resolution: EntityReferenceResolution;
    createCandidateQuery: (candidateId: string) => string;
}

const parseProjection = (query: string, entities: Entity[], ownship: Entity): ParsedProjection | null => {
    const parsed = parseCommand(query);
    if (parsed.type !== 'PROJECTION' || parsed.errors.length > 0) return null;

    const bearing = parsed.parameters.bearing;
    const range = parsed.parameters.range;
    const unit = parsed.parameters.unit;
    if (typeof bearing !== 'number' || !Number.isFinite(bearing)
        || typeof range !== 'number' || !Number.isFinite(range)
        || typeof unit !== 'string') {
        return null;
    }

    const referenceName = typeof parsed.parameters.reference === 'string'
        ? parsed.parameters.reference
        : 'OWNSHIP';
    const resolution = resolveEntityReference(referenceName, entities, ownship);
    const createCandidateQuery = (candidateId: string): string => (
        `PROJ ${candidateId} ${bearing}/${range}${unit}`
    );

    if (!resolution.executable || !resolution.entity) {
        return {
            resolution,
            createCandidateQuery,
        };
    }

    let rangeNauticalMiles: number;
    try {
        const quantity = createTacticalQuantity(range, unit, { allowImplicitNauticalMile: true });
        rangeNauticalMiles = convertTacticalQuantity(quantity, 'NM').value;
    } catch {
        return null;
    }

    try {
        const preview = createProjectionPreview(
            resolution.entity.label,
            { ...resolution.entity.position },
            bearing,
            rangeNauticalMiles,
        );
        return {
            label: `PROJ: ${resolution.entity.label} BRG ${bearing}°/RNG ${rangeNauticalMiles}NM`,
            preview,
            resolution,
            createCandidateQuery,
        };
    } catch {
        return null;
    }
};

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
    const {
        entities,
        ownship,
        systems,
        setMapMode,
        toggleSystem,
        focusMapAt,
        proposeDirectTo,
        proposeRoute,
        requestMissionAction,
        history,
        openDocument,
        designations = [],
        listDesignations,
        renameDesignation,
        deleteDesignation,
        proposeClearDesignations,
        undoLastDesignation,
        groundSpeed,
        scenarioTimeMs,
        localTimeZone,
        activeRoute,
    } = context;
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
                    autocompleteValue: entry.canonical
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

    // 3. Designated simulated points. These commands only call local intent
    // callbacks; they never mutate entities, tracks, routes, or mission state.
    const findDesignation = (reference: string): SimulatedDesignation | undefined => {
        const normalizedReference = normalizeRankingText(reference);
        return designations.find(designation => (
            normalizeRankingText(designation.label) === normalizedReference
            || normalizeRankingText(designation.id) === normalizedReference
        ));
    };

    if (normalizeRankingText(q) === 'LIST POINTS') {
        commands.push({
            id: 'list-points',
            label: 'LIST POINTS',
            subLabel: designations.length === 0
                ? 'No designated points'
                : `${designations.length} designated point${designations.length === 1 ? '' : 's'}`,
            icon: FileText,
            action: () => listDesignations?.(),
            keywords: ['list', 'points', 'designations'],
            historyValue: 'LIST POINTS',
            ranking: {
                category: 'STRUCTURED_EXACT',
                completeness: 3,
                match: 'EXACT',
            },
        });
    }

    const pointFocusMatch = q.match(/^focus(?:\s+point)?\s+(.+)$/i);
    if (pointFocusMatch) {
        const designation = findDesignation(pointFocusMatch[1]);
        if (designation) {
            commands.push({
                id: `focus-point-${designation.id}`,
                label: `FOCUS ${designation.label}`,
                subLabel: 'Map focus only · Designated point',
                icon: Crosshair,
                action: () => focusMapAt({ ...designation.position }),
                keywords: ['focus', 'point', 'center', designation.label],
                historyValue: `FOCUS ${designation.label}`,
                ranking: createStructuredRanking(q, `FOCUS ${designation.label}`),
            });
        }
    }

    const renameMatch = q.match(/^rename\s+(\S+)\s+(.+)$/i);
    if (renameMatch) {
        const designation = findDesignation(renameMatch[1]);
        const label = renameMatch[2].trim();
        if (designation && label) {
            commands.push({
                id: `rename-point-${designation.id}`,
                label: `RENAME ${designation.label} ${label}`,
                subLabel: 'Rename designated point',
                icon: FileText,
                action: () => renameDesignation?.(designation.id, label),
                keywords: ['rename', 'point', designation.label, label],
                historyValue: `RENAME ${designation.label} ${label}`,
                ranking: createStructuredRanking(q, `RENAME ${designation.label} ${label}`),
            });
        }
    }

    const deleteMatch = q.match(/^delete\s+(.+)$/i);
    if (deleteMatch) {
        const designation = findDesignation(deleteMatch[1]);
        if (designation) {
            commands.push({
                id: `delete-point-${designation.id}`,
                label: `DELETE ${designation.label}`,
                subLabel: 'Delete designated point only',
                icon: Trash2,
                action: () => deleteDesignation?.(designation.id),
                keywords: ['delete', 'point', designation.label],
                historyValue: `DELETE ${designation.label}`,
                ranking: createStructuredRanking(q, `DELETE ${designation.label}`),
            });
        }
    }

    if (normalizeRankingText(q) === 'UNDO LAST DESIGNATION') {
        commands.push({
            id: 'undo-last-designation',
            label: 'UNDO LAST DESIGNATION',
            subLabel: 'Remove the latest simulated designation only',
            icon: Trash2,
            action: () => undoLastDesignation?.(),
            keywords: ['undo', 'last', 'designation', 'point'],
            historyValue: 'UNDO LAST DESIGNATION',
            ranking: {
                category: 'STRUCTURED_EXACT',
                completeness: 3,
                match: 'EXACT',
            },
        });
    }

    if (normalizeRankingText(q) === 'CLEAR POINTS') {
        commands.push({
            id: 'clear-points',
            label: 'CLEAR POINTS',
            subLabel: 'Propose clear · explicit confirmation required',
            icon: Trash2,
            action: () => proposeClearDesignations?.(),
            keywords: ['clear', 'points', 'designations'],
            historyValue: 'CLEAR POINTS',
            ranking: {
                category: 'STRUCTURED_EXACT',
                completeness: 3,
                match: 'EXACT',
            },
        });
    }

    // 4. Explicit map focus: it never creates a navigation proposal.
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
    if (proj?.preview && proj.label) {
        commands.push({
            id: 'proj-focus',
            label: proj.label,
            subLabel: 'Projection Focus',
            icon: Crosshair,
            action: () => {
                if (context.previewProjection) {
                    context.previewProjection(proj.preview!);
                    return;
                }
                focusMapAt(proj.preview!.targetPosition);
            },
            keywords: ['proj'],
            isPreview: true,
            keepPaletteOpen: true,
            ranking: projectionRanking(),
        });
    } else if (proj) {
        const resolution = proj.resolution;
        const isFuzzySuggestion = resolution.status === 'FUZZY_SUGGESTION';
        const statusSubLabel = resolution.status === 'UNKNOWN_REFERENCE'
            ? 'No matching entity · projection blocked'
            : isFuzzySuggestion
                ? 'Choose a suggestion explicitly · projection blocked'
                : 'Multiple matching entities · choose a reference';
        const match = isFuzzySuggestion ? 'FUZZY' : resolution.match === 'IDENTIFIER_EXACT'
            || resolution.match === 'LABEL_EXACT' ? 'EXACT' : 'PREFIX';

        commands.push({
            id: `proj-reference-status-${resolution.status.toLowerCase()}`,
            label: `${resolution.status}: ${resolution.reference}`,
            subLabel: statusSubLabel,
            icon: Crosshair,
            keywords: ['proj', 'reference', resolution.status.toLowerCase()],
            keepPaletteOpen: true,
            ranking: {
                category: 'STRUCTURED_PARTIAL',
                completeness: 2,
                match,
                intent: 'PROJECTION',
            },
        });

        resolution.candidates.forEach(candidate => {
            commands.push({
                id: `proj-reference-candidate-${candidate.id}`,
                label: candidate.label,
                subLabel: formatEntityReferenceCandidate(candidate),
                icon: Crosshair,
                keywords: ['proj', 'reference', candidate.label, candidate.type, candidate.id],
                autocompleteValue: proj.createCandidateQuery(candidate.id),
                keepPaletteOpen: true,
                ranking: {
                    category: 'ENTITY_AMBIGUOUS',
                    completeness: 2,
                    match,
                    intent: 'PROJECTION',
                },
            });
        });
    }

    const parsedMeasurement = parseCommand(q);
    const calculationCommand = typeof parsedMeasurement.parameters.command === 'string'
        ? parsedMeasurement.parameters.command
        : undefined;
    if (parsedMeasurement.type === 'CALCULATION'
        && (calculationCommand === 'TIME' || calculationCommand === 'DIST' || calculationCommand === 'GS')
        && parsedMeasurement.errors.length === 0) {
        try {
            const distance = typeof parsedMeasurement.parameters.distance === 'number'
                && typeof parsedMeasurement.parameters.distanceUnit === 'string'
                ? createTacticalQuantity(parsedMeasurement.parameters.distance, parsedMeasurement.parameters.distanceUnit)
                : undefined;
            const speed = typeof parsedMeasurement.parameters.speed === 'number'
                && typeof parsedMeasurement.parameters.speedUnit === 'string'
                ? createTacticalQuantity(parsedMeasurement.parameters.speed, parsedMeasurement.parameters.speedUnit)
                : undefined;
            const time = typeof parsedMeasurement.parameters.time === 'number'
                && typeof parsedMeasurement.parameters.timeUnit === 'string'
                ? createTacticalQuantity(parsedMeasurement.parameters.time, parsedMeasurement.parameters.timeUnit)
                : undefined;
            const result = calculationCommand === 'TIME'
                ? solveTimeDistanceSpeed({ solveFor: 'TIME', distance, speed })
                : calculationCommand === 'DIST'
                    ? solveTimeDistanceSpeed({ solveFor: 'DISTANCE', time, speed })
                    : solveTimeDistanceSpeed({ solveFor: 'SPEED', distance, time });
            const display = formatTimeDistanceSpeed(result);
            const label = calculationCommand === 'TIME'
                ? `TIME: ${display.time}`
                : calculationCommand === 'DIST'
                    ? `DIST: ${display.distance}`
                    : `GS: ${display.speed}`;

            commands.push({
                id: `tds-${calculationCommand.toLowerCase()}`,
                label,
                subLabel: `DIST: ${display.distance} · GS: ${display.speed} · TIME: ${display.time}`,
                icon: Calculator,
                action: () => {
                    if (navigator.clipboard) {
                        void navigator.clipboard.writeText(`${label} · ${display.distance} · ${display.speed} · ${display.time}`);
                    }
                },
                keywords: ['time', 'distance', 'speed', 'ground speed'],
                historyValue: q,
                isPreview: true,
                ranking: {
                    category: 'STRUCTURED_EXACT',
                    completeness: 3,
                    match: 'EXACT',
                },
            });
        } catch {
            // The typed parser already reports invalid quantities; no result is emitted here.
        }
    }

    const parsedRoute = parseCommand(q);
    if (parsedRoute.type === 'ROUTE' && parsedRoute.errors.length === 0) {
        const routeCommand = parsedRoute.parameters.command;
        if (routeCommand === 'STATUS' || routeCommand === 'LEG'
            || routeCommand === 'NEXT' || routeCommand === 'ETE') {
            const summary = summarizeRoute(activeRoute, {
                currentPosition: { ...ownship.position },
                speed: groundSpeed,
                scenarioTimeMs,
            });
            const display = formatRouteSummary(routeCommand as RouteSummaryCommand, summary);
            commands.push({
                id: `route-${routeCommand.toLowerCase()}`,
                label: display.label,
                subLabel: display.subLabel,
                icon: Navigation,
                keywords: ['route', 'leg', 'next', 'ete', 'simulated', summary.routeLabel ?? 'route'],
                historyValue: q,
                isPreview: true,
                ranking: {
                    category: 'STRUCTURED_EXACT',
                    completeness: 3,
                    match: 'EXACT',
                },
            });
        }
    }

    // 5. Tactical BRG/RNG measurements. These results are pure, local
    // calculations and never create navigation, route, or designation state.
    const measurementCommand = typeof parsedMeasurement.parameters.command === 'string'
        ? parsedMeasurement.parameters.command
        : undefined;
    if (parsedMeasurement.type === 'MEASUREMENT'
        && (measurementCommand === 'BRG' || measurementCommand === 'RNG' || measurementCommand === 'BRG/RNG')
        && parsedMeasurement.errors.length === 0) {
        const fromReference = typeof parsedMeasurement.parameters.fromReference === 'string'
            ? parsedMeasurement.parameters.fromReference
            : undefined;
        const toReference = typeof parsedMeasurement.parameters.toReference === 'string'
            ? parsedMeasurement.parameters.toReference
            : undefined;

        if (fromReference && toReference) {
            const fromResolution = resolveEntityReference(fromReference, entities, ownship);
            const toResolution = resolveEntityReference(toReference, entities, ownship);
            const failedResolution = [fromResolution, toResolution]
                .find(resolution => resolution.status !== 'RESOLVED');

            if (failedResolution) {
                commands.push({
                    id: `measurement-reference-status-${failedResolution.status.toLowerCase()}`,
                    label: `${failedResolution.status}: ${failedResolution.reference}`,
                    subLabel: `${measurementCommand} blocked · choose an unambiguous reference`,
                    icon: Calculator,
                    keywords: ['brg', 'rng', 'reference', failedResolution.status.toLowerCase()],
                    isPreview: true,
                    ranking: {
                        category: 'STRUCTURED_PARTIAL',
                        completeness: 2,
                        match: 'EXACT',
                        intent: 'MEASUREMENT',
                    },
                });
            } else if (fromResolution.entity && toResolution.entity) {
                const kind = measurementCommand as 'BRG' | 'RNG' | 'BRG/RNG';
                const measurement = calculateTacticalMeasurement(
                    fromResolution.entity,
                    toResolution.entity,
                    {
                        fromFreshness: context.measurementPositionFreshness?.(fromResolution.entity),
                        toFreshness: context.measurementPositionFreshness?.(toResolution.entity),
                    },
                );
                const referenceLabel = fromReference === 'OWNSHIP'
                    ? toResolution.entity.label
                    : `${fromResolution.entity.label} ${toResolution.entity.label}`;

                commands.push({
                    id: `measurement-result-${kind.toLowerCase().replace('/', '-')}-${fromResolution.entity.id}-${toResolution.entity.id}`,
                    label: `${kind} ${referenceLabel}`,
                    subLabel: formatTacticalMeasurement(measurement, kind),
                    icon: Calculator,
                    keywords: ['brg', 'rng', fromResolution.entity.label, toResolution.entity.label],
                    historyValue: q,
                    isPreview: true,
                    ranking: {
                        category: 'STRUCTURED_EXACT',
                        completeness: 3,
                        match: 'EXACT',
                        intent: 'MEASUREMENT',
                    },
                });
            }
        }
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

        // ETA/ETE uses an explicit ground-speed source and the scenario clock.
        const etaEteCommand = typeof parsedMeasurement.parameters.command === 'string'
            ? parsedMeasurement.parameters.command
            : undefined;
        if (parsedMeasurement.type === 'MEASUREMENT'
            && (etaEteCommand === 'ETA' || etaEteCommand === 'ETE')
            && parsedMeasurement.errors.length === 0) {
            const fromReference = typeof parsedMeasurement.parameters.fromReference === 'string'
                ? parsedMeasurement.parameters.fromReference
                : undefined;
            const toReference = typeof parsedMeasurement.parameters.toReference === 'string'
                ? parsedMeasurement.parameters.toReference
                : undefined;

            if (fromReference && toReference) {
                const fromResolution = resolveEntityReference(fromReference, entities, ownship);
                const toResolution = resolveEntityReference(toReference, entities, ownship);
                const failedResolution = [fromResolution, toResolution]
                    .find(resolution => resolution.status !== 'RESOLVED');

                if (failedResolution) {
                    commands.push({
                        id: `${etaEteCommand.toLowerCase()}-reference-status-${failedResolution.status.toLowerCase()}`,
                        label: `${etaEteCommand} ${failedResolution.reference}`,
                        subLabel: `${failedResolution.status} · ${etaEteCommand} blocked`,
                        icon: Calculator,
                        keywords: ['eta', 'ete', 'reference', failedResolution.status.toLowerCase()],
                        isPreview: true,
                        ranking: {
                            category: 'STRUCTURED_EXACT',
                            completeness: 3,
                            match: 'EXACT',
                            intent: 'MEASUREMENT',
                        },
                    });
                } else if (fromResolution.entity && toResolution.entity) {
                    const explicitSpeed = typeof parsedMeasurement.parameters.speed === 'number'
                        && parsedMeasurement.parameters.speedUnit === 'KT'
                        ? {
                            speedKnots: parsedMeasurement.parameters.speed,
                            source: 'USER_INPUT' as const,
                            qualification: 'USER_ASSUMPTION' as const,
                        }
                        : groundSpeed;
                    const result = calculateEtaEte(
                        fromResolution.entity.position,
                        toResolution.entity.position,
                        explicitSpeed,
                        scenarioTimeMs ?? Number.NaN,
                    );
                    const display = formatEtaEte(result, localTimeZone ?? 'UTC');
                    const referenceLabel = fromReference === 'OWNSHIP'
                        ? toResolution.entity.label
                        : `${fromResolution.entity.label} → ${toResolution.entity.label}`;
                    const resultId = fromReference === 'OWNSHIP'
                        ? `${etaEteCommand.toLowerCase()}-${toResolution.entity.id}`
                        : `${etaEteCommand.toLowerCase()}-${fromResolution.entity.id}-${toResolution.entity.id}`;
                    const label = `${etaEteCommand} ${referenceLabel}`;

                    commands.push({
                        id: resultId,
                        label,
                        subLabel: `${display.distance} · ${display.ete} · ${display.etaUtc} · ${display.etaLocal} · ${display.speed} · SRC: ${result.speedSource}`,
                        icon: Calculator,
                        action: () => {
                            if (navigator.clipboard) {
                                void navigator.clipboard.writeText(`${label}: ${display.ete}; ${display.etaUtc}`);
                            }
                        },
                        keywords: ['eta', 'ete', 'time', 'distance', fromResolution.entity.label, toResolution.entity.label],
                        historyValue: q,
                        isPreview: true,
                        ranking: {
                            category: 'STRUCTURED_EXACT',
                            completeness: 3,
                            match: 'EXACT',
                            intent: 'MEASUREMENT',
                        },
                    });
                }
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
