import { Entity, SystemStatus, MapMode, HistoryEntry, NavMode, Position } from '../types';
import { bearingBetween } from './geo';
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
import {
    findNearestEntities,
    type NearestCandidate,
    type NearestCategory,
} from '../domain/spatialQueries';
import {
    projectFuturePosition,
    type FuturePositionFreshness,
    type FuturePositionPreview,
    type FuturePositionResult,
    type FuturePositionTrack,
} from '../domain/futurePosition';
import {
    calculateRelativeMotion,
    type RelativeMotionFreshness,
    type RelativeMotionPreview,
    type RelativeMotionResult,
    type RelativeMotionTrack,
} from '../domain/relativeMotion';
import {
    createEntityTrackDetails,
    listStaleEntityDetails,
    type TrackDisplayDetails,
} from '../domain/trackDetails';
import {
    intersectBearings,
    BearingIntersectionError,
    type BearingIntersectionResult,
} from '../domain/bearingIntersection';
import {
    calculateDelta,
    calculateReciprocal,
    calculateRelativeBearing,
    type AngularInputKind,
} from '../domain/angularCalculations';
import {
    calculateFromBullseye,
    createBullseye,
    createBullseyeProjectionPreview,
    type BullseyeEntity,
    type BullseyeProjectionPreview,
    type BullseyeReference,
} from '../domain/bullseye';
import {
    formatCoordinate,
    type CoordinateFormat,
} from '../domain/coordinateFormats';
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
    previewIntersection?: (preview: BearingIntersectionResult) => void;
    previewBullseyeProjection?: (preview: BullseyeProjectionPreview) => void;
    previewFuturePosition?: (preview: FuturePositionPreview) => void;
    previewRelativeMotion?: (preview: RelativeMotionPreview) => void;
    bullseye?: BullseyeReference | null;
    proposeSetBullseye?: (bullseye: BullseyeReference) => void;
    proposeClearBullseye?: () => void;
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
    futurePositionPreview?: FuturePositionPreview;
    futurePositionResult?: FuturePositionResult;
    relativeMotionPreview?: RelativeMotionPreview;
    relativeMotionResult?: RelativeMotionResult;
    trackDetails?: TrackDisplayDetails;
    staleTrackDetails?: TrackDisplayDetails[];
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

const formatNearestCandidate = (candidate: NearestCandidate): string => {
    const bearing = candidate.bearingTrueDegrees === null
        ? 'UNAVAILABLE'
        : `${candidate.bearingTrueDegrees.toFixed(1)}°T`;
    const uncertainty = candidate.uncertaintyMeters === null
        ? ''
        : ` · UNCERTAINTY: ${candidate.uncertaintyMeters.toFixed(0)} M`;
    return `RNG: ${candidate.rangeNauticalMiles.toFixed(1)} NM · BRG: ${bearing} · FRESHNESS: ${candidate.freshness} · QUALITY: ${candidate.quality} · SRC: ${candidate.source}${uncertainty}`;
};

const formatIntersectionBearing = (bearing: number): string => (
    Number.isInteger(bearing)
        ? bearing.toFixed(0).padStart(3, '0')
        : bearing.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
);

const formatIntersectionResult = (result: BearingIntersectionResult): string => {
    const legs = result.legs.map(leg => (
        `${leg.reference} BRG ${formatIntersectionBearing(leg.bearingDegrees)}°T / RNG ${leg.rangeNauticalMiles.toFixed(1)} NM`
    )).join(' · ');
    return `${legs} · ANGLE: ${result.crossingAngleDegrees.toFixed(2)}° · QUALITY: ${result.quality} · METHOD: ${result.method}`;
};

const formatAngularDegrees = (value: number): string => (
    Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)
);

const formatAngularBearing = (value: number): string => (
    Number.isInteger(value) ? value.toFixed(0).padStart(3, '0') : value.toFixed(1)
);

const readFuturePositionTrack = (entity: Entity): FuturePositionTrack => {
    const metadata = entity.metadata;
    const numeric = (key: string): number | undefined => {
        const value = metadata?.[key];
        return typeof value === 'number' ? value : undefined;
    };
    const rawFreshness = metadata?.freshness;
    const freshness: FuturePositionFreshness | undefined = rawFreshness === 'FRESH'
        || rawFreshness === 'STALE'
        || rawFreshness === 'UNKNOWN'
        ? rawFreshness
        : undefined;

    return {
        id: entity.id,
        label: entity.label,
        position: { ...entity.position },
        groundTrackDegrees: numeric('groundTrackDegrees'),
        groundSpeedKnots: numeric('groundSpeedKnots'),
        freshness,
        lastSeenAtMs: numeric('lastSeenAtMs'),
        ageSeconds: numeric('ageSeconds'),
    };
};

const formatFutureAge = (ageSeconds: number | null): string => (
    ageSeconds === null
        ? 'UNKNOWN'
        : `${Number.isInteger(ageSeconds) ? ageSeconds.toFixed(0) : ageSeconds.toFixed(1)} S`
);

const formatFutureUnavailable = (
    reference: string,
    reason: string,
    futurePositionResult?: FuturePositionResult,
): CommandOption => ({
    id: `future-position-unavailable-${normalizeRankingText(reference).replace(/\\s+/g, '-')}`,
    label: `PREDICT ${reference}: UNAVAILABLE`,
    subLabel: `REASON: ${reason} · NO GHOST PREVIEW · CALCULATION ONLY`,
    icon: Navigation,
    keywords: ['predict', 'future', 'position', 'unavailable', reason.toLowerCase()],
    historyValue: `PREDICT ${reference}`,
    isPreview: true,
    futurePositionResult,
    ranking: {
        category: 'STRUCTURED_EXACT',
        completeness: 3,
        match: 'EXACT',
    },
});

