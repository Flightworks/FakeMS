import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Entity, EntityType, MapMode, PrototypeSettings, SystemStatus, StabMode } from '../types';
import { HelicopterSymbol, WaypointSymbol, EnemySymbol, AirportSymbol } from './IconSymbols';
import { PieMenu, PieMenuOption } from './PieMenu';
import {
  MapPin, Crosshair, Navigation, Info, Trash2, CircleDashed,
  Zap, Shield, FileText, Scan, Eye, Slash, Target, Settings, Router,
  Lock, Anchor, Flag, Video, Wifi, Globe, Thermometer, Activity,
  ArrowLeftRight, CornerUpRight, Flame, TrendingUp, ChevronUp
} from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

// Fix Leaflet's default icon path issues
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapDisplayProps {
  ownship: Entity;
  entities: Entity[];
  systems: SystemStatus;
  mapMode: MapMode;
  zoomLevel: number;
  onZoom: (z: number) => void;
  panOffset: { x: number, y: number };
  onPan: (offset: { x: number, y: number }, newCenter?: {lat: number, lon: number}) => void;
  selectedEntityId: string | null;
  onSelectEntity: (id: string | null) => void;
  origin: { lat: number; lon: number };
  gestureSettings: PrototypeSettings;
  setGestureSettings: React.Dispatch<React.SetStateAction<PrototypeSettings>>;
  onMapDrop?: (e: React.DragEvent) => void;
  stabMode: StabMode;
  setStabMode: (m: StabMode) => void;
  frozenHeading: number | null;
  setFrozenHeading: (h: number | null) => void;
  onResetStab: () => void;
  setMapMode: (m: MapMode) => void;
  groundAnchor: {lat: number, lon: number} | null;
}


const EARTH_RADIUS = 6378137;

// Deprecated projection helpers. We now use native lat/lon. Validate if still needed elsewhere.
// const metersToLatLon = ...
// const latLonToMeters = ...

// --- Custom Components ---

const LongPressRing = ({ x, y, duration }: { x: number, y: number, duration: number }) => {
  const [fill, setFill] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setFill(true));
  }, []);

  const radius = 55;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="fixed pointer-events-none z-[9999]" style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}>
      <svg width="140" height="140" viewBox="0 0 140 140" className="overflow-visible">
        <circle cx="70" cy="70" r={radius} stroke="rgba(2, 6, 23, 0.5)" strokeWidth="4" fill="none" />
        <circle
          cx="70" cy="70" r={radius}
          stroke="#10b981"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={fill ? "0" : circumference.toString()}
          style={{
            transition: `stroke-dashoffset ${duration}ms linear`,
            transformOrigin: 'center',
            transform: 'rotate(-90deg)',
            filter: 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.6))'
          }}
        />
      </svg>
    </div>
  );
};

const MapController: React.FC<{
  center: LatLngExpression,
  zoom: number,
  rotation: number,
  onMapMoveStart: () => void,
  onMapMove: (center: L.LatLng) => void,
  onMapZoom: (zoom: number) => void,
  isPanning: boolean
}> = ({ center, zoom, rotation, onMapMoveStart, onMapMove, onMapZoom, isPanning }) => {
  const map = useMap();
  const mapContainer = map.getContainer();
  const isInteracting = useRef(false);

  // Sync View
  useEffect(() => {
    if (!isInteracting.current) {
      map.setView(center, zoom, { animate: false });
    }
  }, [center, zoom, map]);

  const prevRotRef = useRef<number>(rotation);

  // Sync Rotation — always take shortest angular path
  useEffect(() => {
    let delta = rotation - prevRotRef.current;
    // Normalize delta to [-180, 180]
    delta = ((delta + 180) % 360 + 360) % 360 - 180;
    prevRotRef.current = prevRotRef.current + delta;
    mapContainer.style.transform = `rotate(${prevRotRef.current}deg)`;
    mapContainer.style.transition = 'none';
  }, [rotation, mapContainer, map]);

  useMapEvents({
    movestart: () => { isInteracting.current = true; onMapMoveStart(); },
    moveend: () => {
      isInteracting.current = false;
    },
    zoomend: () => {
      onMapZoom(map.getZoom());
    },
    click: (e) => {
      // We handle all 'clicks' via our unified Pointer/Gesture system in the parent div.
      // Therefore, we must swallow Leaflet's generated click events to prevent
      // conflicts, ghost clicks, or 'click outside' logic in other components from firing.
      e.originalEvent.stopPropagation();
      // e.originalEvent.preventDefault(); // Don't prevent default if input fields need focus? Map clicks shouldn't need focus.
    }
  });

  return null;
};

