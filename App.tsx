
import React, { useState, useEffect, useRef } from 'react';

import { MapDisplay } from './components/MapDisplay';
import { TopSystemBar } from './components/TopSystemBar';
import { LeftSidebar } from './components/LeftSidebar';
import { CommandPalette } from './components/CommandPalette';
import { DocumentViewer } from './components/DocumentViewer';
import { OwnshipPanel, TargetPanel } from './components/InfoPanels';
import { SimulationBanner } from './components/SimulationBanner';
import { ActionStatusPanel } from './components/ActionStatusPanel';
import { MissionActionStatusPanel } from './components/MissionActionStatusPanel';
import { ProposalComparisonPanel } from './components/ProposalComparisonPanel';
import { JustificationPanel } from './components/JustificationPanel';
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
import type { MissionObjective } from './domain/intent';
import type { RouteProposal, RouteProposalSet } from './domain/proposals';
import { solveSimpleRouteProposals } from './simulation/simpleRouteSolver';
import { getCommands, CommandContext } from './utils/CommandRegistry';
import { useSimulation } from './utils/useSimulation';

const DEFAULT_ORIGIN = { lat: 34.0522, lon: -118.2437 };
const BUILD_ID = import.meta.env.VITE_BUILD_ID || 'local';

const INITIAL_OWNSHIP: Entity = {
  id: 'ownship',
  type: EntityType.OWNSHIP,
  position: { lat: DEFAULT_ORIGIN.lat, lon: DEFAULT_ORIGIN.lon },
  label: 'VIPER 1-1',
  heading: 0,
  speed: 120, // Default speed in knots for ETA calculations
  altitude: 3428
};

// Seeding test entities with Lat/Lon Native coordinates
const INITIAL_ENTITIES: Entity[] = [
  { id: 'wp-1', type: EntityType.WAYPOINT, position: { lat: 34.1, lon: -118.2 }, label: 'G01' },
  { id: 'wp-2', type: EntityType.WAYPOINT, position: { lat: 34.08, lon: -118.15 }, label: 'BRAVO' },
  { id: 'apt-1', type: EntityType.AIRPORT, position: { lat: 33.94, lon: -118.40 }, label: 'BASE' },
  { id: 'en-1', type: EntityType.ENEMY, position: { lat: 34.07, lon: -118.10 }, label: 'HOSTILE 1', heading: 270, targetHeading: 270, speed: 60, targetSpeed: 60, turnRate: 3 },
  // Adding Waypoint routine to ENEMY 2 to test automatic navigation
  { id: 'en-2', type: EntityType.ENEMY, position: { lat: 34.02, lon: -118.12 }, label: 'HOSTILE 2', heading: 320, targetHeading: 320, speed: 180, targetSpeed: 180, turnRate: 5, waypoints: [{ lat: 34.1, lon: -118.2 }, { lat: 34.08, lon: -118.15 }] },
];

