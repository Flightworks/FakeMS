
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
import { Entity, EntityType, MapMode, SystemStatus, PrototypeSettings, StabMode, NavMode } from './types';
import { createNavigationState, markNavigationError, markNavigationUpdate, OwnshipNavigationState } from './domain/navigation';
import { createBrowserGeolocationAdapter } from './adapters/geolocation';
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
import { resolveCommandIntent, type CommandIntent as CommandExecutionIntent } from './application/commandExecutor';
import { useSimulation } from './utils/useSimulation';
import {
  addScenarioTimer,
  advanceScenarioTimers,
  cancelScenarioTimer,
  createTimerState,
  resetScenarioTimers,
} from './domain/simulationTimers';

const DEFAULT_ORIGIN = { lat: 34.0522, lon: -118.2437 };
const BUILD_ID = import.meta.env.VITE_BUILD_ID || 'local';

const formatTimerRemaining = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
  { id: 'wp-1', type: EntityType.WAYPOINT, position: { lat: 34.1, lon: -118.2 }, label: 'G01' },
  { id: 'wp-2', type: EntityType.WAYPOINT, position: { lat: 34.08, lon: -118.15 }, label: 'BRAVO', metadata: { groundTrackDegrees: 180, groundSpeedKnots: 60, freshness: 'FRESH', ageSeconds: 4 } },
  { id: 'apt-1', type: EntityType.AIRPORT, position: { lat: 33.94, lon: -118.40 }, label: 'BASE' },
  { id: 'en-1', type: EntityType.ENEMY, position: { lat: 34.07, lon: -118.10 }, label: 'HOSTILE 1', heading: 270, targetHeading: 270, speed: 60, targetSpeed: 60, turnRate: 3, metadata: { groundTrackDegrees: 270, groundSpeedKnots: 60, freshness: 'FRESH', ageSeconds: 4, source: 'RADAR', quality: 'GOOD', uncertaintyMeters: 40, classification: 'HOSTILE', confidence: 0.9 } },
  // Adding Waypoint routine to ENEMY 2 to test automatic navigation
  { id: 'en-2', type: EntityType.ENEMY, position: { lat: 34.02, lon: -118.12 }, label: 'HOSTILE 2', heading: 320, targetHeading: 320, speed: 180, targetSpeed: 180, turnRate: 5, waypoints: [{ lat: 34.1, lon: -118.2 }, { lat: 34.08, lon: -118.15 }], metadata: { freshness: 'STALE', ageSeconds: 90, source: 'RADAR', quality: 'DEGRADED', uncertaintyMeters: 250, classification: 'HOSTILE', confidence: 0.8 } },
];

type BullseyeProposal =
  | { type: 'SET'; bullseye: BullseyeReference }
  | { type: 'CLEAR'; previous: BullseyeReference };

