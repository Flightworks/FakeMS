
import React, { useState, useEffect, useRef } from 'react';
import { MapDisplay } from './components/MapDisplay';
import { TopSystemBar } from './components/TopSystemBar';
import { LeftSidebar } from './components/LeftSidebar';
import { CommandPalette } from './components/CommandPalette';
import { OwnshipPanel, TargetPanel } from './components/InfoPanels';
import { Entity, EntityType, MapMode, SystemStatus, PrototypeSettings } from './types';
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

  // Use the Simulation Engine to manage entities instead of bare useState
  const { entities, setEntities } = useSimulation(INITIAL_ENTITIES);
  const [mapMode, setMapMode] = useState<MapMode>(MapMode.HEADING_UP);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(0.05);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [systems, setSystems] = useState<SystemStatus>({ radar: true, adsb: true, ais: false, eots: true });

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
    showSpeedVectors: true
  });

  const toggleSystem = (sys: keyof SystemStatus) => {
    setSystems(prev => ({ ...prev, [sys]: !prev[sys] }));
  };

  const panAnimationRef = useRef<number>();

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
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = { lat: position.coords.latitude, lon: position.coords.longitude };
          const dLat = loc.lat - DEFAULT_ORIGIN.lat;
          const dLon = loc.lon - DEFAULT_ORIGIN.lon;

          setOrigin(loc);
          setOwnship(prev => ({ ...prev, position: loc }));
          setEntities(prev => prev.map(e => ({
            ...e,
            position: { lat: e.position.lat + dLat, lon: e.position.lon + dLon },
            waypoints: e.waypoints?.map(wp => ({ lat: wp.lat + dLat, lon: wp.lon + dLon }))
          })));
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

  const handleManualPan = React.useCallback((newOffset: { x: number, y: number }) => {
    // console.log('App: handleManualPan', newOffset);
    if (panAnimationRef.current) {
      cancelAnimationFrame(panAnimationRef.current);
      panAnimationRef.current = undefined;
    }
    setPanOffset(newOffset);
  }, []);

  const centerOnOwnship = React.useCallback(() => {
    // console.log('App: centerOnOwnship Triggered');
    if (panAnimationRef.current) cancelAnimationFrame(panAnimationRef.current);

    const start = { ...panOffset };
    const end = { x: 0, y: 0 };
    const duration = prototypeSettings.animationSpeed;

    if (duration <= 0 || (Math.abs(start.x) < 0.1 && Math.abs(start.y) < 0.1)) {
      setPanOffset(end);
      return;
    }

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
  }, [panOffset, prototypeSettings.animationSpeed]);

  useEffect(() => {
    centerOnOwnship();
  }, [mapMode]);

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
          }
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
            ownship={ownship} entities={entities} mapMode={mapMode} zoomLevel={zoomLevel}
            onZoom={(val) => setZoomLevel(Math.min(Math.max(val, 0.0001), 5))}
            panOffset={panOffset} onPan={handleManualPan}
            selectedEntityId={selectedEntityId} onSelectEntity={setSelectedEntityId}
            origin={origin} gestureSettings={prototypeSettings}
            setGestureSettings={setPrototypeSettings}
            onMapDrop={handleDropCommand}
          />
        )}
      </div>

      <div style={{ transform: `scale(${prototypeSettings.uiScale})`, transformOrigin: 'top left' }} className="absolute inset-0 pointer-events-none">
        <LeftSidebar
          mapMode={mapMode} setMapMode={setMapMode} toggleLayer={() => { }} systems={systems} toggleSystem={toggleSystem}
          isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)}
          gestureSettings={prototypeSettings} setGestureSettings={setPrototypeSettings}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
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
        setMapMode={setMapMode}
        ownship={ownship}
        origin={origin || DEFAULT_ORIGIN}
      />

      <div style={{ transform: `scale(${prototypeSettings.uiScale})`, transformOrigin: 'top center' }} className="absolute top-0 left-0 right-0 pointer-events-none">
        <TopSystemBar systems={systems} />
      </div>

      <div style={{ transformOrigin: 'bottom left' }} className="absolute inset-0 pointer-events-none">
        {origin && <OwnshipPanel ownship={ownship} origin={origin} prototypeSettings={prototypeSettings} />}
      </div>

      <div style={{ transform: `scale(${prototypeSettings.uiScale})`, transformOrigin: 'bottom right' }} className="absolute bottom-0 right-0 pointer-events-none">
        <TargetPanel ownship={ownship} entity={entities.find(e => e.id === selectedEntityId) || null} animationSpeed={prototypeSettings.animationSpeed} />
      </div>

      {(Math.abs(panOffset.x) > 5 || Math.abs(panOffset.y) > 5) && (
        <button
          onClick={centerOnOwnship}
          className="absolute bottom-28 right-4 z-30 bg-emerald-900/80 text-emerald-400 border border-emerald-600 p-3 rounded-full shadow-lg backdrop-blur hover:bg-emerald-800 transition-all active:scale-95 pointer-events-auto"
          style={{ transform: `scale(${prototypeSettings.uiScale})` }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" fill="currentColor" /><line x1="12" y1="2" x2="12" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /></svg>
        </button>
      )}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.9)] z-40"></div>
    </div>
  );
};

export default App;
