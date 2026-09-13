import { Entity, EntityType, SystemStatus, MapMode, HistoryEntry, NavMode, Position } from '../types';
import { createKinematicsSnapshot, type KinematicsFreshness, type KinematicsSnapshotOptions } from '../domain/kinematics';
import { bearingBetween } from './geo';
import { Zap, Radio, Eye, Navigation, Compass, Target, Calculator, MapPin, Crosshair, History, FileText, Copy, Trash2, Layers, Info } from 'lucide-react';
import Fuse from 'fuse.js';
import {
    calculateEtaEte,
    formatEtaEte,
    type GroundSpeedInput,
} from '../domain/etaEte';
import {
    convertTacticalQuantity,
    createTacticalQuantity,
    type TacticalQuantity,
} from '../domain/tacticalUnits';
import { parseCommand } from '../domain/commandParser';
import {
    formatEntityReferenceCandidate,
    resolveEntityPairReference,
    resolveEntityReference,
    type EntityReferencePairResolution,
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
    findWithinEntities,
    type NearestCandidate,
    type NearestCategory,
    type WithinCategory,
} from '../domain/spatialQueries';
import {
    projectFuturePosition,
    toFuturePositionTrack,
    type FuturePositionFreshness,
    type FuturePositionPreview,
    type FuturePositionResult,
    type FuturePositionTrack,
} from '../domain/futurePosition';
import {
    calculateRelativeMotion,
    toRelativeMotionTrack,
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
import type { ScenarioTimerState } from '../domain/simulationTimers';
import type { FavoriteRequest, FavoriteState } from '../domain/favorites';
import {
    setDeclutterPreset,
    type DeclutterPreset,
    type DeclutterState,
} from '../domain/declutter';
import {
    getLegendEntries,
    getLegendEntry,
    type LegendEntryId,
} from '../domain/legend';
import {
    createGridState,
    setGridEnabled,
    setGridStep,
    type GridState,
} from '../domain/grid';
import {
    checkZoneContainment,
    createDefaultZones,
    getZone,
    type NamedZone,
} from '../domain/zones';
import type { TrackTrailState } from '../domain/trackTrails';
import {
    createLayerState,
    setLayerVisibility,
    type TacticalLayerId,
    type TacticalLayerState,
} from '../domain/layers';
import {
    calculateGradient,
    calculateTopOfDescent,
    calculateVerticalSpeedRequired,
} from '../domain/verticalCalculations';
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
import {
    createAmbiguousCommandResult,
    createAvailableCommandResult,
    createIncompleteCommandResult,
    createPartialCommandResult,
    createUnavailableCommandResult,
    displayValue,
    mapCommandReason,
    type CommandResult,
    type InputQualification,
    type ResultCandidate,
    type ResultInputOrigin,
} from '../domain/commandResults';

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
    /** Absolute scenario epoch used for ETA qualification. */
    scenarioTimeMs?: number;
    timerState?: ScenarioTimerState;
    createTimer?: (durationMs: number, label: string, checkReference?: string) => void;
    cancelTimer?: (timerId: number) => void;
    favoriteState?: FavoriteState;
    addFavorite?: (request: FavoriteRequest) => void;
    removeFavorite?: (favoriteId: number) => void;
    layers?: TacticalLayerState;
    setLayers?: (state: TacticalLayerState) => void;
    declutter?: DeclutterState;
    setDeclutter?: (state: DeclutterState) => void;
    grid?: GridState;
    setGrid?: (state: GridState) => void;
    zones?: NamedZone[];
    visibleZoneId?: string | null;
    setVisibleZone?: (zoneId: string | null) => void;
    simulationStatus?: 'RUNNING' | 'PAUSED' | 'RESET · PAUSED' | 'REPLAY · RUNNING';
    simulationIsRunning?: boolean;
    /** Elapsed simulation duration used for T+ display. */
    simulationTimeMs?: number;
    simulationSpeed?: number;
    pauseSimulation?: () => void;
    resumeSimulation?: () => void;
    setSimulationSpeed?: (speed: number) => boolean;
    requestSimulationReset?: () => void;
    requestSimulationReplay?: () => void;
    localTimeZone?: string;
    activeRoute?: ActiveSimulatedRoute;
    setRouteVisibility?: (visible: boolean) => void;
    trails?: TrackTrailState;
    setTrailVisibility?: (targetId: string, visible: boolean, label?: string) => void;
}

