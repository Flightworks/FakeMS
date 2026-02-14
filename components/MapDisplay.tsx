import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Entity, EntityType, MapMode, PrototypeSettings } from '../types';
import { HelicopterSymbol, WaypointSymbol, EnemySymbol, AirportSymbol } from './IconSymbols';
import { PieMenu, PieMenuOption } from './PieMenu';
import {
  MapPin, Crosshair, Navigation, Info, Trash2, CircleDashed,
  Zap, Shield, FileText, Scan, Eye, Slash, Target, Settings, Router,
  Lock, Anchor, Flag, Video, Wifi, Globe, Thermometer, Activity,
  ArrowLeftRight, CornerUpRight, Flame, TrendingUp
} from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

// Fix Leaflet's default icon path issues
import icon from 'leaflet/dist/images/marker-icon.png';
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
  mapMode: MapMode;
  zoomLevel: number;
  onZoom: (z: number) => void;
  panOffset: { x: number, y: number };
  onPan: (offset: { x: number, y: number }) => void;
  selectedEntityId: string | null;
  onSelectEntity: (id: string | null) => void;
  origin: { lat: number; lon: number };
  gestureSettings: PrototypeSettings;
  setGestureSettings: React.Dispatch<React.SetStateAction<PrototypeSettings>>;
}

const EARTH_RADIUS = 6378137;

// --- Helper Functions ---
const metersToLatLon = (origin: { lat: number, lon: number }, x: number, y: number): [number, number] => {
  const dLat = (y / EARTH_RADIUS) * (180 / Math.PI);
  const dLon = (x / (EARTH_RADIUS * Math.cos(Math.PI * origin.lat / 180))) * (180 / Math.PI);
  return [origin.lat + dLat, origin.lon + dLon];
};

const latLonToMeters = (origin: { lat: number, lon: number }, lat: number, lon: number) => {
  const dLat = lat - origin.lat;
  const dLon = lon - origin.lon;
  const y = dLat * (Math.PI / 180) * EARTH_RADIUS;
  const x = dLon * (Math.PI / 180) * (EARTH_RADIUS * Math.cos(Math.PI * origin.lat / 180));
  return { x, y };
};

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
  onMapMove: (center: L.LatLng) => void,
  onMapZoom: (zoom: number) => void,
  onMapClickBlockCheck: () => boolean
}> = ({ center, zoom, rotation, onMapMove, onMapZoom, onMapClickBlockCheck }) => {
  const map = useMap();
  const mapContainer = map.getContainer();
  const isInteracting = useRef(false);

  // Sync View
  useEffect(() => {
    if (!isInteracting.current) {
      map.setView(center, zoom, { animate: false });
    }
  }, [center, zoom, map]);

  // Sync Rotation
  useEffect(() => {
    mapContainer.style.transform = `rotate(${rotation}deg)`;
    mapContainer.style.transition = 'transform 0.3s ease-out';
  }, [rotation, mapContainer, map]);

  useMapEvents({
    movestart: () => { isInteracting.current = true; },
    moveend: () => {
      isInteracting.current = false;
      onMapMove(map.getCenter());
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
  mapMode,
  zoomLevel,
  onZoom,
  panOffset,
  onPan,
  selectedEntityId,
  onSelectEntity,
  origin,
  gestureSettings,
  setGestureSettings
}) => {
  const [pieMenu, setPieMenu] = useState<{ x: number, y: number, type: 'ENTITY' | 'MAP', entityId?: string } | null>(null);
  const [longPressIndicator, setLongPressIndicator] = useState<{ x: number, y: number } | null>(null);

  // Interaction State
  const interactionRef = useRef<{
    startTime: number,
    startX: number,
    startY: number,
    type: 'MAP' | 'ENTITY',
    entityId?: string
  } | null>(null);

  const isDraggingRef = useRef(false);
  const menuOpenTimeRef = useRef(0);

  const indTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rotation
  const mapRotation = mapMode === MapMode.HEADING_UP ? -(ownship.heading || 0) : 0;

  // Coordinates
  const centerMetersX = ownship.position.x + panOffset.x;
  const centerMetersY = ownship.position.y + panOffset.y;

  const centerLatLon = useMemo(() =>
    metersToLatLon(origin, centerMetersX, centerMetersY),
    [origin, centerMetersX, centerMetersY]);

  const leafletZoom = Math.max(3, Math.min(18, Math.round(13 + Math.log2(Math.max(zoomLevel, 0.01)))));

  const handleMapMove = (newCenter: L.LatLng) => {
    const newCenterMeters = latLonToMeters(origin, newCenter.lat, newCenter.lng);
    const newPanX = newCenterMeters.x - ownship.position.x;
    const newPanY = newCenterMeters.y - ownship.position.y;
    onPan({ x: newPanX, y: newPanY });
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

    interactionRef.current = { startTime: Date.now(), startX: x, startY: y, type, entityId, autoTriggered: false };
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
      isDraggingRef.current = true;
      if (indTimer.current) clearTimeout(indTimer.current);
      if (hldTimer.current) clearTimeout(hldTimer.current);
      setLongPressIndicator(null);
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
    const displayRotation = heading + rotation;

    const svgString = renderToStaticMarkup(
      <div style={{
        width: '48px', height: '48px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `rotate(${displayRotation}deg)`,
        transition: 'transform 0.1s linear'
      }}>
        <div style={{ width: '100%', height: '100%' }}>{IconComponent}</div>
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
    >
      <MapContainer
        center={centerLatLon}
        zoom={leafletZoom}
        className="h-full w-full z-0"
        zoomControl={false}
        attributionControl={false}
        zoomAnimation={true}
        zoomSnap={0}
        zoomDelta={0.1}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController
          center={centerLatLon}
          zoom={leafletZoom}
          rotation={mapRotation}
          onMapMove={handleMapMove}
          onMapZoom={handleMapZoom}
          onMapClickBlockCheck={checkMapClickBlock}
        />

        {/* Ownship */}
        <Marker
          position={metersToLatLon(origin, ownship.position.x, ownship.position.y)}
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
        {entities.map(entity => (
          <Marker
            key={entity.id}
            position={metersToLatLon(origin, entity.position.x, entity.position.y)}
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