export const MapDisplay: React.FC<MapDisplayProps> = ({
  ownship,
  entities,
  systems,
  mapMode,
  zoomLevel,
  onZoom,
  panOffset,
  onPan,
  selectedEntityId,
  onSelectEntity,
  origin,
  gestureSettings,
  setGestureSettings,
  onMapDrop,
  stabMode,
  setStabMode,
  frozenHeading,
  setFrozenHeading,
  onResetStab,
  setMapMode,
  groundAnchor
}) => {
  const [pieMenu, setPieMenu] = useState<{ x: number, y: number, type: 'ENTITY' | 'MAP', entityId?: string } | null>(null);
  const [longPressIndicator, setLongPressIndicator] = useState<{ x: number, y: number } | null>(null);
  const [ghostData, setGhostData] = useState<{x: number, y: number, angle: number} | null>(null);

  // Ghost Tracker inner component
  const GhostTracker: React.FC = () => {
    const map = useMap();
    useEffect(() => {
      const handler = () => {
        if (stabMode !== StabMode.GND && !gestureSettings.stabAutoGndOnPan && stabMode === StabMode.HELICO) {
           // Allow being off-screen in HELICO if auto-GND is OFF
        } else if (stabMode !== StabMode.GND && stabMode !== StabMode.HELICO) {
           setGhostData(null);
           return;
        }
        const pt = map.latLngToContainerPoint([ownship.position.lat, ownship.position.lon]);
        const size = map.getSize();
        const cx = size.x / 2;
        const cy = size.y / 2;

        let lx = pt.x - cx;
        let ly = pt.y - cy;

        const rad = mapRotation * Math.PI / 180;
        const cosR = Math.cos(rad);
        const sinR = Math.sin(rad);
        
        const sx = lx * cosR - ly * sinR;
        const sy = lx * sinR + ly * cosR;

        const padding = 30; 
        const screenHalfW = window.innerWidth / 2 - padding;
        const screenHalfH = window.innerHeight / 2 - padding;

        const isOutside = Math.abs(sx) > screenHalfW || Math.abs(sy) > screenHalfH;

        if (!isOutside) {
           setGhostData(null);
           return;
        }

        if (stabMode === StabMode.HELICO && gestureSettings.stabAutoGndOnPan) {
            setStabMode(StabMode.GND);
            const c = map.getCenter();
            onPan(activePan, { lat: c.lat, lon: c.lng });
        }

        let rx = sx;
        let ry = sy;
        if (Math.abs(sx) * screenHalfH > Math.abs(sy) * screenHalfW) {
            rx = Math.sign(sx) * screenHalfW;
            ry = sy * (screenHalfW / Math.abs(sx));
        } else {
            ry = Math.sign(sy) * screenHalfH;
            rx = sx * (screenHalfH / Math.abs(sy));
        }

        const angleDeg = Math.atan2(sy, sx) * 180 / Math.PI + 90;

        setGhostData({ x: (window.innerWidth / 2) + rx, y: (window.innerHeight / 2) + ry, angle: angleDeg });
      };

      map.on('move', handler);
      map.on('zoom', handler);
      handler();

      return () => { map.off('move', handler); map.off('zoom', handler); };
    }, [map, ownship.position.lat, ownship.position.lon, stabMode, mapRotation, activePan.x, activePan.y]); // Re-run when these change
    return null;
  };

  // Interaction State
  const interactionRef = useRef<{
    startTime: number,
    startX: number,
    startY: number,
    type: 'MAP' | 'ENTITY',
    entityId?: string,
    autoTriggered: boolean,
    startPanOffset: { x: number, y: number }
  } | null>(null);

  const isDraggingRef = useRef(false);
  const menuOpenTimeRef = useRef(0);

  const indTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rotation
  const mapRotation = mapMode === MapMode.HEADING_UP 
    ? -((stabMode === StabMode.GND && frozenHeading !== null) ? frozenHeading : ownship.heading || 0) 
    : 0;

  // --- Dynamic Pan Rotation (Continuous HUP fixing) ---
  const lastPanOffsetRef = useRef(panOffset);
  const rotAtPanSetRef = useRef(mapRotation);

  if (panOffset !== lastPanOffsetRef.current) {
    lastPanOffsetRef.current = panOffset;
    rotAtPanSetRef.current = mapRotation;
  }

  const getEffectivePan = () => {
    let activePanX = panOffset.x;
    let activePanY = panOffset.y;

    if (stabMode === StabMode.HELICO && gestureSettings.stabMaintainScreenPosOnOrient) {
       const deltaDeg = mapRotation - rotAtPanSetRef.current;
       if (Math.abs(deltaDeg) > 0.01) {
          const rad = -deltaDeg * (Math.PI / 180);
          const cosR = Math.cos(rad);
          const sinR = Math.sin(rad);
          activePanX = panOffset.x * cosR - panOffset.y * sinR;
          activePanY = panOffset.x * sinR + panOffset.y * cosR;
       }
    }
    return { x: activePanX, y: activePanY };
  };

  const activePan = getEffectivePan();

  // Coordinates
  const centerLatLon = useMemo(() => {
    // Current base point (either helicopter or fixed ground anchor)
    const base = (stabMode === StabMode.GND && groundAnchor) ? groundAnchor : ownship.position;
    if (!base) return { lat: 0, lng: 0 };
    
    // Displacement from the base
    const dLat = (activePan.y / EARTH_RADIUS) * (180 / Math.PI);
    const dLon = (activePan.x / (EARTH_RADIUS * Math.cos(base.lat * Math.PI / 180))) * (180 / Math.PI);
    return [base.lat + dLat, base.lon + dLon] as [number, number];
  }, [ownship.position.lat, ownship.position.lon, activePan.x, activePan.y, stabMode, groundAnchor]);

  const leafletZoom = Math.max(3, Math.min(18, Math.round(13 + Math.log2(Math.max(zoomLevel, 0.01)))));

  const handleMapMove = (newCenter: L.LatLng) => {
    // Calculate new pan offset in meters relative to ownship
    const dLat = newCenter.lat - ownship.position.lat;
    const dLon = newCenter.lng - ownship.position.lon;
    const newPanY = dLat * (Math.PI / 180) * EARTH_RADIUS;
    const newPanX = dLon * (Math.PI / 180) * (EARTH_RADIUS * Math.cos(ownship.position.lat * Math.PI / 180));
    onPan({ x: newPanX, y: newPanY }, { lat: newCenter.lat, lon: newCenter.lng });
  };

  const handleMapZoom = (newZoom: number) => {
    const newAppZoom = Math.pow(2, newZoom - 13);
    onZoom(newAppZoom);
  };

  const lastTouchTime = useRef(0);

  // --- Interaction Logic ---

  const startInteraction = (x: number, y: number, type: 'MAP' | 'ENTITY', entityId?: string, pointerType: 'mouse' | 'touch' | 'pen' = 'mouse') => {
    // SOTA Ghost Buster:
    // If this is a mouse event, but we had a touch event < 1000ms ago, it's a ghost. Ignore it.
    if (pointerType === 'mouse' && Date.now() - lastTouchTime.current < 1000) {
      return;
    }

    if (indTimer.current) clearTimeout(indTimer.current);
    if (hldTimer.current) clearTimeout(hldTimer.current);

    interactionRef.current = { 
      startTime: Date.now(), 
      startX: x, 
      startY: y, 
      type, 
      entityId, 
      autoTriggered: false,
      startPanOffset: { ...activePan }
    };
    isDraggingRef.current = false;
    setLongPressIndicator(null);

    // IND Timer (250ms)
    indTimer.current = setTimeout(() => {
      if (!isDraggingRef.current && interactionRef.current) {
        setLongPressIndicator({ x, y });
        if (navigator.vibrate && gestureSettings.hapticEnabled) navigator.vibrate(10);
      }
    }, gestureSettings.indicatorDelay);

    // HLD Timer (1000ms)
    hldTimer.current = setTimeout(() => {
      if (!isDraggingRef.current && interactionRef.current) {
        // Auto-open menu
        interactionRef.current.autoTriggered = true;
        openMenu(x, y, type, entityId);
      }
    }, gestureSettings.longPressDuration);
  };

  const moveInteraction = (x: number, y: number) => {
    if (!interactionRef.current) return;
    const dx = x - interactionRef.current.startX;
    const dy = y - interactionRef.current.startY;

    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      if (!isDraggingRef.current) {
        if (stabMode !== StabMode.GND && gestureSettings.stabAutoGndOnPan) {
          setStabMode(StabMode.GND); // routes through handleSetStabMode in App.tsx
        }
        // else: stay in HELICO (panning without forced GND switch)
      }
      isDraggingRef.current = true;
      if (indTimer.current) clearTimeout(indTimer.current);
      if (hldTimer.current) clearTimeout(hldTimer.current);
      setLongPressIndicator(null);

      // Rotation-Aware Panning Math
      const rad = mapRotation * (Math.PI / 180);
      const cosR = Math.cos(rad);
      const sinR = Math.sin(rad);

      // Rotate screen-space drag (dx, dy) into world-space displacement (un-rotate by mapRotation)
      // Screen to World transformation (pulling the map)
      const de = dx * cosR + dy * sinR;
      const dn = -dx * sinR + dy * cosR;

      const latForMpp = (stabMode === StabMode.GND && groundAnchor) ? groundAnchor.lat : ownship.position.lat;
      const latRad = latForMpp * (Math.PI / 180);
      const metersPerPixel = (2 * Math.PI * EARTH_RADIUS * Math.cos(latRad)) / (256 * Math.pow(2, leafletZoom));
      
      const newPanX = interactionRef.current.startPanOffset.x - de * metersPerPixel;
      const newPanY = interactionRef.current.startPanOffset.y + dn * metersPerPixel;

      onPan({ x: newPanX, y: newPanY });
    }
  };

  const endInteraction = (x: number, y: number) => {
    if (!interactionRef.current) return;

    const { startTime, type, entityId, autoTriggered } = interactionRef.current;
    const duration = Date.now() - startTime;

    if (indTimer.current) clearTimeout(indTimer.current);
    if (hldTimer.current) clearTimeout(hldTimer.current);
    setLongPressIndicator(null);
    interactionRef.current = null;

    if (isDraggingRef.current) return;

    // Renew interaction lock on release to prevent ghost clicks
    if (autoTriggered) {
      menuOpenTimeRef.current = Date.now();
      return;
    }

    // Logic based on timing
    if (duration <= gestureSettings.tapThreshold) {
      // Short Press
      if (type === 'ENTITY') {
        onSelectEntity(entityId || null);
        openMenu(x, y, type, entityId); // User wants menu on short press too?
      } else {
        // Map Tap -> Clear Selection
        onSelectEntity(null);
        setPieMenu(null);
      }
    } else if (duration > gestureSettings.indicatorDelay) {
      // Long Press (Released between IND and HLD)
      openMenu(x, y, type, entityId);
    }
  };

  const openMenu = (x: number, y: number, type: 'MAP' | 'ENTITY', entityId?: string) => {
    setPieMenu({ x, y, type, entityId });
    setLongPressIndicator(null);
    menuOpenTimeRef.current = Date.now();
    if (navigator.vibrate && gestureSettings.hapticEnabled) navigator.vibrate(50);
  };

  const closePieMenu = () => setPieMenu(null);

  const checkMapClickBlock = () => {
    // Prevent ghost clicks from closing the menu immediately
    return (Date.now() - menuOpenTimeRef.current < 350);
  };

  const getPieOptions = (): PieMenuOption[] => {
    if (!pieMenu) return [];
    if (pieMenu.type === 'ENTITY') {
      return [
        { label: 'NAV', icon: Navigation, color: 'primary', subOptions: [{ label: 'DIRECT', icon: Crosshair, action: () => alert('NAV: Direct To Initiated'), color: 'primary' }, { label: 'HOLD', icon: CircleDashed, action: () => alert('NAV: Holding Pattern Established') }, { label: 'FPL', icon: FileText, action: () => alert('NAV: Added to Flight Plan') }, { label: 'OFFSET', icon: ArrowLeftRight, action: () => alert('NAV: 5nm Right Offset Applied') }] },
        { label: 'ENGAGE', icon: Target, color: 'danger', subOptions: [{ label: 'AUTH', icon: Flame, action: () => alert('ENGAGE: Weapons Free - Authorized'), color: 'danger' }, { label: 'ABORT', icon: Shield, action: () => alert('ENGAGE: Attack Aborted') }, { label: 'SPI', icon: Crosshair, action: () => alert('ENGAGE: Sensor Point of Interest Set') }] },
        { label: 'COMMS', icon: Router, subOptions: [{ label: 'TEXT', icon: FileText, action: () => alert('COMMS: Text Message Sent') }, { label: 'HANDOFF', icon: CornerUpRight, action: () => alert('COMMS: Handoff Initiated') }, { label: 'SQUAWK', icon: Lock, action: () => alert('COMMS: Squawk Code Interrogated') }, { label: 'DLINK', icon: Wifi, action: () => alert('COMMS: Datalink Connection Established') }] },
        { label: 'SENSORS', icon: Scan, subOptions: [{ label: 'FLIR', icon: Video, action: () => alert('SENSORS: FLIR Slewed to Target') }, { label: 'STT', icon: Target, action: () => alert('SENSORS: Radar Single Target Track (STT)'), color: 'danger' }, { label: 'LSR', icon: Zap, action: () => alert('SENSORS: Laser Designator Active') }] },
        { label: 'ADMIN', icon: Trash2, color: 'danger', subOptions: [{ label: 'DELETE', icon: Trash2, action: () => alert('ADMIN: Entity Deleted'), color: 'danger' }, { label: 'PROP', icon: Settings, action: () => alert('ADMIN: Properties Opened') }] }
      ];
    } else {
      return [
        { label: 'DROP', icon: MapPin, subOptions: [{ label: 'WPT', icon: MapPin, action: () => alert('MAP: Waypoint Added') }, { label: 'TGT', icon: Target, action: () => alert('MAP: Target Designated'), color: 'danger' }, { label: 'LZ', icon: Flag, action: () => alert('MAP: Landing Zone Marked') }, { label: 'FARP', icon: Anchor, action: () => alert('MAP: FARP Location Added') }] },
        { label: 'TRACKS', icon: TrendingUp, subOptions: [{ label: 'VECTOR', icon: ArrowLeftRight, action: () => setGestureSettings(s => ({ ...s, showSpeedVectors: !s.showSpeedVectors })), color: gestureSettings.showSpeedVectors ? 'primary' : 'default' }, { label: 'LABELS', icon: FileText, action: () => alert('TRACKS: Global Labels Toggled') }, { label: 'CLR ALL', icon: Trash2, action: () => alert('TRACKS: All Tracks Cleared'), color: 'danger' }] },
        { label: 'TOOLS', icon: Settings, subOptions: [{ label: 'RULER', icon: Slash, action: () => alert('TOOLS: Measure Mode Active') }, { label: 'MARK', icon: Crosshair, action: () => alert('TOOLS: Mark Point Created') }, { label: 'ELEV', icon: Activity, action: () => alert('TOOLS: Elevation Profile') }] },
        { label: 'VIEW', icon: Eye, subOptions: [{ label: 'CLR', icon: Eye, action: () => alert('VIEW: Declutter') }, { label: 'NVG', icon: Globe, action: () => alert('VIEW: Night Vision Mode') }, { label: 'THERM', icon: Thermometer, action: () => alert('VIEW: Thermal Mode') }] }
      ];
    }
  };

  const createEntityIcon = (entity: Entity, rotation: number, isSelected: boolean) => {
    let IconComponent;
    switch (entity.type) {
      case EntityType.OWNSHIP: IconComponent = <HelicopterSymbol />; break;
      case EntityType.ENEMY: IconComponent = <EnemySymbol selected={isSelected} />; break;
      case EntityType.AIRPORT: IconComponent = <AirportSymbol selected={isSelected} />; break;
      default: IconComponent = <WaypointSymbol selected={isSelected} />;
    }

    const heading = entity.heading || 0;
    // The icon's rotation relative to the map container should be its true heading.
    // Since the MapContainer is rotated by 'rotation' (e.g., -ownshipHeading in HUP),
    // the resulting screen rotation is: heading + rotation.
    // For ownship in HUP: ownshipHeading + (-ownshipHeading) = 0 (straight UP).
    const displayRotation = heading;

    const svgString = renderToStaticMarkup(
      <div 
        className="entity-marker-container relative flex flex-col items-center justify-center pointer-events-none"
        data-entity-id={entity.id}
        style={{
          width: '48px', height: '48px',
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto" style={{ 
          transform: `rotate(${displayRotation}deg)`, 
          transition: 'transform 0.1s linear'
        }}>
          <div style={{ width: '100%', height: '100%' }}>{IconComponent}</div>
        </div>
        <div 
          className="absolute -bottom-4 text-[10px] text-white font-mono bg-slate-900/60 px-1 rounded whitespace-nowrap"
          style={{ transform: `rotate(${-rotation}deg)`, display: 'inline-block' }}
        >
          {entity.label}
        </div>
      </div>
    );

    return L.divIcon({
      html: svgString,
      className: 'custom-entity-icon',
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });
  };

  return (
    <div
      className="absolute inset-0 bg-slate-950 overflow-hidden touch-none"
      onPointerDown={(e) => startInteraction(e.clientX, e.clientY, 'MAP', undefined, e.pointerType as any)}
      onPointerMove={(e) => moveInteraction(e.clientX, e.clientY)}
      onPointerUp={(e) => endInteraction(e.clientX, e.clientY)}
      onTouchStartCapture={() => { lastTouchTime.current = Date.now(); }}
      // PointerCancel needed?
      onPointerCancel={() => setLongPressIndicator(null)}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={(e) => { e.preventDefault(); onMapDrop?.(e); }}
    >
      <MapContainer
        center={centerLatLon}
        zoom={leafletZoom}
        className="absolute -inset-[75%] z-0"
        zoomControl={false}
        attributionControl={false}
        zoomAnimation={true}
        zoomSnap={0}
        zoomDelta={0.1}
        dragging={false}
        touchZoom={true}
        doubleClickZoom={false}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController
          center={centerLatLon}
          zoom={leafletZoom}
          rotation={mapRotation}
          onMapMoveStart={() => {
            if (stabMode === StabMode.HELICO && !gestureSettings.stabAutoGndOnPan) {
               return;
            }
            if (stabMode !== StabMode.GND) {
              setStabMode(StabMode.GND);
            }
          }}
          onMapMove={handleMapMove}
          onMapZoom={handleMapZoom}
          isPanning={isDraggingRef.current}
        />

        <GhostTracker />

        {/* Ownship */}
        <Marker
          position={[ownship.position.lat, ownship.position.lon]}
          icon={createEntityIcon(ownship, mapRotation, selectedEntityId === ownship.id)}
          eventHandlers={{
            mousedown: (e) => {
              L.DomEvent.stopPropagation(e as any);
              const evt = e.originalEvent as any;
              const clientX = evt.clientX || (evt.touches ? evt.touches[0].clientX : 0);
              const clientY = evt.clientY || (evt.touches ? evt.touches[0].clientY : 0);
              // Leaflet mousedown is the only event we get on mobile for markers (touches are swallowed).
              // We pass 'touch' to bypass the Ghost Buster check.
              startInteraction(clientX, clientY, 'ENTITY', ownship.id, 'touch');
            },
            mouseup: (e) => {
              L.DomEvent.stopPropagation(e as any);
              const evt = e.originalEvent as any;
              const clientX = evt.clientX || (evt.changedTouches ? evt.changedTouches[0].clientX : 0);
              const clientY = evt.clientY || (evt.changedTouches ? evt.changedTouches[0].clientY : 0);
              endInteraction(clientX, clientY);
            }
          }}
        />

        {/* Entities */}
        {entities
          .filter(entity => {
            if (entity.type === EntityType.ENEMY) return systems.radar;
            if (entity.type === EntityType.FRIENDLY) return systems.adsb;
            if (entity.type === EntityType.AIRPORT) return true; // Always visible
            if (entity.type === EntityType.WAYPOINT) return true; // Always visible
            return true;
          })
          .map(entity => (
            <Marker
              key={entity.id}
              position={[entity.position.lat, entity.position.lon]}
              icon={createEntityIcon(entity, mapRotation, selectedEntityId === entity.id)}
              eventHandlers={{
                mousedown: (e) => {
                  L.DomEvent.stopPropagation(e as any);
                  const evt = e.originalEvent as any;
                  const clientX = evt.clientX || (evt.touches ? evt.touches[0].clientX : 0);
                  const clientY = evt.clientY || (evt.touches ? evt.touches[0].clientY : 0);
                  startInteraction(clientX, clientY, 'ENTITY', entity.id, 'touch');
                },
                mouseup: (e) => {
                  L.DomEvent.stopPropagation(e as any);
                  const evt = e.originalEvent as any;
                  const clientX = evt.clientX || (evt.changedTouches ? evt.changedTouches[0].clientX : 0);
                  const clientY = evt.clientY || (evt.changedTouches ? evt.changedTouches[0].clientY : 0);
                  endInteraction(clientX, clientY);
                }
              }}
            />
          ))}

      </MapContainer>

      {/* Map orientation and stab are now controlled via the Left Sidebar */}

      {ghostData && (
        <div 
          className="absolute z-20 pointer-events-auto cursor-pointer group"
          style={{ 
            left: ghostData.x, 
            top: ghostData.y,
            transform: `translate(-50%, -50%) rotate(${ghostData.angle}deg)`, 
            transition: 'all 0.1s linear'
          }}
          onClick={(e) => { e.stopPropagation(); onResetStab(); }}
        >
          <div className="w-10 h-10 bg-amber-500/40 rounded-full flex items-center justify-center border border-amber-500/80 backdrop-blur-sm shadow-[0_0_15px_rgba(245,158,11,0.3)] group-hover:bg-amber-500/60 group-hover:scale-110 transition-all active:scale-95">
             <ChevronUp size={24} className="text-amber-400 drop-shadow-[0_0_2px_rgba(0,0,0,0.5)]" />
          </div>
          <div className="absolute -inset-1 bg-amber-500/20 rounded-full animate-ping opacity-50"></div>
        </div>
      )}
      {/* Pure Recentering Button */}
      {(stabMode === StabMode.GND || Math.abs(panOffset.x) > 1 || Math.abs(panOffset.y) > 1) && (
        <button
          onClick={(e) => { e.stopPropagation(); onResetStab(); }}
          className="absolute bottom-6 right-6 z-30 w-14 h-14 flex items-center justify-center bg-slate-900/90 border-2 border-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] text-emerald-400 hover:bg-emerald-900 transition-all active:scale-90 pointer-events-auto group"
          title="Recenter Map on Ownship"
        >
          <Crosshair size={28} className="group-hover:scale-110 transition-transform" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
        </button>
      )}

      {/* Overlays */}
      {longPressIndicator && <LongPressRing x={longPressIndicator.x} y={longPressIndicator.y} duration={gestureSettings.longPressDuration - gestureSettings.indicatorDelay} />}
      {pieMenu && (
        <PieMenu
          x={pieMenu.x} y={pieMenu.y}
          options={getPieOptions()} onClose={closePieMenu}
          title={pieMenu.type === 'ENTITY' ? entities.find(e => e.id === pieMenu.entityId)?.label || ownship.label : 'MAP ACTION'}
          glowIntensity={gestureSettings.glowIntensity}
          hapticEnabled={gestureSettings.hapticEnabled}
        />
      )}
      <style>{`
                .leaflet-container { background: #020617; }
                .custom-entity-icon { background: transparent; border: none; }
            `}</style>
    </div>
  );
};