export interface CommandOption {
    id: string;
    label: string;
    subLabel?: string;
    icon: any;
    action?: () => void;
    keywords: string[];
    disabled?: boolean;
    isPreview?: boolean;
    isHistory?: boolean;
    autocompleteValue?: string;
    historyValue?: string;
    ranking?: CommandRankingMetadata;
    /** Explicit opt-in for dispatching this command from a map drop. */
    dragDropEligible?: boolean;
    /** Explicit opt-in for the horizontal swipe execution gesture. */
    swipeCapable?: boolean;
    futurePositionPreview?: FuturePositionPreview;
    futurePositionResult?: FuturePositionResult;
    relativeMotionPreview?: RelativeMotionPreview;
    relativeMotionResult?: RelativeMotionResult;
    trackDetails?: TrackDisplayDetails;
    staleTrackDetails?: TrackDisplayDetails[];
    timerState?: ScenarioTimerState;
    unitConversionResult?: TacticalQuantity;
    unitConversionError?: string;
    /** One immutable, structured result calculated at the registry boundary. */
    result?: CommandResult;
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

type StructuredPaletteFamily =
    | 'ETA_ETE'
    | 'TACTICAL_MEASUREMENT'
    | 'RELATIVE_MOTION'
    | 'TRACK_INFO'
    | 'NEAREST'
    | 'FUTURE_POSITION';

const structuredPaletteFamily = (
    parsed: ReturnType<typeof parseCommand>,
): StructuredPaletteFamily | undefined => {
    const command = parsed.parameters.command;
    if (parsed.type === 'MEASUREMENT' && (command === 'ETA' || command === 'ETE')) return 'ETA_ETE';
    if (parsed.type === 'MEASUREMENT'
        && (command === 'BRG' || command === 'RNG' || command === 'BRG/RNG')) {
        return 'TACTICAL_MEASUREMENT';
    }
    if (parsed.type === 'CALCULATION' && (command === 'CPA' || command === 'CLOSURE')) return 'RELATIVE_MOTION';
    if (parsed.type === 'SEARCH'
        && (command === 'INFO' || command === 'AGE' || command === 'QUALITY' || command === 'STALE')) {
        return 'TRACK_INFO';
    }
    if (parsed.type === 'SEARCH' && command === 'NEAREST') return 'NEAREST';
    if (parsed.type === 'SEARCH' && command === 'PREDICT') return 'FUTURE_POSITION';
    return undefined;
};

const belongsToStructuredPaletteFamily = (
    option: CommandOption,
    family: StructuredPaletteFamily,
): boolean => {
    const id = option.id.toLowerCase();
    if (family === 'ETA_ETE') return id.startsWith('eta-') || id.startsWith('ete-');
    if (family === 'TACTICAL_MEASUREMENT') return id.startsWith('measurement-') || id.startsWith('brg-') || id.startsWith('rng-');
    if (family === 'RELATIVE_MOTION') return id.startsWith('relative-cpa-') || id.startsWith('relative-closure-') || id.startsWith('cpa-') || id.startsWith('closure-');
    if (family === 'TRACK_INFO') return id.startsWith('track-info-') || id.startsWith('track-age-') || id.startsWith('track-quality-') || id.startsWith('info-') || id.startsWith('age-') || id.startsWith('quality-') || id.startsWith('stale-') || id === 'track-stale';
    if (family === 'NEAREST') return id.startsWith('nearest-');
    return id.startsWith('future-position-') || id.startsWith('predict-');
};

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

const readFuturePositionTrack = (
    entity: Entity,
    options: KinematicsSnapshotOptions = {},
): FuturePositionTrack => toFuturePositionTrack(createKinematicsSnapshot(entity, options));

const formatFutureAge = (ageSeconds: number | null): string => (
    ageSeconds === null
        ? 'UNKNOWN'
        : `${Number.isInteger(ageSeconds) ? ageSeconds.toFixed(0) : ageSeconds.toFixed(1)} S`
);

const formatFutureUnavailable = (
    reference: string,
    reason: string,
    futurePositionResult?: FuturePositionResult,
    structuredResult?: CommandResult,
): CommandOption => ({
    id: `future-position-unavailable-${normalizeRankingText(reference).replace(/\\s+/g, '-')}`,
    label: `PREDICT ${reference}: UNAVAILABLE`,
    subLabel: `REASON: ${reason} · NO GHOST PREVIEW · CALCULATION ONLY`,
    icon: Navigation,
    keywords: ['predict', 'future', 'position', 'unavailable', reason.toLowerCase()],
    historyValue: `PREDICT ${reference}`,
    isPreview: true,
    futurePositionResult,
    ...(structuredResult ? { result: structuredResult } : {}),
    ranking: {
        category: 'STRUCTURED_EXACT',
        completeness: 3,
        match: 'EXACT',
    },
});

const readRelativeMotionTrack = (
    entity: Entity,
    options: KinematicsSnapshotOptions = {},
): RelativeMotionTrack => toRelativeMotionTrack(createKinematicsSnapshot(entity, options));

const formatRelativeMotionUnavailable = (
    command: string,
    reference: string,
    reason: string,
    relativeMotionResult?: RelativeMotionResult,
    structuredResult?: CommandResult,
): CommandOption => ({
    id: `relative-${command.toLowerCase()}-unavailable-${normalizeRankingText(reference).replace(/\\s+/g, '-')}`,
    label: `${command} ${reference}: UNAVAILABLE`,
    subLabel: `REASON: ${reason} · CALCULATION ONLY`,
    icon: Compass,
    keywords: ['relative', 'motion', command.toLowerCase(), 'unavailable', reason.toLowerCase()],
    historyValue: `${command} ${reference}`,
    isPreview: true,
    relativeMotionResult,
    ...(structuredResult ? { result: structuredResult } : {}),
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
    ownship?: Entity,
    ownshipNavMode: NavMode = NavMode.REAL,
    groundSpeed?: GroundSpeedInput,
    implicitReference = false,
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
        : `CPA ${implicitReference ? '' : `${reference.label} `}${target.label}`;
    return {
        id: command === 'CLOSURE'
            ? `relative-closure-${target.id}`
            : `relative-cpa-${reference.id}-${target.id}`,
        label,
        subLabel: `CLOSURE: ${result.closureRateKnots.toFixed(1)} KT · CPA: ${result.cpaDistanceNauticalMiles.toFixed(1)} NM · TCPA: ${tcpaLabel} · STATUS: ${result.cpaStatus} · ASSUMPTION: ${result.assumption}`,
        icon: Compass,
        action: previewRelativeMotion ? () => previewRelativeMotion(preview) : undefined,
        dragDropEligible: Boolean(previewRelativeMotion),
        relativeMotionPreview: preview,
        relativeMotionResult: result,
        result: createRelativeMotionCommandResult(command, reference, target, result, Boolean(previewRelativeMotion), ownship, ownshipNavMode, groundSpeed),
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
    result?: CommandResult,
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
    ...(result ? { result } : {}),
    keepPaletteOpen: true,
    ranking: {
        category: 'STRUCTURED_EXACT',
        completeness: 3,
        match: 'EXACT',
    },
});

const isAngularInputKind = (value: unknown): value is AngularInputKind => (
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

const isCoordinateDisplayFormat = (value: unknown): value is CoordinateFormat => (
    value === 'DD' || value === 'DDM' || value === 'DMS'
);

const coordinateRoundingLabel = (format: CoordinateFormat): string => {
    if (format === 'DD') return '0.00001°';
    if (format === 'DDM') return "0.01'";
    return '0.1"';
};

const withInteractionCapabilities = (options: readonly CommandOption[]): CommandOption[] => options.map(option => ({
    ...option,
    dragDropEligible: option.dragDropEligible === true,
    swipeCapable: option.swipeCapable === true,
}));

type ResultQualificationState = InputQualification['status'];

const resultOriginForSource = (source: string | undefined): ResultInputOrigin => {
    if (source === 'GPS') return 'GPS';
    if (source === 'RETAINED_FIX') return 'RETAINED_FIX';
    return 'SCENARIO';
};

const metadataStringValue = (entity: Entity, key: string): string | undefined => {
    const value = entity.metadata?.[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const metadataFiniteNumber = (entity: Entity, key: string): number | undefined => {
    const value = entity.metadata?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const positionQualificationFor = (
    entity: Entity,
    ownship: Entity,
    ownshipNavMode: NavMode,
): InputQualification => {
    const freshness = metadataStringValue(entity, 'freshness')?.toUpperCase();
    const metadataSource = metadataStringValue(entity, 'source')?.toUpperCase();
    const isRetained = metadataSource === 'RETAINED_FIX' || freshness === 'STALE';
    const origin: ResultInputOrigin = isRetained
        ? 'RETAINED_FIX'
        : metadataSource === 'GPS' || (entity.id === ownship.id && ownshipNavMode === NavMode.REAL)
            ? 'GPS'
            : 'SCENARIO';
    const status: ResultQualificationState = freshness === 'STALE'
        ? 'STALE'
        : freshness === 'UNKNOWN'
            ? 'UNKNOWN'
            : 'AVAILABLE';
    return {
        input: 'POSITION',
        origin,
        objectId: entity.id,
        ageSeconds: metadataFiniteNumber(entity, 'ageSeconds'),
        source: metadataSource,
        qualification: origin === 'GPS' ? 'MEASURED' : origin === 'RETAINED_FIX' ? 'RETAINED' : 'SCENARIO',
        status,
    };
};

const speedQualificationFor = (
    speed: GroundSpeedInput | undefined,
    ownshipNavMode: NavMode,
    objectId: string,
    statusOverride?: ResultQualificationState,
): InputQualification => {
    const source = speed?.source;
    const origin: ResultInputOrigin = source === 'USER_INPUT'
        ? 'USER_INPUT'
        : source === 'GPS'
            ? (statusOverride === 'STALE' ? 'RETAINED_FIX' : 'GPS')
            : 'SCENARIO';
    const status = statusOverride ?? (speed ? 'AVAILABLE' : 'MISSING');
    return {
        input: 'SPEED',
        origin: speed ? origin : ownshipNavMode === NavMode.REAL ? 'GPS' : 'SCENARIO',
        objectId,
        ...(speed?.updatedAt === undefined ? {} : { timestampMs: speed.updatedAt }),
        qualification: speed?.qualification
            ?? (origin === 'GPS' ? 'MEASURED' : origin === 'USER_INPUT' ? 'USER_ASSUMPTION' : 'SIMULATED'),
        status,
        ...(origin === 'USER_INPUT' ? { assumption: 'SPEED HYPOTHESIS' } : {}),
    };
};

const clockQualificationFor = (scenarioTimeMs: number | undefined): InputQualification => ({
    input: 'CLOCK',
    origin: 'SCENARIO',
    timestampMs: Number.isFinite(scenarioTimeMs) ? scenarioTimeMs : null,
    qualification: 'SCENARIO TIME',
    status: Number.isFinite(scenarioTimeMs) ? 'AVAILABLE' : 'MISSING',
});

interface ResultVectorInput {
    id: string;
    source?: string;
    sourceLabel?: string;
    qualification?: string;
    freshness?: string;
    groundTrackDegrees?: number;
    groundSpeedKnots?: number;
    ageSeconds?: number | null;
    timestampMs?: number | null;
}

const vectorQualificationFor = (track: ResultVectorInput): InputQualification => {
    const freshness = track.freshness?.toUpperCase();
    const hasTrack = typeof track.groundTrackDegrees === 'number' && Number.isFinite(track.groundTrackDegrees);
    const hasSpeed = typeof track.groundSpeedKnots === 'number' && Number.isFinite(track.groundSpeedKnots);
    const status: ResultQualificationState = freshness === 'STALE'
        ? 'STALE'
        : freshness === 'UNKNOWN' || track.freshness === undefined
            ? 'UNKNOWN'
            : !hasTrack || !hasSpeed
                ? 'MISSING'
                : 'AVAILABLE';
    const origin = status === 'STALE'
        ? 'RETAINED_FIX'
        : resultOriginForSource(track.source ?? track.sourceLabel);
    return {
        input: 'VECTOR',
        origin,
        objectId: track.id,
        ageSeconds: track.ageSeconds ?? null,
        timestampMs: track.timestampMs ?? null,
        source: track.sourceLabel ?? track.source,
        qualification: track.qualification ?? (origin === 'GPS' ? 'MEASURED' : 'SIMULATED'),
        status,
        assumption: 'CONSTANT VELOCITY',
    };
};

const candidateValues = (candidates: readonly {
    id: string;
    label: string;
    type?: string;
}[]): ResultCandidate[] => candidates.map(candidate => ({
    id: candidate.id,
    label: candidate.label,
}));

const createReferenceResolutionResult = (
    id: string,
    resolution: EntityReferenceResolution,
): CommandResult => {
    const common = {
        id,
        kind: 'READ_ONLY' as const,
        references: [resolution.reference],
        qualifications: [],
        capabilities: ['DETAILS'] as const,
        details: resultReasonDetails(resolution.status),
    };
    if (resolution.status === 'AMBIGUOUS_REFERENCE'
        || resolution.status === 'FUZZY_SUGGESTION'
        || resolution.candidates.length > 1) {
        return createAmbiguousCommandResult({
            ...common,
            candidates: candidateValues(resolution.candidates),
            reason: mapCommandReason(resolution.status === 'FUZZY_SUGGESTION'
                ? 'FUZZY_SUGGESTION'
                : 'AMBIGUOUS_REFERENCE'),
        });
    }
    return createUnavailableCommandResult({
        ...common,
        reason: mapCommandReason(resolution.status),
    });
};

const createPairReferenceResolutionResult = (
    id: string,
    resolution: EntityReferencePairResolution,
): CommandResult => {
    const common = {
        id,
        kind: 'READ_ONLY' as const,
        references: [
            resolution.from?.id,
            resolution.to?.id,
        ].filter((reference): reference is string => typeof reference === 'string'),
        qualifications: [],
        capabilities: ['DETAILS'] as const,
        details: resultReasonDetails(resolution.status),
    };
    if (resolution.status === 'AMBIGUOUS_REFERENCE'
        || resolution.status === 'FUZZY_SUGGESTION'
        || resolution.candidates.length > 1) {
        return createAmbiguousCommandResult({
            ...common,
            candidates: resolution.candidates.map(candidate => ({
                id: `${candidate.from.id}:${candidate.to.id}`,
                label: `${candidate.from.label} → ${candidate.to.label}`,
                reference: `${candidate.from.id} ${candidate.to.id}`,
            })),
            reason: mapCommandReason(resolution.status === 'FUZZY_SUGGESTION'
                ? 'FUZZY_SUGGESTION'
                : 'AMBIGUOUS_REFERENCE'),
        });
    }
    return createUnavailableCommandResult({
        ...common,
        reason: mapCommandReason(resolution.status),
    });
};

const resultReasonDetails = (rawCode: string | undefined): readonly ReturnType<typeof displayValue>[] => (
    rawCode ? [displayValue('TECHNICAL REASON', rawCode)] : []
);

const createEtaEteCommandResult = ({
    command,
    from,
    to,
    result,
    speed,
    ownship,
    ownshipNavMode,
    scenarioTimeMs,
    localTimeZone,
}: {
    command: 'ETA' | 'ETE';
    from: Entity;
    to: Entity;
    result: import('../domain/etaEte').EtaEteResult;
    speed?: GroundSpeedInput;
    ownship: Entity;
    ownshipNavMode: NavMode;
    scenarioTimeMs?: number;
    localTimeZone?: string;
}): CommandResult => {
    const display = formatEtaEte(result, localTimeZone ?? 'UTC');
    const speedStatus: ResultQualificationState = result.reason === 'SPEED_STALE'
        ? 'STALE'
        : result.speedKnots === null
            ? 'MISSING'
            : 'AVAILABLE';
    const qualifications = [
        positionQualificationFor(from, ownship, ownshipNavMode),
        positionQualificationFor(to, ownship, ownshipNavMode),
        speedQualificationFor(speed, ownshipNavMode, from.id, speedStatus),
        clockQualificationFor(scenarioTimeMs),
    ];
    const distance = displayValue(
        'DISTANCE',
        result.distanceNauticalMiles === null ? 'UNAVAILABLE' : result.distanceNauticalMiles.toFixed(1),
        'NM',
    );
    const ete = displayValue(
        'ETE',
        display.ete.replace(/^ETE:\s*/, ''),
        'DURATION',
    );
    const eta = displayValue(
        'ETA',
        result.etaUtcMs === null
            ? 'UNAVAILABLE'
            : display.etaUtc.replace(/^ETA UTC:\s*/, '').replace(/\s+UTC$/, ''),
        'UTC',
    );
    const localEta = displayValue(
        'ETA LOCAL',
        display.etaLocal.replace(/^ETA LOCAL \([^)]*\):\s*/, '').replace(/\s+[^\s]+$/, ''),
        localTimeZone ?? 'UTC',
    );
    const groundSpeed = displayValue(
        'GROUND SPEED',
        result.speedKnots === null ? 'UNAVAILABLE' : result.speedKnots.toFixed(1),
        'KT',
    );
    const primary = command === 'ETA' ? eta : ete;
    const secondary = command === 'ETA'
        ? [ete, distance, groundSpeed, localEta]
        : [eta, distance, groundSpeed, localEta];
    const references = [from.id, to.id];
    const common = {
        id: from.id === ownship.id ? `${command.toLowerCase()}-${to.id}` : `${command.toLowerCase()}-${from.id}-${to.id}`,
        kind: 'READ_ONLY' as const,
        references,
        qualifications,
        capabilities: ['COPY', 'DETAILS'] as const,
        details: resultReasonDetails(result.reason),
    };

    if (result.status === 'UNAVAILABLE') {
        const isKnownPosition = result.distanceNauticalMiles !== null;
        const canPartiallyExplain = isKnownPosition
            && (result.reason === 'SPEED_UNAVAILABLE' || result.reason === 'SPEED_STALE');
        const reason = mapCommandReason(result.reason ?? 'RESULT_UNAVAILABLE');
        if (canPartiallyExplain) {
            return createPartialCommandResult({
                ...common,
                primary: displayValue(primary.label, 'UNAVAILABLE', primary.unit),
                secondary: [distance, groundSpeed],
                reason,
            });
        }
        return createUnavailableCommandResult({
            ...common,
            reason,
        });
    }

    if (result.etaUtcMs === null) {
        return createPartialCommandResult({
            ...common,
            primary,
            secondary,
            reason: mapCommandReason('SCENARIO_TIME_UNAVAILABLE'),
        });
    }

    return createAvailableCommandResult({
        ...common,
        primary,
        secondary,
    });
};

const createRelativeMotionCommandResult = (
    command: 'CLOSURE' | 'CPA',
    reference: Entity,
    target: Entity,
    result: Extract<RelativeMotionResult, { status: 'AVAILABLE' }>,
    canPreview = false,
    ownship?: Entity,
    ownshipNavMode: NavMode = NavMode.REAL,
    groundSpeed?: GroundSpeedInput,
): CommandResult => {
    const referenceSource = ownship && reference.id === ownship.id
        ? ownshipNavMode === NavMode.REAL ? 'GPS' : 'SCENARIO'
        : metadataStringValue(reference, 'source') ?? 'SCENARIO';
    const targetSource = metadataStringValue(target, 'source') ?? 'SCENARIO';
    const referenceVector = {
        id: reference.id,
        source: referenceSource,
        qualification: referenceSource === 'GPS' ? 'MEASURED' : 'SIMULATED',
        freshness: metadataStringValue(reference, 'freshness') ?? 'FRESH',
        groundTrackDegrees: reference.heading ?? metadataFiniteNumber(reference, 'groundTrackDegrees'),
        groundSpeedKnots: ownship && reference.id === ownship.id
            ? groundSpeed?.speedKnots ?? reference.speed ?? metadataFiniteNumber(reference, 'groundSpeedKnots')
            : reference.speed ?? metadataFiniteNumber(reference, 'groundSpeedKnots'),
    };
    const targetVector = {
        id: target.id,
        source: targetSource,
        qualification: targetSource === 'GPS' ? 'MEASURED' : 'SIMULATED',
        freshness: metadataStringValue(target, 'freshness') ?? 'FRESH',
        groundTrackDegrees: target.heading ?? metadataFiniteNumber(target, 'groundTrackDegrees'),
        groundSpeedKnots: target.speed ?? metadataFiniteNumber(target, 'groundSpeedKnots'),
    };
    const qualifications: InputQualification[] = [
        positionQualificationFor(reference, ownship ?? reference, ownshipNavMode),
        positionQualificationFor(target, ownship ?? reference, ownshipNavMode),
        vectorQualificationFor(referenceVector),
        vectorQualificationFor(targetVector),
    ];
    const primary = command === 'CLOSURE'
        ? displayValue('CLOSURE', result.closureRateKnots.toFixed(1), 'KT')
        : displayValue('CPA', result.cpaDistanceNauticalMiles.toFixed(1), 'NM');
    const secondary = command === 'CLOSURE'
        ? [
            displayValue('CPA', result.cpaDistanceNauticalMiles.toFixed(1), 'NM'),
            displayValue('TCPA', result.tcpaMinutes === null ? 'UNAVAILABLE' : result.tcpaMinutes.toFixed(1), 'MIN'),
            displayValue('RELATIVE SPEED', result.relativeSpeedKnots.toFixed(1), 'KT'),
        ]
        : [
            displayValue('CLOSURE', result.closureRateKnots.toFixed(1), 'KT'),
            displayValue('TCPA', result.tcpaMinutes === null ? 'UNAVAILABLE' : result.tcpaMinutes.toFixed(1), 'MIN'),
        ];
    return createAvailableCommandResult({
        id: command === 'CLOSURE'
            ? `relative-closure-${target.id}`
            : `relative-cpa-${reference.id}-${target.id}`,
        kind: canPreview ? 'MAP_PREVIEW' : 'READ_ONLY',
        references: [reference.id, target.id],
        qualifications,
        capabilities: canPreview ? ['DETAILS', 'MAP_PREVIEW'] : ['DETAILS'],
        primary,
        secondary,
        details: [displayValue('ASSUMPTION', result.assumption)],
    });
};

const createRelativeMotionFailureResult = ({
    command,
    reason,
    id,
    references = [],
    qualifications = [],
    candidates = [],
    knownPosition = false,
}: {
    command: 'CLOSURE' | 'CPA';
    reason: string;
    id?: string;
    references?: readonly string[];
    qualifications?: readonly InputQualification[];
    candidates?: readonly ResultCandidate[];
    knownPosition?: boolean;
}): CommandResult => {
    const common = {
        id: id ?? `relative-${command.toLowerCase()}-result-${references.join('-') || 'unknown'}`,
        kind: 'READ_ONLY' as const,
        references,
        qualifications,
        capabilities: ['DETAILS'] as const,
        details: resultReasonDetails(reason),
    };
    if (candidates.length > 0) {
        return createAmbiguousCommandResult({
            ...common,
            candidates,
            reason: mapCommandReason('AMBIGUOUS_REFERENCE'),
        });
    }
    if (knownPosition && (reason === 'MISSING_GROUND_SPEED'
        || reason === 'MISSING_GROUND_TRACK'
        || reason === 'STALE_TRACK'
        || reason === 'UNKNOWN_FRESHNESS')) {
        return createPartialCommandResult({
            ...common,
            primary: command === 'CLOSURE'
                ? displayValue('CLOSURE', 'UNAVAILABLE', 'KT')
                : displayValue('CPA', 'UNAVAILABLE', 'NM'),
            secondary: [],
            reason: mapCommandReason(reason),
        });
    }
    return createUnavailableCommandResult({
        ...common,
        reason: mapCommandReason(reason),
    });
};

const createFuturePositionCommandResult = ({
    reference,
    result,
    track,
    id,
    kind,
    canPreview,
    candidates = [],
}: {
    reference: string;
    result?: FuturePositionResult;
    track?: FuturePositionTrack;
    id?: string;
    kind: 'READ_ONLY' | 'MAP_PREVIEW';
    canPreview?: boolean;
    candidates?: readonly ResultCandidate[];
}): CommandResult => {
    const resultId = id ?? `future-position-${normalizeRankingText(reference).replace(/\\s+/g, '-')}`;
    const hasMapPreview = Boolean(canPreview && result?.status === 'AVAILABLE');
    const effectiveKind = hasMapPreview ? kind : 'READ_ONLY';
    const qualifications = track
        ? [
            {
                input: 'POSITION' as const,
                origin: track.freshness === 'STALE'
                    ? 'RETAINED_FIX' as const
                    : resultOriginForSource(track.source ?? track.sourceLabel),
                objectId: track.id,
                status: track.freshness === 'STALE'
                    ? 'STALE' as const
                    : track.freshness === 'UNKNOWN' ? 'UNKNOWN' as const : 'AVAILABLE' as const,
                ageSeconds: track.ageSeconds ?? null,
            },
            vectorQualificationFor(track),
        ]
        : [];
    const common = {
        id: resultId,
        kind: effectiveKind,
        references: track ? [track.id] : [reference],
        qualifications,
        capabilities: hasMapPreview ? ['DETAILS', 'MAP_PREVIEW'] as const : ['DETAILS'] as const,
        details: result?.status === 'UNAVAILABLE' ? resultReasonDetails(result.reason) : [],
    };
    if (candidates.length > 0) {
        return createAmbiguousCommandResult({
            ...common,
            candidates,
            reason: mapCommandReason('AMBIGUOUS_REFERENCE'),
        });
    }
    if (!result) {
        return createIncompleteCommandResult({
            ...common,
            reason: mapCommandReason('INCOMPLETE'),
        });
    }
    if (result.status === 'UNAVAILABLE') {
        const partialReasons = new Set([
            'MISSING_GROUND_TRACK',
            'MISSING_GROUND_SPEED',
            'STALE_TRACK',
            'UNKNOWN_FRESHNESS',
        ]);
        if (track && partialReasons.has(result.reason)) {
            return createPartialCommandResult({
                ...common,
                primary: displayValue('GHOST', 'UNAVAILABLE', 'LAT/LON'),
                secondary: [],
                reason: mapCommandReason(result.reason),
            });
        }
        return createUnavailableCommandResult({
            ...common,
            reason: mapCommandReason(result.reason),
        });
    }
    return createAvailableCommandResult({
        ...common,
        primary: displayValue(
            'GHOST',
            `${result.targetPosition.lat.toFixed(5)}, ${result.targetPosition.lon.toFixed(5)}`,
            'LAT/LON',
        ),
        secondary: [
            displayValue('RANGE', result.projectedRangeNauticalMiles.toFixed(1), 'NM'),
            displayValue('HORIZON', result.effectiveHorizonMinutes.toFixed(1), 'MIN'),
            displayValue('PROJECTED AT', result.projectedAtMs === null ? 'UNAVAILABLE' : String(result.projectedAtMs), 'MS'),
        ],
        details: [displayValue('ASSUMPTION', result.assumption)],
    });
};

const createTacticalMeasurementCommandResult = (
    kind: 'BRG' | 'RNG' | 'BRG/RNG',
    measurement: import('../domain/tacticalMeasurements').TacticalMeasurement,
    from: Entity,
    to: Entity,
    ownship: Entity,
    ownshipNavMode: NavMode,
): CommandResult => {
    const positionQualifications = [
        positionQualificationFor(from, ownship, ownshipNavMode),
        positionQualificationFor(to, ownship, ownshipNavMode),
    ];
    const bearing = measurement.bearingTrueDegrees === null
        ? displayValue('BRG', 'UNAVAILABLE', '°T')
        : displayValue('BRG', measurement.bearingTrueDegrees.toFixed(1), '°T');
    const range = measurement.rangeNauticalMiles === null
        ? displayValue('RNG', 'UNAVAILABLE', 'NM')
        : displayValue('RNG', measurement.rangeNauticalMiles.toFixed(1), 'NM');
    const primary = kind === 'BRG' ? bearing : kind === 'RNG' ? range : bearing;
    const secondary = kind === 'BRG/RNG' ? [range] : [];
    const common = {
        id: `measurement-result-${kind.toLowerCase().replace('/', '-')}-${from.id}-${to.id}`,
        kind: 'READ_ONLY' as const,
        references: [from.id, to.id],
        qualifications: positionQualifications,
        capabilities: ['DETAILS'] as const,
        details: [
            displayValue('SOURCE', measurement.source),
            displayValue('QUALIFICATION', measurement.qualification),
            ...(measurement.reason ? resultReasonDetails(measurement.reason) : []),
        ],
    };
    if (measurement.qualification === 'UNAVAILABLE') {
        return createUnavailableCommandResult({
            ...common,
            reason: mapCommandReason(measurement.reason ?? 'RESULT_UNAVAILABLE'),
        });
    }
    if (measurement.reason === 'IDENTICAL_POSITIONS' && kind !== 'RNG') {
        return createPartialCommandResult({
            ...common,
            primary,
            secondary,
            reason: mapCommandReason('IDENTICAL_POSITIONS'),
        });
    }
    return createAvailableCommandResult({
        ...common,
        primary,
        secondary,
    });
};

const createTrackCommandResult = (
    command: 'INFO' | 'AGE' | 'QUALITY',
    details: TrackDisplayDetails,
    entity: Entity,
    ownship: Entity,
    ownshipNavMode: NavMode,
): CommandResult => {
    const position = positionQualificationFor(entity, ownship, ownshipNavMode);
    const age = details.ageSeconds === null ? 'UNKNOWN' : details.ageSeconds.toFixed(1);
    const qualityNotApplicable = entity.type === EntityType.WAYPOINT || entity.type === EntityType.AIRPORT;
    const primary = command === 'INFO'
        ? displayValue('TRACK', details.label)
        : command === 'AGE'
            ? displayValue('AGE', age, 'S')
            : displayValue('QUALITY', qualityNotApplicable ? 'N/A' : details.quality);
    const secondary = command === 'INFO'
        ? [
            displayValue('SOURCE', details.sourceLabel ?? 'UNKNOWN'),
            displayValue('AGE', age, 'S'),
            displayValue('QUALITY', qualityNotApplicable ? 'N/A' : details.quality),
            displayValue('CLASSIFICATION', details.classification),
            displayValue('CONFIDENCE', details.confidence === null ? 'N/A' : `${(details.confidence * 100).toFixed(0)}%`),
        ]
        : command === 'AGE'
            ? [displayValue('FRESHNESS', details.freshness)]
            : [
                displayValue('CLASSIFICATION', details.classification),
                displayValue('CONFIDENCE', details.confidence === null ? 'N/A' : `${(details.confidence * 100).toFixed(0)}%`),
            ];
    const common = {
        id: `track-${command.toLowerCase()}-${details.trackId}`,
        kind: 'READ_ONLY' as const,
        references: [details.trackId],
        qualifications: [position],
        capabilities: ['DETAILS'] as const,
        details: [],
    };
    if (qualityNotApplicable && (command === 'QUALITY' || command === 'INFO')) {
        return createPartialCommandResult({
            ...common,
            primary,
            secondary,
            reason: mapCommandReason('QUALITY_NOT_APPLICABLE'),
        });
    }
    if (details.freshness === 'STALE') {
        return createPartialCommandResult({
            ...common,
            primary,
            secondary,
            reason: mapCommandReason('STALE_TRACK'),
        });
    }
    if (details.freshness === 'UNKNOWN') {
        return createPartialCommandResult({
            ...common,
            primary,
            secondary,
            reason: mapCommandReason('UNKNOWN_FRESHNESS'),
        });
    }
    if ((command === 'AGE' && details.ageSeconds === null)
        || (command !== 'AGE' && details.quality === 'UNKNOWN')) {
        return createPartialCommandResult({
            ...common,
            primary,
            secondary,
            reason: mapCommandReason(command === 'AGE' ? 'UNKNOWN_AGE' : 'QUALITY_UNKNOWN'),
        });
    }
    return createAvailableCommandResult({
        ...common,
        primary,
        secondary,
    });
};

const createStaleTrackListResult = (details: readonly TrackDisplayDetails[]): CommandResult => createAvailableCommandResult({
    id: 'track-stale',
    kind: 'READ_ONLY',
    references: details.map(item => item.trackId),
    qualifications: details.map(item => ({
        input: 'POSITION' as const,
        origin: 'RETAINED_FIX' as const,
        objectId: item.trackId,
        ageSeconds: item.ageSeconds,
        status: 'STALE' as const,
        qualification: item.sourceLabel ?? 'RETAINED',
    })),
    capabilities: ['DETAILS'],
    primary: displayValue('COUNT', String(details.length), 'TRACKS'),
    secondary: details.map(item => displayValue(
        item.label,
        item.ageSeconds === null ? 'UNKNOWN' : item.ageSeconds.toFixed(1),
        'S',
    )),
});

const createProjectionCommandResult = (
    preview: ProjectionPreview,
    reference: Entity,
    ownship: Entity,
    ownshipNavMode: NavMode,
): CommandResult => createAvailableCommandResult({
    id: 'proj-focus',
    kind: 'MAP_PREVIEW',
    references: [reference.id],
    qualifications: [
        positionQualificationFor(reference, ownship, ownshipNavMode),
    ],
    capabilities: ['DETAILS', 'MAP_PREVIEW'],
    primary: displayValue(
        'POSITION',
        `${preview.targetPosition.lat.toFixed(5)}, ${preview.targetPosition.lon.toFixed(5)}`,
        'LAT/LON',
    ),
    secondary: [
        displayValue('BRG', preview.bearingDegrees.toFixed(1), '°T'),
        displayValue('RNG', preview.rangeNauticalMiles.toFixed(1), 'NM'),
    ],
    details: [
        displayValue('METHOD', preview.method),
        displayValue('REFERENCE', reference.label),
    ],
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
        ownshipNavMode,
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
        timerState,
        createTimer,
        cancelTimer,
        favoriteState,
        addFavorite,
        removeFavorite,
        layers,
        setLayers,
        declutter,
        setDeclutter,
        grid,
        setGrid,
        zones,
        visibleZoneId,
        setVisibleZone,
        simulationStatus,
        simulationIsRunning,
        simulationTimeMs,
        simulationSpeed,
        pauseSimulation,
        resumeSimulation,
        setSimulationSpeed,
        requestSimulationReset,
        requestSimulationReplay,
        localTimeZone,
        activeRoute,
        setRouteVisibility,
        trails,
        setTrailVisibility,
    } = context;
    const commands: CommandOption[] = [];

    const metadataFreshness = (entity: Entity): KinematicsFreshness | undefined => {
        const value = entity.metadata?.freshness;
        return value === 'FRESH' || value === 'STALE' || value === 'UNKNOWN' ? value : undefined;
    };
    const kinematicsOptionsFor = (entity: Entity): KinematicsSnapshotOptions => {
        if (entity.id !== ownship.id) {
            return {
                source: 'SCENARIO',
                qualification: 'SIMULATED',
                timestampMs: scenarioTimeMs ?? null,
            };
        }

        if (ownshipNavMode === NavMode.SIM) {
            return {
                source: 'SIMULATION',
                qualification: 'SIMULATED',
                headingDegrees: entity.heading ?? null,
                groundSpeedKnots: entity.speed ?? null,
                timestampMs: scenarioTimeMs ?? null,
                freshness: 'FRESH',
                ageSeconds: 0,
                allowMetadataVector: false,
            };
        }

        return {
            source: 'GPS',
            qualification: groundSpeed ? 'MEASURED' : 'UNAVAILABLE',
            headingDegrees: entity.heading ?? null,
            groundSpeedKnots: groundSpeed?.speedKnots ?? null,
            timestampMs: groundSpeed?.updatedAt ?? null,
            freshness: groundSpeed ? 'FRESH' : metadataFreshness(entity) ?? 'UNKNOWN',
            allowMetadataVector: false,
        };
    };

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
    // Keep the initial palette focused on recent input rather than exposing
    // every generic command before the user has started typing.
    if (q === '') {
        const recentHistory = (history ?? []).slice(0, 3).map((entry, idx): CommandOption => {
            const date = new Date(entry.timestamp);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return {
                id: `hist-${idx}`,
                label: entry.original,
                subLabel: timeStr,
                icon: History,
                // Selecting a history entry only repopulates the input.
                keywords: ['history'],
                isHistory: true,
                autocompleteValue: entry.canonical,
            };
        });
        if (recentHistory.length > 0) return withInteractionCapabilities(recentHistory);

        return withInteractionCapabilities([{
            id: 'empty-invitation',
            label: 'TYPE A COMMAND',
            subLabel: 'Use the input to search',
            icon: FileText,
            keywords: [],
            disabled: true,
            keepPaletteOpen: true,
        }]);
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
                dragDropEligible: true,
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
                dragDropEligible: true,
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
        dragDropEligible: true,
        ranking: createStructuredRanking(q, `FOCUS ${focusTarget.label}`),
      });
    }
  }

  // 4. Entity Projection
    const proj = parseProjection(q, entities, ownship);
    if (proj?.preview && proj.label && proj.resolution.entity) {
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
            dragDropEligible: true,
            keepPaletteOpen: true,
            result: createProjectionCommandResult(
                proj.preview,
                proj.resolution.entity,
                ownship,
                ownshipNavMode,
            ),
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
            result: createReferenceResolutionResult(
                `proj-reference-status-${resolution.status.toLowerCase()}`,
                resolution,
            ),
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
    const incompleteResultCommands = new Set([
        'ETA',
        'ETE',
        'BRG',
        'RNG',
        'BRG/RNG',
        'CLOSURE',
        'CPA',
        'INT',
        'PREDICT',
        'INFO',
        'AGE',
        'QUALITY',
        'PROJ',
        'PROJECTION',
        'NEAREST',
    ]);
    const parsedCommandName = typeof parsedMeasurement.parameters.command === 'string'
        ? parsedMeasurement.parameters.command
        : parsedMeasurement.type === 'PROJECTION' ? 'PROJ' : undefined;
    if (parsedMeasurement.errors.length > 0
        && typeof parsedCommandName === 'string'
        && incompleteResultCommands.has(parsedCommandName)) {
        const parseError = parsedMeasurement.errors[0];
        const resultId = `${parsedCommandName.toLowerCase().replace('/', '-')}-incomplete`;
        commands.push({
            id: resultId,
            label: `${parsedCommandName}: INCOMPLETE`,
            subLabel: `${parseError?.message ?? 'More input is required'} · CALCULATION NOT EXECUTED`,
            icon: Calculator,
            keywords: ['incomplete', 'input', parsedCommandName.toLowerCase()],
            historyValue: q,
            isPreview: true,
            keepPaletteOpen: true,
            result: createIncompleteCommandResult({
                id: resultId,
                kind: 'READ_ONLY',
                references: [],
                capabilities: ['DETAILS'],
                details: parseError ? [displayValue('PARSER CODE', parseError.code)] : [],
                reason: mapCommandReason('INCOMPLETE'),
            }),
            ranking: {
                category: 'STRUCTURED_EXACT',
                completeness: 2,
                match: 'EXACT',
            },
        });
    }
    const layerCommand = parsedMeasurement.parameters.system;
    if (parsedMeasurement.type === 'SYSTEM'
        && (layerCommand === 'LAYERS' || layerCommand === 'LAYER')) {
        const currentLayers = layers ?? createLayerState();
        if (parsedMeasurement.errors.length > 0) {
            commands.push({
                id: 'layer-unavailable',
                label: 'LAYER UNAVAILABLE',
                subLabel: `${parsedMeasurement.errors[0]?.message ?? 'INVALID LAYER'} · NO STATE CREATED`,
                icon: Layers,
                keywords: ['layer', 'unavailable'],
                historyValue: q,
                isPreview: true,
                keepPaletteOpen: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (layerCommand === 'LAYERS') {
            const summary = Object.values(currentLayers)
                .map(layer => `${layer.label} ${layer.available ? (layer.visible ? 'ON' : 'OFF') : 'UNAVAILABLE'}`)
                .join(' · ');
            commands.push({
                id: 'layers-list',
                label: 'LAYERS',
                subLabel: `${summary} · LOCAL ONLY`,
                icon: Layers,
                keywords: ['layers', 'layer', 'visibility', 'local'],
                historyValue: q,
                isPreview: true,
                keepPaletteOpen: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (typeof parsedMeasurement.parameters.layerId === 'string'
            && typeof parsedMeasurement.parameters.visible === 'boolean') {
            const layerId = parsedMeasurement.parameters.layerId as TacticalLayerId;
            const requestedVisibility = parsedMeasurement.parameters.visible;
            const layer = currentLayers[layerId];
            if (!layer || !layer.available) {
                commands.push({
                    id: 'layer-unavailable',
                    label: 'LAYER UNAVAILABLE',
                    subLabel: `${layerId} · NO RENDERED LOCAL LAYER`,
                    icon: Layers,
                    keywords: ['layer', 'unavailable', layerId.toLowerCase()],
                    historyValue: q,
                    isPreview: true,
                    keepPaletteOpen: true,
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            } else {
                commands.push({
                    id: `layer-${layerId.toLowerCase()}-${requestedVisibility ? 'on' : 'off'}`,
                    label: `LAYER ${layer.label} ${requestedVisibility ? 'ON' : 'OFF'}`,
                    subLabel: `${layer.visible ? 'VISIBLE' : 'HIDDEN'} → ${requestedVisibility ? 'VISIBLE' : 'HIDDEN'} · SOURCE: ${layer.source}`,
                    icon: Layers,
                    action: () => {
                        const result = setLayerVisibility(currentLayers, layerId, requestedVisibility);
                        if (result.status === 'AVAILABLE') setLayers?.(result.state);
                    },
                    keywords: ['layer', layer.label.toLowerCase(), requestedVisibility ? 'on' : 'off', layer.source.toLowerCase()],
                    historyValue: q,
                    isPreview: true,
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            }
        }
    }

    const zoneCommand = parsedMeasurement.parameters.system;
    if (parsedMeasurement.type === 'SYSTEM' && zoneCommand === 'ZONE') {
        const currentZones = zones ?? createDefaultZones();
        const requestedZoneCommand = parsedMeasurement.parameters.zoneCommand;
        if (parsedMeasurement.errors.length > 0) {
            commands.push({
                id: 'zone-unavailable',
                label: 'ZONE UNAVAILABLE',
                subLabel: `${parsedMeasurement.errors[0]?.message ?? 'INVALID ZONE COMMAND'} · LOCAL STATE UNCHANGED`,
                icon: MapPin,
                keywords: ['zone', 'unavailable', 'local'],
                historyValue: q,
                isPreview: true,
                keepPaletteOpen: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (requestedZoneCommand === 'LIST') {
            const summary = currentZones
                .map(zone => `${zone.label} ${zone.geometry.kind} · ${zone.source} · ${zone.simulatedState}`)
                .join(' · ');
            commands.push({
                id: 'zones-list',
                label: 'ZONE LIST',
                subLabel: `${summary} · LOCAL ONLY`,
                icon: MapPin,
                keywords: ['zone', 'list', 'local', ...currentZones.map(zone => zone.label.toLowerCase())],
                historyValue: q,
                isPreview: true,
                keepPaletteOpen: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (typeof parsedMeasurement.parameters.zoneReference === 'string') {
            const zone = getZone(currentZones, parsedMeasurement.parameters.zoneReference);
            if (!zone) {
                commands.push({
                    id: 'zone-unavailable',
                    label: 'ZONE UNAVAILABLE',
                    subLabel: `${parsedMeasurement.parameters.zoneReference} · UNKNOWN LOCAL ZONE · NO STATE CREATED`,
                    icon: MapPin,
                    keywords: ['zone', 'unavailable', 'unknown'],
                    historyValue: q,
                    isPreview: true,
                    keepPaletteOpen: true,
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            } else if (requestedZoneCommand === 'SHOW') {
                commands.push({
                    id: 'zone-show',
                    label: `ZONE SHOW ${zone.label}`,
                    subLabel: `${zone.geometry.kind} · SOURCE: ${zone.source} · STATE: ${zone.simulatedState} · VISIBLE: ${visibleZoneId === zone.id ? 'ON' : 'OFF'}`,
                    icon: MapPin,
                    action: () => setVisibleZone?.(zone.id),
                    keywords: ['zone', 'show', zone.label.toLowerCase(), zone.geometry.kind.toLowerCase(), zone.source.toLowerCase()],
                    historyValue: q,
                    isPreview: true,
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            } else if (requestedZoneCommand === 'CHECK' && typeof parsedMeasurement.parameters.pointReference === 'string') {
                const resolution = resolveEntityReference(parsedMeasurement.parameters.pointReference, entities, ownship);
                if (resolution.status !== 'RESOLVED' || !resolution.entity) {
                    commands.push({
                        id: 'zone-unavailable',
                        label: 'ZONE UNAVAILABLE',
                        subLabel: `${parsedMeasurement.parameters.pointReference} · POINT ${resolution.status} · CHECK NOT EXECUTED`,
                        icon: MapPin,
                        keywords: ['zone', 'check', 'ambiguous', 'unknown'],
                        historyValue: q,
                        isPreview: true,
                        keepPaletteOpen: true,
                        ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                    });
                } else {
                    const containment = checkZoneContainment(zone, resolution.entity.position);
                    commands.push({
                        id: 'zone-check',
                        label: `ZONE CHECK ${resolution.entity.label} ${zone.label}`,
                        subLabel: `RESULT: ${containment} · POINT: ${resolution.entity.label} · ${zone.geometry.kind} · SOURCE: ${zone.source} · STATE: ${zone.simulatedState}`,
                        icon: MapPin,
                        keywords: ['zone', 'check', zone.label.toLowerCase(), resolution.entity.label.toLowerCase(), containment.toLowerCase()],
                        historyValue: q,
                        isPreview: true,
                        keepPaletteOpen: true,
                        ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                    });
                }
            }
        }
    }

    const gridCommand = parsedMeasurement.parameters.system;
    if (parsedMeasurement.type === 'SYSTEM' && gridCommand === 'GRID') {
        const currentGrid = grid ?? createGridState();
        if (parsedMeasurement.errors.length > 0) {
            commands.push({
                id: 'grid-unavailable',
                label: 'GRID UNAVAILABLE',
                subLabel: `${parsedMeasurement.errors[0]?.message ?? 'INVALID GRID'} · LOCAL DISPLAY UNCHANGED`,
                icon: Crosshair,
                keywords: ['grid', 'latlon', 'mgrs', 'unavailable'],
                historyValue: q,
                isPreview: true,
                keepPaletteOpen: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (typeof parsedMeasurement.parameters.enabled === 'boolean') {
            const enabled = parsedMeasurement.parameters.enabled;
            commands.push({
                id: `grid-latlon-${enabled ? 'on' : 'off'}`,
                label: `GRID LATLON ${enabled ? 'ON' : 'OFF'}`,
                subLabel: `LOCAL GRID · CURRENT: ${currentGrid.enabled ? 'ON' : 'OFF'} → ${enabled ? 'ON' : 'OFF'} · STEP ${currentGrid.stepMinutes}MIN`,
                icon: Crosshair,
                action: () => setGrid?.(setGridEnabled(currentGrid, enabled)),
                keywords: ['grid', 'latlon', enabled ? 'on' : 'off', 'local'],
                historyValue: q,
                isPreview: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (typeof parsedMeasurement.parameters.stepMinutes === 'number') {
            const stepMinutes = parsedMeasurement.parameters.stepMinutes;
            commands.push({
                id: 'grid-latlon-step',
                label: `GRID LATLON STEP ${stepMinutes}MIN`,
                subLabel: `LOCAL GRID · CURRENT STEP ${currentGrid.stepMinutes}MIN → ${stepMinutes}MIN · VALIDATED`,
                icon: Crosshair,
                action: () => {
                    const result = setGridStep(currentGrid, stepMinutes);
                    if (result.status === 'AVAILABLE') setGrid?.(result.state);
                },
                keywords: ['grid', 'latlon', 'step', `${stepMinutes}min`, 'local'],
                historyValue: q,
                isPreview: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        }
    }

    const legendCommand = parsedMeasurement.parameters.system;
    if (parsedMeasurement.type === 'SYSTEM' && legendCommand === 'LEGEND') {
        if (parsedMeasurement.errors.length > 0) {
            commands.push({
                id: 'legend-unavailable',
                label: 'LEGEND UNAVAILABLE',
                subLabel: `${parsedMeasurement.errors[0]?.message ?? 'INVALID LEGEND QUERY'} · MEANING NOT INFERRED`,
                icon: Info,
                keywords: ['legend', 'unavailable', 'symbol', 'layer'],
                historyValue: q,
                isPreview: true,
                keepPaletteOpen: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (parsedMeasurement.parameters.scope === 'ALL') {
            const summary = getLegendEntries()
                .map(entry => `${entry.label}: ${entry.meaning}`)
                .join(' · ');
            commands.push({
                id: 'legend-list',
                label: 'LEGEND',
                subLabel: `${summary} · SOURCE: LOCAL REGISTRY · SIMULATED`,
                icon: Info,
                keywords: ['legend', 'symbol', 'layer', 'meaning', 'local'],
                historyValue: q,
                isPreview: true,
                keepPaletteOpen: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (typeof parsedMeasurement.parameters.kind === 'string'
            && typeof parsedMeasurement.parameters.reference === 'string') {
            const legendId = `${parsedMeasurement.parameters.kind}_${parsedMeasurement.parameters.reference}` as LegendEntryId;
            const entry = getLegendEntry(legendId);
            if (!entry) {
                commands.push({
                    id: 'legend-unavailable',
                    label: 'LEGEND UNAVAILABLE',
                    subLabel: 'REFERENCE NOT IN LOCAL REGISTRY · MEANING NOT INFERRED',
                    icon: Info,
                    keywords: ['legend', 'unavailable'],
                    historyValue: q,
                    isPreview: true,
                    keepPaletteOpen: true,
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            } else {
                const layerId = entry.kind === 'LAYER' ? entry.label as TacticalLayerId : null;
                const layerState = layerId && layers ? layers[layerId as 'TRACKS' | 'VECTORS' | 'ROUTE'] : undefined;
                const visibility = layerState ? ` · VISIBILITY: ${layerState.visible ? 'ON' : 'OFF'}` : '';
                commands.push({
                    id: `legend-${entry.id.toLowerCase()}`,
                    label: `LEGEND ${entry.kind} ${entry.label}`,
                    subLabel: `${entry.meaning} · SOURCE: ${entry.source} · STATE: ${entry.simulatedState}${visibility}`,
                    icon: Info,
                    keywords: ['legend', entry.kind.toLowerCase(), entry.label.toLowerCase(), entry.meaning.toLowerCase(), entry.source.toLowerCase()],
                    historyValue: q,
                    isPreview: true,
                    keepPaletteOpen: true,
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            }
        }
    }

    const declutterCommand = parsedMeasurement.parameters.system;
    if (parsedMeasurement.type === 'SYSTEM' && declutterCommand === 'DECLUTTER') {
        const currentDeclutter = declutter ?? { preset: 'FULL' as const, hiddenCategories: [] };
        if (parsedMeasurement.errors.length > 0) {
            commands.push({
                id: 'declutter-unavailable',
                label: 'DECLUTTER UNAVAILABLE',
                subLabel: `LOW/HIGH REJECTED · ${parsedMeasurement.errors[0]?.message ?? 'INVALID PRESET'} · DISPLAY UNCHANGED`,
                icon: Eye,
                keywords: ['declutter', 'unavailable', 'minimal', 'normal', 'full'],
                historyValue: q,
                isPreview: true,
                keepPaletteOpen: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (typeof parsedMeasurement.parameters.preset === 'string'
            && ['MINIMAL', 'NORMAL', 'FULL'].includes(parsedMeasurement.parameters.preset)) {
            const requestedPreset = parsedMeasurement.parameters.preset as DeclutterPreset;
            const hidden = setDeclutterPreset(requestedPreset).hiddenCategories;
            commands.push({
                id: `declutter-${requestedPreset.toLowerCase()}`,
                label: `DECLUTTER ${requestedPreset}`,
                subLabel: `ACTIVE: ${currentDeclutter.preset} → ${requestedPreset} · HIDDEN: ${hidden.length > 0 ? hidden.join(', ') : 'NONE'} · DISPLAY ONLY`,
                icon: Eye,
                action: () => setDeclutter?.(setDeclutterPreset(requestedPreset)),
                keywords: ['declutter', requestedPreset.toLowerCase(), ...hidden.map(category => category.toLowerCase())],
                historyValue: q,
                isPreview: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        }
    }

    const simulationCommand = parsedMeasurement.parameters.simulationCommand;
    if (parsedMeasurement.type === 'SYSTEM'
        && parsedMeasurement.parameters.system === 'SIM'
        && (simulationCommand === 'STATUS'
            || simulationCommand === 'PAUSE'
            || simulationCommand === 'RESUME'
            || simulationCommand === 'RESET'
            || simulationCommand === 'REPLAY'
            || simulationCommand === 'TIME'
            || simulationCommand === 'SPEED')) {
        const status = simulationStatus ?? (simulationIsRunning ? 'RUNNING' : 'PAUSED');
        const simulatedSeconds = typeof simulationTimeMs === 'number' && Number.isFinite(simulationTimeMs)
            ? Math.floor(simulationTimeMs / 1000)
            : null;
        const statusSuffix = simulatedSeconds === null ? '' : ` · SIM T+${simulatedSeconds}s`;
        if (parsedMeasurement.errors.length > 0) {
            commands.push({
                id: `sim-${String(simulationCommand).toLowerCase()}-unavailable`,
                label: `SIM ${String(simulationCommand)}: UNAVAILABLE`,
                subLabel: `${parsedMeasurement.errors[0]?.message ?? 'INVALID INPUT'} · CALCULATION NOT EXECUTED`,
                icon: Compass,
                keywords: ['sim', 'simulation', String(simulationCommand).toLowerCase(), 'unavailable'],
                historyValue: q,
                isPreview: true,
                keepPaletteOpen: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (simulationCommand === 'TIME') {
            const speed = typeof simulationSpeed === 'number' ? simulationSpeed : 1;
            commands.push({
                id: 'sim-time',
                label: 'SIM TIME',
                subLabel: `${status}${statusSuffix} · SPEED ${speed}x · LOCAL SIMULATION · NO SIDE EFFECT`,
                icon: Compass,
                keywords: ['sim', 'simulation', 'time', 'clock'],
                historyValue: q,
                isPreview: true,
                keepPaletteOpen: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (simulationCommand === 'SPEED' && typeof parsedMeasurement.parameters.speed === 'number') {
            const speed = parsedMeasurement.parameters.speed;
            const previousSpeed = typeof simulationSpeed === 'number' ? simulationSpeed : 1;
            commands.push({
                id: 'sim-speed',
                label: `SIM SPEED ${speed.toFixed(2)}x`,
                subLabel: `PREVIOUS ${previousSpeed}x · ${status} · LOCAL SIMULATION · NO REAL-TIME CHANGE`,
                icon: Compass,
                action: () => { setSimulationSpeed?.(speed); },
                keywords: ['sim', 'simulation', 'speed', 'clock'],
                historyValue: q,
                isPreview: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (simulationCommand === 'STATUS') {
            commands.push({
                id: 'sim-status',
                label: 'SIM STATUS',
                subLabel: `${status}${statusSuffix} · LOCAL SIMULATION · NO SIDE EFFECT`,
                icon: Compass,
                keywords: ['sim', 'simulation', 'status', status.toLowerCase()],
                historyValue: q,
                isPreview: true,
                keepPaletteOpen: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (simulationCommand === 'PAUSE') {
            commands.push({
                id: 'sim-pause',
                label: 'SIM PAUSE',
                subLabel: `${status} · LOCAL SIMULATION · IDEMPOTENT`,
                icon: Compass,
                action: pauseSimulation,
                keywords: ['sim', 'pause', 'simulation'],
                historyValue: q,
                isPreview: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (simulationCommand === 'RESUME') {
            commands.push({
                id: 'sim-resume',
                label: 'SIM RESUME',
                subLabel: `${status} · LOCAL SIMULATION · IDEMPOTENT`,
                icon: Compass,
                action: resumeSimulation,
                keywords: ['sim', 'resume', 'simulation'],
                historyValue: q,
                isPreview: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (simulationCommand === 'RESET') {
            commands.push({
                id: 'sim-reset',
                label: 'SIM RESET',
                subLabel: `${status} · LOCAL SIMULATION · CONFIRMATION REQUIRED`,
                icon: Compass,
                action: requestSimulationReset,
                keywords: ['sim', 'reset', 'simulation', 'confirm'],
                historyValue: q,
                isPreview: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else {
            commands.push({
                id: 'sim-replay',
                label: 'SIM REPLAY',
                subLabel: `${status} · LOCAL SIMULATION · CONFIRMATION REQUIRED`,
                icon: Compass,
                action: requestSimulationReplay,
                keywords: ['sim', 'replay', 'simulation', 'confirm'],
                historyValue: q,
                isPreview: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        }
    }

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
            const reference = String(predictionReference ?? 'UNKNOWN');
            const unavailableId = `future-position-unavailable-${normalizeRankingText(reference).replace(/\\\\s+/g, '-')}`;
            commands.push(formatFutureUnavailable(
                reference,
                'INVALID_INPUT',
                undefined,
                createFuturePositionCommandResult({
                    reference,
                    id: unavailableId,
                    kind: previewFuturePosition ? 'MAP_PREVIEW' : 'READ_ONLY',
                    canPreview: Boolean(previewFuturePosition),
                }),
            ));
        } else {
            const resolution = resolveEntityReference(predictionReference, entities, ownship);
            if (!resolution.executable || !resolution.entity) {
                commands.push(formatFutureUnavailable(
                    predictionReference,
                    'AMBIGUOUS OR UNKNOWN REFERENCE',
                    undefined,
                    createReferenceResolutionResult(
                        `future-position-unavailable-${normalizeRankingText(predictionReference).replace(/\\s+/g, '-')}`,
                        resolution,
                    ),
                ));
            } else {
                const futureTrack = readFuturePositionTrack(
                    resolution.entity,
                    kinematicsOptionsFor(resolution.entity),
                );
                const result = projectFuturePosition({
                    track: futureTrack,
                    horizon: { value: predictionHorizonValue, unit: predictionHorizonUnit },
                    nowMs: scenarioTimeMs,
                });
                if (result.status === 'UNAVAILABLE') {
                    const unavailableId = `future-position-unavailable-${normalizeRankingText(resolution.entity.label).replace(/\\\\s+/g, '-')}`;
                    commands.push(formatFutureUnavailable(
                        resolution.entity.label,
                        result.reason,
                        result,
                        createFuturePositionCommandResult({
                            reference: resolution.entity.label,
                            id: unavailableId,
                            result,
                            track: futureTrack,
                            kind: previewFuturePosition ? 'MAP_PREVIEW' : 'READ_ONLY',
                            canPreview: Boolean(previewFuturePosition),
                        }),
                    ));
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
                        dragDropEligible: Boolean(previewFuturePosition),
                        futurePositionPreview: preview,
                        futurePositionResult: result,
                        result: createFuturePositionCommandResult({
                            reference: resolution.entity.label,
                            id: `future-position-${resolution.entity.id}`,
                            result,
                            track: futureTrack,
                            kind: previewFuturePosition ? 'MAP_PREVIEW' : 'READ_ONLY',
                            canPreview: Boolean(previewFuturePosition),
                        }),
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
        const referenceQuery = typeof parsedMeasurement.parameters.referenceQuery === 'string'
            ? parsedMeasurement.parameters.referenceQuery
            : undefined;
        const pairResolution = !isClosure
            && parsedMeasurement.parameters.referenceMode === 'EXPLICIT_PAIR'
            && referenceQuery
            ? resolveEntityPairReference(referenceQuery, entities, ownship)
            : undefined;
        const referenceResolution = isClosure
            ? { executable: true, entity: ownship }
            : pairResolution
                ? { executable: pairResolution.executable, entity: pairResolution.from }
                : typeof fromReference === 'string'
                    ? resolveEntityReference(fromReference, entities, ownship)
                    : { executable: false, entity: undefined };
        const targetResolution = pairResolution
            ? { executable: pairResolution.executable, entity: pairResolution.to }
            : typeof toReference === 'string'
                ? resolveEntityReference(toReference, entities, ownship)
                : { executable: false, entity: undefined };
        if (!referenceResolution.executable || !referenceResolution.entity
            || !targetResolution.executable || !targetResolution.entity
            || referenceResolution.entity.id === targetResolution.entity.id) {
            const failedResolution = pairResolution && !pairResolution.executable
                ? pairResolution
                : !referenceResolution.executable
                    ? referenceResolution
                    : !targetResolution.executable
                        ? targetResolution
                        : undefined;
            const failedCandidates = pairResolution
                ? pairResolution.candidates.map(candidate => ({
                    id: `${candidate.from.id}:${candidate.to.id}`,
                    label: `${candidate.from.label} → ${candidate.to.label}`,
                }))
                : failedResolution && !pairResolution && 'candidates' in failedResolution
                    ? candidateValues((failedResolution as EntityReferenceResolution).candidates)
                    : [];
            const implicitTargetReference = !isClosure
                && parsedMeasurement.parameters.referenceMode === 'IMPLICIT_TARGET';
            const failureLabel = isClosure
                ? targetLabel
                : implicitTargetReference
                    ? targetLabel
                    : pairResolution ? referenceQuery ?? `${referenceLabel} ${targetLabel}` : `${referenceLabel} ${targetLabel}`;
            const failureId = `relative-${relativeMotionCommand.toLowerCase()}-unavailable-${normalizeRankingText(failureLabel).replace(/\\s+/g, '-')}`;
            const result = createRelativeMotionFailureResult({
                command: relativeMotionCommand,
                reason: pairResolution && !pairResolution.executable
                    ? pairResolution.status
                    : failedResolution && 'status' in failedResolution
                        ? failedResolution.status
                        : 'AMBIGUOUS OR UNKNOWN REFERENCE',
                id: failureId,
                references: [
                    referenceResolution.entity?.id,
                    targetResolution.entity?.id,
                ].filter((id): id is string => typeof id === 'string'),
                candidates: failedCandidates,
            });
            commands.push(formatRelativeMotionUnavailable(
                relativeMotionCommand,
                isClosure
                    ? targetLabel
                    : implicitTargetReference
                        ? targetLabel
                        : pairResolution ? referenceQuery ?? `${referenceLabel} ${targetLabel}` : `${referenceLabel} ${targetLabel}`,
                'AMBIGUOUS OR UNKNOWN REFERENCE',
                undefined,
                result,
            ));
        } else {
            const referenceTrack = readRelativeMotionTrack(
                referenceResolution.entity,
                kinematicsOptionsFor(referenceResolution.entity),
            );
            const targetTrack = readRelativeMotionTrack(
                targetResolution.entity,
                kinematicsOptionsFor(targetResolution.entity),
            );
            const result = calculateRelativeMotion({
                reference: referenceTrack,
                target: targetTrack,
            });
            if (result.status === 'UNAVAILABLE') {
                const implicitTargetReference = !isClosure
                    && parsedMeasurement.parameters.referenceMode === 'IMPLICIT_TARGET';
                const displayReference = isClosure
                    ? targetResolution.entity.label
                    : implicitTargetReference
                        ? targetResolution.entity.label
                        : `${referenceResolution.entity.label} ${targetResolution.entity.label}`;
                const structuredResult = createRelativeMotionFailureResult({
                    command: relativeMotionCommand,
                    reason: result.reason,
                    id: `relative-${relativeMotionCommand.toLowerCase()}-unavailable-${normalizeRankingText(displayReference).replace(/\\s+/g, '-')}`,
                    references: [referenceResolution.entity.id, targetResolution.entity.id],
                    qualifications: [
                        positionQualificationFor(referenceResolution.entity, ownship, ownshipNavMode),
                        positionQualificationFor(targetResolution.entity, ownship, ownshipNavMode),
                        vectorQualificationFor(referenceTrack),
                        vectorQualificationFor(targetTrack),
                    ],
                    knownPosition: true,
                });
                commands.push(formatRelativeMotionUnavailable(
                    relativeMotionCommand,
                    displayReference,
                    result.reason,
                    result,
                    structuredResult,
                ));
            } else {
                commands.push(createRelativeMotionOption(
                    relativeMotionCommand,
                    referenceResolution.entity,
                    targetResolution.entity,
                    result,
                    previewRelativeMotion,
                    q,
                    ownship,
                    ownshipNavMode,
                    groundSpeed,
                    parsedMeasurement.parameters.referenceMode === 'IMPLICIT_TARGET',
                ));
            }
        }
    }

    // A recognized CPA query is a calculation-domain result. Keep unrelated
    // fuzzy actions and the note fallback out of this command's result set.
    if (parsedMeasurement.type === 'CALCULATION'
        && parsedMeasurement.parameters.command === 'CPA'
        && parsedMeasurement.errors.length === 0) {
        const cpaCommands = commands.filter(command => (
            command.id.startsWith('relative-cpa-')
            || command.relativeMotionPreview?.command === 'CPA'
        ));
        return withInteractionCapabilities(cpaCommands.slice(0, 3));
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
                result: createStaleTrackListResult(staleDetails),
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
                const resultId = `track-${trackInfoCommand.toLowerCase()}-unavailable`;
                commands.push({
                    id: resultId,
                    label: `${trackInfoCommand} ${reference}: UNAVAILABLE`,
                    subLabel: 'REASON: AMBIGUOUS OR UNKNOWN REFERENCE · TRACK DETAILS UNAVAILABLE',
                    icon: Compass,
                    keywords: ['track', trackInfoCommand.toLowerCase(), 'unavailable', 'reference'],
                    historyValue: q,
                    isPreview: true,
                    result: createReferenceResolutionResult(resultId, resolution),
                    keepPaletteOpen: true,
                    ranking: {
                        category: 'STRUCTURED_EXACT',
                        completeness: 3,
                        match: 'EXACT',
                    },
                });
            } else {
                const details = createEntityTrackDetails(resolution.entity, scenarioTimeMs);
                commands.push(createTrackInfoOption(
                    trackInfoCommand,
                    details,
                    q,
                    createTrackCommandResult(
                        trackInfoCommand,
                        details,
                        resolution.entity,
                        ownship,
                        ownshipNavMode,
                    ),
                ));
            }
        }
    }

    const favoriteCommand = parsedMeasurement.parameters.command;
    if (parsedMeasurement.type === 'SEARCH'
        && (favoriteCommand === 'PIN' || favoriteCommand === 'PIN TEMPLATE' || favoriteCommand === 'FAVORITES' || favoriteCommand === 'UNPIN')
        && parsedMeasurement.errors.length === 0) {
        if (favoriteCommand === 'PIN' || favoriteCommand === 'PIN TEMPLATE') {
            const favoriteValue = parsedMeasurement.parameters.favoriteCommand;
            const favoriteKind = parsedMeasurement.parameters.favoriteKind === 'TEMPLATE' ? 'TEMPLATE' : 'COMMAND';
            if (typeof favoriteValue === 'string') {
                commands.push({
                    id: 'favorite-pin',
                    label: `PIN ${favoriteValue}`,
                    subLabel: `${favoriteKind} · LOCAL FAVORITE · FILL ONLY`,
                    icon: Copy,
                    keywords: ['pin', 'favorite', favoriteKind.toLowerCase(), favoriteValue],
                    historyValue: q,
                    isPreview: true,
                    keepPaletteOpen: true,
                    action: () => addFavorite?.({
                        kind: favoriteKind,
                        label: favoriteValue,
                        command: favoriteValue,
                    }),
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            }
        } else if (favoriteCommand === 'FAVORITES') {
            const items = favoriteState?.items ?? [];
            if (items.length === 0) {
                commands.push({
                    id: 'favorites-empty',
                    label: 'FAVORITES: EMPTY',
                    subLabel: 'LOCAL STORAGE · NO SAVED COMMANDS',
                    icon: History,
                    keywords: ['favorites', 'empty'],
                    historyValue: q,
                    isPreview: true,
                    keepPaletteOpen: true,
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            } else {
                items.forEach(item => commands.push({
                    id: `favorite-${item.id}`,
                    label: `#${item.id} ${item.label}`,
                    subLabel: `${item.kind} · FILL ONLY · ${item.command}`,
                    icon: History,
                    keywords: ['favorites', item.kind.toLowerCase(), item.label, item.command],
                    autocompleteValue: item.command,
                    historyValue: item.command,
                    keepPaletteOpen: true,
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                }));
            }
        } else {
            const favoriteId = parsedMeasurement.parameters.favoriteId;
            const item = typeof favoriteId === 'number'
                ? favoriteState?.items.find(candidate => candidate.id === favoriteId)
                : undefined;
            if (item) {
                commands.push({
                    id: `favorite-unpin-${item.id}`,
                    label: `UNPIN #${item.id} ${item.label}`,
                    subLabel: 'LOCAL FAVORITE · DELETE ONLY',
                    icon: Copy,
                    keywords: ['unpin', 'favorite', item.label, item.command],
                    historyValue: q,
                    isPreview: true,
                    keepPaletteOpen: true,
                    action: () => removeFavorite?.(item.id),
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            } else {
                commands.push({
                    id: `favorite-unpin-${String(favoriteId ?? 'unknown')}-unavailable`,
                    label: `UNPIN ${favoriteId ?? '?'}: UNAVAILABLE`,
                    subLabel: 'REASON: FAVORITE NOT FOUND',
                    icon: Copy,
                    keywords: ['unpin', 'favorite', 'unavailable'],
                    historyValue: q,
                    isPreview: true,
                    keepPaletteOpen: true,
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            }
        }
    }

    if (parsedMeasurement.type === 'CALCULATION'
        && parsedMeasurement.parameters.command === 'CONVERT') {
        const sourceValue = parsedMeasurement.parameters.value;
        const sourceUnit = parsedMeasurement.parameters.sourceUnit;
        const targetUnit = parsedMeasurement.parameters.targetUnit;
        const sourceLabel = `${typeof sourceValue === 'number' ? sourceValue : '?'} ${typeof sourceUnit === 'string' ? sourceUnit : '?'}`;
        const targetLabel = typeof targetUnit === 'string' ? targetUnit : '?';
        if (parsedMeasurement.errors.length > 0
            || typeof sourceValue !== 'number'
            || typeof sourceUnit !== 'string'
            || typeof targetUnit !== 'string') {
            const parseError = parsedMeasurement.errors[0];
            const reason = parseError?.code === 'INCOMPATIBLE_UNIT'
                ? 'INCOMPATIBLE UNITS'
                : (parseError?.message ?? 'INVALID CONVERSION').toUpperCase();
            commands.push({
                id: 'unit-conversion-unavailable',
                label: `${sourceLabel} > ${targetLabel}: UNAVAILABLE`,
                subLabel: `${reason} · CALCULATION NOT EXECUTED`,
                unitConversionError: reason,
                icon: Calculator,
                keywords: ['convert', 'unit', 'unavailable', 'incompatible', sourceLabel, targetLabel],
                historyValue: q,
                isPreview: true,
                keepPaletteOpen: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else {
            try {
                const quantity = createTacticalQuantity(sourceValue, sourceUnit, {
                    allowZero: true,
                    allowNegative: true,
                });
                const converted = convertTacticalQuantity(quantity, targetUnit);
                commands.push({
                    id: 'unit-conversion',
                    label: `${sourceValue} ${quantity.unit} > ${targetUnit}`,
                    subLabel: `${converted.value.toFixed(3)} ${converted.unit} · ${quantity.dimension} · CALCULATION ONLY`,
                    icon: Calculator,
                    keywords: ['convert', 'unit', quantity.unit, converted.unit, quantity.dimension],
                    historyValue: q,
                    isPreview: true,
                    unitConversionResult: converted,
                    keepPaletteOpen: true,
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            } catch (error) {
                const reason = error instanceof Error ? error.message : 'INVALID CONVERSION';
                commands.push({
                    id: 'unit-conversion-unavailable',
                    label: `${sourceLabel} > ${targetLabel}: UNAVAILABLE`,
                    subLabel: `${reason.toUpperCase()} · CALCULATION NOT EXECUTED`,
                    unitConversionError: reason.toUpperCase(),
                    icon: Calculator,
                    keywords: ['convert', 'unit', 'unavailable', 'incompatible'],
                    historyValue: q,
                    isPreview: true,
                    keepPaletteOpen: true,
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            }
        }
    }

    const verticalCommand = parsedMeasurement.parameters.command;
    if (parsedMeasurement.type === 'CALCULATION'
        && (verticalCommand === 'GRAD' || verticalCommand === 'VSREQ' || verticalCommand === 'TOD')) {
        const addVerticalUnavailable = (reason: string) => commands.push({
            id: `vertical-${String(verticalCommand).toLowerCase()}-unavailable`,
            label: `${String(verticalCommand)}: UNAVAILABLE`,
            subLabel: `${reason} · THEORETICAL CALCULATION NOT EXECUTED`,
            icon: Calculator,
            keywords: ['vertical', String(verticalCommand).toLowerCase(), 'unavailable'],
            historyValue: q,
            isPreview: true,
            keepPaletteOpen: true,
            ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
        });
        if (parsedMeasurement.errors.length > 0) {
            addVerticalUnavailable(parsedMeasurement.errors[0]?.message ?? 'INVALID INPUT');
        } else if (verticalCommand === 'GRAD'
            && typeof parsedMeasurement.parameters.verticalSpeedFpm === 'number'
            && typeof parsedMeasurement.parameters.groundSpeedKnots === 'number') {
            const result = calculateGradient({
                verticalSpeedFpm: parsedMeasurement.parameters.verticalSpeedFpm,
                groundSpeedKnots: parsedMeasurement.parameters.groundSpeedKnots,
            });
            if (result.status === 'UNAVAILABLE') addVerticalUnavailable(result.reason);
            else commands.push({
                id: 'vertical-grad',
                label: `GRAD ${result.feetPerNauticalMile.toFixed(1)} FT/NM`,
                subLabel: `${result.percent.toFixed(2)}% · ANGLE ${result.angleDegrees.toFixed(2)}° · THEORETICAL · FORMULA: ${result.formula}`,
                icon: Calculator,
                keywords: ['grad', 'vertical', 'slope', 'theoretical'],
                historyValue: q,
                isPreview: true,
                keepPaletteOpen: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (verticalCommand === 'VSREQ'
            && typeof parsedMeasurement.parameters.altitudeChangeFeet === 'number'
            && typeof parsedMeasurement.parameters.distanceNauticalMiles === 'number'
            && typeof parsedMeasurement.parameters.groundSpeedKnots === 'number') {
            const result = calculateVerticalSpeedRequired({
                altitudeChangeFeet: parsedMeasurement.parameters.altitudeChangeFeet,
                distanceNauticalMiles: parsedMeasurement.parameters.distanceNauticalMiles,
                groundSpeedKnots: parsedMeasurement.parameters.groundSpeedKnots,
            });
            if (result.status === 'UNAVAILABLE') addVerticalUnavailable(result.reason);
            else commands.push({
                id: 'vertical-vsreq',
                label: `VSREQ ${result.verticalSpeedFpm.toFixed(1)} FPM`,
                subLabel: `TIME: ${result.timeMinutes.toFixed(2)} MIN · THEORETICAL · FORMULA: ${result.formula}`,
                icon: Calculator,
                keywords: ['vsreq', 'vertical', 'speed', 'theoretical'],
                historyValue: q,
                isPreview: true,
                keepPaletteOpen: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (verticalCommand === 'TOD'
            && typeof parsedMeasurement.parameters.reference === 'string'
            && typeof parsedMeasurement.parameters.fromAltitudeFeet === 'number'
            && typeof parsedMeasurement.parameters.toAltitudeFeet === 'number'
            && typeof parsedMeasurement.parameters.verticalSpeedFpm === 'number'
            && typeof parsedMeasurement.parameters.groundSpeedKnots === 'number') {
            const reference = resolveEntityReference(parsedMeasurement.parameters.reference, entities, ownship);
            if (!reference.executable || !reference.entity) {
                addVerticalUnavailable(`REFERENCE ${reference.status}`);
            } else {
                const result = calculateTopOfDescent({
                    fromAltitudeFeet: parsedMeasurement.parameters.fromAltitudeFeet,
                    toAltitudeFeet: parsedMeasurement.parameters.toAltitudeFeet,
                    verticalSpeedFpm: parsedMeasurement.parameters.verticalSpeedFpm,
                    groundSpeedKnots: parsedMeasurement.parameters.groundSpeedKnots,
                });
                if (result.status === 'UNAVAILABLE') addVerticalUnavailable(result.reason);
                else commands.push({
                    id: 'vertical-tod',
                    label: `TOD ${reference.entity.label} ${result.distanceNauticalMiles.toFixed(2)} NM BEFORE`,
                    subLabel: `TIME: ${result.timeMinutes.toFixed(2)} MIN · THEORETICAL · FORMULA: ${result.formula}`,
                    icon: Calculator,
                    keywords: ['tod', 'vertical', 'descent', reference.entity.label, 'theoretical'],
                    historyValue: q,
                    isPreview: true,
                    keepPaletteOpen: true,
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            }
        } else {
            addVerticalUnavailable('MISSING OR INVALID INPUT');
        }
    }

    const timerCommand = parsedMeasurement.parameters.command;
    if (parsedMeasurement.type === 'SEARCH'
        && (timerCommand === 'TIMER' || timerCommand === 'TIMERS' || timerCommand === 'CANCEL TIMER')
        && parsedMeasurement.errors.length === 0) {
        if (timerCommand === 'TIMER'
            && typeof parsedMeasurement.parameters.durationValue === 'number'
            && parsedMeasurement.parameters.durationUnit === 'MIN') {
            const durationMinutes = parsedMeasurement.parameters.durationValue;
            const checkReference = typeof parsedMeasurement.parameters.checkReference === 'string'
                ? parsedMeasurement.parameters.checkReference
                : undefined;
            const timerLabel = checkReference ? `CHECK ${checkReference}` : 'TIMER';
            commands.push({
                id: 'timer-create',
                label: `TIMER +${durationMinutes}MIN`,
                subLabel: `${timerLabel} · LOCAL SCENARIO TIME · NO AUTOMATIC ACTION`,
                icon: Compass,
                action: createTimer ? () => createTimer(durationMinutes * 60_000, timerLabel, checkReference) : undefined,
                keywords: ['timer', 'scenario', 'clock', 'check', checkReference ?? ''],
                historyValue: q,
                isPreview: true,
                keepPaletteOpen: false,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (timerCommand === 'TIMERS') {
            const timers = timerState?.timers ?? [];
            const summary = timers.length === 0
                ? 'NO TIMERS'
                : timers.map(timer => `${timer.id}: ${timer.label} · ${timer.status}`).join(' · ');
            commands.push({
                id: 'timer-list',
                label: 'TIMERS',
                subLabel: `${summary} · LOCAL SCENARIO TIME`,
                icon: Compass,
                keywords: ['timer', 'timers', 'scenario', 'clock'],
                historyValue: q,
                isPreview: true,
                timerState,
                keepPaletteOpen: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (timerCommand === 'CANCEL TIMER' && typeof parsedMeasurement.parameters.timerId === 'number') {
            const timerId = parsedMeasurement.parameters.timerId;
            const timer = timerState?.timers.find(item => item.id === timerId);
            commands.push({
                id: `timer-cancel-${timerId}`,
                label: `CANCEL TIMER ${timerId}`,
                subLabel: timer
                    ? `${timer.label} · STATUS: ${timer.status}`
                    : 'TIMER NOT FOUND',
                icon: Compass,
                action: cancelTimer ? () => cancelTimer(timerId) : undefined,
                keywords: ['timer', 'cancel', String(timerId)],
                historyValue: q,
                isPreview: true,
                keepPaletteOpen: false,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
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
        } else if (routeCommand === 'SHOW' || routeCommand === 'HIDE' || routeCommand === 'CLEAR') {
            const hasActiveRoute = Boolean(activeRoute && activeRoute.waypoints.length > 0);
            if (!hasActiveRoute) {
                commands.push({
                    id: 'route-unavailable',
                    label: 'NO ACTIVE SIM ROUTE',
                    subLabel: `ROUTE ${routeCommand} UNAVAILABLE · NO STATE CHANGED`,
                    icon: Navigation,
                    keywords: ['route', routeCommand.toLowerCase(), 'no active route', 'simulated'],
                    historyValue: q,
                    isPreview: true,
                    keepPaletteOpen: true,
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            } else if (routeCommand === 'SHOW' || routeCommand === 'HIDE') {
                const visible = routeCommand === 'SHOW';
                commands.push({
                    id: `route-${routeCommand.toLowerCase()}`,
                    label: `ROUTE ${routeCommand}`,
                    subLabel: `ACTIVE · ${activeRoute?.hidden ? 'HIDDEN' : 'VISIBLE'} → ${visible ? 'VISIBLE' : 'HIDDEN'} · LOCAL DISPLAY ONLY`,
                    icon: Navigation,
                    action: () => setRouteVisibility?.(visible),
                    keywords: ['route', routeCommand.toLowerCase(), 'visibility', 'simulated'],
                    historyValue: q,
                    isPreview: true,
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            } else {
                commands.push({
                    id: 'route-clear',
                    label: 'ROUTE CLEAR',
                    subLabel: `ACTIVE · ${activeRoute?.label ?? 'SIM ROUTE'} · CONFIRMATION REQUIRED · LOCAL SIMULATION ONLY`,
                    icon: Trash2,
                    action: () => requestMissionAction({
                        id: `command:view:route-clear:${activeRoute?.id ?? 'unknown'}:${Date.now()}`,
                        label: 'ROUTE CLEAR',
                        category: 'VIEW',
                        ...(activeRoute?.id ? { targetId: activeRoute.id } : {}),
                        issuedAt: Date.now(),
                        implementation: 'SIMULATED_EFFECT',
                        requiresAuthorization: true,
                    }),
                    keywords: ['route', 'clear', 'confirm', 'simulated'],
                    historyValue: q,
                    isPreview: true,
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            }
        }
    }

    const trailCommand = parsedMeasurement.parameters.system;
    if (parsedMeasurement.type === 'SYSTEM' && trailCommand === 'TRAIL') {
        const requestedTrailCommand = parsedMeasurement.parameters.trailCommand;
        const trailState = trails ?? { trails: {} };
        if (parsedMeasurement.errors.length === 0 && requestedTrailCommand === 'STATUS') {
            const entries = Object.values(trailState.trails);
            const summary = entries.length === 0
                ? 'NO TRAIL HISTORY · HIDDEN BY DEFAULT'
                : entries.map(trail => `${trail.label}: ${trail.visible ? 'VISIBLE' : 'HIDDEN'} · ${trail.points.length < 2 ? 'TRAIL INSUFFICIENT' : `${trail.points.length} POINTS`}${trail.limited ? ' · TRAIL LIMITED' : ''}`).join(' · ');
            const ignoredSuffix = trailState.lastIgnoredReason ? ` · ${trailState.lastIgnoredReason}` : '';
            commands.push({
                id: 'trail-status',
                label: 'TRAIL STATUS',
                subLabel: `${summary}${ignoredSuffix} · LOCAL MEMORY ONLY`,
                icon: History,
                keywords: ['trail', 'status', 'history', 'local'],
                historyValue: q,
                isPreview: true,
                keepPaletteOpen: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else if (parsedMeasurement.errors.length === 0
            && typeof parsedMeasurement.parameters.targetReference === 'string') {
            const resolution = resolveEntityReference(parsedMeasurement.parameters.targetReference, entities, ownship);
            if (resolution.status === 'RESOLVED' && resolution.entity) {
                const targetId = resolution.entity.id === ownship.id ? 'OWNSHIP' : resolution.entity.id;
                const currentTrail = trailState.trails[targetId];
                if (requestedTrailCommand === 'VISIBILITY' && typeof parsedMeasurement.parameters.visible === 'boolean') {
                    const visible = parsedMeasurement.parameters.visible;
                    commands.push({
                        id: 'trail-visibility',
                        label: `TRAIL ${resolution.entity.label} ${visible ? 'ON' : 'OFF'}`,
                        subLabel: `${currentTrail?.visible ? 'VISIBLE' : 'HIDDEN'} → ${visible ? 'VISIBLE' : 'HIDDEN'} · ${currentTrail ? (currentTrail.points.length < 2 ? 'TRAIL INSUFFICIENT' : `${currentTrail.points.length} POINTS`) : 'NO TRAIL HISTORY'} · HISTORICAL ONLY`,
                        icon: History,
                        action: () => setTrailVisibility?.(targetId, visible, resolution.entity?.label),
                        keywords: ['trail', 'history', visible ? 'on' : 'off', resolution.entity.label.toLowerCase()],
                        historyValue: q,
                        isPreview: true,
                        ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                    });
                } else if (requestedTrailCommand === 'CLEAR') {
                    if (currentTrail && currentTrail.points.length > 0) {
                        commands.push({
                            id: 'trail-clear',
                            label: `TRAIL CLEAR ${resolution.entity.label}`,
                            subLabel: `${currentTrail.points.length} POINTS · CONFIRMATION REQUIRED · TARGET ONLY`,
                            icon: Trash2,
                            action: () => {
                                const issuedAt = Date.now();
                                requestMissionAction({
                                    id: `command:view:trail-clear:${targetId}:${issuedAt}`,
                                    label: `TRAIL CLEAR ${resolution.entity.label}`,
                                    category: 'VIEW',
                                    targetId,
                                    issuedAt,
                                    implementation: 'SIMULATED_EFFECT',
                                    requiresAuthorization: true,
                                });
                            },
                            keywords: ['trail', 'clear', 'confirm', 'history', resolution.entity.label.toLowerCase()],
                            historyValue: q,
                            isPreview: true,
                            ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                        });
                    }
                }
            }
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
                        dragDropEligible: true,
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

    // 4c. Within spatial search. This is a local read-only scenario query.
    const withinCommand = typeof parsedMeasurement.parameters.command === 'string'
        ? parsedMeasurement.parameters.command
        : undefined;
    const withinReference = parsedMeasurement.parameters.reference;
    const withinRange = parsedMeasurement.parameters.range;
    const withinUnit = parsedMeasurement.parameters.rangeUnit;
    const withinCategory = parsedMeasurement.parameters.category as WithinCategory | undefined;
    if (parsedMeasurement.type === 'SEARCH'
        && withinCommand === 'WITHIN'
        && parsedMeasurement.errors.length === 0
        && typeof withinReference === 'string'
        && typeof withinRange === 'number'
        && withinUnit === 'NM'
        && (withinCategory === undefined
            || withinCategory === 'TRACK'
            || withinCategory === 'WAYPOINT'
            || withinCategory === 'AIRPORT')) {
        const resolution = resolveEntityReference(withinReference, entities, ownship);
        if (!resolution.executable || !resolution.entity) {
            commands.push({
                id: `within-reference-status-${resolution.status.toLowerCase()}`,
                label: `WITHIN ${resolution.status}: ${resolution.reference}`,
                subLabel: 'WITHIN search blocked · choose an unambiguous reference',
                icon: Crosshair,
                keywords: ['within', 'reference', resolution.status.toLowerCase()],
                historyValue: q,
                isPreview: true,
                keepPaletteOpen: true,
                ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
            });
        } else {
            let result: ReturnType<typeof findWithinEntities> | undefined;
            try {
                result = findWithinEntities({
                    reference: resolution.entity,
                    entities,
                    rangeNauticalMiles: withinRange,
                    category: withinCategory as WithinCategory | undefined,
                    freshnessOf: context.measurementPositionFreshness,
                });
            } catch {
                commands.push({
                    id: 'within-invalid-reference-position',
                    label: `WITHIN INVALID_REFERENCE_POSITION: ${resolution.reference}`,
                    subLabel: 'WITHIN search unavailable · reference position is invalid',
                    icon: Crosshair,
                    keywords: ['within', 'reference', 'invalid', 'position'],
                    historyValue: q,
                    isPreview: true,
                    keepPaletteOpen: true,
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            }
            if (result?.status === 'EMPTY') {
                commands.push({
                    id: `within-empty-${String(withinCategory ?? 'all').toLowerCase()}`,
                    label: `WITHIN ${withinRange}NM: NONE`,
                    subLabel: 'NO LOADED SCENARIO OBJECTS MATCH THE QUERY',
                    icon: Crosshair,
                    keywords: ['within', 'none', String(withinCategory ?? 'all').toLowerCase()],
                    historyValue: q,
                    isPreview: true,
                    keepPaletteOpen: true,
                    ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                });
            } else if (result) {
                result.candidates.forEach(candidate => {
                    const resultCategory = withinCategory
                        ?? (candidate.type === 'WAYPOINT' ? 'WAYPOINT' : candidate.type === 'AIRPORT' ? 'AIRPORT' : 'TRACK');
                    commands.push({
                        id: `within-result-${resultCategory.toLowerCase()}-${candidate.id}`,
                        label: candidate.label,
                        subLabel: formatNearestCandidate(candidate),
                        icon: Crosshair,
                        keywords: ['within', resultCategory.toLowerCase(), candidate.label, candidate.type, candidate.id],
                        historyValue: q,
                        isPreview: true,
                        keepPaletteOpen: true,
                        ranking: { category: 'STRUCTURED_EXACT', completeness: 3, match: 'EXACT' },
                    });
                });
            }
        }
    }

    // 4d. Coordinate conversion and local clipboard copy. These commands only
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
                            dragDropEligible: true,
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
                        dragDropEligible: Boolean(proposeSetBullseye),
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
                            dragDropEligible: Boolean(previewBullseyeProjection),
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
            const referenceQuery = typeof parsedMeasurement.parameters.referenceQuery === 'string'
                ? parsedMeasurement.parameters.referenceQuery
                : undefined;
            const pairResolution = parsedMeasurement.parameters.referenceMode === 'EXPLICIT_PAIR'
                && referenceQuery
                ? resolveEntityPairReference(referenceQuery, entities, ownship)
                : undefined;
            const fromResolution = pairResolution
                ? undefined
                : resolveEntityReference(fromReference, entities, ownship);
            const toResolution = pairResolution
                ? undefined
                : resolveEntityReference(toReference, entities, ownship);
            const fromEntity = pairResolution?.from ?? fromResolution?.entity;
            const toEntity = pairResolution?.to ?? toResolution?.entity;
            const failedResolution = pairResolution && !pairResolution.executable
                ? pairResolution
                : [fromResolution, toResolution]
                    .find((resolution): resolution is EntityReferenceResolution => Boolean(resolution)
                        && resolution.status !== 'RESOLVED');

            if (failedResolution) {
                const resultId = `measurement-reference-status-${failedResolution.status.toLowerCase()}`;
                commands.push({
                    id: resultId,
                    label: `${measurementCommand} ${referenceQuery ?? failedResolution.reference}: UNAVAILABLE`,
                    subLabel: `${measurementCommand} blocked · choose an unambiguous reference`,
                    icon: Calculator,
                    keywords: ['brg', 'rng', 'reference', failedResolution.status.toLowerCase()],
                    isPreview: true,
                    result: pairResolution
                        ? createPairReferenceResolutionResult(resultId, pairResolution)
                        : createReferenceResolutionResult(resultId, failedResolution as EntityReferenceResolution),
                    ranking: {
                        category: 'STRUCTURED_PARTIAL',
                        completeness: 2,
                        match: 'EXACT',
                        intent: 'MEASUREMENT',
                    },
                });
            } else if (fromEntity && toEntity) {
                const kind = measurementCommand as 'BRG' | 'RNG' | 'BRG/RNG';
                const measurement = calculateTacticalMeasurement(
                    fromEntity,
                    toEntity,
                    {
                        fromFreshness: context.measurementPositionFreshness?.(fromEntity),
                        toFreshness: context.measurementPositionFreshness?.(toEntity),
                    },
                );
                const referenceLabel = fromEntity.id === ownship.id
                    ? toEntity.label
                    : `${fromEntity.label} ${toEntity.label}`;

                commands.push({
                    id: `measurement-result-${kind.toLowerCase().replace('/', '-')}-${fromEntity.id}-${toEntity.id}`,
                    label: `${kind} ${referenceLabel}`,
                    subLabel: formatTacticalMeasurement(measurement, kind),
                    icon: Calculator,
                    keywords: ['brg', 'rng', fromEntity.label, toEntity.label],
                    historyValue: q,
                    isPreview: true,
                    result: createTacticalMeasurementCommandResult(
                        kind,
                        measurement,
                        fromEntity,
                        toEntity,
                        ownship,
                        ownshipNavMode,
                    ),
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
                    dragDropEligible: true,
                    swipeCapable: true,
                    ranking: createStructuredRanking(q, `DCT ${e.label}`),
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
            const referenceQuery = typeof parsedMeasurement.parameters.referenceQuery === 'string'
                ? parsedMeasurement.parameters.referenceQuery
                : undefined;
            const pairResolution = parsedMeasurement.parameters.referenceMode === 'EXPLICIT_PAIR'
                && referenceQuery
                ? resolveEntityPairReference(referenceQuery, entities, ownship)
                : undefined;
            const fromResolution = pairResolution || !fromReference
                ? undefined
                : resolveEntityReference(fromReference, entities, ownship);
            const toResolution = pairResolution || !toReference
                ? undefined
                : resolveEntityReference(toReference, entities, ownship);
            const fromEntity = pairResolution?.from ?? fromResolution?.entity;
            const toEntity = pairResolution?.to ?? toResolution?.entity;
            const failedResolution = pairResolution
                ? pairResolution.executable ? undefined : pairResolution
                : [fromResolution, toResolution]
                    .find((resolution): resolution is EntityReferenceResolution => Boolean(resolution)
                        && resolution.status !== 'RESOLVED');

            if (failedResolution) {
                const resultId = `${etaEteCommand.toLowerCase()}-reference-status-${failedResolution.status.toLowerCase()}`;
                commands.push({
                    id: resultId,
                    label: `${etaEteCommand} ${referenceQuery ?? failedResolution.reference}: UNAVAILABLE`,
                    subLabel: `${etaEteCommand} blocked · choose an unambiguous reference`,
                    icon: Calculator,
                    keywords: ['eta', 'ete', 'reference', failedResolution.status.toLowerCase()],
                    isPreview: true,
                    result: pairResolution
                        ? createPairReferenceResolutionResult(resultId, pairResolution)
                        : createReferenceResolutionResult(resultId, failedResolution as EntityReferenceResolution),
                    ranking: {
                        category: 'STRUCTURED_EXACT',
                        completeness: 3,
                        match: 'EXACT',
                        intent: 'MEASUREMENT',
                    },
                });
            } else if (fromEntity && toEntity) {
                const explicitSpeed = typeof parsedMeasurement.parameters.speed === 'number'
                    && parsedMeasurement.parameters.speedUnit === 'KT'
                    ? {
                        speedKnots: parsedMeasurement.parameters.speed,
                        source: 'USER_INPUT' as const,
                        qualification: 'USER_ASSUMPTION' as const,
                    }
                    : groundSpeed;
                const result = calculateEtaEte(
                    fromEntity.position,
                    toEntity.position,
                    explicitSpeed,
                    scenarioTimeMs,
                );
                const display = formatEtaEte(result, localTimeZone ?? 'UTC');
                const referenceLabel = fromReference === 'OWNSHIP'
                    ? toEntity.label
                    : `${fromEntity.label} → ${toEntity.label}`;
                const resultId = fromEntity.id === ownship.id
                    ? `${etaEteCommand.toLowerCase()}-${toEntity.id}`
                    : `${etaEteCommand.toLowerCase()}-${fromEntity.id}-${toEntity.id}`;
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
                    keywords: ['eta', 'ete', 'time', 'distance', fromEntity.label, toEntity.label],
                    historyValue: q,
                    isPreview: true,
                    result: createEtaEteCommandResult({
                        command: etaEteCommand,
                        from: fromEntity,
                        to: toEntity,
                        result,
                        speed: explicitSpeed,
                        ownship,
                        ownshipNavMode,
                        scenarioTimeMs,
                        localTimeZone,
                    }),
                    ranking: {
                        category: 'STRUCTURED_EXACT',
                        completeness: 3,
                        match: 'EXACT',
                        intent: 'MEASUREMENT',
                    },
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
    const exactStructuredFamily = q.length > 0 ? structuredPaletteFamily(parsedMeasurement) : undefined;
    if (exactStructuredFamily) {
        const exactStructuredCommands = commands.filter(command => (
            belongsToStructuredPaletteFamily(command, exactStructuredFamily)
        ));
        if (exactStructuredCommands.length > 0) {
            return withInteractionCapabilities(exactStructuredCommands);
        }
    }

    const rankedCommands = q.length > 0 ? rankCommandOptions(q, commands) : commands;
    const nearestResults = parsedMeasurement.type === 'SEARCH'
        && parsedMeasurement.parameters.command === 'NEAREST'
        ? commands.filter(command => command.id.startsWith('nearest-result-'))
        : [];
    if (nearestResults.length > 0) {
        const nearestIds = new Set(nearestResults.map(command => command.id));
        return withInteractionCapabilities([
            ...nearestResults,
            ...rankedCommands.filter(command => !nearestIds.has(command.id)),
        ]);
    }
    return withInteractionCapabilities(rankedCommands);
};
