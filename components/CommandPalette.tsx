import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Entity, SystemStatus, MapMode, HistoryEntry, NavMode } from '../types';
import { Search, History, MoveRight, CornerDownLeft, Copy } from 'lucide-react';
import { getCommands, CommandOption } from '../utils/CommandRegistry';
import type { MathCommandProvider } from '../utils/mathEvaluator';
import { motion, AnimatePresence } from 'framer-motion';
import type { MissionActionRequest } from '../domain/missionActions';
import { parseCommand } from '../domain/commandParser';
import { HMI_CLASSES } from './hmiTokens';
import {
  calculateDelta,
  calculateReciprocal,
  calculateRelativeBearing,
  type AngularCalculationResult,
  type AngularInputKind,
} from '../domain/angularCalculations';
import { intersectBearings, type BearingIntersectionResult } from '../domain/bearingIntersection';
import { createProjectionPreview, type ProjectionPreview, type SimulatedDesignation } from '../domain/designations';
import {
  calculateFromBullseye,
  createBullseyeProjectionPreview,
  type BullseyeMeasurement,
  type BullseyeProjectionPreview,
  type BullseyeReference,
} from '../domain/bullseye';
import { resolveEntityReference } from '../domain/entityResolution';
import { bearingBetween } from '../utils/geo';
import { convertTacticalQuantity, createTacticalQuantity } from '../domain/tacticalUnits';
import { CommandInterpretationPanel } from './CommandInterpretationPanel';
import { CommandResultCard } from './CommandResultCard';
import {
  buildCommandContext,
  type CommandContextFactory,
  type CommandContextOverrides,
} from '../application/buildCommandContext';
import { executeCommandIntent } from '../application/commandExecutor';
import { getTacticalCompletions, type TacticalCompletion } from '../domain/commandCompletion';
import {
  appendCommandHistory,
  canonicalizeCommandInput,
  MAX_COMMAND_HISTORY_ENTRIES,
} from '../domain/commandHistory';
import type { MissionObjective } from '../domain/intent';
import type { GroundSpeedInput } from '../domain/etaEte';
import type { ActiveSimulatedRoute } from '../domain/routeSummary';
import type { TrackTrailState } from '../domain/trackTrails';
import type { TacticalLayerState } from '../domain/layers';
import type { GridState } from '../domain/grid';
import type { NamedZone } from '../domain/zones';
import type { DeclutterState } from '../domain/declutter';
import type { FuturePositionPreview, FuturePositionResult } from '../domain/futurePosition';
import type { RelativeMotionPreview, RelativeMotionResult } from '../domain/relativeMotion';
import type { TrackDisplayDetails } from '../domain/trackDetails';
import type { ScenarioTimerState } from '../domain/simulationTimers';
import type { TacticalQuantity } from '../domain/tacticalUnits';
import {
  addFavorite,
  createFavoriteState,
  loadFavoriteState,
  removeFavorite,
  type FavoriteRequest,
  type FavoriteState,
} from '../domain/favorites';

type CommandPaletteCloseOptions = {
  preserveFuturePosition?: boolean;
};

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: (options?: CommandPaletteCloseOptions) => void;
  commandContextFactory?: CommandContextFactory;
  focusMapAt: (position: { lat: number, lon: number }) => void;
  previewProjection?: (preview: ProjectionPreview) => void;
  previewIntersection?: (preview: BearingIntersectionResult) => void;
  previewBullseyeProjection?: (preview: BullseyeProjectionPreview) => void;
  previewFuturePosition?: (preview: FuturePositionPreview) => void;
  previewRelativeMotion?: (preview: RelativeMotionPreview) => void;
  timerState?: ScenarioTimerState;
  createTimer?: (durationMs: number, label: string, checkReference?: string) => void;
  cancelTimer?: (timerId: number) => void;
  simulationStatus?: 'RUNNING' | 'PAUSED' | 'RESET · PAUSED' | 'REPLAY · RUNNING';
  simulationIsRunning?: boolean;
  simulationTimeMs?: number;
  simulationSpeed?: number;
  pauseSimulation?: () => void;
  resumeSimulation?: () => void;
  setSimulationSpeed?: (speed: number) => boolean;
  requestSimulationReset?: () => void;
  requestSimulationReplay?: () => void;
  bullseye?: BullseyeReference | null;
  proposeSetBullseye?: (bullseye: BullseyeReference) => void;
  proposeClearBullseye?: () => void;
  designations?: SimulatedDesignation[];
  listDesignations?: () => void;
  renameDesignation?: (designationId: string, label: string) => void;
  deleteDesignation?: (designationId: string) => void;
  proposeClearDesignations?: () => void;
  undoLastDesignation?: () => void;
  proposeDirectTo: (target: Pick<Entity, 'id' | 'label' | 'position'>) => void;
  proposeRoute: (target: Pick<Entity, 'id' | 'label' | 'position'>, objective?: MissionObjective) => void;
  requestMissionAction: (request: MissionActionRequest) => void;
  entities: Entity[];
  systems: SystemStatus;
  toggleSystem: (sys: keyof SystemStatus) => void;
  setMapMode: (mode: MapMode) => void;
  ownship: Entity;
  openDocument: (filename: string) => void;
  ownshipNavMode: NavMode;
  setOwnshipNavMode: (mode: NavMode) => void;
  groundSpeed?: GroundSpeedInput;
  scenarioTimeMs?: number;
  localTimeZone?: string;
  activeRoute?: ActiveSimulatedRoute;
  setRouteVisibility?: (visible: boolean) => void;
  trails?: TrackTrailState;
  setTrailVisibility?: (targetId: string, visible: boolean, label?: string) => void;
  layers?: TacticalLayerState;
  setLayers?: (state: TacticalLayerState) => void;
  declutter?: DeclutterState;
  setDeclutter?: (state: DeclutterState) => void;
  grid?: GridState;
  setGrid?: (state: GridState) => void;
  zones?: NamedZone[];
  visibleZoneId?: string | null;
  setVisibleZone?: (zoneId: string | null) => void;
}

