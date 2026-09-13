
import React, { useState, useEffect, useRef } from 'react';

const MapDisplay = React.lazy(() => import('./components/MapDisplay').then(module => ({ default: module.MapDisplay })));
const CommandPalette = React.lazy(() => import('./components/CommandPalette').then(module => ({ default: module.CommandPalette })));
const DocumentViewer = React.lazy(() => import('./components/DocumentViewer').then(module => ({ default: module.DocumentViewer })));
const TopSystemBar = React.lazy(() => import('./components/TopSystemBar').then(module => ({ default: module.TopSystemBar })));
const LeftSidebar = React.lazy(() => import('./components/LeftSidebar').then(module => ({ default: module.LeftSidebar })));
const ActionStatusPanel = React.lazy(() => import('./components/ActionStatusPanel').then(module => ({ default: module.ActionStatusPanel })));
const MissionActionStatusPanel = React.lazy(() => import('./components/MissionActionStatusPanel').then(module => ({ default: module.MissionActionStatusPanel })));
const ProposalComparisonPanel = React.lazy(() => import('./components/ProposalComparisonPanel').then(module => ({ default: module.ProposalComparisonPanel })));
const JustificationPanel = React.lazy(() => import('./components/JustificationPanel').then(module => ({ default: module.JustificationPanel })));

import { OwnshipPanel, TargetPanel } from './components/InfoPanels';
import { SimulationBanner } from './components/SimulationBanner';
import { UpdateAvailableBanner } from './components/UpdateAvailableBanner';
import { HMI_CLASSES } from './components/hmiTokens';
import { Entity, EntityType, MapMode, SystemStatus, PrototypeSettings, StabMode, NavMode, HistoryEntry } from './types';
import { createNavigationState, markNavigationError, markNavigationUpdate, markSimulationUpdate, OwnshipNavigationState } from './domain/navigation';
import { createKinematicsSnapshot, projectKinematicsToEntity } from './domain/kinematics';
import { createBrowserGeolocationAdapter } from './adapters/geolocation';
import { selectGroundSpeedInput } from './domain/navigationInputs';
import { positionToMeterOffset } from './domain/mapCoordinates';
import { bearingBetween } from './utils/geo';
import { CommandIntent, CommandState } from './domain/commands';
import { createCommandState, dispatchCommand } from './application/commandDispatcher';
import { MissionActionIntent } from './application/missionActionReducer';
import { createMissionActionState, dispatchMissionAction } from './application/missionActionReducer';
import type { MissionActionRequest } from './domain/missionActions';
import type { ProjectionPreview } from './domain/designations';
import type { BearingIntersectionResult } from './domain/bearingIntersection';
import type { BullseyeProjectionPreview, BullseyeReference } from './domain/bullseye';
import type { FuturePositionPreview } from './domain/futurePosition';
import type { ActiveSimulatedRoute } from './domain/routeSummary';
import { createBullseyeState, bullseyeReducer } from './application/bullseyeReducer';
import { createDesignationState, designationReducer } from './application/designationReducer';
import type { MissionObjective } from './domain/intent';
import type { RouteProposal, RouteProposalSet } from './domain/proposals';
import { solveSimpleRouteProposals } from './simulation/simpleRouteSolver';
import type { CommandContext } from './utils/CommandRegistry';
import {
  buildCommandContext,
  createCommandContextFactory,
  dispatchContextAction,
  type ContextActionHandlers,
  type ContextActionRequest,
} from './application/buildCommandContext';
import { executeCommandIntent, type CommandIntent as CommandExecutionIntent } from './application/commandExecutor';
import { useSimulation } from './utils/useSimulation';
import {
  addScenarioTimer,
  advanceScenarioTimers,
  cancelScenarioTimer,
  createTimerState,
  resetScenarioTimers,
} from './domain/simulationTimers';
import {
  createLayerState,
  setLayerVisibility,
  type TacticalLayerState,
} from './domain/layers';
import {
  createDeclutterState,
  setDeclutterPreset,
  type DeclutterState,
} from './domain/declutter';
import {
  createGridState,
  setGridEnabled,
  type GridState,
} from './domain/grid';
import {
  createDefaultZones,
  type NamedZone,
} from './domain/zones';
import {
  appendTrailSample,
  clearTrail,
  createTrailState,
  resetTrailState,
  setTrailVisibility as setTrailVisibilityState,
  type TrackTrailState,
} from './domain/trackTrails';
import {
  DEFAULT_MISSION_AIRPORT,
  DEFAULT_MISSION_ORIGIN,
  translateScenarioPosition,
} from './domain/missionOrigin';
import { CONTEXT_ACTION_IDS } from './domain/contextActions';
import { calculateEtaEte, formatEtaEte } from './domain/etaEte';
import { calculateTacticalMeasurement, formatTacticalMeasurement } from './domain/tacticalMeasurements';
import {
  createBullseye,
} from './domain/bullseye';
import {
  projectFuturePosition,
  toFuturePositionTrack,
} from './domain/futurePosition';

const DEFAULT_ORIGIN = DEFAULT_MISSION_ORIGIN;
const BUILD_ID = import.meta.env.VITE_BUILD_ID || 'local';

type HmiRootStyle = React.CSSProperties & {
  '--ui-scale': number;
};

type MapRenderSurfaceStyle = React.CSSProperties & {
  '--hmi-map-base-opacity': number;
};

const formatTimerRemaining = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const readDraggedHistory = (value: unknown): HistoryEntry[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const entry = item as Record<string, unknown>;
    if (typeof entry.original !== 'string'
      || typeof entry.canonical !== 'string'
      || typeof entry.timestamp !== 'number'
      || !Number.isFinite(entry.timestamp)) return [];
    const original = entry.original.trim();
    const canonical = entry.canonical.trim();
    return original && canonical
      ? [{ original, canonical, timestamp: entry.timestamp }]
      : [];
  }).slice(0, 100);
};

const capturePanelReturnFocus = (fallbackSelector: string): HTMLElement | null => {
  if (typeof document === 'undefined') return null;
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement
    && activeElement !== document.body
    && !activeElement.closest('[data-command-palette="true"]')) {
    return activeElement;
  }
  return document.querySelector<HTMLElement>(fallbackSelector);
};

const restorePanelFocus = (focusRef: React.MutableRefObject<HTMLElement | null>) => {
  const target = focusRef.current;
  focusRef.current = null;
  if (typeof document === 'undefined' || !target || !document.contains(target)) return;
  target.focus({ preventScroll: true });
  target.style.setProperty('outline', '3px solid rgb(103 232 249)');
  target.style.setProperty('outline-offset', '2px');
};

const INITIAL_OWNSHIP: Entity = {
  id: 'ownship',
  type: EntityType.OWNSHIP,
  position: { lat: DEFAULT_ORIGIN.lat, lon: DEFAULT_ORIGIN.lon },
  label: 'VIPER 1-1',
  heading: 0,
  speed: 120, // Default speed in knots for ETA calculations
  altitude: 3428,
  metadata: { groundTrackDegrees: 0, groundSpeedKnots: 120, freshness: 'FRESH', ageSeconds: 0 },
};

// Seeding test entities with Lat/Lon Native coordinates
const INITIAL_ENTITIES: Entity[] = [
  { id: 'wp-1', type: EntityType.WAYPOINT, position: translateScenarioPosition({ lat: 34.1, lon: -118.2 }), label: 'G01' },
  { id: 'wp-2', type: EntityType.WAYPOINT, position: translateScenarioPosition({ lat: 34.08, lon: -118.15 }), label: 'BRAVO', metadata: { groundTrackDegrees: 180, groundSpeedKnots: 60, freshness: 'FRESH', ageSeconds: 4 } },
  { id: 'apt-1', type: EntityType.AIRPORT, position: DEFAULT_MISSION_AIRPORT, label: 'BASE' },
  { id: 'en-1', type: EntityType.ENEMY, position: translateScenarioPosition({ lat: 34.07, lon: -118.10 }), label: 'HOSTILE 1', heading: 270, targetHeading: 270, speed: 60, targetSpeed: 60, turnRate: 3, metadata: { groundTrackDegrees: 270, groundSpeedKnots: 60, freshness: 'FRESH', ageSeconds: 4, source: 'RADAR', quality: 'GOOD', uncertaintyMeters: 40, classification: 'HOSTILE', confidence: 0.9 } },
  // Adding Waypoint routine to ENEMY 2 to test automatic navigation
  { id: 'en-2', type: EntityType.ENEMY, position: translateScenarioPosition({ lat: 34.02, lon: -118.12 }), label: 'HOSTILE 2', heading: 320, targetHeading: 320, speed: 180, targetSpeed: 180, turnRate: 5, waypoints: [{ lat: 34.1, lon: -118.2 }, { lat: 34.08, lon: -118.15 }].map(translateScenarioPosition), metadata: { freshness: 'STALE', ageSeconds: 90, source: 'RADAR', quality: 'DEGRADED', uncertaintyMeters: 250, classification: 'HOSTILE', confidence: 0.8 } },
];

type BullseyeProposal =
  | { type: 'SET'; bullseye: BullseyeReference }
  | { type: 'CLEAR'; previous: BullseyeReference };

interface ContextActionResult {
  actionId: string;
  label: string;
  detail: string;
}