const App: React.FC = () => {
  const [origin, setOrigin] = useState<{ lat: number, lon: number } | null>(DEFAULT_ORIGIN);
  const [ownship, setOwnship] = useState<Entity>(INITIAL_OWNSHIP);

  const [ownshipNavMode, setOwnshipNavMode] = useState<NavMode>(NavMode.SIM);
  const [navigationState, setNavigationState] = useState<OwnshipNavigationState>(() => createNavigationState(INITIAL_OWNSHIP.position));
  const [commandState, setCommandState] = useState<CommandState>(() => createCommandState());
  const [missionActionState, setMissionActionState] = useState(() => createMissionActionState());
  const [routeProposalSet, setRouteProposalSet] = useState<RouteProposalSet | null>(null);
  const [acceptedRouteProposalId, setAcceptedRouteProposalId] = useState<string | null>(null);
  const [justificationPair, setJustificationPair] = useState<{
    preferred: RouteProposal;
    alternative: RouteProposal;
  } | null>(null);
  const [stabMode, setStabMode] = useState<StabMode>(StabMode.HELICO);
  const [frozenHeading, setFrozenHeading] = useState<number | null>(null);
  const [groundAnchor, setGroundAnchor] = useState<{ lat: number, lon: number } | null>(null);

  const { entities, setEntities } = useSimulation(INITIAL_ENTITIES, ownship, setOwnship, ownshipNavMode);

  const [mapMode, setMapMode] = useState<MapMode>(MapMode.HEADING_UP);
  const [mapModeBeforeGhost, setMapModeBeforeGhost] = useState<MapMode | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(0.05);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
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

  const panAnimationRef = useRef<number | undefined>(undefined);
  const lastPanActivityRef = useRef<number>(Date.now());
  const headingUnfreezeRef = useRef<number | undefined>(undefined);

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
    setMissionActionState(prev => dispatchMissionAction(prev, { type: 'PROPOSE', request }));
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
    setAcceptedRouteProposalId(proposal.id);
    setJustificationPair(null);
  }, []);

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
    setCommandState(prev => {
      if (!prev.directToProposal) return prev;
      return dispatchCommand(prev, {
        type: 'ACCEPT_ROUTE_PROPOSAL',
        proposalId: prev.directToProposal.id,
        authorizedAt: Date.now(),
      });
    });
  }, []);

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

  const handleDropCommand = (e: React.DragEvent) => {
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data && data.type === 'command' && data.query) {
        const context: CommandContext = {
          entities,
          ownship,
          systems,
          history: [], // Stub history 
          setMapMode: handleMapModeChange,
          toggleSystem,
          focusMapAt: handleFocusMapAt,
          proposeDirectTo: handleProposeDirectTo,
          proposeRoute: handleProposeRoute,
          requestMissionAction: issueMissionAction,
          openDocument: setOpenDoc,
          ownshipNavMode,
          toggleNavMode: () => setOwnshipNavMode(prev => prev === NavMode.REAL ? NavMode.SIM : NavMode.REAL)
        };

        const cmds = getCommands(data.query, context);
        const matched = cmds.find(c => c.id === data.id) || cmds[0];

        if (matched) {
          matched.action();
          // Feedback?
          if (prototypeSettings.hapticEnabled && navigator.vibrate) navigator.vibrate(50);
        }
      }
    } catch (err) {
      console.error("Drop failed", err);
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
          />
        )}
      </div>

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

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        focusMapAt={handleFocusMapAt}
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
      />

      <ProposalComparisonPanel
        result={routeProposalSet}
        acceptedProposalId={acceptedRouteProposalId}
        onWhy={handleExplainRouteProposals}
        onAccept={handleAcceptRouteProposal}
        onReject={handleRejectRouteProposals}
        onModify={handleModifyRouteIntent}
      />

      <JustificationPanel
        preferred={justificationPair?.preferred ?? null}
        alternative={justificationPair?.alternative ?? null}
        onClose={() => setJustificationPair(null)}
      />

      <ActionStatusPanel
        proposal={commandState.directToProposal}
        onAccept={handleAcceptProposal}
        onReject={handleRejectProposal}
      />

      <MissionActionStatusPanel
        action={missionActionState.active}
        journal={missionActionState.journal}
        onIntent={handleMissionActionIntent}
      />

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
        />
      </div>

      <div style={{ transformOrigin: 'bottom left' }} className="absolute inset-0 pointer-events-none">
        {origin && <OwnshipPanel ownship={ownship} origin={origin} prototypeSettings={prototypeSettings} />}
      </div>

      <div style={{ transform: `scale(${prototypeSettings.uiScale})`, transformOrigin: 'bottom right' }} className="absolute bottom-0 right-0 pointer-events-none">
        <TargetPanel ownship={ownship} entity={entities.find(e => e.id === selectedEntityId) || null} animationSpeed={prototypeSettings.animationSpeed} />
      </div>





      {openDoc && (
        <DocumentViewer filename={openDoc} onClose={() => setOpenDoc(null)} uiScale={prototypeSettings.uiScale} />
      )}

      <SimulationBanner buildId={BUILD_ID} />

      {/* Global vignette shadow removed */}
    </div>
  );
};

export default App;