interface VisualViewportRect {
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
}

const COMPACT_VIEWPORT_HEIGHT = 520;
const MATH_FUNCTION_PREFIX = /^(sin|cos|tan|asin|acos|atan|sqrt|log|abs|exp)/i;

const needsMathProvider = (trimmedQuery: string): boolean => trimmedQuery.length > 1 && (
  /^[-+]?\d/.test(trimmedQuery)
  || /^[.(]/.test(trimmedQuery)
  || MATH_FUNCTION_PREFIX.test(trimmedQuery)
  || /\b(?:to|in)\b/i.test(trimmedQuery)
);

const readVisualViewportRect = (): VisualViewportRect => {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, offsetTop: 0, offsetLeft: 0 };
  }

  const visualViewport = window.visualViewport;
  return {
    width: visualViewport?.width ?? window.innerWidth,
    height: visualViewport?.height ?? window.innerHeight,
    offsetTop: visualViewport?.offsetTop ?? 0,
    offsetLeft: visualViewport?.offsetLeft ?? 0,
  };
};

const readStoredHistory = (): HistoryEntry[] => {
  const saved = sessionStorage.getItem('cmd_history');
  if (!saved) return [];

  try {
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item): HistoryEntry[] => {
      if (typeof item === 'string') {
        const original = item.trim();
        return original
          ? [{ original, canonical: canonicalizeCommandInput(original), timestamp: Date.now() }]
          : [];
      }
      if (!item || typeof item !== 'object') return [];

      const record = item as Record<string, unknown>;
      if (typeof record.original !== 'string' || typeof record.timestamp !== 'number') return [];
      const original = record.original.trim();
      const canonical = typeof record.canonical === 'string'
        ? record.canonical.trim()
        : canonicalizeCommandInput(original);
      return original && canonical
        ? [{ original, canonical, timestamp: record.timestamp }]
        : [];
    }).slice(0, MAX_COMMAND_HISTORY_ENTRIES);
  } catch {
    return [];
  }
};

const readStoredFavorites = (): FavoriteState => {
  if (typeof window === 'undefined') return createFavoriteState();
  try {
    return loadFavoriteState(window.localStorage.getItem('cmd_favorites'));
  } catch {
    return createFavoriteState();
  }
};