const readRelativeMotionTrack = (entity: Entity): RelativeMotionTrack => {
    const metadata = entity.metadata;
    const numeric = (key: string): number | undefined => {
        const value = metadata?.[key];
        return typeof value === 'number' ? value : undefined;
    };
    const rawFreshness = metadata?.freshness;
    const freshness: RelativeMotionFreshness | undefined = rawFreshness === 'FRESH'
        || rawFreshness === 'STALE'
        || rawFreshness === 'UNKNOWN'
        ? rawFreshness
        : undefined;
    return {
        id: entity.id,
        label: entity.label,
        position: { ...entity.position },
        groundTrackDegrees: numeric('groundTrackDegrees'),
        groundSpeedKnots: numeric('groundSpeedKnots'),
        freshness,
    };
};

const formatRelativeMotionUnavailable = (
    command: string,
    reference: string,
    reason: string,
    relativeMotionResult?: RelativeMotionResult,
): CommandOption => ({
    id: `relative-${command.toLowerCase()}-unavailable-${normalizeRankingText(reference).replace(/\\s+/g, '-')}`,
    label: `${command} ${reference}: UNAVAILABLE`,
    subLabel: `REASON: ${reason} · CALCULATION ONLY`,
    icon: Compass,
    keywords: ['relative', 'motion', command.toLowerCase(), 'unavailable', reason.toLowerCase()],
    historyValue: `${command} ${reference}`,
    isPreview: true,
    relativeMotionResult,
    ranking: {
        category: 'STRUCTURED_EXACT',
        completeness: 3,
        match: 'EXACT',
    },
});

const createRelativeMotionOption = (
    command: 'CLOSURE' | 'CPA',
    reference: Entity,
    target: Entity,
    result: Extract<RelativeMotionResult, { status: 'AVAILABLE' }>,
    previewRelativeMotion: ((preview: RelativeMotionPreview) => void) | undefined,
    historyValue: string,
): CommandOption => {
    const preview: RelativeMotionPreview = {
        type: 'RELATIVE_MOTION_PREVIEW',
        command,
        referenceId: reference.id,
        referenceLabel: reference.label,
        targetId: target.id,
        targetLabel: target.label,
        result,
    };
    const tcpaLabel = result.tcpaMinutes === null ? 'N/A' : `${result.tcpaMinutes.toFixed(1)} MIN`;
    const label = command === 'CLOSURE'
        ? `CLOSURE ${target.label}`
        : `CPA ${reference.label === 'VIPER 1-1' || reference.id === 'ownship' ? '' : `${reference.label} `}${target.label}`;
    return {
        id: command === 'CLOSURE'
            ? `relative-closure-${target.id}`
            : `relative-cpa-${reference.id}-${target.id}`,
        label,
        subLabel: `CLOSURE: ${result.closureRateKnots.toFixed(1)} KT · CPA: ${result.cpaDistanceNauticalMiles.toFixed(1)} NM · TCPA: ${tcpaLabel} · STATUS: ${result.cpaStatus} · ASSUMPTION: ${result.assumption}`,
        icon: Compass,
        action: previewRelativeMotion ? () => previewRelativeMotion(preview) : undefined,
        relativeMotionPreview: preview,
        relativeMotionResult: result,
        keywords: ['relative', 'motion', command.toLowerCase(), 'closure', 'cpa', 'tcpa', reference.label, target.label],
        historyValue,
        isPreview: true,
        keepPaletteOpen: true,
        ranking: {
            category: 'STRUCTURED_EXACT',
            completeness: 3,
            match: 'EXACT',
        },
    };
};

const formatTrackAge = (ageSeconds: number | null): string => (
    ageSeconds === null ? 'UNKNOWN' : `${Number.isInteger(ageSeconds) ? ageSeconds.toFixed(0) : ageSeconds.toFixed(1)} S`
);

const formatTrackDetails = (details: TrackDisplayDetails): string => (
    `SOURCE: ${details.sourceLabel ?? 'UNKNOWN'} · AGE: ${formatTrackAge(details.ageSeconds)} · FRESHNESS: ${details.freshness} · QUALITY: ${details.quality} · UNCERTAINTY: ${details.uncertaintyMeters === null ? 'N/A' : `${details.uncertaintyMeters.toFixed(0)} M`} · CLASSIFICATION: ${details.classification} · CONFIDENCE: ${details.confidence === null ? 'N/A' : `${(details.confidence * 100).toFixed(0)}%`}`
);

const createTrackInfoOption = (
    command: 'INFO' | 'AGE' | 'QUALITY',
    details: TrackDisplayDetails,
    historyValue: string,
): CommandOption => ({
    id: `track-${command.toLowerCase()}-${details.trackId}`,
    label: `${command} ${details.label}`,
    subLabel: command === 'INFO'
        ? formatTrackDetails(details)
        : command === 'AGE'
            ? `AGE: ${formatTrackAge(details.ageSeconds)} · FRESHNESS: ${details.freshness}`
            : `QUALITY: ${details.quality} · CLASSIFICATION: ${details.classification} · CONFIDENCE: ${details.confidence === null ? 'N/A' : `${(details.confidence * 100).toFixed(0)}%`}`,
    icon: Compass,
    keywords: ['track', 'info', 'age', 'quality', 'freshness', details.label, details.freshness, details.quality],
    historyValue,
    isPreview: true,
    trackDetails: details,
    keepPaletteOpen: true,
    ranking: {
        category: 'STRUCTURED_EXACT',
        completeness: 3,
        match: 'EXACT',
    },
});

const isAngularInputKind = (value: string | number | null): value is AngularInputKind => (
    value === 'HEADING'
    || value === 'TRACK'
    || value === 'TRUE_BEARING'
    || value === 'RELATIVE_BEARING'
);

