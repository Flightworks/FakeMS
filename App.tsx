
import React, { useState, useEffect, useRef } from 'react';
import { Compass, Crosshair } from 'lucide-react';
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
  const [groundCenter, setGroundCenter] = useState<{lat: number, lon: number} | null>(null);

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
    stabRecenterOnOrientSwitch: false
  });

  const toggleSystem = (sys: keyof SystemStatus) => {
    setSystems(prev => ({ ...prev, [sys]: !prev[sys] }));
  };

  const panAnimationRef = useRef<number | undefined>(undefined);

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
    if (newCenterLatLon) {
      setGroundCenter(newCenterLatLon);
    }
  }, []);

  const handleMapModeChange = (newMode: MapMode | ((prev: MapMode) => MapMode)) => {
    setMapMode(prev => {
       const nextMode = typeof newMode === 'function' ? newMode(prev) : newMode;
       if (nextMode !== prev && prototypeSettings.stabRecenterOnOrientSwitch && stabMode === StabMode.GND) {
          handleResetStab();
       }
       return nextMode;
    });
  };

  const centerOnOwnship = React.useCallback(() => {
    // console.log('App: centerOnOwnship Triggered');
    if (panAnimationRef.current) cancelAnimationFrame(panAnimationRef.current);

    // If we are coming from GND stab, compute the current panOffset based on the fixed groundCenter and current ownship
    let start = { ...panOffset };
    if (stabMode === StabMode.GND && groundCenter) {
      const dLat = groundCenter.lat - ownship.position.lat;
      const dLon = groundCenter.lon - ownship.position.lon;
      const panY = dLat * (Math.PI / 180) * 6378137;
      const panX = dLon * (Math.PI / 180) * (6378137 * Math.cos(ownship.position.lat * Math.PI / 180));
      start = { x: panX, y: panY };
    }

    const end = { x: 0, y: 0 };
    const duration = prototypeSettings.stabSnapRecenter ? 0 : prototypeSettings.animationSpeed;

    if (duration <= 0 || (Math.abs(start.x) < 0.1 && Math.abs(start.y) < 0.1)) {
      setPanOffset(end);
      setStabMode(StabMode.HELICO);
      return;
    }

    // Immediately switch to HELICO so the animation runs relative to ownship
    setStabMode(StabMode.HELICO);

    const startTime = performance.now();
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
  }, [panOffset, prototypeSettings.animationSpeed, stabMode, groundCenter, ownship.position.lat, ownship.position.lon]);

  useEffect(() => {
    centerOnOwnship();
  }, [mapMode]);

  const handleResetStab = React.useCallback(() => {
    setFrozenHeading(null);
    centerOnOwnship(); // This now sets stabMode to HELICO and animates
  }, [centerOnOwnship]);

  const handleDropCommand = (e: React.DragEvent) => {
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data && data.type === 'command' && data.query) {
        const context: CommandContext = {
          entities,
          ownship,
          systems,
          history: [], // Stub history 
          setMapMode,
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
            setStabMode={setStabMode}
            frozenHeading={frozenHeading}
            setFrozenHeading={setFrozenHeading}
            onResetStab={handleResetStab}
            setMapMode={handleMapModeChange}
            groundCenter={groundCenter}
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
          setStabMode={setStabMode}
          onResetStab={handleResetStab}
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
        <TopSystemBar systems={systems} navMode={ownshipNavMode} setNavMode={setOwnshipNavMode} ownship={ownship} setOwnship={setOwnship} />
      </div>

      <div style={{ transformOrigin: 'bottom left' }} className="absolute inset-0 pointer-events-none">
        {origin && <OwnshipPanel ownship={ownship} origin={origin} prototypeSettings={prototypeSettings} />}
      </div>

      <div style={{ transform: `scale(${prototypeSettings.uiScale})`, transformOrigin: 'bottom right' }} className="absolute bottom-0 right-0 pointer-events-none">
        <TargetPanel ownship={ownship} entity={entities.find(e => e.id === selectedEntityId) || null} animationSpeed={prototypeSettings.animationSpeed} />
      </div>

      <div style={{ transform: `scale(${prototypeSettings.uiScale})`, transformOrigin: 'bottom right' }} className="absolute bottom-[200px] right-6 flex flex-col items-center gap-4 pointer-events-none z-50">
        <div 
          className="w-16 h-16 rounded-full bg-slate-900/80 border-2 border-slate-700 shadow-xl flex items-center justify-center pointer-events-auto cursor-pointer active:scale-95 transition-transform"
          onClick={() => handleMapModeChange(m => m === MapMode.NORTH_UP ? MapMode.HEADING_UP : MapMode.NORTH_UP)}
        >
          <div 
            style={{ 
              transform: `rotate(${mapMode === MapMode.HEADING_UP ? ((stabMode === StabMode.GND && frozenHeading !== null) ? frozenHeading : ownship.heading || 0) : 0}deg)`,
              transition: 'transform 0.1s linear'
            }}
            className="flex flex-col items-center mt-2"
          >
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[12px] border-l-transparent border-r-transparent border-b-red-500 mb-1" />
            <Compass size={24} className="text-slate-400" />
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[12px] border-l-transparent border-r-transparent border-t-white mt-1" />
          </div>
        </div>

        {stabMode === StabMode.GND && (
          <button 
            onClick={handleResetStab}
            className="w-12 h-12 rounded-full bg-emerald-900/80 border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center pointer-events-auto active:scale-95 transition-transform"
          >
            <Crosshair size={24} className="text-emerald-300" />
          </button>
        )}
      </div>



      {openDoc && (
        <DocumentViewer filename={openDoc} onClose={() => setOpenDoc(null)} uiScale={prototypeSettings.uiScale} />
      )}

      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.9)] z-40"></div>
    </div>
  );
};

export default App;