const accessibleSubLabelFor = (cmd: CommandOption): string | undefined => (
  cmd.result && cmd.subLabel
    ? cmd.subLabel.replace(/SPEED_UNAVAILABLE/g, 'Vitesse sol absente')
    : cmd.subLabel
);

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commandContextFactory,
  focusMapAt,
  previewProjection,
  previewIntersection,
  previewBullseyeProjection,
  previewFuturePosition,
  previewRelativeMotion,
  timerState,
  createTimer,
  cancelTimer,
  simulationStatus,
  simulationIsRunning,
  simulationTimeMs,
  simulationSpeed,
  pauseSimulation,
  resumeSimulation,
  setSimulationSpeed,
  requestSimulationReset,
  requestSimulationReplay,
  bullseye,
  proposeSetBullseye,
  proposeClearBullseye,
  designations = [],
  listDesignations,
  renameDesignation,
  deleteDesignation,
  proposeClearDesignations,
  undoLastDesignation,
  proposeDirectTo,
  proposeRoute,
  requestMissionAction,
  entities,
  systems,
  toggleSystem,
  setMapMode,
  ownship,
  openDocument,
  ownshipNavMode,
  setOwnshipNavMode,
  groundSpeed,
  scenarioTimeMs,
  localTimeZone,
  activeRoute,
  setRouteVisibility,
  trails,
  setTrailVisibility,
  layers,
  setLayers,
  declutter,
  setDeclutter,
  grid,
  setGrid,
  zones,
  visibleZoneId,
  setVisibleZone,
}) => {
  const [query, setQuery] = useState('');
  const [selectedCommandId, setSelectedCommandId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const swipePointerRef = useRef<{
    pointerId: number;
    commandId: string;
    startX: number;
    startY: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const lastSwipeExecutionRef = useRef<{ commandId: string; timestamp: number } | null>(null);
  const restorePaletteFocus = React.useCallback(() => {
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (target && document.contains(target)) {
      target.focus();
      target.style.setProperty('outline', '3px solid rgb(52 211 153)');
      target.style.setProperty('outline-offset', '2px');
    }
  }, []);
  const listRef = useRef<HTMLUListElement>(null);
  const [visualViewportRect, setVisualViewportRect] = useState<VisualViewportRect>(readVisualViewportRect);
  const isViewportConstrained = visualViewportRect.height < COMPACT_VIEWPORT_HEIGHT;

  useEffect(() => {
    if (!isOpen) return;

    const updateVisualViewport = () => {
      setVisualViewportRect(readVisualViewportRect());
    };
    const visualViewport = window.visualViewport;

    updateVisualViewport();
    if (visualViewport) {
      visualViewport.addEventListener('resize', updateVisualViewport);
      visualViewport.addEventListener('scroll', updateVisualViewport);
      return () => {
        visualViewport.removeEventListener('resize', updateVisualViewport);
        visualViewport.removeEventListener('scroll', updateVisualViewport);
      };
    }

    window.addEventListener('resize', updateVisualViewport);
    return () => window.removeEventListener('resize', updateVisualViewport);
  }, [isOpen]);

  // History State: sessionStorage is scoped to the current browser tab.
  const [history, setHistory] = useState<HistoryEntry[]>(readStoredHistory);
  const [favoriteState, setFavoriteState] = useState<FavoriteState>(readStoredFavorites);
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 means typing new command
  const [mathProvider, setMathProvider] = useState<MathCommandProvider | null>(null);
  const isMathProviderPending = needsMathProvider(query.trim()) && !mathProvider;

  useEffect(() => {
    if (!isOpen) {
      restorePaletteFocus();
      return;
    }

    if (!returnFocusRef.current) {
      const activeElement = document.activeElement;
      const paletteTrigger = document.querySelector<HTMLElement>('button[aria-label="FIND"]');
      returnFocusRef.current = activeElement instanceof HTMLElement
        && activeElement !== document.body
        && !activeElement.closest('[data-command-palette="true"]')
        ? activeElement
        : paletteTrigger;
    }

    setQuery('');
    setSelectedCommandId(null);
    setHistoryIndex(-1);
    setTimeout(() => inputRef.current?.focus(), 50);

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose, restorePaletteFocus]);

  useEffect(() => () => restorePaletteFocus(), [restorePaletteFocus]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!needsMathProvider(trimmedQuery) || mathProvider) return;

    let cancelled = false;
    void import('../utils/mathEvaluator').then(({ createMathCommandProvider }) => {
      if (!cancelled) setMathProvider(createMathCommandProvider());
    });
    return () => {
      cancelled = true;
    };
  }, [query, mathProvider]);

  const addToHistory = (original: string, canonical: string) => {
    setHistory(previous => {
      const next = appendCommandHistory(previous, {
        original,
        canonical,
        timestamp: Date.now(),
      });
      sessionStorage.setItem('cmd_history', JSON.stringify(next));
      return next;
    });
  };

  const addFavoriteToStorage = React.useCallback((request: FavoriteRequest) => {
    setFavoriteState(previous => {
      const result = addFavorite(previous, request);
      if (result.status === 'AVAILABLE') {
        try {
          window.localStorage.setItem('cmd_favorites', JSON.stringify(result.state));
        } catch {
          // Storage failures leave the in-memory favorite available for this session.
        }
      }
      return result.state;
    });
  }, []);

  const removeFavoriteFromStorage = React.useCallback((favoriteId: number) => {
    setFavoriteState(previous => {
      const next = removeFavorite(previous, favoriteId);
      try {
        window.localStorage.setItem('cmd_favorites', JSON.stringify(next));
      } catch {
        // Storage failures leave the in-memory state available for this session.
      }
      return next;
    });
  }, []);

  const commands = useMemo(() => {
    const paletteContextOverrides: CommandContextOverrides = {
      history,
      favoriteState,
      addFavorite: addFavoriteToStorage,
      removeFavorite: removeFavoriteFromStorage,
    };
    const context = commandContextFactory
      ? commandContextFactory(paletteContextOverrides)
      : buildCommandContext({
        entities,
        ownship,
        systems,
        setMapMode,
        toggleSystem,
        focusMapAt,
        previewProjection,
        previewIntersection,
        previewBullseyeProjection,
        previewFuturePosition,
        previewRelativeMotion,
        timerState,
        createTimer,
        cancelTimer,
        simulationStatus,
        simulationIsRunning,
        simulationTimeMs,
        simulationSpeed,
        pauseSimulation,
        resumeSimulation,
        setSimulationSpeed,
        requestSimulationReset,
        requestSimulationReplay,
        favoriteState,
        addFavorite: addFavoriteToStorage,
        removeFavorite: removeFavoriteFromStorage,
        bullseye,
        proposeSetBullseye,
        proposeClearBullseye,
        designations,
        listDesignations,
        renameDesignation,
        deleteDesignation,
        proposeClearDesignations,
        undoLastDesignation,
        proposeDirectTo,
        proposeRoute,
        requestMissionAction,
        history,
        openDocument,
        ownshipNavMode,
        groundSpeed,
        scenarioTimeMs,
        localTimeZone,
        activeRoute,
        setRouteVisibility,
        trails,
        setTrailVisibility,
        layers,
        setLayers,
        declutter,
        setDeclutter,
        grid,
        setGrid,
        zones,
        visibleZoneId,
        setVisibleZone,
        toggleNavMode: () => setOwnshipNavMode(ownshipNavMode === NavMode.REAL ? NavMode.SIM : NavMode.REAL),
      });
    return getCommands(query, context, mathProvider ?? undefined);
  }, [
    query,
    commandContextFactory,
    entities,
    ownship,
    systems,
    history,
    setMapMode,
    toggleSystem,
    focusMapAt,
    previewProjection,
    previewIntersection,
    previewBullseyeProjection,
    previewFuturePosition,
    previewRelativeMotion,
    timerState,
    createTimer,
    cancelTimer,
    simulationStatus,
    simulationIsRunning,
    simulationTimeMs,
    simulationSpeed,
    pauseSimulation,
    resumeSimulation,
    setSimulationSpeed,
    requestSimulationReset,
    requestSimulationReplay,
    favoriteState,
    addFavoriteToStorage,
    removeFavoriteFromStorage,
    bullseye,
    proposeSetBullseye,
    proposeClearBullseye,
    designations,
    listDesignations,
    renameDesignation,
    deleteDesignation,
    proposeClearDesignations,
    undoLastDesignation,
    proposeDirectTo,
    proposeRoute,
    requestMissionAction,
    openDocument,
    ownshipNavMode,
    setOwnshipNavMode,
    groundSpeed,
    scenarioTimeMs,
    localTimeZone,
    activeRoute,
    setRouteVisibility,
    trails,
    setTrailVisibility,
    layers,
    setLayers,
    declutter,
    setDeclutter,
    grid,
    setGrid,
    zones,
    visibleZoneId,
    setVisibleZone,
    mathProvider,
  ]);

  const selectedIndex = useMemo(() => {
    if (commands.length === 0) return -1;
    if (selectedCommandId === null) return 0;
    return commands.findIndex(command => command.id === selectedCommandId);
  }, [commands, selectedCommandId]);

  const parsedCommand = useMemo(() => parseCommand(query), [query]);

  const interpretationProjection = useMemo<ProjectionPreview | undefined>(() => {
    if (parsedCommand.type !== 'PROJECTION' || parsedCommand.errors.length > 0) return undefined;

    const reference = typeof parsedCommand.parameters.reference === 'string'
      ? parsedCommand.parameters.reference
      : 'OWNSHIP';
    const bearing = parsedCommand.parameters.bearing;
    const range = parsedCommand.parameters.range;
    const unit = parsedCommand.parameters.unit;
    if (typeof bearing !== 'number' || typeof range !== 'number' || typeof unit !== 'string') {
      return undefined;
    }

    const resolution = resolveEntityReference(reference, entities, ownship);
    if (!resolution.executable || !resolution.entity) return undefined;

    try {
      const quantity = createTacticalQuantity(range, unit, { allowImplicitNauticalMile: true });
      const rangeNauticalMiles = convertTacticalQuantity(quantity, 'NM').value;
      return createProjectionPreview(
        resolution.entity.label,
        { ...resolution.entity.position },
        bearing,
        rangeNauticalMiles,
      );
    } catch {
      return undefined;
    }
  }, [parsedCommand, entities, ownship]);

  const interpretationIntersection = useMemo<BearingIntersectionResult | undefined>(() => {
    if (parsedCommand.type !== 'INTERSECTION' || parsedCommand.errors.length > 0) return undefined;

    const firstReference = parsedCommand.parameters.firstReference;
    const firstBearing = parsedCommand.parameters.firstBearing;
    const secondReference = parsedCommand.parameters.secondReference;
    const secondBearing = parsedCommand.parameters.secondBearing;
    if (typeof firstReference !== 'string' || typeof firstBearing !== 'number'
      || typeof secondReference !== 'string' || typeof secondBearing !== 'number'
      || !Number.isFinite(firstBearing) || !Number.isFinite(secondBearing)) {
      return undefined;
    }

    const firstResolution = resolveEntityReference(firstReference, entities, ownship);
    const secondResolution = resolveEntityReference(secondReference, entities, ownship);
    if (!firstResolution.executable || !firstResolution.entity
      || !secondResolution.executable || !secondResolution.entity
      || firstResolution.entity.id === secondResolution.entity.id) {
      return undefined;
    }

    try {
      return intersectBearings(
        {
          reference: firstResolution.entity.label,
          position: { ...firstResolution.entity.position },
          bearingDegrees: firstBearing,
        },
        {
          reference: secondResolution.entity.label,
          position: { ...secondResolution.entity.position },
          bearingDegrees: secondBearing,
        },
      );
    } catch {
      return undefined;
    }
  }, [parsedCommand, entities, ownship]);

  const interpretationBullseyeMeasurement = useMemo<BullseyeMeasurement | undefined>(() => {
    if (parsedCommand.type !== 'BULLSEYE' || parsedCommand.errors.length > 0) return undefined;
    const targetReference = parsedCommand.parameters.targetReference;
    if (typeof targetReference !== 'string') return undefined;
    const resolution = resolveEntityReference(targetReference, entities, ownship);
    if (!resolution.executable || !resolution.entity) return undefined;
    return calculateFromBullseye(bullseye ?? null, {
      id: resolution.entity.id,
      label: resolution.entity.label,
      position: { ...resolution.entity.position },
    });
  }, [parsedCommand, entities, ownship, bullseye]);

  const interpretationBullseyeProjection = useMemo<BullseyeProjectionPreview | undefined>(() => {
    if (parsedCommand.type !== 'BULLSEYE' || parsedCommand.errors.length > 0 || !bullseye) return undefined;
    const bearing = parsedCommand.parameters.bearing;
    const range = parsedCommand.parameters.range;
    const unit = parsedCommand.parameters.unit;
    if (typeof bearing !== 'number' || typeof range !== 'number' || typeof unit !== 'string') return undefined;
    try {
      const quantity = createTacticalQuantity(range, unit, { allowImplicitNauticalMile: true });
      const rangeNauticalMiles = convertTacticalQuantity(quantity, 'NM').value;
      return createBullseyeProjectionPreview(bullseye, bearing, rangeNauticalMiles);
    } catch {
      return undefined;
    }
  }, [parsedCommand, bullseye]);

  const interpretationAngularCalculation = useMemo<AngularCalculationResult | undefined>(() => {
    if (parsedCommand.type !== 'CALCULATION' || parsedCommand.errors.length > 0) return undefined;
    const command = parsedCommand.parameters.command;
    if (command !== 'RECIP' && command !== 'DELTA' && command !== 'REL') return undefined;

    const parsedKind = parsedCommand.parameters.angleKind;
    const angleKind: Exclude<AngularInputKind, 'RELATIVE_BEARING'> = (
      parsedKind === 'HEADING' || parsedKind === 'TRACK' || parsedKind === 'TRUE_BEARING'
    ) ? parsedKind : 'HEADING';

    if (command === 'RECIP' && typeof parsedCommand.parameters.angle === 'number') {
      return calculateReciprocal(parsedCommand.parameters.angle, angleKind);
    }
    if (command === 'DELTA'
      && typeof parsedCommand.parameters.fromAngle === 'number'
      && typeof parsedCommand.parameters.toAngle === 'number') {
      return calculateDelta(parsedCommand.parameters.fromAngle, parsedCommand.parameters.toAngle, angleKind);
    }
    if (command === 'REL'
      && typeof parsedCommand.parameters.fromReference === 'string'
      && typeof parsedCommand.parameters.toReference === 'string') {
      const fromResolution = resolveEntityReference(parsedCommand.parameters.fromReference, entities, ownship);
      const toResolution = resolveEntityReference(parsedCommand.parameters.toReference, entities, ownship);
      const observer = fromResolution.entity;
      const target = toResolution.entity;
      if (!fromResolution.executable || !toResolution.executable || !observer || !target
        || typeof observer.heading !== 'number'
        || !Number.isFinite(observer.heading)
        || !Number.isFinite(observer.position.lat)
        || !Number.isFinite(observer.position.lon)
        || !Number.isFinite(target.position.lat)
        || !Number.isFinite(target.position.lon)) {
        return calculateRelativeBearing(Number.NaN, Number.NaN);
      }
      const trueBearing = bearingBetween(
        observer.position.lat,
        observer.position.lon,
        target.position.lat,
        target.position.lon,
      );
      return calculateRelativeBearing(trueBearing, observer.heading);
    }
    return undefined;
  }, [parsedCommand, entities, ownship]);

  const interpretationFuturePositionPreview = useMemo<FuturePositionPreview | undefined>(() => {
    if (parsedCommand.type !== 'SEARCH'
      || parsedCommand.parameters.command !== 'PREDICT'
      || parsedCommand.errors.length > 0) return undefined;
    return commands.find(command => command.futurePositionPreview)?.futurePositionPreview;
  }, [parsedCommand, commands]);

  const interpretationFuturePositionResult = useMemo<FuturePositionResult | undefined>(() => {
    if (parsedCommand.type !== 'SEARCH'
      || parsedCommand.parameters.command !== 'PREDICT'
      || parsedCommand.errors.length > 0) return undefined;
    return commands.find(command => command.futurePositionResult)?.futurePositionResult;
  }, [parsedCommand, commands]);

  const interpretationRelativeMotionPreview = useMemo<RelativeMotionPreview | undefined>(() => {
    if (parsedCommand.type !== 'CALCULATION'
      || (parsedCommand.parameters.command !== 'CLOSURE' && parsedCommand.parameters.command !== 'CPA')
      || parsedCommand.errors.length > 0) return undefined;
    return commands.find(command => command.relativeMotionPreview)?.relativeMotionPreview;
  }, [parsedCommand, commands]);

  const interpretationRelativeMotionResult = useMemo<RelativeMotionResult | undefined>(() => {
    if (parsedCommand.type !== 'CALCULATION'
      || (parsedCommand.parameters.command !== 'CLOSURE' && parsedCommand.parameters.command !== 'CPA')
      || parsedCommand.errors.length > 0) return undefined;
    return commands.find(command => command.relativeMotionResult)?.relativeMotionResult;
  }, [parsedCommand, commands]);

  const interpretationTrackDetails = useMemo<TrackDisplayDetails | undefined>(() => {
    if (parsedCommand.type !== 'SEARCH'
      || (parsedCommand.parameters.command !== 'INFO'
        && parsedCommand.parameters.command !== 'AGE'
        && parsedCommand.parameters.command !== 'QUALITY')
      || parsedCommand.errors.length > 0) return undefined;
    return commands.find(command => command.trackDetails)?.trackDetails;
  }, [parsedCommand, commands]);

  const interpretationStaleTrackDetails = useMemo<TrackDisplayDetails[] | undefined>(() => {
    if (parsedCommand.type !== 'SEARCH'
      || parsedCommand.parameters.command !== 'STALE'
      || parsedCommand.errors.length > 0) return undefined;
    return commands.find(command => command.staleTrackDetails)?.staleTrackDetails;
  }, [parsedCommand, commands]);

  const interpretationUnitConversionResult = useMemo<TacticalQuantity | undefined>(() => {
    if (parsedCommand.type !== 'CALCULATION'
      || parsedCommand.parameters.command !== 'CONVERT'
      || parsedCommand.errors.length > 0) return undefined;
    return commands.find(command => command.unitConversionResult)?.unitConversionResult;
  }, [parsedCommand, commands]);

  const interpretationUnitConversionError = useMemo<string | undefined>(() => {
    if (parsedCommand.type !== 'CALCULATION'
      || parsedCommand.parameters.command !== 'CONVERT') return undefined;
    return commands.find(command => command.unitConversionError)?.unitConversionError;
  }, [parsedCommand, commands]);

  const projectionErrors = parsedCommand.type === 'PROJECTION' ? parsedCommand.errors : [];
  const showConversionError = parsedCommand.type === 'CALCULATION'
    && parsedCommand.parameters.command === 'CONVERT'
    && parsedCommand.errors.length > 0;
  const shouldShowInterpretation = query.trim().length > 0
    && parsedCommand.type !== 'NOTE'
    && (parsedCommand.errors.length === 0 || showConversionError);
  const interpretationEffect = parsedCommand.type === 'PROJECTION'
    ? interpretationProjection ? 'MAP PREVIEW ONLY' : 'MAP PREVIEW ONLY · BLOCKED'
    : parsedCommand.type === 'INTERSECTION'
      ? interpretationIntersection ? 'MAP PREVIEW ONLY' : 'MAP PREVIEW ONLY · BLOCKED'
      : parsedCommand.type === 'BULLSEYE'
        ? parsedCommand.parameters.command === 'SET BULL' || parsedCommand.parameters.command === 'CLEAR BULL'
          ? 'LOCAL SIMULATION · EXPLICIT CONFIRMATION'
          : typeof parsedCommand.parameters.bearing === 'number'
            ? interpretationBullseyeProjection ? 'MAP PREVIEW ONLY' : 'MAP PREVIEW ONLY · BLOCKED'
            : 'CALCULATION ONLY'
      : parsedCommand.type === 'MEASUREMENT' || parsedCommand.type === 'CALCULATION'
      ? 'CALCULATION ONLY'
      : parsedCommand.type === 'COORDINATE'
        ? 'MAP DISPLAY ONLY'
        : parsedCommand.type === 'SEARCH' && parsedCommand.parameters.command === 'PREDICT'
          ? interpretationFuturePositionPreview ? 'MAP PREVIEW ONLY' : 'MAP PREVIEW ONLY · BLOCKED'
        : parsedCommand.type === 'SYSTEM'
          ? 'LOCAL SIMULATION CONTROL'
          : 'LOCAL DISPLAY ONLY';

  const completions = useMemo(
    () => getTacticalCompletions(query, entities, ownship),
    [query, entities, ownship],
  );

  const applyCompletion = (completion: TacticalCompletion) => {
    setQuery(completion.value);
    setSelectedCommandId(null);
    inputRef.current?.focus();
  };

  const isNonExecutableResult = (cmd: CommandOption): boolean => Boolean(
    cmd.result && (cmd.result.kind === 'READ_ONLY' || cmd.result.state !== 'AVAILABLE'),
  );

  const executeCommand = (cmd: CommandOption) => {
    if (cmd.disabled || isNonExecutableResult(cmd)) return;
    if (cmd.isHistory) {
      // Recalling history fills the input only. Clear the history-row
      // selection so the next explicit Enter resolves the newly typed command
      // instead of recalling the same entry a second time.
      setSelectedCommandId(null);
      setQuery(cmd.autocompleteValue || cmd.label);
      inputRef.current?.focus();
      return;
    }
    if (cmd.autocompleteValue) {
      setQuery(cmd.autocompleteValue);
      inputRef.current?.focus();
      return;
    }
    const executed = executeCommandIntent([cmd], {
      commandId: cmd.id,
      query,
    });
    if (!executed) return;
    addToHistory(query, cmd.historyValue || canonicalizeCommandInput(query));
    if (!cmd.keepPaletteOpen) {
      onClose(cmd.futurePositionPreview ? { preserveFuturePosition: true } : undefined);
    }
  };

  const executeSwipeCommand = (cmd: CommandOption) => {
    if (cmd.disabled || !cmd.swipeCapable || isNonExecutableResult(cmd) || isMathProviderPending) return;
    const now = Date.now();
    const lastExecution = lastSwipeExecutionRef.current;
    if (lastExecution
      && lastExecution.commandId === cmd.id
      && now - lastExecution.timestamp < 500) return;
    lastSwipeExecutionRef.current = { commandId: cmd.id, timestamp: now };
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
    executeCommand(cmd);
  };

  const handlePointerDown = (event: React.PointerEvent, cmd: CommandOption) => {
    if (cmd.disabled || !cmd.swipeCapable || isNonExecutableResult(cmd) || isMathProviderPending) return;
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    swipePointerRef.current = {
      pointerId: event.pointerId,
      commandId: cmd.id,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  const handlePointerMove = (event: React.PointerEvent, cmd: CommandOption) => {
    const gesture = swipePointerRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.commandId !== cmd.id) return;
    const offsetX = event.clientX - gesture.startX;
    const offsetY = event.clientY - gesture.startY;
    if (offsetX > 100 && Math.abs(offsetX) > Math.abs(offsetY)) {
      swipePointerRef.current = null;
      event.preventDefault();
      suppressClickRef.current = true;
      executeSwipeCommand(cmd);
    }
  };

  const handlePointerUp = (event: React.PointerEvent, cmd: CommandOption) => {
    const gesture = swipePointerRef.current;
    swipePointerRef.current = null;
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.commandId !== cmd.id) return;
    const offsetX = event.clientX - gesture.startX;
    const offsetY = event.clientY - gesture.startY;
    if (offsetX > 100 && Math.abs(offsetX) > Math.abs(offsetY)) {
      event.preventDefault();
      suppressClickRef.current = true;
      executeSwipeCommand(cmd);
    }
  };

  const handlePointerCancel = (event: React.PointerEvent) => {
    if (swipePointerRef.current?.pointerId === event.pointerId) {
      swipePointerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && completions.length > 0) {
      e.preventDefault();
      applyCompletion(completions[0]);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      // If navigating history (and query matches history), allow moving back down to empty?
      // For now, prioritize list navigation if results exist
      if (commands.length > 0) {
        const nextIndex = selectedIndex >= 0 ? (selectedIndex + 1) % commands.length : 0;
        setSelectedCommandId(commands[nextIndex]?.id ?? null);
      } else {
        // History navigation down
        if (historyIndex > -1) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setQuery(newIndex === -1 ? '' : history[newIndex].original);
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commands.length > 0 && query !== '') {
        // Navigate list
        const previousIndex = selectedIndex >= 0
          ? (selectedIndex - 1 + commands.length) % commands.length
          : commands.length - 1;
        setSelectedCommandId(commands[previousIndex]?.id ?? null);
      } else {
        // History navigation up (only if query is empty or we are already identifying as history nav)
        // Actually, standard terminal behavior: ArrowUp always goes to history if caret at start? 
        // Simplified: If query is empty OR we are already traversing history
        const newIndex = historyIndex + 1;
        if (newIndex < history.length) {
          setHistoryIndex(newIndex);
          setQuery(history[newIndex].original);
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isMathProviderPending) return;
      if (selectedIndex < 0) return;
      if (commands[selectedIndex]) executeCommand(commands[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, cmd: CommandOption) => {
    if (cmd.disabled || isNonExecutableResult(cmd) || !cmd.action || !cmd.dragDropEligible) return;
    const commandQuery = cmd.historyValue || query;
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'command',
      commandId: cmd.id,
      query: commandQuery,
      history,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed z-[100] flex justify-center animate-in fade-in duration-200 ${
        isViewportConstrained
          ? 'items-start p-2'
          : 'items-end pb-8 lg:pb-12'
      }`}
      style={{
        top: visualViewportRect.offsetTop,
        left: visualViewportRect.offsetLeft,
        width: visualViewportRect.width,
        height: visualViewportRect.height,
        ...(isViewportConstrained ? {
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        } : {}),
      }}
      onClick={() => onClose()}
    >
      <div
        className={`w-[600px] min-w-0 max-w-[90vw] ${HMI_CLASSES.surfacePanel} ${HMI_CLASSES.palette} border border-emerald-500/50 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 duration-200 ${
          isViewportConstrained
            ? 'h-full max-h-full min-h-0'
            : 'h-[60vh] min-h-[400px] max-h-[500px] mb-safe'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Tactical command palette"
        data-command-palette="true"
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center px-4 py-3 border-b border-slate-800 bg-slate-900/50">
          <Search className="text-emerald-500 mr-3" size={20} />
          <input
            ref={inputRef}
            className={`flex-1 bg-transparent border-none outline-none ${HMI_CLASSES.actionText} ${HMI_CLASSES.focusRing} text-slate-100 placeholder-slate-500 font-medium h-6`}
            aria-label="Command input"
            placeholder="Type a command (e.g., 'DCT', 'TK2 180 5')..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setHistoryIndex(-1); // Reset history index on type
            }}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <div className="flex gap-2 items-center text-slate-400">
            {query && (
              <div
                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(query); }}
                className="cursor-pointer hover:text-emerald-400 transition-colors p-1"
                title="Copy Input"
              >
                <Copy size={16} />
              </div>
            )}
            <button
              type="button"
              aria-label="Close command palette"
              onClick={() => onClose()}
              className={`px-2 py-1 flex items-center justify-center rounded bg-slate-800 ${HMI_CLASSES.actionText} ${HMI_CLASSES.focusRing} font-mono border border-slate-700 hover:bg-slate-700 active:bg-slate-600 transition-colors cursor-pointer ${HMI_CLASSES.activeTarget}`}
            >
              ESC
            </button>
          </div>
        </div>



        {/* Suggestion / Tip Area */}
        {!isViewportConstrained && (
          <div className="shrink-0 px-4 py-2 bg-slate-900/30 border-b border-slate-800 text-[10px] text-emerald-500/70 font-mono flex justify-between">
            <span>
              {commands.length > 0 && (commands[0].id === 'coord-suggestion' || commands[0].id === 'calc-hint') ? (
                <span className="text-emerald-400 font-bold animate-pulse">{commands[0].label}</span>
              ) : (
                <>
                  {query === '' && "TYPE TO SEARCH COMMANDS OR ENTITIES"}
                  {query.length > 0 && !query.includes('/') && !query.match(/^\d/) && !query.match(/^[a-z]/i) && "TRY: '12*5', '10km to nm', 'TK2 180 5'"}
                  {(query.match(/^\d/) || (query.length > 0 && commands.some(c => c.id === 'calc-result'))) && "CALCULATOR MODE ACTIVE"}
                  {query.includes('/') && "BEARING/RANGE PROJECTION MODE"}
                </>
              )}
            </span>
            {historyIndex > -1 && <span className="flex items-center gap-1 text-slate-400"><History size={10} /> HISTORY ({historyIndex + 1})</span>}
          </div>
        )}
        {projectionErrors.length > 0 && (
          <div
            role="alert"
            aria-live="polite"
            className="shrink-0 px-4 py-2 border-b border-amber-500/40 bg-amber-950/30 text-amber-200 text-xs font-mono"
          >
            {projectionErrors.map(error => (
              <div key={`${error.code}-${error.message}`}>{error.message}</div>
            ))}
          </div>
        )}

        {completions.length > 0 && (
          <div
            className="shrink-0 max-h-32 overflow-y-auto border-b border-slate-800 bg-slate-900/60"
            role="listbox"
            aria-label="Tactical completions"
          >
            {completions.map(completion => (
              <button
                key={`${completion.stage}-${completion.value}`}
                type="button"
                role="option"
                aria-label={`${completion.label} · ${completion.subLabel}`}
                className={`w-full px-4 py-2 text-left ${HMI_CLASSES.actionText} ${HMI_CLASSES.activeTarget} ${HMI_CLASSES.focusRing} font-mono text-emerald-200 hover:bg-emerald-900/30 focus:bg-emerald-900/30 focus:outline-none`}
                onClick={() => applyCompletion(completion)}
              >
                <span className="font-bold">{completion.label}</span>
                <span className="ml-2 text-slate-400">{completion.subLabel}</span>
              </button>
            ))}
          </div>
        )}
        {isMathProviderPending && (
          <div className="shrink-0 px-4 py-2 border-b border-slate-800 text-[10px] text-amber-300 font-mono" role="status" aria-live="polite">
            CALCULATOR LOADING…
          </div>
        )}
        {shouldShowInterpretation && (
          <CommandInterpretationPanel
            parsed={parsedCommand}
            angularCalculation={interpretationAngularCalculation}
            futurePositionPreview={interpretationFuturePositionPreview}
            futurePositionResult={interpretationFuturePositionResult}
            relativeMotionPreview={interpretationRelativeMotionPreview}
            relativeMotionResult={interpretationRelativeMotionResult}
            trackDetails={interpretationTrackDetails}
            staleTrackDetails={interpretationStaleTrackDetails}
            unitConversionResult={interpretationUnitConversionResult}
            unitConversionError={interpretationUnitConversionError}
            projection={interpretationProjection}
            intersection={interpretationIntersection}
            bullseyeMeasurement={interpretationBullseyeMeasurement}
            bullseyeProjection={interpretationBullseyeProjection}
            effect={interpretationEffect}
            source={interpretationBullseyeMeasurement || interpretationBullseyeProjection ? 'SIMULATED BULLSEYE' : 'LOCAL SCENARIO'}
            result={commands[selectedIndex]?.result}
          />
        )}

        <ul ref={listRef} className="flex-1 min-w-0 min-h-0 overflow-y-auto py-2 overflow-x-hidden" role="listbox" aria-label="Command results" aria-busy={isMathProviderPending}>
          {commands.length === 0 ? (
            <li className="px-4 py-8 text-center text-slate-500 text-sm">
              No commands found for "{query}"
            </li>
          ) : (
            <AnimatePresence>
              {commands.map((cmd, idx) => {
                const Icon = cmd.icon;
                const isSelected = idx === selectedIndex;
                const resultIsNonExecutable = isNonExecutableResult(cmd);
                const rowIsNonExecutable = Boolean(cmd.disabled || resultIsNonExecutable);
                const accessibleSubLabel = accessibleSubLabelFor(cmd);
                const selectionClasses = isSelected
                  ? rowIsNonExecutable
                    ? 'bg-slate-900/70 border-l-4 border-amber-400/70'
                    : 'bg-emerald-900/20 border-l-4 border-emerald-500'
                  : 'border-l-4 border-transparent hover:bg-slate-800/50';
                return (
                  <motion.li
                    key={cmd.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    drag={false}
                    onPointerDown={event => handlePointerDown(event, cmd)}
                    onPointerMove={event => handlePointerMove(event, cmd)}
                    onPointerUp={event => handlePointerUp(event, cmd)}
                    onPointerCancel={handlePointerCancel}
                    draggable={!rowIsNonExecutable && Boolean(cmd.action) && cmd.dragDropEligible === true}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={rowIsNonExecutable ? 'true' : undefined}
                    aria-label={accessibleSubLabel ? `${cmd.label} · ${accessibleSubLabel}` : cmd.label}
                    onDragStart={(e: any) => handleDragStart(e, cmd)}
                    className={`
                     group ${HMI_CLASSES.activeTarget} ${HMI_CLASSES.focusRing} ${HMI_CLASSES.actionText} w-full min-w-0 px-4 py-4 min-h-[60px] flex items-center gap-4 ${rowIsNonExecutable ? 'cursor-default' : 'cursor-pointer'} relative
                     ${selectionClasses}
                   `}
                    onClick={() => {
                      if (suppressClickRef.current) {
                        suppressClickRef.current = false;
                        return;
                      }
                      if (isMathProviderPending) return;
                      executeCommand(cmd);
                    }}
                    onMouseEnter={() => setSelectedCommandId(cmd.id)}
                    style={{ touchAction: 'pan-y' }} // Allow vertical scroll, horizontal swipe handled by Framer
                  >
                    {/* Keep the swipe cue specific to explicitly swipe-capable commands. */}
                    {cmd.swipeCapable === true && !resultIsNonExecutable && (
                      <div className="absolute inset-y-0 left-0 w-full min-w-0 bg-emerald-600/20 -z-10 flex items-center pl-4 opacity-0 motion-safe:group-active:opacity-100">
                        <MoveRight size={24} className="text-emerald-400" />
                        <span className="ml-2 font-bold text-emerald-400">DIRECT TO</span>
                      </div>
                    )}

                    <div className={`shrink-0 p-2 rounded-md ${isSelected ? 'bg-emerald-900/40 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex min-w-0 flex-1 max-w-full flex-col">
                      <div className={`min-w-0 max-w-full ${HMI_CLASSES.actionText} font-medium break-words ${isSelected ? 'text-emerald-100' : 'text-slate-200'} [overflow-wrap:anywhere]`}>
                        {cmd.label}
                      </div>
                      {cmd.result ? (
                        <>
                          <CommandResultCard result={cmd.result} />
                          {/* Keep the legacy subLabel contract available to existing consumers without
                              making long secondary details part of the visual row. */}
                          {accessibleSubLabel && <span className="hidden" aria-hidden="true">{accessibleSubLabel}</span>}
                        </>
                      ) : cmd.subLabel && (
                        <div className={`min-w-0 max-w-full break-words ${HMI_CLASSES.qualification} mt-0.5 [overflow-wrap:anywhere]`}>
                          {cmd.subLabel}
                        </div>
                      )}
                    </div>
                    {cmd.isHistory && (
                      <div
                        className="ml-2 shrink-0 text-slate-500 hover:text-emerald-400 cursor-pointer p-2 z-10 relative opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(cmd.label);
                        }}
                        title="Copy History Item"
                      >
                        <Copy size={16} />
                      </div>
                    )}
                    {isSelected && !rowIsNonExecutable && <CornerDownLeft size={16} className={`shrink-0 text-emerald-500 ${cmd.isHistory ? 'ml-1' : 'ml-2'}`} />}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          )}
        </ul>

      </div>
    </div>
  );
};
