
import React, { useState, useEffect, useRef } from 'react';

import { MapDisplay } from './components/MapDisplay';
import { TopSystemBar } from './components/TopSystemBar';
import { LeftSidebar } from './components/LeftSidebar';
import { CommandPalette } from './components/CommandPalette';
import { DocumentViewer } from './components/DocumentViewer';
import { OwnshipPanel, TargetPanel } from './components/InfoPanels';
import { Entity, EntityType, MapMode, SystemStatus, PrototypeSettings, StabMode, NavMode } from './types';
import { getCommands, CommandContext } from './utils/CommandRegistry';
import { useSimulation } from './utils/useSimulation';

const DEFAULT_ORIGIN = { lat: 34.0522, lon: -118.2437 };

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
  const [origin, setOrigin] = useState<{ lat: number, lon: number } | null>(null);
  const [ownship, setOwnship] = useState<Entity>(INITIAL_OWNSHIP);

  const [ownshipNavMode, setOwnshipNavMode] = useState<NavMode>(NavMode.REAL);
  const [stabMode, setStabMode] = useState<StabMode>(StabMode.HELICO);
  const [frozenHeading, setFrozenHeading] = useState<number | null>(null);
  const [groundAnchor, setGroundAnchor] = useState<{ lat: number, lon: number } | null>(null);

  const { entities, setEntities } = useSimulation(INITIAL_ENTITIES, ownship, setOwnship, ownshipNavMode);

  const [mapMode, setMapMode] = useState<MapMode>(MapMode.HEADING_UP);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(0.05);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const [systems, setSystems] = useState<SystemStatus>({ radar: true, adsb: true, ais: false, eots: true });
  const lastOriginRef = useRef<{ lat: number, lon: number }>(INITIAL_OWNSHIP.position);

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

  const navModeRef = useRef(ownshipNavMode);
  useEffect(() => { navModeRef.current = ownshipNavMode; }, [ownshipNavMode]);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (navModeRef.current === NavMode.SIM) return;
          const loc = { lat: position.coords.latitude, lon: position.coords.longitude };
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
        () => {
          setOrigin(DEFAULT_ORIGIN);
          setOwnship(prev => ({ ...prev, position: DEFAULT_ORIGIN }));
        },
        { enableHighAccuracy: true }
      );
    } else {
      setOrigin(DEFAULT_ORIGIN);
      setOwnship(prev => ({ ...prev, position: DEFAULT_ORIGIN }));
    }
  }, []);

  const handleManualPan = React.useCallback((newOffset: { x: number, y: number }, newCenterLatLon?: { lat: number, lon: number }) => {
    // console.log('App: handleManualPan', newOffset);
    if (panAnimationRef.current) {
      cancelAnimationFrame(panAnimationRef.current);
      panAnimationRef.current = undefined;
    }
    setPanOffset(newOffset);
    lastPanActivityRef.current = Date.now(); // Track activity for auto-recenter
    // Note: groundAnchor remains fixed during manual panning to preserve the reference point.
  }, []);

  const handleSetStabMode = React.useCallback((mode: StabMode | ((prev: StabMode) => StabMode)) => {
    setStabMode(prev => {
      const next = typeof mode === 'function' ? mode(prev) : mode;
      if (next === StabMode.GND && prev !== StabMode.GND) {
        // Anchor the ground position to current ownship position
        setGroundAnchor({ ...ownship.position });
        // Centralized: freeze heading if option is enabled
        if (mapMode === MapMode.HEADING_UP && prototypeSettings.stabFreezeHeadingDrop) {
          setFrozenHeading(ownship.heading || 0);
        }
      }
      return next;
    });
  }, [ownship.position, ownship.heading, mapMode, prototypeSettings.stabFreezeHeadingDrop, setFrozenHeading]);

  const handleMapModeChange = (newMode: MapMode | ((prev: MapMode) => MapMode)) => {
    setMapMode(prev => {
      const nextMode = typeof newMode === 'function' ? newMode(prev) : newMode;
      if (nextMode !== prev) {
        // Feature: Rotate panOffset to maintain helicopter screen position
        if (prototypeSettings.stabMaintainScreenPosOnOrient) {
          const prevRot = prev === MapMode.HEADING_UP 
            ? -((stabMode === StabMode.GND && frozenHeading !== null) ? frozenHeading : (ownship.heading || 0)) 
            : 0;
          const nextRot = nextMode === MapMode.HEADING_UP 
            ? -((stabMode === StabMode.GND && frozenHeading !== null) ? frozenHeading : (ownship.heading || 0)) 
            : 0;
          const deltaDeg = nextRot - prevRot;
          
          if (Math.abs(deltaDeg) > 0.01 && stabMode === StabMode.HELICO) {
            // HELICO mode: Rotate panOffset to keep ownship fixed on screen
            const rad = -(deltaDeg) * (Math.PI / 180);
            const cosR = Math.cos(rad);
            const sinR = Math.sin(rad);
            setPanOffset(prevPan => ({
              x: prevPan.x * cosR - prevPan.y * sinR,
              y: prevPan.x * sinR + prevPan.y * cosR
            }));
          }
          // In GND mode, we do nothing to panOffset, so it naturally rotates around center
        }

        if (prototypeSettings.stabRecenterOnOrientSwitch && stabMode === StabMode.GND) {
          handleResetStab();
        } else if (nextMode === MapMode.HEADING_UP && stabMode === StabMode.GND && frozenHeading === null && prototypeSettings.stabFreezeHeadingDrop) {
          // If switching to HUP in GND and we don't recenter, at least lock the rotation if setting is on
          setFrozenHeading(ownship.heading || 0);
        }
      }
      return nextMode;
    });
  };

  const centerOnOwnship = React.useCallback(() => {
    // console.log('App: centerOnOwnship Triggered');
    if (panAnimationRef.current) cancelAnimationFrame(panAnimationRef.current);
    if (headingUnfreezeRef.current) cancelAnimationFrame(headingUnfreezeRef.current);

    // If we are coming from GND stab, compute the current panOffset based on the fixed groundAnchor and current ownship
    let start = { ...panOffset };
    if (stabMode === StabMode.GND && groundAnchor) {
      const dLat = groundAnchor.lat - ownship.position.lat;
      const dLon = groundAnchor.lon - ownship.position.lon;
      const panY = dLat * (Math.PI / 180) * 6378137;
      const panX = dLon * (Math.PI / 180) * (6378137 * Math.cos(ownship.position.lat * Math.PI / 180));
      start = { x: panX, y: panY };
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

    const startTime = performance.now();

    // 3B: Smooth heading unfreeze — animate frozenHeading -> null (live heading)
    if (frozenHeading !== null && prototypeSettings.stabSmoothUnfreeze) {
      const startFrozen = frozenHeading;
      const targetHeading = ownship.heading || 0;
      // shortest angular difference
      let diff = ((targetHeading - startFrozen + 180) % 360 + 360) % 360 - 180;
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
          panTo: (lat, lon) => {
            // Drop command might pass coords or x/y offset, 
            // for now fallback to standard panning via offset
            handleManualPan({ x: lat, y: lon })
          },
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
        />
      </div>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onPan={handleManualPan}
        entities={entities}
        systems={systems}
        toggleSystem={toggleSystem}
        mapMode={mapMode}
        setMapMode={handleMapModeChange}
        ownship={ownship}
        origin={origin || DEFAULT_ORIGIN}
        openDocument={setOpenDoc}
        ownshipNavMode={ownshipNavMode}
        setOwnshipNavMode={setOwnshipNavMode}
      />

      <div style={{ transform: `scale(${prototypeSettings.uiScale})`, transformOrigin: 'top center' }} className="absolute top-0 left-0 right-0 pointer-events-none">
        <TopSystemBar
          systems={systems}
          navMode={ownshipNavMode}
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

      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.9)] z-40"></div>
    </div>
  );
};

export default App;