const App: React.FC = () => {
  const [origin, setOrigin] = useState<{ lat: number, lon: number } | null>(DEFAULT_ORIGIN);
  const [ownship, setOwnship] = useState<Entity>(INITIAL_OWNSHIP);

  const [ownshipNavMode, setOwnshipNavMode] = useState<NavMode>(NavMode.REAL);
  const [navigationState, setNavigationState] = useState<OwnshipNavigationState>(() => createNavigationState(INITIAL_OWNSHIP.position));
  const [commandState, setCommandState] = useState<CommandState>(() => createCommandState());
  const [directToPanelOpen, setDirectToPanelOpen] = useState(false);
  const directToReturnFocusRef = useRef<HTMLElement | null>(null);
  const [missionActionState, setMissionActionState] = useState(() => createMissionActionState());
  const [missionActionPanelOpen, setMissionActionPanelOpen] = useState(false);
  const missionActionReturnFocusRef = useRef<HTMLElement | null>(null);
  const [routeProposalSet, setRouteProposalSet] = useState<RouteProposalSet | null>(null);
  const [activeSimulatedRoute, setActiveSimulatedRoute] = useState<ActiveSimulatedRoute | undefined>();
  const [acceptedRouteProposalId, setAcceptedRouteProposalId] = useState<string | null>(null);
  const [justificationPair, setJustificationPair] = useState<{
    preferred: RouteProposal;
    alternative: RouteProposal;
  } | null>(null);
  const [stabMode, setStabMode] = useState<StabMode>(StabMode.HELICO);
  const [frozenHeading, setFrozenHeading] = useState<number | null>(null);
  const [groundAnchor, setGroundAnchor] = useState<{ lat: number, lon: number } | null>(null);
  const [simulationProposal, setSimulationProposal] = useState<'RESET' | 'REPLAY' | null>(null);
  const [layerState, setLayerState] = useState<TacticalLayerState>(() => createLayerState());
  const [declutterState, setDeclutterState] = useState<DeclutterState>(() => createDeclutterState());
  const [gridState, setGridState] = useState<GridState>(() => createGridState());
  const [zones] = useState<NamedZone[]>(() => createDefaultZones());
  const [visibleZoneId, setVisibleZoneId] = useState<string | null>(null);
  const [trailState, setTrailState] = useState<TrackTrailState>(() => createTrailState());
  const trailResetStatusRef = useRef<string | null>(null);

  const { entities, setEntities, simulationControls } = useSimulation(INITIAL_ENTITIES, ownship, setOwnship, ownshipNavMode);
  const requestSimulationReset = React.useCallback(() => setSimulationProposal('RESET'), []);
  const requestSimulationReplay = React.useCallback(() => setSimulationProposal('REPLAY'), []);
  const confirmSimulationProposal = React.useCallback(() => {
    if (simulationProposal === 'RESET') simulationControls.reset();
    if (simulationProposal === 'REPLAY') simulationControls.replay();
    setSimulationProposal(null);
  }, [simulationControls, simulationProposal]);
  const cancelSimulationProposal = React.useCallback(() => setSimulationProposal(null), []);
  const localTimeZone = React.useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    [],
  );
  const groundSpeed = selectGroundSpeedInput(
    ownshipNavMode === NavMode.SIM ? 'SIM' : 'GPS',
    ownship.speed,
    navigationState.groundSpeed,
  );
  const ownshipKinematics = React.useMemo(() => {
    const isSimulation = ownshipNavMode === NavMode.SIM;
    const gpsCurrent = navigationState.validity === 'VALID';
    // Before the first GPS fix, the app still has the explicit scenario
    // ownship model. Keep its heading available as SCENARIO data for local
    // angular calculations; do not relabel it as GPS or promote its speed.
    const scenarioOwnship = isSimulation
      || (!gpsCurrent && navigationState.positionSource === 'SIM');
    const freshness = scenarioOwnship
      ? 'FRESH' as const
      : gpsCurrent
        ? 'FRESH' as const
        : navigationState.validity === 'STALE' || navigationState.validity === 'LOST'
          ? 'STALE' as const
          : 'UNKNOWN' as const;
    return createKinematicsSnapshot(ownship, {
      source: isSimulation ? 'SIMULATION' : scenarioOwnship ? 'SCENARIO' : 'GPS',
      qualification: scenarioOwnship ? 'SIMULATED' : groundSpeed ? 'MEASURED' : 'UNAVAILABLE',
      position: isSimulation ? ownship.position : navigationState.position,
      headingDegrees: scenarioOwnship
        ? ownship.heading ?? null
        : gpsCurrent ? navigationState.headingDegrees ?? null : null,
      groundSpeedKnots: isSimulation
        ? ownship.speed ?? null
        : gpsCurrent ? groundSpeed?.speedKnots ?? null : null,
      timestampMs: isSimulation
        ? simulationControls.scenarioTimeMs ?? simulationControls.simTimeMs
        : navigationState.positionUpdatedAt ?? navigationState.updatedAt,
      freshness,
      ageSeconds: scenarioOwnship || gpsCurrent ? 0 : null,
      allowMetadataVector: false,
    });
  }, [
    groundSpeed,
    navigationState,
    ownship,
    ownshipNavMode,
    simulationControls.scenarioTimeMs,
    simulationControls.simTimeMs,
  ]);
  const displayOwnship = React.useMemo(
    () => projectKinematicsToEntity(ownship, ownshipKinematics),
    [ownship, ownshipKinematics],
  );
  const displayEntities = React.useMemo(() => entities.map(entity => {
    const freshnessValue = entity.metadata?.freshness;
    const freshness = freshnessValue === 'FRESH' || freshnessValue === 'STALE' || freshnessValue === 'UNKNOWN'
      ? freshnessValue
      : undefined;
    const ageValue = entity.metadata?.ageSeconds;
    const ageSeconds = typeof ageValue === 'number' && Number.isFinite(ageValue) ? ageValue : undefined;
    return projectKinematicsToEntity(
      entity,
      createKinematicsSnapshot(entity, {
        source: 'SCENARIO',
        qualification: 'SIMULATED',
        timestampMs: simulationControls.scenarioTimeMs ?? simulationControls.simTimeMs,
        freshness,
        ageSeconds,
      }),
    );
  }), [entities, simulationControls.scenarioTimeMs, simulationControls.simTimeMs]);

  useEffect(() => {
    if (simulationControls.status === 'RESET · PAUSED' || simulationControls.status === 'REPLAY · RUNNING') {
      setActiveSimulatedRoute(undefined);
    }
  }, [simulationControls.status]);

  useEffect(() => {
    if (simulationControls.status === 'RESET · PAUSED' || simulationControls.status === 'REPLAY · RUNNING') {
      setTimerState(resetScenarioTimers);
    }
  }, [simulationControls.status]);

  useEffect(() => {
    const running = simulationControls.status === 'RUNNING' || simulationControls.status === 'REPLAY · RUNNING';
    setTimerState(previous => advanceScenarioTimers(previous, simulationControls.simTimeMs, running));
  }, [simulationControls.simTimeMs, simulationControls.status]);

  useEffect(() => {
    const status = simulationControls.status;
    if (status === 'RESET · PAUSED') {
      if (trailResetStatusRef.current !== status) {
        trailResetStatusRef.current = status;
        setTrailState(resetTrailState());
      }
      return;
    }
    if (status === 'REPLAY · RUNNING' && trailResetStatusRef.current !== status) {
      trailResetStatusRef.current = status;
      setTrailState(resetTrailState());
      return;
    }
    if (status !== 'REPLAY · RUNNING') trailResetStatusRef.current = null;
    const ownshipSource = ownshipNavMode === NavMode.SIM ? 'SIM' : navigationState.source;
    setTrailState(previous => {
      let next = previous;
      if (ownshipNavMode === NavMode.SIM || (navigationState.source === 'GPS' && navigationState.validity === 'VALID')) {
        next = appendTrailSample(previous, {
          targetId: 'OWNSHIP',
          label: ownship.label,
          position: ownship.position,
          atMs: simulationControls.simTimeMs,
          source: ownshipSource,
          accuracyMeters: navigationState.accuracyMeters,
        }).state;
      }
      for (const entity of entities) {
        next = appendTrailSample(next, {
          targetId: entity.id,
          label: entity.label,
          position: entity.position,
          atMs: simulationControls.simTimeMs,
          source: 'SIM',
        }).state;
      }
      return next;
    });
  }, [entities, navigationState.accuracyMeters, navigationState.source, navigationState.validity, ownship, ownshipNavMode, simulationControls.simTimeMs, simulationControls.status]);

  useEffect(() => {
    setActiveSimulatedRoute(previous => {
      if (!previous) return previous;
      const remainingWaypointCount = ownship.waypoints
        ? Math.min(previous.waypoints.length, ownship.waypoints.length)
        : previous.remainingWaypointCount === previous.waypoints.length
          ? previous.remainingWaypointCount
          : 0;
      return remainingWaypointCount === previous.remainingWaypointCount
        ? previous
        : { ...previous, remainingWaypointCount };
    });
  }, [ownship.waypoints]);

  const activeRouteForPalette = React.useMemo<ActiveSimulatedRoute | undefined>(() => {
    if (!activeSimulatedRoute) return undefined;
    return {
      ...activeSimulatedRoute,
      origin: { ...activeSimulatedRoute.origin },
      waypoints: activeSimulatedRoute.waypoints.map(waypoint => ({
        ...waypoint,
        position: { ...waypoint.position },
      })),
    };
  }, [activeSimulatedRoute]);

  const [mapMode, setMapMode] = useState<MapMode>(MapMode.HEADING_UP);
  const [mapModeBeforeGhost, setMapModeBeforeGhost] = useState<MapMode | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(0.05);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [designationState, setDesignationState] = useState(() => createDesignationState());
  const [bullseyeState, setBullseyeState] = useState(() => createBullseyeState());
  const [bullseyeProposal, setBullseyeProposal] = useState<BullseyeProposal | null>(null);
  const [bullseyeProjectionPreview, setBullseyeProjectionPreview] = useState<BullseyeProjectionPreview | null>(null);
  const [intersectionPreview, setIntersectionPreview] = useState<BearingIntersectionResult | null>(null);
  const [futurePositionPreview, setFuturePositionPreview] = useState<FuturePositionPreview | null>(null);
  const [contextActionResult, setContextActionResult] = useState<ContextActionResult | null>(null);
  const contextActionReturnFocusRef = useRef<HTMLElement | null>(null);
  const [timerState, setTimerState] = useState(() => createTimerState());
  const [designationListRequested, setDesignationListRequested] = useState(false);
  const projectionPreview = designationState.activePreview;
  const [mapReady, setMapReady] = useState(false);
  const [controlsReady, setControlsReady] = useState(false);
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const documentReturnFocusRef = useRef<HTMLElement | null>(null);
  const qakStabFocusReturnPendingRef = useRef(false);
  const [systems, setSystems] = useState<SystemStatus>({ radar: true, adsb: true, ais: false, eots: true });
  const lastOriginRef = useRef<{ lat: number, lon: number }>(INITIAL_OWNSHIP.position);
  const ownshipPositionRef = useRef(INITIAL_OWNSHIP.position);

  useEffect(() => {
    ownshipPositionRef.current = ownship.position;
  }, [ownship.position]);

  const [prototypeSettings, setPrototypeSettings] = useState<PrototypeSettings>({
    tapThreshold: 300,
    indicatorDelay: 250,
    longPressDuration: 1000,
    jitterTolerance: 20,
    uiScale: 1.0,
    glowIntensity: 1.0,
    animationSpeed: 300,
    mapDim: 1.0,
    hapticEnabled: true,
    ownshipPanelPos: 'BL',
    ownshipPanelScale: 1.0,
    ownshipPanelOpacity: 0.95,
    ownshipShowCoords: true,
    ownshipShowDetails: true,
    showSpeedVectors: true, // Legacy fixture compatibility; layerState.VECTORS is authoritative.
    stabAutoGndOnPan: false,
    stabFreezeHeadingDrop: true,
    stabSnapRecenter: false,
    stabRecenterOnOrientSwitch: false,
    stabAutoRecenterDelay: 0,
    stabSmoothUnfreeze: false,
    stabMaintainScreenPosOnOrient: true
  });

  const toggleSystem = (sys: keyof SystemStatus) => {
    setSystems(prev => ({ ...prev, [sys]: !prev[sys] }));
  };

  const closeCommandPalette = React.useCallback((options?: { preserveFuturePosition?: boolean }) => {
    setCommandPaletteOpen(false);
    setBullseyeProposal(null);
    setBullseyeProjectionPreview(null);
    setIntersectionPreview(null);
    if (!options?.preserveFuturePosition) setFuturePositionPreview(null);
    setDesignationState(prev => prev.phase === 'PREVIEWED'
      ? designationReducer(prev, { type: 'CANCEL_DESIGNATION' })
      : prev);
  }, []);

  const handleOpenDocument = React.useCallback((filename: string) => {
    documentReturnFocusRef.current = capturePanelReturnFocus('button[aria-label="FIND"]');
    setOpenDoc(filename);
  }, []);

  const closeDocument = React.useCallback(() => {
    setOpenDoc(null);
    restorePanelFocus(documentReturnFocusRef);
  }, []);

  const closeDirectToPanel = React.useCallback(() => {
    setDirectToPanelOpen(false);
    restorePanelFocus(directToReturnFocusRef);
  }, []);

  React.useEffect(() => {
    if (!futurePositionPreview) return undefined;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFuturePositionPreview(null);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [futurePositionPreview]);

  const previewProjection = React.useCallback((preview: ProjectionPreview) => {
    setDesignationState(prev => designationReducer(prev, {
      type: 'PREVIEW_DESIGNATION',
      preview,
    }));
  }, []);

  const previewIntersection = React.useCallback((preview: BearingIntersectionResult) => {
    setIntersectionPreview({
      ...preview,
      position: { ...preview.position },
      legs: [
        { ...preview.legs[0], position: { ...preview.legs[0].position } },
        { ...preview.legs[1], position: { ...preview.legs[1].position } },
      ],
    });
  }, []);

  const clearIntersectionPreview = React.useCallback(() => {
    setIntersectionPreview(null);
  }, []);

  const previewBullseyeProjection = React.useCallback((preview: BullseyeProjectionPreview) => {
    setBullseyeProjectionPreview({
      ...preview,
      referencePosition: { ...preview.referencePosition },
      targetPosition: { ...preview.targetPosition },
      line: [
        { ...preview.line[0] },
        { ...preview.line[1] },
      ],
    });
  }, []);

  const clearBullseyeProjectionPreview = React.useCallback(() => {
    setBullseyeProjectionPreview(null);
  }, []);

  const previewFuturePosition = React.useCallback((preview: FuturePositionPreview) => {
    setFuturePositionPreview({
      ...preview,
      result: {
        ...preview.result,
        referencePosition: { ...preview.result.referencePosition },
        targetPosition: { ...preview.result.targetPosition },
        line: [
          { ...preview.result.line[0] },
          { ...preview.result.line[1] },
        ],
      },
    });
  }, []);

  const clearFuturePositionPreview = React.useCallback(() => {
    setFuturePositionPreview(null);
  }, []);

  const createTimer = React.useCallback((durationMs: number, label: string, checkReference?: string) => {
    setTimerState(previous => addScenarioTimer(previous, {
      durationMs,
      label,
      checkReference,
    }, simulationControls.simTimeMs).state);
  }, [simulationControls.simTimeMs]);

  const cancelTimer = React.useCallback((timerId: number) => {
    setTimerState(previous => cancelScenarioTimer(previous, timerId));
  }, []);

  const proposeSetBullseye = React.useCallback((nextBullseye: BullseyeReference) => {
    setBullseyeProposal({
      type: 'SET',
      bullseye: {
        ...nextBullseye,
        position: { ...nextBullseye.position },
      },
    });
  }, []);

  const proposeClearBullseye = React.useCallback(() => {
    if (!bullseyeState.bullseye) return;
    setBullseyeProposal({
      type: 'CLEAR',
      previous: {
        ...bullseyeState.bullseye,
        position: { ...bullseyeState.bullseye.position },
      },
    });
  }, [bullseyeState.bullseye]);

  const confirmBullseyeProposal = React.useCallback(() => {
    const proposal = bullseyeProposal;
    if (!proposal) return;
    setBullseyeState(previous => proposal.type === 'SET'
      ? bullseyeReducer(previous, { type: 'SET_BULLSEYE_CONFIRMED', bullseye: proposal.bullseye })
      : bullseyeReducer(previous, { type: 'CLEAR_BULLSEYE_CONFIRMED' }));
    setBullseyeProposal(null);
    setBullseyeProjectionPreview(null);
    setCommandPaletteOpen(false);
  }, [bullseyeProposal]);

  const cancelBullseyeProposal = React.useCallback(() => {
    setBullseyeProposal(null);
  }, []);

  const confirmDesignation = React.useCallback(() => {
    setDesignationState(prev => designationReducer(prev, { type: 'CONFIRM_DESIGNATION' }));
    setCommandPaletteOpen(false);
  }, []);

  const cancelDesignation = React.useCallback(() => {
    setDesignationState(prev => designationReducer(prev, { type: 'CANCEL_DESIGNATION' }));
  }, []);

  const listDesignations = React.useCallback(() => {
    setDesignationListRequested(true);
  }, []);

  const renameDesignation = React.useCallback((designationId: string, label: string) => {
    setDesignationState(prev => designationReducer(prev, {
      type: 'RENAME_DESIGNATION',
      designationId,
      label,
    }));
  }, []);

  const deleteDesignation = React.useCallback((designationId: string) => {
    setDesignationState(prev => designationReducer(prev, {
      type: 'DELETE_DESIGNATION',
      designationId,
    }));
  }, []);

  const undoLastDesignation = React.useCallback(() => {
    setDesignationState(prev => designationReducer(prev, { type: 'UNDO_LAST_DESIGNATION' }));
  }, []);

  const proposeClearDesignations = React.useCallback(() => {
    setDesignationState(prev => designationReducer(prev, {
      type: 'PROPOSE_CLEAR_DESIGNATIONS',
    }));
  }, []);

  const confirmClearDesignations = React.useCallback(() => {
    setDesignationState(prev => designationReducer(prev, {
      type: 'CONFIRM_CLEAR_DESIGNATIONS',
    }));
    setDesignationListRequested(false);
  }, []);

  const cancelClearDesignations = React.useCallback(() => {
    setDesignationState(prev => designationReducer(prev, {
      type: 'CANCEL_CLEAR_DESIGNATIONS',
    }));
  }, []);

  const panAnimationRef = useRef<number | undefined>(undefined);
  const lastPanActivityRef = useRef<number>(Date.now());
  const headingUnfreezeRef = useRef<number | undefined>(undefined);
  const centerOnOwnshipRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const revealControls = () => {
      if (!cancelled) setControlsReady(true);
    };
    const idleHandle = idleWindow.requestIdleCallback?.(revealControls, { timeout: 750 });
    const timeoutHandle = window.setTimeout(revealControls, 750);

    return () => {
      cancelled = true;
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
      window.clearTimeout(timeoutHandle);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const revealMap = () => {
      if (!cancelled) setMapReady(true);
    };
    const idleHandle = idleWindow.requestIdleCallback?.(revealMap, { timeout: 1500 });
    const timeoutHandle = window.setTimeout(revealMap, 1500);

    return () => {
      cancelled = true;
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
      window.clearTimeout(timeoutHandle);
    };
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Toggle on Space, Backslash, or Ctrl+K
      if ((e.key === ' ' || e.key === '\\' || (e.ctrlKey && e.key === 'k')) && !commandPaletteOpen) {
        // Don't trigger if user is typing in an input
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [commandPaletteOpen]);

  useEffect(() => {
    const currentPosition = ownshipPositionRef.current;
    if (ownshipNavMode === NavMode.SIM) {
      setNavigationState(prev => markSimulationUpdate(
        prev,
        currentPosition,
        Date.now(),
        ownship.speed,
        ownship.heading,
      ));
      return;
    }

    if (!('geolocation' in navigator)) {
      setNavigationState(prev => markNavigationError(prev, 'DENIED', Date.now()));
      return;
    }

    setNavigationState(prev => markNavigationError(prev, 'ACQUIRING', Date.now()));
    lastOriginRef.current = currentPosition;
    const geolocation = createBrowserGeolocationAdapter();

    return geolocation.start(
      update => {
        const loc = update.position;
        setNavigationState(prev => markNavigationUpdate(
          prev,
          loc,
          update.timestamp,
          update.accuracyMeters,
          {
            speedMetersPerSecond: update.speedMetersPerSecond,
            headingDegrees: update.headingDegrees,
          },
        ));
        setOrigin(loc);
        setOwnship(prev => ({ ...prev, position: loc }));

        const actualDLat = loc.lat - lastOriginRef.current.lat;
        const actualDLon = loc.lon - lastOriginRef.current.lon;
        if (Math.abs(actualDLat) > 0.000001 || Math.abs(actualDLon) > 0.000001) {
          setEntities(entitiesPrev => entitiesPrev.map(e => ({
            ...e,
            position: { lat: e.position.lat + actualDLat, lon: e.position.lon + actualDLon },
            waypoints: e.waypoints?.map(wp => ({ lat: wp.lat + actualDLat, lon: wp.lon + actualDLon }))
          })));
          lastOriginRef.current = loc;
        }
      },
      error => {
        const validity = error.code === 1 ? 'DENIED' : 'LOST';
        setNavigationState(prev => markNavigationError(prev, validity, Date.now()));
      },
    );
  }, [ownship.heading, ownship.speed, ownshipNavMode, setEntities]);

  const handleManualPan = React.useCallback((newOffset: { x: number, y: number }) => {
    if (panAnimationRef.current) {
      cancelAnimationFrame(panAnimationRef.current);
      panAnimationRef.current = undefined;
    }
    setPanOffset(newOffset);
    lastPanActivityRef.current = Date.now(); // Track activity for auto-recenter
    // Note: groundAnchor remains fixed during manual panning to preserve the reference point.
  }, []);

  const issueCommand = React.useCallback((intent: CommandIntent) => {
    setCommandState(prev => dispatchCommand(prev, intent));
  }, []);

  const issueMissionAction = React.useCallback((request: MissionActionRequest) => {
    missionActionReturnFocusRef.current = capturePanelReturnFocus('button[aria-label="FIND"]');
    setMissionActionPanelOpen(true);
    setMissionActionState(prev => dispatchMissionAction(prev, { type: 'PROPOSE', request }));
  }, []);

  const dismissMissionActionPanel = React.useCallback(() => {
    setMissionActionPanelOpen(false);
    restorePanelFocus(missionActionReturnFocusRef);
  }, []);

  useEffect(() => {
    if (!missionActionPanelOpen) return undefined;
    const handleMissionActionEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      dismissMissionActionPanel();
    };
    window.addEventListener('keydown', handleMissionActionEscape);
    return () => window.removeEventListener('keydown', handleMissionActionEscape);
  }, [dismissMissionActionPanel, missionActionPanelOpen]);

  const setActiveRouteVisibility = React.useCallback((visible: boolean) => {
    setActiveSimulatedRoute(previous => previous ? { ...previous, hidden: !visible } : previous);
  }, []);

  const setTrailVisibility = React.useCallback((targetId: string, visible: boolean, label?: string) => {
    setTrailState(previous => setTrailVisibilityState(previous, targetId, visible, label));
  }, []);

  const handleMissionActionIntent = React.useCallback((intent: MissionActionIntent) => {
    setMissionActionState(prev => dispatchMissionAction(prev, intent, {
      executeSimulatedEffect: action => action.id.startsWith('command:view:route-clear:')
        ? { ok: true, detail: 'ACTIVE SIM ROUTE CLEARED' }
        : action.id.startsWith('command:view:trail-clear:')
          ? { ok: true, detail: 'TARGET TRAIL CLEARED' }
          : { ok: false, reason: 'No local simulated effect is available for this action' },
    }));
  }, []);

  useEffect(() => {
    const activeAction = missionActionState.active;
    if (activeAction?.status !== 'COMPLETED_SIM') return;
    if (activeAction.id.startsWith('command:view:route-clear:')) {
      setActiveSimulatedRoute(undefined);
      setAcceptedRouteProposalId(null);
    }
    if (activeAction.id.startsWith('command:view:trail-clear:') && activeAction.targetId) {
      setTrailState(previous => clearTrail(previous, activeAction.targetId as string));
    }
  }, [missionActionState.active]);

  const handleProposeRoute = React.useCallback((
    target: Pick<Entity, 'id' | 'label' | 'position'>,
    objective: MissionObjective = 'THREAT_PRIORITY',
  ) => {
    const createdAt = Date.now();
    const intent = {
      id: `intent:${target.id}:${objective}:${createdAt}`,
      objective,
      target: { ...target.position },
      createdAt,
    };
    const result = solveSimpleRouteProposals({
      ownshipPosition: { ...ownship.position },
      intent,
      constraints: {
        fuelAvailableUnits: 100,
        fuelReserveUnits: 20,
        fuelBurnUnitsPerNm: 1,
        returnPolicy: 'PREFERRED',
        returnTo: { ...ownship.position },
      },
      speedKnots: ownship.speed ?? 0,
      altitudeFt: ownship.altitude ?? 0,
    });
    setRouteProposalSet(result);
    setAcceptedRouteProposalId(null);
    setJustificationPair(null);
  }, [ownship.altitude, ownship.position, ownship.speed]);

  const handleAcceptRouteProposal = React.useCallback((proposal: RouteProposal) => {
    if (proposal.status === 'PROHIBITED' || proposal.waypoints.length === 0) return;
    const waypoints = proposal.waypoints.map(position => ({ ...position }));
    const routeWaypoints = waypoints.map((position, index) => {
      const matchingEntity = entities.find(entity => (
        entity.position.lat === position.lat && entity.position.lon === position.lon
      ));
      return {
        id: `${proposal.id}:waypoint:${index + 1}`,
        label: matchingEntity?.label ?? `WP${index + 1}`,
        position: { ...position },
      };
    });
    const firstWaypoint = waypoints[0];
    setOwnship(prev => ({
      ...prev,
      targetHeading: bearingBetween(
        prev.position.lat,
        prev.position.lon,
        firstWaypoint.lat,
        firstWaypoint.lon,
      ),
      waypoints,
    }));
    setActiveSimulatedRoute({
      id: proposal.id,
      label: proposal.label,
      origin: { ...ownship.position },
      waypoints: routeWaypoints,
      remainingWaypointCount: routeWaypoints.length,
      hidden: false,
    });
    setAcceptedRouteProposalId(proposal.id);
    setJustificationPair(null);
  }, [entities, ownship.position]);

  const handleRejectRouteProposals = React.useCallback(() => {
    setRouteProposalSet(null);
    setAcceptedRouteProposalId(null);
    setJustificationPair(null);
  }, []);

  const handleExplainRouteProposals = React.useCallback((preferred: RouteProposal, alternative: RouteProposal) => {
    setJustificationPair({ preferred, alternative });
  }, []);

  const handleModifyRouteIntent = React.useCallback(() => {
    setRouteProposalSet(null);
    setAcceptedRouteProposalId(null);
    setJustificationPair(null);
    setCommandPaletteOpen(true);
  }, []);

  const handleFocusMapAt = React.useCallback((position: { lat: number, lon: number }) => {
    const reference = stabMode === StabMode.GND && groundAnchor
      ? groundAnchor
      : ownship.position;
    const offset = positionToMeterOffset(reference, position);
    handleManualPan({ x: offset.eastMeters, y: offset.northMeters });
    issueCommand({ type: 'CENTER_MAP', position: { ...position }, issuedAt: Date.now() });
  }, [groundAnchor, handleManualPan, issueCommand, ownship.position, stabMode]);

  const handleProposeDirectTo = React.useCallback((target: Pick<Entity, 'id' | 'label' | 'position'>) => {
    directToReturnFocusRef.current = capturePanelReturnFocus('button[aria-label="FIND"]');
    setDirectToPanelOpen(true);
    issueCommand({
      type: 'PROPOSE_DIRECT_TO',
      targetId: target.id,
      targetLabel: target.label,
      position: { ...target.position },
      issuedAt: Date.now(),
    });
  }, [issueCommand]);

  const handleAcceptProposal = React.useCallback(() => {
    const proposal = commandState.directToProposal;
    if (!proposal || proposal.status !== 'PROPOSED') return;

    setActiveSimulatedRoute({
      id: proposal.id,
      label: `DCT ${proposal.targetLabel}`,
      origin: { ...ownship.position },
      waypoints: [{
        id: `${proposal.id}:waypoint:1`,
        label: proposal.targetLabel,
        position: { ...proposal.position },
      }],
      remainingWaypointCount: 1,
      hidden: false,
    });
    setCommandState(previous => {
      if (!previous.directToProposal || previous.directToProposal.id !== proposal.id) return previous;
      return dispatchCommand(previous, {
        type: 'ACCEPT_ROUTE_PROPOSAL',
        proposalId: proposal.id,
        authorizedAt: Date.now(),
      });
    });
  }, [commandState.directToProposal, ownship.position]);

  const handleRejectProposal = React.useCallback(() => {
    setCommandState(prev => {
      if (!prev.directToProposal) return prev;
      return dispatchCommand(prev, {
        type: 'REJECT_ROUTE_PROPOSAL',
        proposalId: prev.directToProposal.id,
        rejectedAt: Date.now(),
      });
    });
  }, []);

  useEffect(() => {
    if (!directToPanelOpen) return undefined;
    const handleDirectToEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeDirectToPanel();
    };
    window.addEventListener('keydown', handleDirectToEscape);
    return () => window.removeEventListener('keydown', handleDirectToEscape);
  }, [closeDirectToPanel, directToPanelOpen]);

  useEffect(() => {
    if (!directToPanelOpen && !missionActionPanelOpen) return undefined;
    const handleProtectedPanelOutsideEvent = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[aria-label="Direct-to route proposal status"], [aria-label="Mission action status"], [aria-label="Close direct-to route proposal"]')) return;
      if (target.closest('[data-top-system-bar], [data-testid="quick-access-keys"]')) return;
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener('pointerdown', handleProtectedPanelOutsideEvent, true);
    document.addEventListener('click', handleProtectedPanelOutsideEvent, true);
    return () => {
      document.removeEventListener('pointerdown', handleProtectedPanelOutsideEvent, true);
      document.removeEventListener('click', handleProtectedPanelOutsideEvent, true);
    };
  }, [directToPanelOpen, missionActionPanelOpen]);

  useEffect(() => {
    const route = commandState.route;
    if (!route || ownshipNavMode !== NavMode.SIM) return;

    setOwnship(prev => ({
      ...prev,
      targetHeading: bearingBetween(
        prev.position.lat,
        prev.position.lon,
        route.position.lat,
        route.position.lon,
      ),
      waypoints: [{ ...route.position }],
    }));
  }, [commandState.route, ownshipNavMode]);

  const handleSetStabMode = React.useCallback((mode: StabMode | ((prev: StabMode) => StabMode)) => {
    setStabMode(prev => {
      const next = typeof mode === 'function' ? mode(prev) : mode;
      if (next === StabMode.GND && prev !== StabMode.GND) {
        // Start the inactivity window when GND is entered, not at app mount.
        lastPanActivityRef.current = Date.now();
        // Anchor the ground position to current ownship position
        setGroundAnchor({ ...ownship.position });
        
        // Spec requirements:
        // si appui sur STAB pour passer en GND (cas où H/C se trouve sur le TPP) {=> on veut passer en logique TAC} 
        // => Le Nord passe en haut (rotation autour du centre écran)
        setMapMode(MapMode.NORTH_UP);
        setFrozenHeading(null);
      }
      if (next === StabMode.HELICO && prev === StabMode.GND) {
        // Restore orientation if we had a saved one from ghosting
        if (mapModeBeforeGhost) {
          handleMapModeChange(mapModeBeforeGhost);
          setMapModeBeforeGhost(null);
        }
      }
      return next;
    });
  }, [ownship.position, ownship.heading, mapMode, prototypeSettings.stabFreezeHeadingDrop, mapModeBeforeGhost]);

  const handleGhostEvent = React.useCallback((isGhost: boolean) => {
    if (isGhost && stabMode === StabMode.HELICO) {
      // Auto-switch to GND
      setMapModeBeforeGhost(mapMode);
      setStabMode(StabMode.GND);
      setGroundAnchor({ ...ownship.position });
      
      // si on panne et que H/C se retrouve GHOST {=> TAC}, 
      // alors la STAB passe automatiquement GND au dernier cap mémorisé (celui au moment du passage GHOST).
      if (mapMode === MapMode.HEADING_UP) {
        setFrozenHeading(ownship.heading || 0);
      }
    }
  }, [stabMode, mapMode, ownship.position, ownship.heading]);

  const handleMapModeChange = (newMode: MapMode | ((prev: MapMode) => MapMode)) => {
    setMapMode(prev => {
      const nextMode = typeof newMode === 'function' ? newMode(prev) : newMode;
      if (nextMode !== prev) {
        // Feature: Rotate panOffset to maintain helicopter screen position
        // DEPRECATED: We now rely on MapDisplay's continuous stabilization logic (getEffectivePan)
        // to handle the jump visually. This avoids double-compensation and timing issues.
        
        if (prototypeSettings.stabRecenterOnOrientSwitch && stabMode === StabMode.GND) {
          handleResetStab();
        } else if (nextMode === MapMode.HEADING_UP && stabMode === StabMode.GND && prototypeSettings.stabFreezeHeadingDrop) {
          // Fix Issue 1: Always update or initialize frozenHeading when switching to HUP in GND mode.
          // This ensures the map aligns with the current aircraft heading even if it was previously frozen at another angle.
          setFrozenHeading(ownship.heading || 0);
        }
      }
      return nextMode;
    });
  };

  const centerOnOwnship = React.useCallback(() => {
    if (panAnimationRef.current) cancelAnimationFrame(panAnimationRef.current);
    if (headingUnfreezeRef.current) cancelAnimationFrame(headingUnfreezeRef.current);

    // If we are coming from GND stab, compute the current panOffset based on the fixed groundAnchor and current ownship
    let start = { ...panOffset };
    if (stabMode === StabMode.GND && groundAnchor) {
      const offset = positionToMeterOffset(groundAnchor, ownship.position);
      start = { x: offset.eastMeters, y: offset.northMeters };
      setGroundAnchor(null);
    }

    const end = { x: 0, y: 0 };
    const duration = prototypeSettings.stabSnapRecenter ? 0 : prototypeSettings.animationSpeed;

    if (duration <= 0 || (Math.abs(start.x) < 0.1 && Math.abs(start.y) < 0.1)) {
      setPanOffset(end);
      setStabMode(StabMode.HELICO);
      setFrozenHeading(null);
      return;
    }

    // Immediately switch to HELICO so the animation runs relative to ownship
    setStabMode(StabMode.HELICO);

    // Restore orientation if we had a saved one from ghosting
    if (mapModeBeforeGhost) {
      handleMapModeChange(mapModeBeforeGhost);
      setMapModeBeforeGhost(null);
    }

    const startTime = performance.now();

    // 3B: Smooth heading unfreeze — animate frozenHeading -> null (live heading)
    if (frozenHeading !== null && prototypeSettings.stabSmoothUnfreeze) {
      const startFrozen = frozenHeading;
      const targetHeading = ownship.heading || 0;
      // shortest angular difference
      const diff = ((targetHeading - startFrozen + 180) % 360 + 360) % 360 - 180;
      const animateHeading = (time: number) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        if (progress < 1) {
          setFrozenHeading(startFrozen + diff * ease);
          headingUnfreezeRef.current = requestAnimationFrame(animateHeading);
        } else {
          setFrozenHeading(null);
        }
      };
      headingUnfreezeRef.current = requestAnimationFrame(animateHeading);
    } else {
      setFrozenHeading(null);
    }

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (isNaN(progress)) {
        setPanOffset(end);
        return;
      }

      const ease = 1 - Math.pow(1 - progress, 3);
      setPanOffset({
        x: start.x + (end.x - start.x) * ease,
        y: start.y + (end.y - start.y) * ease
      });

      if (progress < 1) {
        panAnimationRef.current = requestAnimationFrame(animate);
      }
    };
    panAnimationRef.current = requestAnimationFrame(animate);
  }, [panOffset, prototypeSettings.animationSpeed, prototypeSettings.stabSnapRecenter, prototypeSettings.stabSmoothUnfreeze, stabMode, groundAnchor, frozenHeading, ownship.position.lat, ownship.position.lon, ownship.heading]);

  // Keep the delayed timer alive while the moving ownship changes callback identity.
  centerOnOwnshipRef.current = centerOnOwnship;

  // 3A: Auto-recenter timer — fires centerOnOwnship() after idle in GND mode
  useEffect(() => {
    if (prototypeSettings.stabAutoRecenterDelay <= 0) return;
    const interval = setInterval(() => {
      if (stabMode !== StabMode.GND) return;
      const elapsed = Date.now() - lastPanActivityRef.current;
      if (elapsed >= prototypeSettings.stabAutoRecenterDelay) {
        centerOnOwnshipRef.current();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [prototypeSettings.stabAutoRecenterDelay, stabMode]);

  const handleResetStab = React.useCallback(() => {
    setFrozenHeading(null);
    handleSetStabMode(StabMode.HELICO);
    centerOnOwnship(); // This now sets stabMode to HELICO and animates
  }, [centerOnOwnship, handleSetStabMode]);

  const openStabilizationPanelFromQak = React.useCallback(() => {
    qakStabFocusReturnPendingRef.current = true;
    closeCommandPalette();
    const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="STABLN CFG"]');
    trigger?.click();
  }, [closeCommandPalette]);

  React.useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      if (!qakStabFocusReturnPendingRef.current) return;
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.getAttribute('aria-label') !== 'STABLN CFG') return;

      window.setTimeout(() => {
        if (!qakStabFocusReturnPendingRef.current
          || document.querySelector('[aria-label="Stabilisation controls"]')
          || document.activeElement !== target) return;
        qakStabFocusReturnPendingRef.current = false;
        const qak = document.querySelector<HTMLElement>('button[aria-label="STAB"]');
        qak?.focus({ preventScroll: true });
        qak?.style.setProperty('outline', '3px solid rgb(103 232 249)');
        qak?.style.setProperty('outline-offset', '2px');
      }, 0);
    };

    document.addEventListener('focusin', handleFocusIn, true);
    return () => document.removeEventListener('focusin', handleFocusIn, true);
  }, []);

  const dismissContextActionResult = React.useCallback(() => {
    setContextActionResult(null);
    restorePanelFocus(contextActionReturnFocusRef);
  }, []);

  const handleContextConsultation = React.useCallback((request: ContextActionRequest) => {
    contextActionReturnFocusRef.current = capturePanelReturnFocus('button[aria-label="FIND"]');
    const measurementActionIds = new Set<string>([
      CONTEXT_ACTION_IDS.MAP.FROM_OWNSHIP,
      CONTEXT_ACTION_IDS.WAYPOINT.BRG_RNG,
      CONTEXT_ACTION_IDS.TRACK.BRG_RNG,
      CONTEXT_ACTION_IDS.BASE.BRG_RNG,
    ]);
    const etaActionIds = new Set<string>([
      CONTEXT_ACTION_IDS.WAYPOINT.ETA_ETE,
      CONTEXT_ACTION_IDS.BASE.ETA_ETE,
    ]);
    const coordinateActionIds = new Set<string>([
      CONTEXT_ACTION_IDS.MAP.COORDINATES,
      CONTEXT_ACTION_IDS.WAYPOINT.COORDINATES,
    ]);
    const targetPosition = { ...request.position };
    const target = {
      id: request.targetId ?? 'map-center',
      label: request.targetLabel ?? 'MAP CENTER',
      position: targetPosition,
    };
    let detail: string;

    if (coordinateActionIds.has(request.actionId)) {
      detail = `POSITION ${targetPosition.lat.toFixed(5)}, ${targetPosition.lon.toFixed(5)} · CAPTURED ${request.context}`;
    } else if (measurementActionIds.has(request.actionId)) {
      const measurement = calculateTacticalMeasurement(
        {
          id: ownship.id,
          label: ownship.label,
          position: { ...ownship.position },
        },
        target,
      );
      detail = formatTacticalMeasurement(measurement, 'BRG/RNG');
    } else if (etaActionIds.has(request.actionId)) {
      const timing = calculateEtaEte(
        { ...ownship.position },
        targetPosition,
        groundSpeed,
        simulationControls.scenarioTimeMs,
      );
      const formatted = formatEtaEte(timing, localTimeZone);
      detail = `${formatted.ete} · ${formatted.etaUtc} · ${formatted.distance} · ${formatted.speed}`;
    } else {
      detail = `NO LOCAL CONSULTATION FOR ${request.actionId}`;
    }

    setContextActionResult({
      actionId: request.actionId,
      label: request.targetLabel ?? request.context,
      detail,
    });
  }, [groundSpeed, localTimeZone, ownship.id, ownship.label, ownship.position, simulationControls.scenarioTimeMs]);

  useEffect(() => {
    if (!contextActionResult) return undefined;
    const handleContextActionEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      dismissContextActionResult();
    };
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)
        || target.closest('[data-testid="context-action-result"]')) return;
      dismissContextActionResult();
      if (!target.closest('[data-top-system-bar], [data-testid="quick-access-keys"]')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleContextActionEscape);
    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
    return () => {
      window.removeEventListener('keydown', handleContextActionEscape);
      document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
    };
  }, [contextActionResult, dismissContextActionResult]);

  const handleContextFuturePosition = React.useCallback((request: ContextActionRequest) => {
    const sourceEntity = request.targetId === displayOwnship.id
      ? displayOwnship
      : displayEntities.find(entity => entity.id === request.targetId);
    if (!sourceEntity) return;

    const isOwnship = request.context === 'OWNSHIP';
    const source = isOwnship
      ? ownshipNavMode === NavMode.REAL ? 'GPS' as const : 'SIMULATION' as const
      : 'SCENARIO' as const;
    const qualification = source === 'GPS'
      ? groundSpeed ? 'MEASURED' as const : 'UNAVAILABLE' as const
      : 'SIMULATED' as const;
    const freshnessValue = sourceEntity.metadata?.freshness;
    const freshness = freshnessValue === 'FRESH' || freshnessValue === 'STALE' || freshnessValue === 'UNKNOWN'
      ? freshnessValue
      : 'FRESH' as const;
    const metadataNumber = (key: string): number | undefined => {
      const value = sourceEntity.metadata?.[key];
      return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    };
    const timestampMs = metadataNumber('lastSeenAtMs')
      ?? simulationControls.scenarioTimeMs
      ?? simulationControls.simTimeMs;
    const snapshot = createKinematicsSnapshot(sourceEntity, {
      source,
      qualification,
      position: { ...request.position },
      headingDegrees: sourceEntity.heading ?? null,
      groundSpeedKnots: sourceEntity.speed ?? null,
      timestampMs,
      freshness,
      ageSeconds: source === 'GPS' ? metadataNumber('ageSeconds') ?? null : 0,
      allowMetadataVector: false,
    });
    if (snapshot.groundTrackDegrees === null || snapshot.groundSpeedKnots === null) return;

    const result = projectFuturePosition({
      track: toFuturePositionTrack(snapshot),
      horizon: { value: 2, unit: 'MIN' },
      nowMs: simulationControls.scenarioTimeMs ?? simulationControls.simTimeMs,
    });
    if (result.status !== 'AVAILABLE') return;

    previewFuturePosition({
      type: 'FUTURE_POSITION_PREVIEW',
      trackId: request.targetId ?? sourceEntity.id,
      trackLabel: request.targetLabel ?? sourceEntity.label,
      groundTrackDegrees: snapshot.groundTrackDegrees,
      groundSpeedKnots: snapshot.groundSpeedKnots,
      result,
    });
  }, [displayEntities, displayOwnship, groundSpeed, ownshipNavMode, previewFuturePosition, simulationControls.scenarioTimeMs, simulationControls.simTimeMs]);

  const handleContextAction = React.useCallback((request: ContextActionRequest) => {
    const handlers: ContextActionHandlers = {
      focusMapAt: handleFocusMapAt,
      onResetStab: handleResetStab,
      setMapMode: handleMapModeChange,
      toggleVectors: () => {
        setLayerState(previous => {
          const update = setLayerVisibility(previous, 'VECTORS', !previous.VECTORS.visible);
          return update.status === 'AVAILABLE' ? update.state : previous;
        });
      },
      toggleGrid: () => setGridState(previous => setGridEnabled(previous, !previous.enabled)),
      toggleDeclutter: () => setDeclutterState(previous => setDeclutterPreset(
        previous.preset === 'FULL' ? 'MINIMAL' : 'FULL',
      )),
      consult: handleContextConsultation,
      toggleSimulation: () => {
        if (simulationControls.isRunning) simulationControls.pause();
        else simulationControls.resume();
      },
      setStabMode: handleSetStabMode,
      toggleTrailVisibility: (targetId, label) => {
        const trailTargetId = targetId === ownship.id ? 'OWNSHIP' : targetId;
        const visible = !(trailState.trails[trailTargetId]?.visible ?? false);
        setTrailVisibility(trailTargetId, visible, label);
      },
      requestClearTrail: (targetId, label) => {
        const trailTargetId = targetId === ownship.id ? 'OWNSHIP' : targetId;
        const issuedAt = Date.now();
        issueMissionAction({
          id: `command:view:trail-clear:${trailTargetId}:${issuedAt}`,
          label: `TRAIL CLEAR ${label}`,
          category: 'VIEW',
          targetId: trailTargetId,
          issuedAt,
          implementation: 'SIMULATED_EFFECT',
          requiresAuthorization: true,
        });
      },
      previewFuturePosition: handleContextFuturePosition,
      selectEntity: setSelectedEntityId,
      proposeDirectTo: handleProposeDirectTo,
      proposeSetBullseye: target => proposeSetBullseye(createBullseye(target)),
    };
    return dispatchContextAction(request, handlers);
  }, [
    handleContextConsultation,
    handleContextFuturePosition,
    handleFocusMapAt,
    handleMapModeChange,
    handleProposeDirectTo,
    handleResetStab,
    handleSetStabMode,
    proposeSetBullseye,
    issueMissionAction,
    ownship.id,
    setTrailVisibility,
    simulationControls,
    trailState.trails,
  ]);

  // All command entry points start from this typed application snapshot. The
  // palette adds its own history/favorite state through the factory; map drop
  // uses the same state and callbacks without reconstructing a partial bag.
  const commandContext = React.useMemo<CommandContext>(() => buildCommandContext({
    entities: displayEntities,
    ownship: displayOwnship,
    systems,
    setMapMode: handleMapModeChange,
    toggleSystem,
    focusMapAt: handleFocusMapAt,
    previewProjection,
    previewIntersection,
    previewBullseyeProjection,
    previewFuturePosition,
    proposeSetBullseye,
    proposeClearBullseye,
    bullseye: bullseyeState.bullseye,
    proposeDirectTo: handleProposeDirectTo,
    proposeRoute: handleProposeRoute,
    requestMissionAction: issueMissionAction,
    history: [],
    openDocument: handleOpenDocument,
    ownshipNavMode,
    toggleNavMode: () => setOwnshipNavMode(previous => previous === NavMode.REAL ? NavMode.SIM : NavMode.REAL),
    designations: designationState.confirmedDesignations,
    listDesignations,
    renameDesignation,
    deleteDesignation,
    proposeClearDesignations,
    undoLastDesignation,
    groundSpeed,
    scenarioTimeMs: simulationControls.scenarioTimeMs,
    localTimeZone,
    timerState,
    createTimer,
    cancelTimer,
    simulationStatus: simulationControls.status,
    simulationIsRunning: simulationControls.isRunning,
    simulationTimeMs: simulationControls.simTimeMs,
    simulationSpeed: simulationControls.speed,
    pauseSimulation: simulationControls.pause,
    resumeSimulation: simulationControls.resume,
    setSimulationSpeed: simulationControls.setSpeed,
    requestSimulationReset,
    requestSimulationReplay,
    activeRoute: activeRouteForPalette,
    setRouteVisibility: setActiveRouteVisibility,
    trails: trailState,
    setTrailVisibility,
    layers: layerState,
    setLayers: setLayerState,
    declutter: declutterState,
    setDeclutter: setDeclutterState,
    grid: gridState,
    setGrid: setGridState,
    zones,
    visibleZoneId,
    setVisibleZone: setVisibleZoneId,
  }), [
    activeRouteForPalette,
    bullseyeState.bullseye,
    cancelTimer,
    createTimer,
    declutterState,
    deleteDesignation,
    designationState.confirmedDesignations,
    displayEntities,
    displayOwnship,
    handleFocusMapAt,
    handleOpenDocument,
    groundSpeed,
    handleProposeRoute,
    handleProposeDirectTo,
    handleMapModeChange,
    gridState,
    layerState,
    listDesignations,
    localTimeZone,
    ownshipNavMode,
    previewBullseyeProjection,
    previewFuturePosition,
    previewIntersection,
    previewProjection,
    proposeClearBullseye,
    proposeClearDesignations,
    proposeSetBullseye,
    renameDesignation,
    requestSimulationReplay,
    requestSimulationReset,
    setActiveRouteVisibility,
    setTrailVisibility,
    simulationControls,
    systems,
    timerState,
    trailState,
    toggleSystem,
    undoLastDesignation,
    visibleZoneId,
    zones,
    issueMissionAction,
  ]);
  const createCommandContext = React.useMemo(
    () => createCommandContextFactory(commandContext),
    [commandContext],
  );

  const handleDropCommand = async (e: React.DragEvent) => {
    if (!mapReady) return;
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json')) as {
        type?: unknown;
        commandId?: unknown;
        query?: unknown;
        history?: unknown;
      };
      if (data.type !== 'command' || typeof data.commandId !== 'string' || typeof data.query !== 'string') return;

      const [{ getCommands }, { createMathCommandProvider }] = await Promise.all([
        import('./utils/CommandRegistry'),
        import('./utils/mathEvaluator'),
      ]);
      const context = createCommandContext({
        history: readDraggedHistory(data.history),
      });
      const commands = getCommands(data.query, context, createMathCommandProvider());
      const intent: CommandExecutionIntent = {
        commandId: data.commandId,
        query: data.query,
      };
      const executed = executeCommandIntent(commands, intent, {
        requireDragDropEligible: true,
      });
      if (!executed) return;
      if (prototypeSettings.hapticEnabled && navigator.vibrate) navigator.vibrate(50);
    } catch (err) {
      console.error('Drop failed', err);
    }
  };

  const selectedDisplayEntity = displayEntities.find(entity => entity.id === selectedEntityId) ?? null;
  const selectedSourceEntity = entities.find(entity => entity.id === selectedEntityId) ?? null;

  return (
    <div
      className="relative w-screen h-screen bg-black overflow-hidden font-sans select-none"
      data-hmi-scale-scope="pw-qak-target-panel"
      style={{ '--ui-scale': prototypeSettings.uiScale } as HmiRootStyle}
    >
      <style>{`
        [data-map-render-surface] .tactical-map.leaflet-container {
          background-color: rgba(9, 13, 18, var(--hmi-map-base-opacity));
        }
        [data-map-render-surface] .tactical-basemap-land,
        [data-map-render-surface] .tactical-coastal-detail,
        [data-map-render-surface] .tactical-airport-layer {
          opacity: var(--hmi-map-base-opacity);
        }
      `}</style>
      <div
        data-map-render-surface
        data-map-base-opacity={prototypeSettings.mapDim}
        className="absolute inset-0"
        style={{ '--hmi-map-base-opacity': prototypeSettings.mapDim } as MapRenderSurfaceStyle}
      >
        {origin && (
          mapReady ? (
            <React.Suspense
              fallback={
                <div className="flex h-full w-full items-center justify-center bg-slate-950/80 font-mono text-xs text-cyan-300" role="status">
                  LOADING SIMULATION MAP…
                </div>
              }
            >
              <MapDisplay
            ownship={displayOwnship} entities={displayEntities} systems={systems} mapMode={mapMode} zoomLevel={zoomLevel}
            onZoom={(val) => setZoomLevel(Math.min(Math.max(val, 0.0001), 5))}
            panOffset={panOffset} onPan={handleManualPan}
            selectedEntityId={selectedEntityId} onSelectEntity={setSelectedEntityId}
            origin={origin} gestureSettings={prototypeSettings}
            onMapDrop={handleDropCommand}
            stabMode={stabMode}
            setStabMode={handleSetStabMode}
            frozenHeading={frozenHeading}
            setFrozenHeading={setFrozenHeading}
            onResetStab={handleResetStab}
            setMapMode={handleMapModeChange}
            groundAnchor={groundAnchor}
            onGhostEvent={handleGhostEvent}
            onMissionAction={issueMissionAction}
            onContextAction={handleContextAction}
            projectionPreview={projectionPreview}
            intersectionPreview={intersectionPreview}
            bullseye={bullseyeState.bullseye}
            bullseyeProjectionPreview={bullseyeProjectionPreview}
            futurePositionPreview={futurePositionPreview}
            layers={layerState}
            setLayers={setLayerState}
            activeRoute={activeRouteForPalette}
            declutter={declutterState}
            grid={gridState}
            trails={trailState}
            visibleZone={zones.find(zone => zone.id === visibleZoneId) ?? null}
            confirmedDesignations={designationState.confirmedDesignations}
            showDesignationList={designationListRequested}
            onConfirmDesignation={confirmDesignation}
            onClearProjectionPreview={cancelDesignation}
            onClearIntersectionPreview={clearIntersectionPreview}
            onClearBullseyeProjectionPreview={clearBullseyeProjectionPreview}
            onClearFuturePositionPreview={clearFuturePositionPreview}
              />
            </React.Suspense>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-950/80 font-mono text-xs text-cyan-300" role="status">
              LOADING SIMULATION MAP…
            </div>
          )
        )}
      </div>

      {contextActionResult && (
        <aside
          className="pointer-events-auto fixed top-20 left-1/2 z-[105] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-cyan-400/70 bg-slate-950/95 p-3 font-mono text-xs text-slate-100 shadow-xl"
          role="status"
          aria-label="Context action result"
          aria-live="polite"
          data-testid="context-action-result"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2 text-cyan-300">
            <span>LOCAL CONSULTATION</span>
            <button
              type="button"
              className="min-h-8 min-w-8 rounded border border-slate-600 px-2 text-slate-300 hover:border-cyan-400 hover:text-white"
              aria-label="Dismiss context action result"
              onClick={dismissContextActionResult}
            >
              ×
            </button>
          </div>
          <div className="mt-2 text-white">{contextActionResult.label}</div>
          <div className="mt-1 break-words text-slate-300">{contextActionResult.detail}</div>
          <div className="mt-2 text-[10px] text-slate-500">ACTION {contextActionResult.actionId} · LOCAL DATA ONLY</div>
        </aside>
      )}

      {controlsReady && (
        <React.Suspense fallback={null}>
          <div style={{ transform: `scale(${prototypeSettings.uiScale})`, transformOrigin: 'top left' }} className="absolute inset-0 pointer-events-none">
            <LeftSidebar
              mapMode={mapMode} setMapMode={handleMapModeChange} toggleLayer={() => { }} systems={systems} toggleSystem={toggleSystem}
              isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)}
              gestureSettings={prototypeSettings} setGestureSettings={setPrototypeSettings}
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
              ownship={ownship}
              stabMode={stabMode}
              setStabMode={handleSetStabMode}
              onResetStab={handleResetStab}
              onOpenStabilizationPanel={openStabilizationPanelFromQak}
            />
          </div>
        </React.Suspense>
      )}

      {commandPaletteOpen && (
        <React.Suspense fallback={null}>
          <CommandPalette
            isOpen={commandPaletteOpen}
            onClose={closeCommandPalette}
            commandContextFactory={createCommandContext}
            focusMapAt={handleFocusMapAt}
            previewProjection={previewProjection}
            previewIntersection={previewIntersection}
            previewBullseyeProjection={previewBullseyeProjection}
            previewFuturePosition={previewFuturePosition}
            timerState={timerState}
            createTimer={createTimer}
            cancelTimer={cancelTimer}
            simulationStatus={simulationControls.status}
            simulationIsRunning={simulationControls.isRunning}
            simulationTimeMs={simulationControls.simTimeMs}
            simulationSpeed={simulationControls.speed}
            pauseSimulation={simulationControls.pause}
            resumeSimulation={simulationControls.resume}
            setSimulationSpeed={simulationControls.setSpeed}
            requestSimulationReset={requestSimulationReset}
            requestSimulationReplay={requestSimulationReplay}
            bullseye={bullseyeState.bullseye}
            proposeSetBullseye={proposeSetBullseye}
            proposeClearBullseye={proposeClearBullseye}
            designations={designationState.confirmedDesignations}
            listDesignations={listDesignations}
            renameDesignation={renameDesignation}
            deleteDesignation={deleteDesignation}
            proposeClearDesignations={proposeClearDesignations}
            undoLastDesignation={undoLastDesignation}
            proposeDirectTo={handleProposeDirectTo}
            proposeRoute={handleProposeRoute}
            requestMissionAction={issueMissionAction}
            entities={displayEntities}
            systems={systems}
            toggleSystem={toggleSystem}
            setMapMode={handleMapModeChange}
            ownship={displayOwnship}
            openDocument={handleOpenDocument}
            ownshipNavMode={ownshipNavMode}
            setOwnshipNavMode={setOwnshipNavMode}
            groundSpeed={groundSpeed}
            scenarioTimeMs={simulationControls.scenarioTimeMs}
            localTimeZone={localTimeZone}
            activeRoute={activeRouteForPalette}
            setRouteVisibility={setActiveRouteVisibility}
            trails={trailState}
            setTrailVisibility={setTrailVisibility}
            layers={layerState}
            setLayers={setLayerState}
            declutter={declutterState}
            setDeclutter={setDeclutterState}
            grid={gridState}
            setGrid={setGridState}
            zones={zones}
            visibleZoneId={visibleZoneId}
            setVisibleZone={setVisibleZoneId}
          />
        </React.Suspense>
      )}

      {simulationProposal && (
        <div
          className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Confirm simulation ${simulationProposal.toLowerCase()}`}
        >
          <div className="w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-cyan-400/70 bg-slate-950 p-5 font-mono text-sm text-slate-100 shadow-2xl">
            <div className="mb-2 text-cyan-300">CONFIRM SIM {simulationProposal}?</div>
            <p className="mb-4 text-xs text-slate-400">
              This changes the local deterministic scenario only. No real GPS position or mission action is changed.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="min-h-[36px] flex-1 rounded border border-cyan-400/70 px-3 py-2 text-cyan-300 hover:bg-cyan-400/10"
                aria-label={`Confirm simulation ${simulationProposal.toLowerCase()}`}
                onClick={confirmSimulationProposal}
              >
                CONFIRM
              </button>
              <button
                type="button"
                className="min-h-[36px] flex-1 rounded border border-slate-600 px-3 py-2 text-slate-300 hover:bg-slate-800"
                aria-label="Cancel simulation change"
                onClick={cancelSimulationProposal}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {timerState.timers.length > 0 && (
        <section
          className="fixed top-20 right-4 z-[105] w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-amber-400/70 bg-slate-950/95 p-3 font-mono text-xs text-slate-100 shadow-xl"
          role="status"
          aria-label="Scenario timers"
          data-testid="scenario-timers"
          aria-live="polite"
        >
          <div className="mb-2 border-b border-slate-800 pb-2 text-amber-300">SCENARIO TIMERS · SIMULATED</div>
          <div className="space-y-1">
            {timerState.timers.map(timer => {
              const remaining = timer.status === 'ACTIVE'
                ? formatTimerRemaining(timer.dueAtSimTimeMs - simulationControls.simTimeMs)
                : timer.status;
              return (
                <div key={timer.id} data-testid={`scenario-timer-${timer.id}`}>
                  TIMER {timer.id} · {timer.label} · {timer.status} · {remaining}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {bullseyeProposal && (
        <div
          className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={bullseyeProposal.type === 'SET' ? 'Set simulated Bullseye' : 'Clear simulated Bullseye'}
        >
          <div className="w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-cyan-400/70 bg-slate-950 p-5 font-mono text-sm text-slate-100 shadow-2xl">
            <div className="mb-2 text-cyan-300">
              {bullseyeProposal.type === 'SET' ? 'SET SIMULATED BULLSEYE?' : 'CLEAR SIMULATED BULLSEYE?'}
            </div>
            <p className="mb-4 text-xs text-slate-400">
              {bullseyeProposal.type === 'SET'
                ? bullseyeState.bullseye
                  ? `This replaces ${bullseyeState.bullseye.label} with ${bullseyeProposal.bullseye.label}.`
                  : `This sets ${bullseyeProposal.bullseye.label} as the local scenario Bullseye.`
                : `This clears ${bullseyeProposal.previous.label}. No entity, track, route, or designated point is changed.`}
              {' '}The change is simulated and requires explicit confirmation.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="min-h-[36px] flex-1 rounded border border-cyan-400/70 px-3 py-2 text-cyan-300 hover:bg-cyan-400/10"
                aria-label={bullseyeProposal.type === 'SET' ? 'Confirm set Bullseye' : 'Confirm clear Bullseye'}
                onClick={confirmBullseyeProposal}
              >
                {bullseyeProposal.type === 'SET' ? 'CONFIRM SET BULL' : 'CONFIRM CLEAR BULL'}
              </button>
              <button
                type="button"
                className="min-h-[36px] flex-1 rounded border border-slate-600 px-3 py-2 text-slate-300 hover:bg-slate-800"
                aria-label={bullseyeProposal.type === 'SET' ? 'Cancel set Bullseye' : 'Cancel clear Bullseye'}
                onClick={cancelBullseyeProposal}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {designationState.clearProposal && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Clear designated points"
        >
          <div className="w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-amber-400/70 bg-slate-950 p-5 font-mono text-sm text-slate-100 shadow-2xl">
            <div className="mb-2 text-amber-300">CLEAR DESIGNATED POINTS?</div>
            <p className="mb-4 text-xs text-slate-400">
              This removes {designationState.clearProposal.designationIds.length} simulated point(s) only.
              Entities, tracks, routes, Bullseye, and past trajectory remain unchanged.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="min-h-[36px] flex-1 rounded border border-amber-400/70 px-3 py-2 text-amber-300 hover:bg-amber-400/10"
                aria-label="Confirm clear points"
                onClick={confirmClearDesignations}
              >
                CONFIRM CLEAR POINTS
              </button>
              <button
                type="button"
                className="min-h-[36px] flex-1 rounded border border-slate-600 px-3 py-2 text-slate-300 hover:bg-slate-800"
                aria-label="Cancel clear points"
                onClick={cancelClearDesignations}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {routeProposalSet && (
        <React.Suspense fallback={null}>
          <ProposalComparisonPanel
            result={routeProposalSet}
            acceptedProposalId={acceptedRouteProposalId}
            onWhy={handleExplainRouteProposals}
            onAccept={handleAcceptRouteProposal}
            onReject={handleRejectRouteProposals}
            onModify={handleModifyRouteIntent}
          />
        </React.Suspense>
      )}

      {justificationPair && (
        <React.Suspense fallback={null}>
          <JustificationPanel
            preferred={justificationPair.preferred}
            alternative={justificationPair.alternative}
            onClose={() => setJustificationPair(null)}
          />
        </React.Suspense>
      )}

      {directToPanelOpen && commandState.directToProposal && (
        <>
          <React.Suspense fallback={null}>
            <ActionStatusPanel
              proposal={commandState.directToProposal}
              onAccept={handleAcceptProposal}
              onReject={handleRejectProposal}
            />
          </React.Suspense>
          <button
            type="button"
            aria-label="Close direct-to route proposal"
            onClick={closeDirectToPanel}
            className={`${HMI_CLASSES.activeTarget} ${HMI_CLASSES.actionText} ${HMI_CLASSES.focusRing} pointer-events-auto fixed bottom-4 right-4 z-[91] min-h-[48px] min-w-[48px] rounded border border-slate-600 bg-slate-950/95 px-3 py-2 font-mono text-xs font-bold text-slate-300 shadow-xl hover:border-cyan-400 hover:text-white`}
          >
            CLOSE DCT
          </button>
        </>
      )}

      {missionActionPanelOpen && missionActionState.active && (
        <React.Suspense fallback={null}>
          <MissionActionStatusPanel
            action={missionActionState.active}
            journal={missionActionState.journal}
            onIntent={handleMissionActionIntent}
            onDismiss={dismissMissionActionPanel}
          />
        </React.Suspense>
      )}

      {controlsReady && (
        <React.Suspense fallback={null}>
          <div style={{ transform: `scale(${prototypeSettings.uiScale})`, transformOrigin: 'top center' }} className="absolute top-0 left-0 right-0 pointer-events-none">
            <TopSystemBar
              systems={systems}
              navMode={ownshipNavMode}
              navigationState={navigationState}
              setNavMode={setOwnshipNavMode}
              ownship={ownship}
              setOwnship={setOwnship}
              gestureSettings={prototypeSettings}
              setGestureSettings={setPrototypeSettings}
              simulationControls={simulationControls}
              stabMode={stabMode}
              setStabMode={handleSetStabMode}
              mapMode={mapMode}
              setMapMode={handleMapModeChange}
              groundAnchor={groundAnchor}
              onResetStab={handleResetStab}
              layers={layerState}
              setLayers={setLayerState}
              declutter={declutterState}
              requestSimulationReset={requestSimulationReset}
              requestSimulationReplay={requestSimulationReplay}
            />
          </div>
        </React.Suspense>
      )}

      <div style={{ transformOrigin: 'bottom left' }} className="absolute inset-0 pointer-events-none">
        {origin && (
          <OwnshipPanel
            ownship={displayOwnship}
            origin={displayOwnship.position}
            prototypeSettings={prototypeSettings}
            navigationState={navigationState}
            scenarioTimeMs={simulationControls.scenarioTimeMs}
            simTimeMs={simulationControls.simTimeMs}
          />
        )}
      </div>

      <div style={{ transform: `scale(${prototypeSettings.uiScale})`, transformOrigin: 'bottom right' }} className="absolute bottom-0 right-0 pointer-events-none">
        <TargetPanel
          ownship={displayOwnship}
          entity={selectedDisplayEntity}
          trackMetadata={selectedSourceEntity?.metadata ?? null}
          animationSpeed={prototypeSettings.animationSpeed}
        />
      </div>





      {openDoc && (
        <React.Suspense fallback={null}>
          <>
            <DocumentViewer filename={openDoc} onClose={closeDocument} uiScale={prototypeSettings.uiScale} />
            <button
              type="button"
              aria-label="Close document viewer"
              onClick={closeDocument}
              className={`${HMI_CLASSES.activeTarget} ${HMI_CLASSES.actionText} ${HMI_CLASSES.focusRing} pointer-events-auto fixed right-4 top-4 z-[151] min-h-[48px] rounded border border-emerald-500/70 bg-slate-950/95 px-3 py-2 font-mono text-xs font-bold text-emerald-200 shadow-xl hover:bg-emerald-900/70`}
            >
              CLOSE DOCUMENT
            </button>
          </>
        </React.Suspense>
      )}

      <SimulationBanner buildId={BUILD_ID} />
      <UpdateAvailableBanner />

      {/* Global vignette shadow removed */}
    </div>
  );
};

export default App;