const formatUnavailableAngular = (command: string, reason = 'MISSING QUALIFIED INPUT'): CommandOption => ({
    id: `angular-${command.toLowerCase()}-unavailable`,
    label: `${command}: UNAVAILABLE`,
    subLabel: `${reason} · CALCULATION ONLY`,
    icon: Compass,
    keywords: ['angular', command.toLowerCase(), 'unavailable'],
    historyValue: command,
    isPreview: true,
    ranking: {
        category: 'STRUCTURED_EXACT',
        completeness: 3,
        match: 'EXACT',
    },
});

const isCoordinateDisplayFormat = (value: string | number | null): value is CoordinateFormat => (
    value === 'DD' || value === 'DDM' || value === 'DMS'
);

const coordinateRoundingLabel = (format: CoordinateFormat): string => {
    if (format === 'DD') return '0.00001°';
    if (format === 'DDM') return "0.01'";
    return '0.1"';
};

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
        previewIntersection,
        previewBullseyeProjection,
        previewFuturePosition,
        previewRelativeMotion,
        bullseye,
        proposeSetBullseye,
        proposeClearBullseye,
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

    const angularCommand = calculationCommand;
    if (parsedMeasurement.type === 'CALCULATION'
        && (angularCommand === 'RECIP' || angularCommand === 'DELTA' || angularCommand === 'REL')
        && parsedMeasurement.errors.length === 0) {
        const angleKind = isAngularInputKind(parsedMeasurement.parameters.angleKind)
            ? parsedMeasurement.parameters.angleKind
            : 'HEADING';

        if (angularCommand === 'RECIP' && typeof parsedMeasurement.parameters.angle === 'number') {
            const result = calculateReciprocal(parsedMeasurement.parameters.angle, angleKind as Exclude<AngularInputKind, 'RELATIVE_BEARING'>);
            if (result.status === 'AVAILABLE' && result.valueDegrees !== null) {
                commands.push({
                    id: 'angular-reciprocal',
                    label: `RECIP: ${formatAngularBearing(result.valueDegrees)}°`,
                    subLabel: `${result.inputKind} → ${result.outputKind} · CALCULATION ONLY`,
                    icon: Compass,
                    keywords: ['reciprocal', 'recip', result.inputKind, result.outputKind],
                    historyValue: q,
                    isPreview: true,
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            } else {
                commands.push(formatUnavailableAngular('RECIP', result.reason ?? 'INVALID ANGLE'));
            }
        } else if (angularCommand === 'DELTA'
            && typeof parsedMeasurement.parameters.fromAngle === 'number'
            && typeof parsedMeasurement.parameters.toAngle === 'number') {
            const result = calculateDelta(
                parsedMeasurement.parameters.fromAngle,
                parsedMeasurement.parameters.toAngle,
                angleKind as Exclude<AngularInputKind, 'RELATIVE_BEARING'>,
            );
            if (result.status === 'AVAILABLE' && result.deltaDegrees !== null && result.direction) {
                commands.push({
                    id: 'angular-delta',
                    label: `DELTA: ${result.direction} ${formatAngularDegrees(result.deltaDegrees)}°`,
                    subLabel: `${result.inputKind} · SIGNED ${result.signedDeltaDegrees}° · CALCULATION ONLY`,
                    icon: Compass,
                    keywords: ['delta', 'turn', result.direction, result.inputKind],
                    historyValue: q,
                    isPreview: true,
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            } else {
                commands.push(formatUnavailableAngular('DELTA', result.reason ?? 'INVALID ANGLE'));
            }
        } else if (angularCommand === 'REL'
            && typeof parsedMeasurement.parameters.fromReference === 'string'
            && typeof parsedMeasurement.parameters.toReference === 'string') {
            const fromReference = parsedMeasurement.parameters.fromReference;
            const toReference = parsedMeasurement.parameters.toReference;
            const fromResolution = resolveEntityReference(fromReference, entities, ownship);
            const toResolution = resolveEntityReference(toReference, entities, ownship);
            const observer = fromResolution.entity;
            const target = toResolution.entity;
            const observerHeading = observer?.heading;
            const validPositions = observer && target
                && Number.isFinite(observer.position.lat)
                && Number.isFinite(observer.position.lon)
                && Number.isFinite(target.position.lat)
                && Number.isFinite(target.position.lon);

            if (!fromResolution.executable || !toResolution.executable || !observer || !target) {
                commands.push(formatUnavailableAngular('REL', 'AMBIGUOUS OR UNKNOWN REFERENCE'));
            } else if (!validPositions || typeof observerHeading !== 'number' || !Number.isFinite(observerHeading)) {
                commands.push(formatUnavailableAngular('REL', 'OBSERVER HEADING UNAVAILABLE'));
            } else {
                const trueBearing = bearingBetween(
                    observer.position.lat,
                    observer.position.lon,
                    target.position.lat,
                    target.position.lon,
                );
                const result = calculateRelativeBearing(trueBearing, observerHeading);
                if (result.status === 'AVAILABLE' && result.valueDegrees !== null) {
                    const relativeId = observer.id === ownship.id
                        ? `angular-relative-${target.id}`
                        : `angular-relative-${observer.id}-${target.id}`;
                    commands.push({
                        id: relativeId,
                        label: `REL ${target.label}: ${formatAngularDegrees(result.valueDegrees)}°`,
                        subLabel: `${result.inputKind} → ${result.outputKind} · BASE ${observerHeading.toFixed(1)}° ${result.referenceKind} · CALCULATION ONLY`,
                        icon: Compass,
                        keywords: ['relative', 'rel', target.label, observer.label, result.outputKind],
                        historyValue: q,
                        isPreview: true,
                        ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                    });
                } else {
                    commands.push(formatUnavailableAngular('REL', result.reason ?? 'INVALID ANGLE'));
                }
            }
        }
    }

    const predictionCommand = typeof parsedMeasurement.parameters.command === 'string'
        ? parsedMeasurement.parameters.command
        : undefined;
    const predictionReference = parsedMeasurement.parameters.reference;
    const predictionHorizonValue = parsedMeasurement.parameters.horizonValue;
    const predictionHorizonUnit = parsedMeasurement.parameters.horizonUnit;
    if (parsedMeasurement.type === 'SEARCH'
        && predictionCommand === 'PREDICT'
        && parsedMeasurement.errors.length === 0) {
        if (typeof predictionReference !== 'string'
            || typeof predictionHorizonValue !== 'number'
            || (predictionHorizonUnit !== 'MIN' && predictionHorizonUnit !== 'NM')) {
            commands.push(formatFutureUnavailable(String(predictionReference ?? 'UNKNOWN'), 'INVALID_INPUT'));
        } else {
            const resolution = resolveEntityReference(predictionReference, entities, ownship);
            if (!resolution.executable || !resolution.entity) {
                commands.push(formatFutureUnavailable(predictionReference, 'AMBIGUOUS OR UNKNOWN REFERENCE'));
            } else {
                const futureTrack = readFuturePositionTrack(resolution.entity);
                const result = projectFuturePosition({
                    track: futureTrack,
                    horizon: { value: predictionHorizonValue, unit: predictionHorizonUnit },
                    nowMs: scenarioTimeMs,
                });
                if (result.status === 'UNAVAILABLE') {
                    commands.push(formatFutureUnavailable(resolution.entity.label, result.reason, result));
                } else {
                    const groundTrack = futureTrack.groundTrackDegrees as number;
                    const groundSpeed = futureTrack.groundSpeedKnots as number;
                    const preview: FuturePositionPreview = {
                        type: 'FUTURE_POSITION_PREVIEW',
                        trackId: futureTrack.id,
                        trackLabel: futureTrack.label,
                        groundTrackDegrees: groundTrack,
                        groundSpeedKnots: groundSpeed,
                        result,
                    };
                    const horizonLabel = `+${predictionHorizonValue}${predictionHorizonUnit}`;
                    const limitLabel = result.horizonLimit === 'NONE' ? 'NONE' : result.horizonLimit;
                    commands.push({
                        id: `future-position-${resolution.entity.id}`,
                        label: `PREDICT ${resolution.entity.label} ${horizonLabel}`,
                        subLabel: `GHOST: ${result.targetPosition.lat.toFixed(5)}, ${result.targetPosition.lon.toFixed(5)} · VECTOR: ${groundTrack.toFixed(1)}°T @ ${groundSpeed.toFixed(1)} KT · RANGE: ${result.projectedRangeNauticalMiles.toFixed(1)} NM · HORIZON: ${result.effectiveHorizonMinutes.toFixed(1)} MIN · AGE: ${formatFutureAge(result.ageSeconds)} · LIMIT: ${limitLabel} · ASSUMPTION: ${result.assumption}`,
                        icon: Navigation,
                        action: previewFuturePosition ? () => previewFuturePosition(preview) : undefined,
                        futurePositionPreview: preview,
                        futurePositionResult: result,
                        keywords: ['predict', 'future', 'position', 'ghost', resolution.entity.label, 'ground track', 'ground speed'],
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
        }
    }

    const relativeMotionCommand = parsedMeasurement.parameters.command;
    if (parsedMeasurement.type === 'CALCULATION'
        && (relativeMotionCommand === 'CLOSURE' || relativeMotionCommand === 'CPA')
        && parsedMeasurement.errors.length === 0) {
        const isClosure = relativeMotionCommand === 'CLOSURE';
        const fromReference = isClosure ? 'OWNSHIP' : parsedMeasurement.parameters.fromReference;
        const toReference = isClosure
            ? parsedMeasurement.parameters.targetReference
            : parsedMeasurement.parameters.toReference;
        const referenceLabel = typeof fromReference === 'string' ? fromReference : 'UNKNOWN';
        const targetLabel = typeof toReference === 'string' ? toReference : 'UNKNOWN';
        const referenceResolution = isClosure
            ? { executable: true, entity: ownship }
            : typeof fromReference === 'string'
                ? resolveEntityReference(fromReference, entities, ownship)
                : { executable: false, entity: undefined };
        const targetResolution = typeof toReference === 'string'
            ? resolveEntityReference(toReference, entities, ownship)
            : { executable: false, entity: undefined };
        if (!referenceResolution.executable || !referenceResolution.entity
            || !targetResolution.executable || !targetResolution.entity
            || referenceResolution.entity.id === targetResolution.entity.id) {
            commands.push(formatRelativeMotionUnavailable(
                relativeMotionCommand,
                isClosure ? targetLabel : `${referenceLabel} ${targetLabel}`,
                'AMBIGUOUS OR UNKNOWN REFERENCE',
            ));
        } else {
            const result = calculateRelativeMotion({
                reference: readRelativeMotionTrack(referenceResolution.entity),
                target: readRelativeMotionTrack(targetResolution.entity),
            });
            if (result.status === 'UNAVAILABLE') {
                commands.push(formatRelativeMotionUnavailable(
                    relativeMotionCommand,
                    isClosure ? targetResolution.entity.label : `${referenceResolution.entity.label} ${targetResolution.entity.label}`,
                    result.reason,
                    result,
                ));
            } else {
                commands.push(createRelativeMotionOption(
                    relativeMotionCommand,
                    referenceResolution.entity,
                    targetResolution.entity,
                    result,
                    previewRelativeMotion,
                    q,
                ));
            }
        }
    }

    const trackInfoCommand = parsedMeasurement.parameters.command;
    if (parsedMeasurement.type === 'SEARCH'
        && (trackInfoCommand === 'INFO'
            || trackInfoCommand === 'AGE'
            || trackInfoCommand === 'QUALITY'
            || trackInfoCommand === 'STALE')
        && parsedMeasurement.errors.length === 0) {
        if (trackInfoCommand === 'STALE') {
            const staleDetails = listStaleEntityDetails(entities, scenarioTimeMs);
            const staleSummary = staleDetails.length === 0
                ? 'NONE · NO EXPLICITLY STALE TRACKS'
                : staleDetails.map(details => `${details.label} AGE: ${formatTrackAge(details.ageSeconds)}`).join(' · ');
            commands.push({
                id: 'track-stale',
                label: 'STALE',
                subLabel: staleSummary,
                icon: Compass,
                keywords: ['track', 'stale', 'freshness', ...staleDetails.map(details => details.label)],
                historyValue: q,
                isPreview: true,
                staleTrackDetails: staleDetails,
                keepPaletteOpen: true,
                ranking: {
                    category: 'STRUCTURED_EXACT',
                    completeness: 3,
                    match: 'EXACT',
                },
            });
        } else if (typeof parsedMeasurement.parameters.reference === 'string') {
            const reference = parsedMeasurement.parameters.reference;
            const resolution = resolveEntityReference(reference, entities, ownship);
            if (!resolution.executable || !resolution.entity) {
                commands.push({
                    id: `track-${trackInfoCommand.toLowerCase()}-unavailable`,
                    label: `${trackInfoCommand} ${reference}: UNAVAILABLE`,
                    subLabel: 'REASON: AMBIGUOUS OR UNKNOWN REFERENCE · TRACK DETAILS UNAVAILABLE',
                    icon: Compass,
                    keywords: ['track', trackInfoCommand.toLowerCase(), 'unavailable', 'reference'],
                    historyValue: q,
                    isPreview: true,
                    keepPaletteOpen: true,
                    ranking: {
                        category: 'STRUCTURED_EXACT',
                        completeness: 3,
                        match: 'EXACT',
                    },
                });
            } else {
                commands.push(createTrackInfoOption(
                    trackInfoCommand,
                    createEntityTrackDetails(resolution.entity, scenarioTimeMs),
                    q,
                ));
            }
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

    // 4b. Nearest spatial search. Results are local read-only map focuses;
    // they never create navigation, route, or mission actions.
    const nearestCommand = typeof parsedMeasurement.parameters.command === 'string'
        ? parsedMeasurement.parameters.command
        : undefined;
    const nearestCategory = parsedMeasurement.parameters.category;
    const nearestLimit = parsedMeasurement.parameters.limit;
    const nearestReference = parsedMeasurement.parameters.reference;
    if (parsedMeasurement.type === 'SEARCH'
        && nearestCommand === 'NEAREST'
        && parsedMeasurement.errors.length === 0
        && (nearestCategory === 'WAYPOINT' || nearestCategory === 'TRACK' || nearestCategory === 'AIRPORT')
        && typeof nearestLimit === 'number'
        && typeof nearestReference === 'string') {
        const resolution = resolveEntityReference(nearestReference, entities, ownship);
        if (!resolution.executable || !resolution.entity) {
            commands.push({
                id: `nearest-reference-status-${resolution.status.toLowerCase()}`,
                label: `NEAREST ${resolution.status}: ${resolution.reference}`,
                subLabel: 'Nearest search blocked · choose an unambiguous reference',
                icon: Crosshair,
                keywords: ['nearest', 'reference', resolution.status.toLowerCase()],
                isPreview: true,
                ranking: {
                    category: 'STRUCTURED_EXACT',
                    completeness: 3,
                    match: 'EXACT',
                },
            });
        } else {
            let result: ReturnType<typeof findNearestEntities> | undefined;
            try {
                result = findNearestEntities({
                    reference: resolution.entity,
                    entities,
                    category: nearestCategory as NearestCategory,
                    limit: nearestLimit,
                    freshnessOf: context.measurementPositionFreshness,
                });
            } catch {
                commands.push({
                    id: 'nearest-reference-invalid-position',
                    label: `NEAREST INVALID_REFERENCE_POSITION: ${resolution.reference}`,
                    subLabel: 'Nearest search unavailable · reference position is invalid',
                    icon: Crosshair,
                    keywords: ['nearest', 'reference', 'invalid', 'position'],
                    isPreview: true,
                    ranking: {
                        category: 'STRUCTURED_EXACT',
                        completeness: 3,
                        match: 'EXACT',
                    },
                });
            }
            if (result?.status === 'EMPTY') {
                commands.push({
                    id: `nearest-empty-${nearestCategory.toLowerCase()}`,
                    label: `NEAREST ${nearestCategory}: NONE`,
                    subLabel: `No ${nearestCategory.toLowerCase()} objects loaded in the scenario`,
                    icon: Crosshair,
                    keywords: ['nearest', nearestCategory.toLowerCase(), 'none'],
                    isPreview: true,
                    ranking: {
                        category: 'STRUCTURED_EXACT',
                        completeness: 3,
                        match: 'EXACT',
                    },
                });
            } else if (result) {
                result.candidates.forEach(candidate => {
                    commands.push({
                        id: `nearest-result-${nearestCategory.toLowerCase()}-${candidate.id}`,
                        label: candidate.label,
                        subLabel: formatNearestCandidate(candidate),
                        icon: Crosshair,
                        action: () => focusMapAt({ ...candidate.position }),
                        keywords: ['nearest', nearestCategory.toLowerCase(), candidate.label, candidate.type, candidate.id],
                        historyValue: q,
                        isPreview: true,
                        ranking: {
                            category: 'STRUCTURED_EXACT',
                            completeness: 3,
                            match: 'EXACT',
                        },
                    });
                });
            }
        }
    }

    // 4c. Coordinate conversion and local clipboard copy. These commands only
    // format scenario coordinates; they never change navigation or map state.
    const coordinateCommand = typeof parsedMeasurement.parameters.command === 'string'
        ? parsedMeasurement.parameters.command
        : undefined;
    const coordinateFormat = parsedMeasurement.parameters.format;
    if (parsedMeasurement.type === 'COORDINATE'
        && (coordinateCommand === 'COORD' || coordinateCommand === 'COPY POS')
        && parsedMeasurement.errors.length === 0
        && isCoordinateDisplayFormat(coordinateFormat)) {
        const latitude = parsedMeasurement.parameters.latitude;
        const longitude = parsedMeasurement.parameters.longitude;
        const reference = parsedMeasurement.parameters.reference;
        const resolvedReference = typeof reference === 'string'
            ? resolveEntityReference(reference, entities, ownship)
            : undefined;
        const coordinatePosition = typeof latitude === 'number'
            && Number.isFinite(latitude)
            && typeof longitude === 'number'
            && Number.isFinite(longitude)
            ? { lat: latitude, lon: longitude }
            : resolvedReference?.entity?.position;

        if (resolvedReference && (!resolvedReference.executable || !resolvedReference.entity)) {
            commands.push({
                id: `coordinate-reference-status-${resolvedReference.status.toLowerCase()}`,
                label: `${coordinateCommand} ${resolvedReference.status}: ${resolvedReference.reference}`,
                subLabel: 'Coordinate conversion blocked · choose an unambiguous reference',
                icon: MapPin,
                keywords: ['coord', 'copy', 'reference', resolvedReference.status.toLowerCase()],
                isPreview: true,
                ranking: {
                    category: 'STRUCTURED_EXACT',
                    completeness: 3,
                    match: 'EXACT',
                },
            });
        } else if (coordinatePosition) {
            try {
                const formatted = formatCoordinate(coordinatePosition, coordinateFormat);
                const referenceLabel = resolvedReference?.entity?.label;
                const baseLabel = coordinateCommand === 'COPY POS'
                    ? `COPY POS ${referenceLabel ?? 'COORDINATE'}`
                    : referenceLabel
                        ? `COORD ${referenceLabel}`
                        : 'COORD';
                const id = coordinateCommand === 'COPY POS'
                    ? `copy-pos-${resolvedReference?.entity?.id ?? coordinateFormat.toLowerCase()}`
                    : referenceLabel
                        ? `coord-format-${resolvedReference?.entity?.id}-${coordinateFormat.toLowerCase()}`
                        : `coord-literal-${coordinateFormat.toLowerCase()}`;
                const copyAction = coordinateCommand === 'COPY POS'
                    ? () => {
                        try {
                            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                void navigator.clipboard.writeText(formatted).catch(() => undefined);
                            }
                        } catch {
                            // Clipboard permission is optional; the rendered text remains selectable.
                        }
                    }
                    : undefined;
                commands.push({
                    id,
                    label: `${baseLabel}: ${formatted}`,
                    subLabel: coordinateCommand === 'COPY POS'
                        ? `LOCAL CLIPBOARD · COPY IF PERMITTED · FORMAT: ${coordinateFormat} · ROUNDING: ${coordinateRoundingLabel(coordinateFormat)}`
                        : `LOCAL DISPLAY · FORMAT: ${coordinateFormat} · ROUNDING: ${coordinateRoundingLabel(coordinateFormat)}`,
                    icon: MapPin,
                    ...(copyAction ? { action: copyAction } : {}),
                    keywords: ['coord', 'coordinate', coordinateFormat, referenceLabel ?? 'literal'],
                    historyValue: q,
                    isPreview: true,
                    ranking: {
                        category: 'STRUCTURED_EXACT',
                        completeness: 3,
                        match: 'EXACT',
                    },
                });
            } catch {
                // The typed parser validates the source; malformed runtime data stays unavailable.
            }
        }
    }

    // 5. Bearing intersection. This is a local geometric preview only: it
    // never proposes a route, direct-to, heading, or speed change.
    const intersectionCommand = typeof parsedMeasurement.parameters.command === 'string'
        ? parsedMeasurement.parameters.command
        : undefined;
    if (parsedMeasurement.type === 'INTERSECTION'
        && intersectionCommand === 'INT'
        && parsedMeasurement.errors.length === 0) {
        const firstReference = typeof parsedMeasurement.parameters.firstReference === 'string'
            ? parsedMeasurement.parameters.firstReference
            : undefined;
        const firstBearing = typeof parsedMeasurement.parameters.firstBearing === 'number'
            ? parsedMeasurement.parameters.firstBearing
            : undefined;
        const secondReference = typeof parsedMeasurement.parameters.secondReference === 'string'
            ? parsedMeasurement.parameters.secondReference
            : undefined;
        const secondBearing = typeof parsedMeasurement.parameters.secondBearing === 'number'
            ? parsedMeasurement.parameters.secondBearing
            : undefined;

        if (firstReference && firstBearing !== undefined && secondReference && secondBearing !== undefined) {
            const firstResolution = resolveEntityReference(firstReference, entities, ownship);
            const secondResolution = resolveEntityReference(secondReference, entities, ownship);
            const failedResolution = [firstResolution, secondResolution]
                .find(resolution => resolution.status !== 'RESOLVED');

            if (failedResolution) {
                commands.push({
                    id: `intersection-reference-status-${failedResolution.status.toLowerCase()}`,
                    label: `INT ${failedResolution.status}: ${failedResolution.reference}`,
                    subLabel: 'Intersection blocked · choose an unambiguous reference',
                    icon: MapPin,
                    keywords: ['int', 'intersection', 'reference', failedResolution.status.toLowerCase()],
                    keepPaletteOpen: true,
                    ranking: {
                        category: 'STRUCTURED_PARTIAL',
                        completeness: 2,
                        match: 'PREFIX',
                        intent: 'INTERSECTION',
                    },
                });
            } else if (firstResolution.entity && secondResolution.entity
                && firstResolution.entity.id === secondResolution.entity.id) {
                commands.push({
                    id: 'intersection-duplicate-reference',
                    label: 'INT: DISTINCT REFERENCES REQUIRED',
                    subLabel: 'Intersection blocked · use two different entities',
                    icon: MapPin,
                    keywords: ['int', 'intersection', 'duplicate', 'reference'],
                    keepPaletteOpen: true,
                    ranking: {
                        category: 'STRUCTURED_PARTIAL',
                        completeness: 2,
                        match: 'EXACT',
                        intent: 'INTERSECTION',
                    },
                });
            } else if (firstResolution.entity && secondResolution.entity) {
                const firstEntity = firstResolution.entity;
                const secondEntity = secondResolution.entity;
                const queryLabel = `INT ${firstEntity.label}/${formatIntersectionBearing(firstBearing)} ${secondEntity.label}/${formatIntersectionBearing(secondBearing)}`;
                try {
                    const result = intersectBearings(
                        {
                            reference: firstEntity.label,
                            position: { ...firstEntity.position },
                            bearingDegrees: firstBearing,
                        },
                        {
                            reference: secondEntity.label,
                            position: { ...secondEntity.position },
                            bearingDegrees: secondBearing,
                        },
                    );
                    const details = formatIntersectionResult(result);
                    if (!result.canConfirm) {
                        commands.push({
                            id: `intersection-status-geometry-weak-${firstEntity.id}-${secondEntity.id}`,
                            label: `${queryLabel}: GEOMETRY WEAK`,
                            subLabel: `${details} · CONFIRMATION BLOCKED`,
                            icon: MapPin,
                            keywords: ['int', 'intersection', 'geometry', 'weak', firstEntity.label, secondEntity.label],
                            historyValue: q,
                            isPreview: true,
                            keepPaletteOpen: true,
                            ranking: {
                                category: 'STRUCTURED_EXACT',
                                completeness: 3,
                                match: 'EXACT',
                                intent: 'INTERSECTION',
                            },
                        });
                    } else {
                        commands.push({
                            id: `intersection-${firstEntity.id}-${secondEntity.id}`,
                            label: `${queryLabel}: ${result.position.lat.toFixed(5)}, ${result.position.lon.toFixed(5)}`,
                            subLabel: details,
                            icon: MapPin,
                            action: () => {
                                if (previewIntersection) {
                                    previewIntersection(result);
                                    return;
                                }
                                focusMapAt({ ...result.position });
                            },
                            keywords: ['int', 'intersection', firstEntity.label, secondEntity.label],
                            historyValue: q,
                            isPreview: true,
                            keepPaletteOpen: true,
                            ranking: {
                                category: 'STRUCTURED_EXACT',
                                completeness: 3,
                                match: 'EXACT',
                                intent: 'INTERSECTION',
                            },
                        });
                    }
                } catch (error) {
                    const intersectionError = error instanceof BearingIntersectionError
                        ? error
                        : undefined;
                    const code = intersectionError?.code ?? 'UNAVAILABLE';
                    const message = intersectionError?.message ?? 'Intersection is unavailable for these inputs.';
                    commands.push({
                        id: `intersection-status-${code.toLowerCase()}`,
                        label: `${queryLabel}: ${code}`,
                        subLabel: message,
                        icon: MapPin,
                        keywords: ['int', 'intersection', code.toLowerCase()],
                        keepPaletteOpen: true,
                        ranking: {
                            category: 'STRUCTURED_PARTIAL',
                            completeness: 2,
                            match: 'EXACT',
                            intent: 'INTERSECTION',
                        },
                    });
                }
            }
        }
    }

    // 5b. Simulated Bullseye. SET/CLEAR are proposal callbacks; measurements
    // and projections remain local read-only results.
    const bullseyeCommand = typeof parsedMeasurement.parameters.command === 'string'
        ? parsedMeasurement.parameters.command
        : undefined;
    if (parsedMeasurement.type === 'BULLSEYE' && parsedMeasurement.errors.length === 0) {
        const pushBullseyeStatus = (id: string, label: string, subLabel: string) => {
            commands.push({
                id,
                label,
                subLabel,
                icon: Crosshair,
                isPreview: true,
                keepPaletteOpen: true,
                keywords: ['bull', 'bullseye', 'blocked'],
                ranking: {
                    category: 'STRUCTURED_EXACT',
                    completeness: 3,
                    match: 'EXACT',
                },
            });
        };

        if (bullseyeCommand === 'SET BULL') {
            const reference = parsedMeasurement.parameters.reference;
            if (typeof reference === 'string') {
                const resolution = resolveEntityReference(reference, entities, ownship);
                if (!resolution.executable || !resolution.entity) {
                    pushBullseyeStatus(
                        `set-bullseye-reference-status-${resolution.status.toLowerCase()}`,
                        `SET BULL ${resolution.status}: ${resolution.reference}`,
                        'SET BULL blocked · choose an unambiguous scenario entity',
                    );
                } else {
                    const bullseyeEntity: BullseyeEntity = {
                        id: resolution.entity.id,
                        label: resolution.entity.label,
                        position: { ...resolution.entity.position },
                    };
                    const nextBullseye = createBullseye(bullseyeEntity);
                    commands.push({
                        id: 'set-bullseye',
                        label: `SET BULL ${nextBullseye.label}`,
                        subLabel: bullseye
                            ? `Replace ${bullseye.label} · explicit confirmation required`
                            : 'Set scenario Bullseye · explicit confirmation required',
                        icon: Crosshair,
                        action: () => proposeSetBullseye?.(nextBullseye),
                        keywords: ['set', 'bull', 'bullseye', nextBullseye.label],
                        historyValue: q,
                        isPreview: true,
                        keepPaletteOpen: true,
                        ranking: {
                            category: 'STRUCTURED_EXACT',
                            completeness: 3,
                            match: 'EXACT',
                        },
                    });
                }
            }
        } else if (bullseyeCommand === 'CLEAR BULL') {
            if (!bullseye) {
                pushBullseyeStatus(
                    'clear-bullseye-no-bullseye',
                    'CLEAR BULL: NO BULLSEYE',
                    'No simulated Bullseye is set',
                );
            } else {
                commands.push({
                    id: 'clear-bullseye',
                    label: 'CLEAR BULL',
                    subLabel: `Clear ${bullseye.label} · explicit confirmation required`,
                    icon: Crosshair,
                    action: () => proposeClearBullseye?.(),
                    keywords: ['clear', 'bull', 'bullseye'],
                    historyValue: q,
                    isPreview: true,
                    keepPaletteOpen: true,
                    ranking: {
                        category: 'STRUCTURED_EXACT',
                        completeness: 3,
                        match: 'EXACT',
                    },
                });
            }
        } else if (bullseyeCommand === 'BULL') {
            const targetReference = parsedMeasurement.parameters.targetReference;
            if (typeof targetReference === 'string') {
                if (!bullseye) {
                    pushBullseyeStatus(
                        'bull-measure-no-bullseye',
                        `BULL ${targetReference}: NO BULLSEYE`,
                        'Measurement blocked · set an explicit simulated Bullseye first',
                    );
                } else {
                    const resolution = resolveEntityReference(targetReference, entities, ownship);
                    if (!resolution.executable || !resolution.entity) {
                        pushBullseyeStatus(
                            `bull-measure-reference-status-${resolution.status.toLowerCase()}`,
                            `BULL ${resolution.status}: ${resolution.reference}`,
                            'BULL measurement blocked · choose an unambiguous target',
                        );
                    } else {
                        const measurement = calculateFromBullseye(bullseye, {
                            id: resolution.entity.id,
                            label: resolution.entity.label,
                            position: { ...resolution.entity.position },
                        });
                        const bearing = measurement.bearingTrueDegrees === null
                            ? 'UNAVAILABLE'
                            : `${measurement.bearingTrueDegrees.toFixed(1)}°T`;
                        const range = measurement.rangeNauticalMiles === null
                            ? 'UNAVAILABLE'
                            : `${measurement.rangeNauticalMiles.toFixed(1)} NM`;
                        commands.push({
                            id: `bull-measure-${resolution.entity.id}`,
                            label: `BULL ${resolution.entity.label}`,
                            subLabel: `BRG: ${bearing} · RNG: ${range} · SRC: BULLSEYE · QUALIFICATION: ${measurement.qualification}`,
                            icon: Crosshair,
                            keywords: ['bull', 'bullseye', 'brg', 'rng', resolution.entity.label],
                            historyValue: q,
                            isPreview: true,
                            keepPaletteOpen: true,
                            ranking: {
                                category: 'STRUCTURED_EXACT',
                                completeness: 3,
                                match: 'EXACT',
                            },
                        });
                    }
                }
            } else {
                const bearing = parsedMeasurement.parameters.bearing;
                const range = parsedMeasurement.parameters.range;
                const unit = parsedMeasurement.parameters.unit;
                if (!bullseye) {
                    pushBullseyeStatus(
                        'bull-projection-no-bullseye',
                        'BULL PROJECTION: NO BULLSEYE',
                        'Projection blocked · set an explicit simulated Bullseye first',
                    );
                } else if (typeof bearing === 'number' && typeof range === 'number' && typeof unit === 'string') {
                    try {
                        const quantity = createTacticalQuantity(range, unit, { allowImplicitNauticalMile: true });
                        const rangeNauticalMiles = convertTacticalQuantity(quantity, 'NM').value;
                        const preview = createBullseyeProjectionPreview(
                            bullseye,
                            bearing,
                            rangeNauticalMiles,
                        );
                        commands.push({
                            id: 'bull-projection',
                            label: `BULL BRG ${formatIntersectionBearing(bearing)}°T / RNG ${rangeNauticalMiles.toFixed(1)} NM`,
                            subLabel: `LOCAL PREVIEW · ${preview.method} · ${bullseye.label} · explicit confirmation not required`,
                            icon: Crosshair,
                            action: () => previewBullseyeProjection?.(preview),
                            keywords: ['bull', 'bullseye', 'projection', 'preview'],
                            historyValue: q,
                            isPreview: true,
                            keepPaletteOpen: true,
                            ranking: {
                                category: 'STRUCTURED_EXACT',
                                completeness: 3,
                                match: 'EXACT',
                            },
                        });
                    } catch {
                        pushBullseyeStatus(
                            'bull-projection-unavailable',
                            'BULL PROJECTION: UNAVAILABLE',
                            'Projection is unavailable for the supplied Bullseye geometry',
                        );
                    }
                }
            }
        }
    }

    // 6. Tactical BRG/RNG measurements. These results are pure, local
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
    const rankedCommands = q.length > 0 ? rankCommandOptions(q, commands) : commands;
    const nearestResults = parsedMeasurement.type === 'SEARCH'
        && parsedMeasurement.parameters.command === 'NEAREST'
        ? commands.filter(command => command.id.startsWith('nearest-result-'))
        : [];
    if (nearestResults.length > 0) {
        const nearestIds = new Set(nearestResults.map(command => command.id));
        return [
            ...nearestResults,
            ...rankedCommands.filter(command => !nearestIds.has(command.id)),
        ];
    }
    return rankedCommands;
};