const App: React.FC = () => {
  const [origin, setOrigin] = useState<{ lat: number, lon: number } | null>(DEFAULT_ORIGIN);
  const [ownship, setOwnship] = useState<Entity>(INITIAL_OWNSHIP);

  const [ownshipNavMode, setOwnshipNavMode] = useState<NavMode>(NavMode.REAL);
  const [navigationState, setNavigationState] = useState<OwnshipNavigationState>(() => createNavigationState(INITIAL_OWNSHIP.position));
  const [commandState, setCommandState] = useState<CommandState>(() => createCommandState());
  const [missionActionState, setMissionActionState] = useState(() => createMissionActionState());
  const [missionActionPanelOpen, setMissionActionPanelOpen] = useState(false);
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
  const simulationGroundSpeed = ownshipNavMode === NavMode.SIM
    ? {
        speedKnots: ownship.speed,
        source: 'SIMULATION' as const,
        qualification: 'SIMULATED' as const,
      }
    : undefined;

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
  const [timerState, setTimerState] = useState(() => createTimerState());
  const [designationListRequested, setDesignationListRequested] = useState(false);
  const projectionPreview = designationState.activePreview;
  const [mapReady, setMapReady] = useState(false);
  const [controlsReady, setControlsReady] = useState(false);
  const [openDoc, setOpenDoc] = useState<string | null>(null);
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
    showSpeedVectors: true,
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
      setNavigationState(prev => ({
        ...prev,
        source: 'SIM',
        validity: 'SIMULATED',
        position: currentPosition,
        updatedAt: Date.now(),
        accuracyMeters: undefined,
      }));
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
  }, [ownshipNavMode, setEntities]);

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
    setMissionActionPanelOpen(true);
    setMissionActionState(prev => dispatchMissionAction(prev, { type: 'PROPOSE', request }));
  }, []);

  const dismissMissionActionPanel = React.useCallback(() => {
    setMissionActionPanelOpen(false);
  }, []);

  const handleMissionActionIntent = React.useCallback((intent: MissionActionIntent) => {
    setMissionActionState(prev => dispatchMissionAction(prev, intent));
  }, []);

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

  // 3A: Auto-recenter timer — fires centerOnOwnship() after idle in GND mode
  useEffect(() => {
    if (prototypeSettings.stabAutoRecenterDelay <= 0) return;
    const interval = setInterval(() => {
      if (stabMode !== StabMode.GND) return;
      const elapsed = Date.now() - lastPanActivityRef.current;
      if (elapsed >= prototypeSettings.stabAutoRecenterDelay) {
        centerOnOwnship();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [prototypeSettings.stabAutoRecenterDelay, stabMode, centerOnOwnship]);

  const handleResetStab = React.useCallback(() => {
    setFrozenHeading(null);
    handleSetStabMode(StabMode.HELICO);
    centerOnOwnship(); // This now sets stabMode to HELICO and animates
  }, [centerOnOwnship, handleSetStabMode]);

  const handleDropCommand = async (e: React.DragEvent) => {
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json')) as {
        type?: unknown;
        commandId?: unknown;
        query?: unknown;
      };
      if (data.type !== 'command' || typeof data.commandId !== 'string' || typeof data.query !== 'string') return;

      const [{ getCommands }, { createMathCommandProvider }] = await Promise.all([
        import('./utils/CommandRegistry'),
        import('./utils/mathEvaluator'),
      ]);
      const context: CommandContext = {
        entities,
        ownship,
        systems,
        history: [], // Stub history
        setMapMode: handleMapModeChange,
        toggleSystem,
        focusMapAt: handleFocusMapAt,
        previewProjection,
        previewIntersection,
        previewBullseyeProjection,
        previewFuturePosition,
        bullseye: bullseyeState.bullseye,
        proposeSetBullseye,
        proposeClearBullseye,
        proposeDirectTo: handleProposeDirectTo,
        proposeRoute: handleProposeRoute,
        requestMissionAction: issueMissionAction,
        designations: designationState.confirmedDesignations,
        listDesignations,
        renameDesignation,
        deleteDesignation,
        proposeClearDesignations,
        undoLastDesignation,
        openDocument: setOpenDoc,
        ownshipNavMode,
        toggleNavMode: () => setOwnshipNavMode(prev => prev === NavMode.REAL ? NavMode.SIM : NavMode.REAL),
      };

      const commands = getCommands(data.query, context, createMathCommandProvider());
      const intent: CommandExecutionIntent = {
        commandId: data.commandId,
        query: data.query,
      };
      const matched = resolveCommandIntent(commands, intent);
      if (!matched) return;

      matched.action?.();
      if (prototypeSettings.hapticEnabled && navigator.vibrate) navigator.vibrate(50);
    } catch (err) {
      console.error('Drop failed', err);
    }
  };

  return (
    <div
      className="relative w-screen h-screen bg-black overflow-hidden font-sans select-none"
      style={{ '--ui-scale': prototypeSettings.uiScale } as any}
    >
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{ opacity: prototypeSettings.mapDim }}
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
            ownship={ownship} entities={entities} systems={systems} mapMode={mapMode} zoomLevel={zoomLevel}
            onZoom={(val) => setZoomLevel(Math.min(Math.max(val, 0.0001), 5))}
            panOffset={panOffset} onPan={handleManualPan}
            selectedEntityId={selectedEntityId} onSelectEntity={setSelectedEntityId}
            origin={origin} gestureSettings={prototypeSettings}
            setGestureSettings={setPrototypeSettings}
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
            projectionPreview={projectionPreview}
            intersectionPreview={intersectionPreview}
            bullseye={bullseyeState.bullseye}
            bullseyeProjectionPreview={bullseyeProjectionPreview}
            futurePositionPreview={futurePositionPreview}
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
            />
          </div>
        </React.Suspense>
      )}

      {commandPaletteOpen && (
        <React.Suspense fallback={null}>
          <CommandPalette
            isOpen={commandPaletteOpen}
            onClose={closeCommandPalette}
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
            entities={entities}
            systems={systems}
            toggleSystem={toggleSystem}
            setMapMode={handleMapModeChange}
            ownship={ownship}
            openDocument={setOpenDoc}
            ownshipNavMode={ownshipNavMode}
            setOwnshipNavMode={setOwnshipNavMode}
            groundSpeed={simulationGroundSpeed}
            scenarioTimeMs={simulationControls.simTimeMs}
            localTimeZone={localTimeZone}
            activeRoute={activeRouteForPalette}
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

      {commandState.directToProposal && (
        <React.Suspense fallback={null}>
          <ActionStatusPanel
            proposal={commandState.directToProposal}
            onAccept={handleAcceptProposal}
            onReject={handleRejectProposal}
          />
        </React.Suspense>
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
            />
          </div>
        </React.Suspense>
      )}

      <div style={{ transformOrigin: 'bottom left' }} className="absolute inset-0 pointer-events-none">
        {origin && <OwnshipPanel ownship={ownship} origin={origin} prototypeSettings={prototypeSettings} />}
      </div>

      <div style={{ transform: `scale(${prototypeSettings.uiScale})`, transformOrigin: 'bottom right' }} className="absolute bottom-0 right-0 pointer-events-none">
        <TargetPanel ownship={ownship} entity={entities.find(e => e.id === selectedEntityId) || null} animationSpeed={prototypeSettings.animationSpeed} />
      </div>





      {openDoc && (
        <React.Suspense fallback={null}>
          <DocumentViewer filename={openDoc} onClose={() => setOpenDoc(null)} uiScale={prototypeSettings.uiScale} />
        </React.Suspense>
      )}

      <SimulationBanner buildId={BUILD_ID} />
      <UpdateAvailableBanner />

      {/* Global vignette shadow removed */}
    </div>
  );
};

export default App;
