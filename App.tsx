
import React, { useState, useEffect, useRef } from 'react';
import { MapDisplay } from './components/MapDisplay';
import { TopSystemBar } from './components/TopSystemBar';
import { LeftSidebar } from './components/LeftSidebar';
import { CommandPalette } from './components/CommandPalette';
import { OwnshipPanel, TargetPanel } from './components/InfoPanels';
import { Entity, EntityType, MapMode, SystemStatus, PrototypeSettings } from './types';

const DEFAULT_ORIGIN = { lat: 34.0522, lon: -118.2437 };

const INITIAL_OWNSHIP: Entity = {
  id: 'ownship',
  type: EntityType.OWNSHIP,
  position: { x: 0, y: 0 },
  label: 'VIPER 1-1',
  heading: 0,
  speed: 120, // Default speed in knots for ETA calculations
  altitude: 3428
};

const INITIAL_ENTITIES: Entity[] = [
  { id: 'wp-1', type: EntityType.WAYPOINT, position: { x: 2000, y: 2000 }, label: 'G01' },
  { id: 'wp-2', type: EntityType.WAYPOINT, position: { x: -2000, y: 5000 }, label: 'BRAVO' },
  { id: 'apt-1', type: EntityType.AIRPORT, position: { x: -5000, y: -5000 }, label: 'BASE' },
  { id: 'en-1', type: EntityType.ENEMY, position: { x: 5000, y: -2000 }, label: 'HOSTILE 1', heading: 270, speed: 60 },
  { id: 'en-2', type: EntityType.ENEMY, position: { x: 4000, y: -1000 }, label: 'HOSTILE 2', heading: 280, speed: 65 },
];

const App: React.FC = () => {
  const [origin, setOrigin] = useState<{ lat: number, lon: number } | null>(null);
  const [ownship, setOwnship] = useState<Entity>(INITIAL_OWNSHIP);
  const [entities, setEntities] = useState<Entity[]>(INITIAL_ENTITIES);
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

  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>();
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
        (position) => setOrigin({ lat: position.coords.latitude, lon: position.coords.longitude }),
        () => setOrigin(DEFAULT_ORIGIN),
        { enableHighAccuracy: true }
      );
    } else {
      setOrigin(DEFAULT_ORIGIN);
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

  const updateSimulation = (time: number) => {
    if (lastTimeRef.current !== undefined) {
      setEntities(prev => prev.map(e => (e.type === EntityType.ENEMY ? { ...e, position: { x: e.position.x + (Math.cos(((e.heading || 0) - 90) * (Math.PI / 180)) * 0.5), y: e.position.y + (Math.sin(((e.heading || 0) - 90) * (Math.PI / 180)) * 0.5) } } : e)));
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(updateSimulation);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateSimulation);
    return () => cancelAnimationFrame(requestRef.current!);
  }, []);

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
        <TargetPanel entity={entities.find(e => e.id === selectedEntityId) || null} animationSpeed={prototypeSettings.animationSpeed} />
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
