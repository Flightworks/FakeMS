import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, CircleMarker, Circle, Rectangle, Polygon, Pane, useMap, useMapEvents } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Entity, EntityType, MapMode, PrototypeSettings, SystemStatus, StabMode } from '../types';
import type { Position } from '../types';
import type { CoastBBox } from '../domain/coastPack';
import type { ContextActionRequest } from '../application/buildCommandContext';
import {
  CONTEXT_ACTION_IDS,
  getAvailableContextActionTree,
  type ContextActionContextKind,
  type ContextActionFamily,
  type ContextActionInput,
  type ContextActionLeaf,
  type ContextActionTarget,
} from '../domain/contextActions';
import type { MissionActionRequest } from '../domain/missionActions';
import type { ProjectionPreview, SimulatedDesignation } from '../domain/designations';
import type { BearingIntersectionResult } from '../domain/bearingIntersection';
import type { BullseyeProjectionPreview, BullseyeReference } from '../domain/bullseye';
import type { FuturePositionPreview } from '../domain/futurePosition';
import type { ActiveSimulatedRoute } from '../domain/routeSummary';
import type { TacticalLayerState } from '../domain/layers';
import { createLayerState, isLayerEffectivelyVisible } from '../domain/layers';
import type { GridState } from '../domain/grid';
import { buildGridLines, createGridState } from '../domain/grid';
import type { NamedZone } from '../domain/zones';
import type { TrackTrailState } from '../domain/trackTrails';
import { getTrailSegments } from '../domain/trackTrails';
import { TacticalBasemap } from './TacticalBasemap';
import { TacticalCoastalDetail } from './TacticalCoastalDetail';
import { TacticalCoastPack } from './TacticalCoastPack';
import { TacticalAirports } from './TacticalAirports';
import {
  createDeclutterState,
  isDeclutterCategoryHidden,
  type DeclutterState,
} from '../domain/declutter';
import {
  getLegendSymbolId,
  type LegendEntryId,
} from '../domain/legend';
import { positionToMeterOffset } from '../domain/mapCoordinates';
import { getDestinationPoint } from '../utils/geo';
import { HelicopterSymbol, WaypointSymbol, EnemySymbol, AirportSymbol } from './IconSymbols';
import { PieMenu, PieMenuOption } from './PieMenu';
import {
  Crosshair,
  ArrowLeftRight,
  TrendingUp,
  ChevronUp,
  MapPin,
  Info,
  Eye,
  Flag,
  Target,
  CornerUpRight,
  FileText,
} from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

export type ContextActionHandler = (request: ContextActionRequest) => void;

// Fix Leaflet's default icon path issues
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
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
  onPan: (offset: { x: number, y: number }) => void;
  selectedEntityId: string | null;
  onSelectEntity: (id: string | null) => void;
  origin: { lat: number; lon: number };
  gestureSettings: PrototypeSettings;
  onMapDrop?: (e: React.DragEvent) => void;
  stabMode: StabMode;
  setStabMode: (m: StabMode) => void;
  frozenHeading: number | null;
  setFrozenHeading: (h: number | null) => void;
  onResetStab: () => void;
  setMapMode: (m: MapMode) => void;
  groundAnchor: {lat: number, lon: number} | null;
  onGhostEvent?: (isGhost: boolean) => void;
  onMissionAction?: (request: MissionActionRequest) => void;
  onContextAction?: ContextActionHandler;
  projectionPreview?: ProjectionPreview | null;
  intersectionPreview?: BearingIntersectionResult | null;
  bullseye?: BullseyeReference | null;
  bullseyeProjectionPreview?: BullseyeProjectionPreview | null;
  futurePositionPreview?: FuturePositionPreview | null;
  layers?: TacticalLayerState;
  setLayers?: (state: TacticalLayerState) => void;
  activeRoute?: ActiveSimulatedRoute;
  declutter?: DeclutterState;
  grid?: GridState;
  trails?: TrackTrailState;
  visibleZone?: NamedZone | null;
  confirmedDesignations?: SimulatedDesignation[];
  showDesignationList?: boolean;
  onConfirmDesignation?: () => void;
  onClearProjectionPreview?: () => void;
  onClearIntersectionPreview?: () => void;
  onClearBullseyeProjectionPreview?: () => void;
  onClearFuturePositionPreview?: () => void;
}

type ContextMenuState = {
  x: number;
  y: number;
  type: 'ENTITY' | 'MAP';
  entityId?: string;
  target?: ContextActionTarget;
  input: ContextActionInput;
  tree: ReturnType<typeof getAvailableContextActionTree>;
};

const contextKindForEntity = (entity: Entity): ContextActionContextKind | null => {
  if (entity.type === EntityType.OWNSHIP) return 'OWNSHIP';
  if (entity.type === EntityType.WAYPOINT) return 'WAYPOINT';
  if (entity.type === EntityType.ENEMY || entity.type === EntityType.FRIENDLY) return 'TRACK';
  if (entity.type === EntityType.AIRPORT && entity.label === 'BASE') return 'BASE';
  return null;
};

const copyContextTarget = (entity: Entity): ContextActionTarget => ({
  id: entity.id,
  label: entity.label,
  type: entity.type,
  position: { ...entity.position },
  ...(entity.metadata ? { metadata: { ...entity.metadata } } : {}),
});

const hasCompleteFuturePositionKinematics = (entity: Entity | undefined): boolean => {
  if (!entity) return false;
  const freshness = entity.metadata?.freshness;
  return Number.isFinite(entity.position.lat)
    && Number.isFinite(entity.position.lon)
    && Number.isFinite(entity.heading)
    && (entity.heading ?? -1) >= 0
    && (entity.heading ?? 360) < 360
    && Number.isFinite(entity.speed)
    && (entity.speed ?? -1) >= 0
    && (freshness === undefined || freshness === 'FRESH');
};

const disabledContextActionIds = (
  context: ContextActionContextKind,
  targetEntity: Entity | undefined,
): string[] => {
  switch (context) {
    case 'MAP':
      // The catalogue's labels leaf has no independent display callback. The
      // explicit DECLUTTER leaf below is the only executable label policy.
      return [CONTEXT_ACTION_IDS.MAP.LABELS];
    case 'OWNSHIP':
      return hasCompleteFuturePositionKinematics(targetEntity)
        ? []
        : [CONTEXT_ACTION_IDS.OWNSHIP.FUTURE_POSITION];
    case 'WAYPOINT':
      return hasCompleteFuturePositionKinematics(targetEntity)
        ? []
        : [CONTEXT_ACTION_IDS.WAYPOINT.PROJECTION];
    case 'TRACK':
      return [
        CONTEXT_ACTION_IDS.TRACK.CPA,
        CONTEXT_ACTION_IDS.TRACK.CLOSURE,
        CONTEXT_ACTION_IDS.TRACK.LOCAL_REFERENCE,
        ...(hasCompleteFuturePositionKinematics(targetEntity)
          ? []
          : [CONTEXT_ACTION_IDS.TRACK.FUTURE_POSITION]),
      ];
    case 'BASE':
      return hasCompleteFuturePositionKinematics(targetEntity)
        ? []
        : [CONTEXT_ACTION_IDS.BASE.PROJECTION];
  }
};

const contextIconFor = (category: string): React.ElementType => {
  switch (category) {
    case 'VIEW': return Crosshair;
    case 'DISPLAY': return Eye;
    case 'MEASURE': return ArrowLeftRight;
    case 'NAV_SIM': return TrendingUp;
    case 'STABILIZE': return Crosshair;
    case 'TRAIL': return TrendingUp;
    case 'DATA': return Info;
    case 'DIRECT_SIM': return CornerUpRight;
    case 'POINT': return MapPin;
    case 'ROUTE': return Flag;
    case 'TRACKING': return TrendingUp;
    case 'DESIGNATE': return Target;
    case 'JOIN': return CornerUpRight;
    case 'CREATE': return MapPin;
    default: return FileText;
  }
};


const EARTH_RADIUS = 6378137;

// The map is intentionally oversized inside the visible viewport. This stable
// geographic envelope mirrors that extent and changes only with the live center
// and Leaflet zoom, not with stale entity props or every pointer event.
const buildCoastViewport = (center: { lat: number; lon: number }, zoom: number): CoastBBox => {
  const scale = Math.pow(2, Math.max(0, zoom));
  const halfLongitude = Math.min(180, 900 / scale);
  const halfLatitude = Math.min(90, 450 / scale);
  return [
    Math.max(-180, center.lon - halfLongitude),
    Math.max(-90, center.lat - halfLatitude),
    Math.min(180, center.lon + halfLongitude),
    Math.min(90, center.lat + halfLatitude),
  ];
};

const formatIntersectionBearing = (value: number): string => (
  Number.isInteger(value)
    ? value.toFixed(0).padStart(3, '0')
    : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
);

const formatProjectedTimestamp = (value: number | null): string => (
  value === null ? 'UNKNOWN' : new Date(value).toISOString()
);

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

// Ghost Tracker component
interface GhostTrackerProps {
  onGhost: (isGhost: boolean) => void;
  ownshipPos: { lat: number; lon: number };
  mapRotation: number;
  stabMode: StabMode;
  activePanX: number;
  activePanY: number;
  setGhostData: (data: { x: number; y: number, angle: number } | null) => void;
  setIsOffCenter: (val: boolean) => void;
}

const GhostTracker: React.FC<GhostTrackerProps> = ({ 
  onGhost, ownshipPos, mapRotation, stabMode, activePanX, activePanY, setGhostData, setIsOffCenter 
}) => {
  const map = useMap();
  const lastGhostRef = useRef(false);
  const lastOffCenterRef = useRef(false);
  const onGhostRef = useRef(onGhost);
  onGhostRef.current = onGhost;

  useEffect(() => {
    const handler = () => {
      const container = map.getContainer();
      const viewport = container.parentElement;
      if (!viewport) return;

      const size = map.getSize(); // Map element size (might be oversized)
      const viewportSize = { x: viewport.clientWidth, y: viewport.clientHeight };
      
      if (viewportSize.x <= 0 || viewportSize.y <= 0) return;

      const cx = size.x / 2;
      const cy = size.y / 2;

      // Viewport center relative to viewport itself
      const vcx = viewportSize.x / 2;
      const vcy = viewportSize.y / 2;

      const pt = map.latLngToContainerPoint([ownshipPos.lat, ownshipPos.lon]);

      // Vector from map center to ownship in container pixels
      const lx = pt.x - cx;
      const ly = pt.y - cy;

      // Check if visually off-center
      const offCenter = Math.abs(lx) > 10 || Math.abs(ly) > 10;
      if (lastOffCenterRef.current !== offCenter) {
        lastOffCenterRef.current = offCenter;
        setIsOffCenter(offCenter);
      }

      // Rotate map-relative vector by mapRotation to get screen-relative vector
      const rad = mapRotation * Math.PI / 180;
      const cosR = Math.cos(rad);
      const sinR = Math.sin(rad);
      
      const sx = lx * cosR - ly * sinR;
      const sy = lx * sinR + ly * cosR;

      const padding = 35; 
      const screenHalfW = viewportSize.x / 2 - padding;
      const screenHalfH = viewportSize.y / 2 - padding;

      const isOutside = Math.abs(sx) > screenHalfW || Math.abs(sy) > screenHalfH;

      if (!isOutside) {
         setGhostData(null);
         if (lastGhostRef.current) {
           lastGhostRef.current = false;
           onGhostRef.current(false);
         }
         return;
      }

      if (!lastGhostRef.current) {
        lastGhostRef.current = true;
        onGhostRef.current(true);
      }

      // Calculate ghost indicator position on screen edge
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

      // Position is relative to viewport center
      setGhostData({ x: vcx + rx, y: vcy + ry, angle: angleDeg });
    };

    map.on('move', handler);
    map.on('zoom', handler);
    handler();

    return () => { 
      map.off('move', handler); 
      map.off('zoom', handler); 
    };
  }, [map, ownshipPos.lat, ownshipPos.lon, stabMode, mapRotation, activePanX, activePanY, setGhostData, setIsOffCenter]); // Removed onGhost from deps

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
  onMapDrop,
  stabMode,
  setStabMode,
  frozenHeading,
  setFrozenHeading,
  onResetStab,
  setMapMode,
  groundAnchor,
  onGhostEvent,
  onContextAction,
  projectionPreview,
  intersectionPreview,
  bullseye,
  bullseyeProjectionPreview,
  futurePositionPreview,
  layers = createLayerState(),
  setLayers,
  activeRoute,
  declutter = createDeclutterState(),
  grid = createGridState(),
  trails = { trails: {} },
  visibleZone = null,
  confirmedDesignations = [],
  showDesignationList = false,
  onConfirmDesignation,
  onClearProjectionPreview,
  onClearIntersectionPreview,
  onClearBullseyeProjectionPreview,
  onClearFuturePositionPreview,
}) => {
  const [pieMenu, setPieMenu] = useState<ContextMenuState | null>(null);
  const mapRootRef = useRef<HTMLDivElement>(null);
  const [longPressIndicator, setLongPressIndicator] = useState<{ x: number, y: number } | null>(null);
  const [ghostData, setGhostData] = useState<{x: number, y: number, angle: number} | null>(null);
  const [isOffCenter, setIsOffCenter] = useState(false);

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
  const activeTouchPointersRef = useRef(new Set<number>());
  const isPinchingRef = useRef(false);

  const cancelCustomInteraction = () => {
    if (indTimer.current) clearTimeout(indTimer.current);
    if (hldTimer.current) clearTimeout(hldTimer.current);
    setLongPressIndicator(null);
    interactionRef.current = null;
    isDraggingRef.current = false;
  };

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
          const rad = deltaDeg * (Math.PI / 180); // +deltaDeg: compensates for Leaflet y-axis inversion vs screen CSS y-down coordinates
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
    const base = (stabMode === StabMode.GND && groundAnchor)
      ? groundAnchor
      : ownship.position;
    const offset = positionToMeterOffset(base, { lat: newCenter.lat, lon: newCenter.lng });
    onPan({ x: offset.eastMeters, y: offset.northMeters });
  };

  const handleMapZoom = (newZoom: number) => {
    const newAppZoom = Math.pow(2, newZoom - 13);
    onZoom(newAppZoom);
  };

  const lastTouchTime = useRef(0);

  // --- Interaction Logic ---

  const startInteraction = (x: number, y: number, type: 'MAP' | 'ENTITY', entityId?: string, pointerType: 'mouse' | 'touch' | 'pen' = 'mouse') => {
    if (pieMenu) {
      cancelCustomInteraction();
      return;
    }
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
    if (pieMenu || !interactionRef.current) return;
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
    if (pieMenu) {
      cancelCustomInteraction();
      return;
    }
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
    cancelCustomInteraction();
    activeTouchPointersRef.current.clear();
    isPinchingRef.current = false;
    const targetEntity = type === 'ENTITY'
      ? entityId === ownship.id
        ? ownship
        : entities.find(entity => entity.id === entityId)
      : undefined;
    const context = type === 'MAP' ? 'MAP' : targetEntity ? contextKindForEntity(targetEntity) : null;
    if (!context) {
      // Static/decorative airports and unknown markers are never mission
      // contexts. They may still be rendered, but they cannot open a radial.
      setPieMenu(null);
      return;
    }

    const mapPosition: Position = Array.isArray(centerLatLon)
      ? { lat: centerLatLon[0], lon: centerLatLon[1] }
      : { lat: centerLatLon.lat, lon: centerLatLon.lng };
    const target = targetEntity ? copyContextTarget(targetEntity) : undefined;
    const activeActionIds = [
      ...(vectorsEffectivelyVisible ? [CONTEXT_ACTION_IDS.MAP.VECTORS] : []),
      ...(grid.enabled ? [CONTEXT_ACTION_IDS.MAP.GRID] : []),
      ...(declutter.preset !== 'FULL' ? [CONTEXT_ACTION_IDS.MAP.DECLUTTER] : []),
    ];
    const input: ContextActionInput = target
      ? {
        context,
        target,
        activeActionIds,
        disabledActionIds: disabledContextActionIds(context, targetEntity),
      }
      : {
        context: 'MAP',
        position: { ...mapPosition },
        activeActionIds,
        disabledActionIds: disabledContextActionIds('MAP', undefined),
      };
    const tree = getAvailableContextActionTree(input);
    if (!tree.accepted || !tree.available) {
      setPieMenu(null);
      return;
    }

    setPieMenu({ x, y, type, entityId, target, input, tree });
    setLongPressIndicator(null);
    menuOpenTimeRef.current = Date.now();
    if (navigator.vibrate && gestureSettings.hapticEnabled) navigator.vibrate(50);
  };

  const closePieMenu = () => {
    activeTouchPointersRef.current.clear();
    isPinchingRef.current = false;
    setPieMenu(null);
  };

  const checkMapClickBlock = () => {
    // Prevent ghost clicks from closing the menu immediately
    return (Date.now() - menuOpenTimeRef.current < 350);
  };

  const getPieOptions = (): PieMenuOption[] => {
    if (!pieMenu) return [];

    const dispatchLeaf = (leaf: ContextActionLeaf) => {
      const position = leaf.position ?? pieMenu.tree.position;
      if (!position || !onContextAction) return;
      onContextAction({
        actionId: leaf.id,
        context: pieMenu.tree.context,
        ...(leaf.targetId === undefined ? {} : { targetId: leaf.targetId }),
        ...(pieMenu.target?.label === undefined ? {} : { targetLabel: pieMenu.target.label }),
        ...(pieMenu.target?.type === undefined ? {} : { targetType: pieMenu.target.type }),
        position: { ...position },
      });
    };
    const toOption = (leaf: ContextActionLeaf): PieMenuOption => ({
      label: leaf.label,
      icon: contextIconFor(leaf.category),
      color: leaf.active ? 'primary' : 'default',
      ...(onContextAction ? { action: () => dispatchLeaf(leaf) } : {}),
    });
    const toFamilyOption = (family: ContextActionFamily): PieMenuOption => ({
      label: family.label,
      icon: contextIconFor(family.category),
      color: family.active ? 'primary' : 'default',
      subOptions: family.children.map(toOption),
    });

    return pieMenu.tree.roots
      .filter(root => root.available)
      .map(root => root.kind === 'FAMILY' ? toFamilyOption(root) : toOption(root));
  };

  const createEntityIcon = (entity: Entity, rotation: number, isSelected: boolean) => {
    const legendSymbolId: LegendEntryId = getLegendSymbolId(entity.type);
    const labelCategory = entity.type === EntityType.WAYPOINT
      ? 'WAYPOINT_LABELS'
      : entity.type === EntityType.AIRPORT
        ? 'AIRPORT_LABELS'
        : 'TRACK_LABELS';
    const showEntityLabel = !isDeclutterCategoryHidden(declutter, labelCategory);
    let IconComponent;
    switch (entity.type) {
      case EntityType.OWNSHIP: IconComponent = <HelicopterSymbol />; break;
      case EntityType.ENEMY: IconComponent = <EnemySymbol selected={isSelected} showText={showEntityLabel} />; break;
      case EntityType.AIRPORT: IconComponent = <AirportSymbol selected={isSelected} />; break;
      default: IconComponent = <WaypointSymbol selected={isSelected} showText={showEntityLabel} />; break;
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
        data-legend-symbol={legendSymbolId}
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
          style={{ transform: `rotate(${-rotation}deg)`, display: showEntityLabel ? 'inline-block' : 'none' }}
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

  const isMarkerTarget = (target: EventTarget | null): boolean =>
    target instanceof Element && Boolean(target.closest('.leaflet-marker-icon, .custom-entity-icon'));

  const isProjectionPreviewTarget = (target: EventTarget | null): boolean =>
    target instanceof Element && Boolean(target.closest('[data-projection-preview-overlay], .projection-preview-pane, .bearing-intersection-preview-overlay, .bearing-intersection-pane, .simulated-designation-pane, .future-position-preview-overlay, .future-position-preview-pane'));

  const cancelProjectionPreviewInteraction = (event: React.PointerEvent<HTMLDivElement>): boolean => {
    if (!isProjectionPreviewTarget(event.target)) return false;

    cancelCustomInteraction();
    if (event.pointerType === 'touch') {
      activeTouchPointersRef.current.delete(event.pointerId);
      if (activeTouchPointersRef.current.size === 0) isPinchingRef.current = false;
    }
    return true;
  };

  const handleMapPointerDownCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pieMenu) {
      event.preventDefault();
      return;
    }
    if (cancelProjectionPreviewInteraction(event)) return;

    if (event.pointerType === 'touch') {
      activeTouchPointersRef.current.add(event.pointerId);
      if (activeTouchPointersRef.current.size > 1) {
        isPinchingRef.current = true;
        cancelCustomInteraction();
        return;
      }
    }

    if (isPinchingRef.current || isMarkerTarget(event.target)) return;
    startInteraction(event.clientX, event.clientY, 'MAP', undefined, event.pointerType as 'mouse' | 'touch' | 'pen');
  };

  const handleMapPointerMoveCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pieMenu) {
      event.preventDefault();
      return;
    }
    if (cancelProjectionPreviewInteraction(event)) return;
    if (isPinchingRef.current || (event.pointerType === 'touch' && activeTouchPointersRef.current.size > 1)) return;
    moveInteraction(event.clientX, event.clientY);
  };

  const handleMapPointerUpCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pieMenu) {
      event.preventDefault();
      return;
    }
    if (cancelProjectionPreviewInteraction(event)) return;

    if (event.pointerType === 'touch') {
      activeTouchPointersRef.current.delete(event.pointerId);
      if (isPinchingRef.current) {
        if (activeTouchPointersRef.current.size === 0) isPinchingRef.current = false;
        cancelCustomInteraction();
        return;
      }
      if (activeTouchPointersRef.current.size > 0) return;
    }

    endInteraction(event.clientX, event.clientY);
  };

  const handleMapPointerCancelCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pieMenu) {
      event.preventDefault();
      return;
    }
    if (cancelProjectionPreviewInteraction(event)) return;
    if (event.pointerType === 'touch') {
      activeTouchPointersRef.current.delete(event.pointerId);
      if (activeTouchPointersRef.current.size === 0) isPinchingRef.current = false;
    }
    cancelCustomInteraction();
  };

  const projectionLinePositions: LatLngExpression[] = projectionPreview
    ? projectionPreview.line.map(position => [position.lat, position.lon] as [number, number])
    : [];
  const intersectionLinePositions: LatLngExpression[][] = intersectionPreview
    ? intersectionPreview.legs.map(leg => [
        [leg.position.lat, leg.position.lon],
        [intersectionPreview.position.lat, intersectionPreview.position.lon],
      ])
    : [];
  const futurePositionLinePositions: LatLngExpression[] = futurePositionPreview
    ? futurePositionPreview.result.line.map(position => [position.lat, position.lon] as [number, number])
    : [];
  const vectorsHiddenByDeclutter = isDeclutterCategoryHidden(declutter, 'VECTORS');
  const vectorsEffectivelyVisible = isLayerEffectivelyVisible(layers, 'VECTORS', vectorsHiddenByDeclutter);
  const vectorLinePositions: LatLngExpression[][] = vectorsEffectivelyVisible
    ? [ownship, ...entities]
      .filter(entity => Number.isFinite(entity.heading) && Number.isFinite(entity.speed) && (entity.speed ?? 0) > 0)
      .map(entity => {
        const endpoint = getDestinationPoint(
          entity.position.lat,
          entity.position.lon,
          (entity.speed ?? 0) * 1852 / 60,
          entity.heading ?? 0,
        );
        return [[entity.position.lat, entity.position.lon], [endpoint.lat, endpoint.lon]];
      })
    : [];
  const routeLinePositions: LatLngExpression[] = layers.ROUTE.visible && activeRoute && !activeRoute.hidden
    ? [activeRoute.origin, ...activeRoute.waypoints.map(waypoint => waypoint.position)]
      .map(position => [position.lat, position.lon] as [number, number])
    : [];
  const gridCenter = Array.isArray(centerLatLon)
    ? { lat: centerLatLon[0], lon: centerLatLon[1] }
    : { lat: centerLatLon.lat, lon: centerLatLon.lng };
  const coastViewport = useMemo(
    () => buildCoastViewport(
      Array.isArray(centerLatLon)
        ? { lat: centerLatLon[0], lon: centerLatLon[1] }
        : { lat: centerLatLon.lat, lon: centerLatLon.lng },
      leafletZoom,
    ),
    [centerLatLon, leafletZoom],
  );
  const gridLinePositions: LatLngExpression[][] = grid.enabled
    ? buildGridLines(gridCenter, leafletZoom, grid.stepMinutes)
      .map(line => line.map(position => [position.lat, position.lon] as [number, number]))
    : [];
  const trailLineSegments = Object.values(trails.trails).flatMap(trail => (
    trail.visible
      ? getTrailSegments(trail)
        .filter(segment => segment.length > 1)
        .map(segment => ({
          id: `${trail.targetId}:${segment[0]?.segmentId ?? 0}`,
          positions: segment.map(point => [point.position.lat, point.position.lon] as [number, number]),
          color: trail.targetId === 'OWNSHIP' ? '#38bdf8' : '#f97316',
        }))
      : []
  ));

  return (
    <div
      ref={mapRootRef}
      tabIndex={-1}
      aria-label="Map interaction surface"
      className="absolute inset-0 bg-slate-950 overflow-hidden touch-none"
      data-map-origin={`${origin.lat.toFixed(4)},${origin.lon.toFixed(4)}`}
      onPointerDownCapture={handleMapPointerDownCapture}
      onPointerMoveCapture={handleMapPointerMoveCapture}
      onPointerUpCapture={handleMapPointerUpCapture}
      onTouchStartCapture={() => { lastTouchTime.current = Date.now(); }}
      onPointerCancelCapture={handleMapPointerCancelCapture}
      onWheelCapture={(event) => {
        if (pieMenu) event.preventDefault();
      }}
      onClickCapture={(event) => {
        if (pieMenu) event.preventDefault();
      }}
      onContextMenuCapture={(event) => {
        if (pieMenu) event.preventDefault();
      }}
      onDragOver={(e) => {
        if (pieMenu) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (!pieMenu) onMapDrop?.(e);
      }}
    >
      <div
        className="sr-only"
        role="status"
        aria-label="Vector layer visibility"
        data-testid="vector-layer-status"
      >
        VECTORS {vectorsEffectivelyVisible ? 'ON' : 'OFF'}{vectorsHiddenByDeclutter ? ' · DECLUTTER' : ''}
      </div>
      <MapContainer
        center={centerLatLon}
        zoom={leafletZoom}
        className="absolute -inset-[75%] z-0 tactical-map"
        zoomControl={false}
        attributionControl={false}
        zoomAnimation={true}
        zoomSnap={0}
        zoomDelta={0.1}
        dragging={false}
        touchZoom="center"
        doubleClickZoom={false}
        scrollWheelZoom={true}
      >
        <TacticalBasemap />
        <TacticalCoastalDetail />
        <TacticalCoastPack
          center={gridCenter}
          viewport={coastViewport}
          zoom={leafletZoom}
        />
        <TacticalAirports />

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

        <GhostTracker 
          onGhost={(isGhost) => onGhostEvent && onGhostEvent(isGhost)}
          ownshipPos={ownship.position}
          mapRotation={mapRotation}
          stabMode={stabMode}
          activePanX={activePan.x}
          activePanY={activePan.y}
          setGhostData={setGhostData}
          setIsOffCenter={setIsOffCenter}
        />

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
        {gridLinePositions.length > 0 && (
          <Pane name="latitudeLongitudeGridLayer" style={{ pointerEvents: 'none' }}>
            {gridLinePositions.map((line, index) => (
              <Polyline
                key={`grid-line-${index}`}
                positions={line}
                className="latlon-grid-line"
                interactive={false}
                pathOptions={{ color: '#64748b', weight: 1, opacity: 0.55, dashArray: '3 5' }}
              />
            ))}
          </Pane>
        )}

        {visibleZone && (
          <Pane name="namedZoneLayer" className="named-zone-layer" style={{ pointerEvents: 'none' }}>
            {visibleZone.geometry.kind === 'RECTANGLE' && (
              <Rectangle
                bounds={[
                  [visibleZone.geometry.bounds.minLat, visibleZone.geometry.bounds.minLon],
                  [visibleZone.geometry.bounds.maxLat, visibleZone.geometry.bounds.maxLon],
                ]}
                pathOptions={{ color: '#a78bfa', weight: 2, opacity: 0.9, fillOpacity: 0.08, dashArray: '8 5' }}
              />
            )}
            {visibleZone.geometry.kind === 'CIRCLE' && (
              <Circle
                center={[visibleZone.geometry.center.lat, visibleZone.geometry.center.lon]}
                radius={visibleZone.geometry.radiusNm * 1852}
                pathOptions={{ color: '#a78bfa', weight: 2, opacity: 0.9, fillOpacity: 0.08, dashArray: '8 5' }}
              />
            )}
            {visibleZone.geometry.kind === 'POLYGON' && (
              <Polygon
                positions={visibleZone.geometry.points.map(point => [point.lat, point.lon] as [number, number])}
                pathOptions={{ color: '#a78bfa', weight: 2, opacity: 0.9, fillOpacity: 0.08, dashArray: '8 5' }}
              />
            )}
          </Pane>
        )}

        {trailLineSegments.length > 0 && (
          <Pane name="trackTrailLayer" className="track-trail-layer" style={{ pointerEvents: 'none' }}>
            {trailLineSegments.map(segment => (
              <Polyline
                key={`trail-${segment.id}`}
                positions={segment.positions}
                className="track-trail-line"
                interactive={false}
                pathOptions={{ color: segment.color, weight: 2, opacity: 0.65, dashArray: '2 5' }}
              />
            ))}
          </Pane>
        )}

        {routeLinePositions.length > 1 && (
          <Pane name="simulatedRouteLayer" style={{ pointerEvents: 'none' }}>
            <Polyline
              positions={routeLinePositions}
              interactive={false}
              pathOptions={{ color: '#f59e0b', weight: 3, opacity: 0.9, dashArray: '10 6' }}
            />
          </Pane>
        )}

        {vectorLinePositions.length > 0 && (
          <Pane name="kinematicVectorsLayer" style={{ pointerEvents: 'none' }}>
            {vectorLinePositions.map((line, index) => (
              <Polyline
                key={`vector-${index}`}
                positions={line}
                className="kinematic-vector-line"
                interactive={false}
                pathOptions={{ color: '#22d3ee', weight: 1.5, opacity: 0.8, dashArray: '4 3' }}
              />
            ))}
          </Pane>
        )}

        {entities
          .filter(entity => {
            if (!layers.TRACKS.visible) return false;
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

        {futurePositionPreview && (
          <Pane
            name="futurePositionPreviewPane"
            className="future-position-preview-pane"
            style={{ pointerEvents: 'none' }}
          >
            <Polyline
              positions={futurePositionLinePositions}
              interactive={false}
              pane="futurePositionPreviewPane"
              pathOptions={{
                color: '#c084fc',
                dashArray: '6 5',
                weight: 3,
                opacity: 0.9,
              }}
            />
            <CircleMarker
              center={[futurePositionPreview.result.targetPosition.lat, futurePositionPreview.result.targetPosition.lon]}
              radius={9}
              interactive={false}
              pane="futurePositionPreviewPane"
              pathOptions={{
                color: '#e879f9',
                fillColor: '#7e22ce',
                fillOpacity: 0.85,
                weight: 3,
              }}
            />
          </Pane>
        )}

        {bullseye && (
          <Pane
            name="simulatedBullseyePane"
            className="simulated-bullseye-pane"
            style={{ pointerEvents: 'none' }}
          >
            <CircleMarker
              center={[bullseye.position.lat, bullseye.position.lon]}
              radius={10}
              interactive={false}
              pane="simulatedBullseyePane"
              pathOptions={{
                color: '#22d3ee',
                fillColor: '#0e7490',
                fillOpacity: 0.75,
                weight: 3,
              }}
            />
          </Pane>
        )}

        {bullseyeProjectionPreview && (
          <Pane
            name="bullseyeProjectionPreviewPane"
            className="bullseye-projection-preview-pane"
            style={{ pointerEvents: 'auto' }}
          >
            <Polyline
              positions={bullseyeProjectionPreview.line.map(position => [position.lat, position.lon] as [number, number])}
              interactive={false}
              pane="bullseyeProjectionPreviewPane"
              pathOptions={{
                color: '#38bdf8',
                dashArray: '7 5',
                weight: 3,
                opacity: 0.9,
              }}
            />
            <CircleMarker
              center={[bullseyeProjectionPreview.targetPosition.lat, bullseyeProjectionPreview.targetPosition.lon]}
              radius={8}
              interactive={false}
              pane="bullseyeProjectionPreviewPane"
              pathOptions={{
                color: '#facc15',
                fillColor: '#facc15',
                fillOpacity: 0.9,
                weight: 2,
              }}
            />
          </Pane>
        )}

        {confirmedDesignations.length > 0 && (
          <Pane
            name="simulatedDesignationPane"
            className="simulated-designation-pane"
            style={{ pointerEvents: 'auto' }}
          >
            {confirmedDesignations.map((designation) => (
              <CircleMarker
                key={designation.id}
                center={[designation.position.lat, designation.position.lon]}
                radius={7}
                interactive={false}
                pane="simulatedDesignationPane"
                pathOptions={{
                  color: '#a78bfa',
                  fillColor: '#a78bfa',
                  fillOpacity: 0.9,
                  weight: 2,
                }}
              />
            ))}
          </Pane>
        )}

        {projectionPreview && (
          <Pane
            name="projectionPreviewPane"
            className="projection-preview-pane"
            style={{ pointerEvents: 'auto' }}
          >
            <Polyline
              positions={projectionLinePositions}
              interactive={false}
              pane="projectionPreviewPane"
              pathOptions={{
                color: '#22d3ee',
                dashArray: '8 6',
                weight: 3,
                opacity: 0.9,
              }}
            />
            <CircleMarker
              center={[projectionPreview.targetPosition.lat, projectionPreview.targetPosition.lon]}
              radius={8}
              interactive={false}
              pane="projectionPreviewPane"
              pathOptions={{
                color: '#fbbf24',
                fillColor: '#fbbf24',
                fillOpacity: 0.85,
                weight: 2,
              }}
            />
          </Pane>
        )}

        {intersectionPreview && (
          <Pane
            name="bearingIntersectionPane"
            className="bearing-intersection-pane"
            style={{ pointerEvents: 'auto' }}
          >
            {intersectionLinePositions.map((positions, index) => (
              <Polyline
                key={`bearing-intersection-leg-${index}`}
                positions={positions}
                interactive={false}
                pane="bearingIntersectionPane"
                pathOptions={{
                  color: '#f97316',
                  dashArray: '6 5',
                  weight: 3,
                  opacity: 0.9,
                }}
              />
            ))}
            <CircleMarker
              center={[intersectionPreview.position.lat, intersectionPreview.position.lon]}
              radius={8}
              interactive={false}
              pane="bearingIntersectionPane"
              pathOptions={{
                color: '#fb923c',
                fillColor: '#fb923c',
                fillOpacity: 0.9,
                weight: 2,
              }}
            />
          </Pane>
        )}

      </MapContainer>

      {(confirmedDesignations.length > 0 || showDesignationList) && (
        <section
          className="absolute bottom-4 left-4 z-[90] rounded-lg border border-violet-400/70 bg-slate-950/90 p-3 font-mono text-xs text-slate-100 shadow-xl pointer-events-none"
          role="status"
          aria-label="Confirmed simulated designations"
          aria-live="polite"
        >
          <div className="mb-2 border-b border-slate-800 pb-1 text-violet-300">
            DESIGNATED POINTS · SIMULATED
          </div>
          {confirmedDesignations.length === 0 ? (
            <div data-testid="no-designated-points">NO DESIGNATED POINTS</div>
          ) : confirmedDesignations.map((designation) => (
              <div key={designation.id} data-testid={`confirmed-designation-${designation.label}`}>
                {designation.label} {designation.position.lat.toFixed(5)}, {designation.position.lon.toFixed(5)}
              </div>
            ))}
        </section>
      )}

      {bullseye && (
        <section
          className="absolute bottom-4 right-4 z-[90] rounded-lg border border-cyan-400/70 bg-slate-950/90 p-3 font-mono text-xs text-slate-100 shadow-xl pointer-events-none"
          role="status"
          aria-label="Simulated Bullseye"
          aria-live="polite"
          data-testid="simulated-bullseye"
        >
          <div className="mb-1 border-b border-slate-800 pb-1 text-cyan-300">BULLSEYE · SIMULATED</div>
          <div>{bullseye.label}</div>
          <div className="text-slate-400">SOURCE {bullseye.source} · STATE {bullseye.state}</div>
          <div className="text-slate-400">POSITION {bullseye.position.lat.toFixed(5)}, {bullseye.position.lon.toFixed(5)}</div>
        </section>
      )}

      {bullseyeProjectionPreview && (
        <section
          className="bullseye-projection-preview-overlay absolute top-4 right-4 z-[110] w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-sky-400/70 bg-slate-950/95 p-3 font-mono text-xs text-slate-100 shadow-xl"
          role="region"
          aria-label="Bullseye projection preview"
          aria-live="polite"
        >
          <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2 text-sky-300">
            <span>BULLSEYE PROJECTION PREVIEW</span>
            <span className="text-[10px] text-slate-400">{bullseyeProjectionPreview.referenceLabel}</span>
          </div>
          <div className="space-y-1">
            <div data-testid="bullseye-preview-point">
              TARGET {bullseyeProjectionPreview.targetPosition.lat.toFixed(5)}, {bullseyeProjectionPreview.targetPosition.lon.toFixed(5)}
            </div>
            <div data-testid="bullseye-preview-line">
              LINE BULLSEYE {bullseyeProjectionPreview.referencePosition.lat.toFixed(5)}, {bullseyeProjectionPreview.referencePosition.lon.toFixed(5)} → TARGET
            </div>
            <div className="text-emerald-300">
              {bullseyeProjectionPreview.bearingDegrees.toFixed(1)}°T / {bullseyeProjectionPreview.rangeNauticalMiles.toFixed(1)} {bullseyeProjectionPreview.unit}
            </div>
            <div className="text-slate-400">METHOD {bullseyeProjectionPreview.method}</div>
          </div>
          {onClearBullseyeProjectionPreview && (
            <button
              type="button"
              className="mt-3 min-h-[32px] w-full rounded border border-amber-400/70 px-2 py-1 text-amber-300 hover:bg-amber-400/10"
              aria-label="Cancel Bullseye projection preview"
              onClick={(event) => {
                event.stopPropagation();
                onClearBullseyeProjectionPreview();
              }}
            >
              CANCEL BULLSEYE PREVIEW
            </button>
          )}
        </section>
      )}

      {projectionPreview && (
        <section
          className="projection-preview-overlay absolute top-4 left-4 z-[110] w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-cyan-400/70 bg-slate-950/95 p-3 font-mono text-xs text-slate-100 shadow-xl"
          data-projection-preview-overlay
          role="region"
          aria-label="Projection preview"
          aria-live="polite"
        >
          <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2 text-cyan-300">
            <span>PROJECTION PREVIEW</span>
            <span className="text-[10px] text-slate-400">{projectionPreview.referenceLabel}</span>
          </div>
          <div className="space-y-1">
            <div data-testid="projection-preview-point">
              POINT TARGET {projectionPreview.targetPosition.lat.toFixed(5)}, {projectionPreview.targetPosition.lon.toFixed(5)}
            </div>
            <div data-testid="projection-preview-line">
              LINE REFERENCE {projectionPreview.referencePosition.lat.toFixed(5)}, {projectionPreview.referencePosition.lon.toFixed(5)} → TARGET
            </div>
            <div className="text-emerald-300">
              {projectionPreview.bearingDegrees.toFixed(1)}°T / {projectionPreview.rangeNauticalMiles.toFixed(1)} {projectionPreview.unit}
            </div>
            <div className="text-slate-400">METHOD {projectionPreview.method}</div>
          </div>
          {onConfirmDesignation && (
            <button
              type="button"
              className="mt-3 min-h-[32px] w-full rounded border border-violet-400/70 px-2 py-1 text-violet-300 hover:bg-violet-400/10"
              aria-label="Confirm designation"
              onClick={(event) => {
                event.stopPropagation();
                onConfirmDesignation();
              }}
            >
              CONFIRM DESIGNATION
            </button>
          )}
          {onClearProjectionPreview && (
            <button
              type="button"
              className="mt-3 min-h-[32px] w-full rounded border border-amber-400/70 px-2 py-1 text-amber-300 hover:bg-amber-400/10"
              aria-label="Cancel projection preview"
              onClick={(event) => {
                event.stopPropagation();
                onClearProjectionPreview();
              }}
            >
              CANCEL PREVIEW
            </button>
          )}
        </section>
      )}

      {intersectionPreview && (
        <section
          className="bearing-intersection-preview-overlay absolute top-4 right-4 z-[110] w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-orange-400/70 bg-slate-950/95 p-3 font-mono text-xs text-slate-100 shadow-xl"
          data-bearing-intersection-preview-overlay
          role="region"
          aria-label="Bearing intersection preview"
          aria-live="polite"
        >
          <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2 text-orange-300">
            <span>BEARING INTERSECTION PREVIEW</span>
            <span className="text-[10px] text-slate-400">LOCAL · SIMULATED</span>
          </div>
          <div className="space-y-1">
            <div data-testid="bearing-intersection-preview-point">
              POINT {intersectionPreview.position.lat.toFixed(5)}, {intersectionPreview.position.lon.toFixed(5)}
            </div>
            {intersectionPreview.legs.map(leg => (
              <div key={leg.reference}>
                {leg.reference} BRG {formatIntersectionBearing(leg.bearingDegrees)}°T / RNG {leg.rangeNauticalMiles.toFixed(1)} NM
              </div>
            ))}
            <div className="text-emerald-300">
              ANGLE {intersectionPreview.crossingAngleDegrees.toFixed(2)}° · QUALITY {intersectionPreview.quality}
            </div>
            <div className="text-slate-400">METHOD {intersectionPreview.method}</div>
          </div>
          {onClearIntersectionPreview && (
            <button
              type="button"
              className="mt-3 min-h-[32px] w-full rounded border border-amber-400/70 px-2 py-1 text-amber-300 hover:bg-amber-400/10"
              aria-label="Cancel bearing intersection preview"
              onClick={(event) => {
                event.stopPropagation();
                onClearIntersectionPreview();
              }}
            >
              CANCEL INTERSECTION PREVIEW
            </button>
          )}
        </section>
      )}

      {futurePositionPreview && (
        <section
          className="future-position-preview-overlay absolute bottom-20 left-4 z-[110] w-[min(25rem,calc(100vw-2rem))] rounded-lg border border-fuchsia-400/70 bg-slate-950/95 p-3 font-mono text-xs text-slate-100 shadow-xl"
          data-future-position-preview-overlay
          role="region"
          aria-label="Future position preview"
          aria-live="polite"
        >
          <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2 text-fuchsia-300">
            <span>FUTURE POSITION PREVIEW</span>
            <span className="text-[10px] text-slate-400">{futurePositionPreview.trackLabel}</span>
          </div>
          <div className="space-y-1">
            <div data-testid="future-position-preview-point">
              GHOST {futurePositionPreview.result.targetPosition.lat.toFixed(5)}, {futurePositionPreview.result.targetPosition.lon.toFixed(5)}
            </div>
            <div data-testid="future-position-preview-vector">
              VECTOR {futurePositionPreview.groundTrackDegrees.toFixed(1)}°T @ {futurePositionPreview.groundSpeedKnots.toFixed(1)} KT
            </div>
            <div>
              HORIZON {futurePositionPreview.result.effectiveHorizonMinutes.toFixed(1)} MIN · RANGE {futurePositionPreview.result.projectedRangeNauticalMiles.toFixed(1)} NM
            </div>
            <div data-testid="future-position-preview-timestamp">
              PROJECTED AT {formatProjectedTimestamp(futurePositionPreview.result.projectedAtMs)}
            </div>
            <div>
              AGE {futurePositionPreview.result.ageSeconds === null ? 'UNKNOWN' : `${futurePositionPreview.result.ageSeconds.toFixed(1)} S`} · LIMIT {futurePositionPreview.result.horizonLimit}
            </div>
            <div className="text-slate-400">ASSUMPTION {futurePositionPreview.result.assumption}</div>
            <div className="text-slate-500">SOURCE LOCAL SCENARIO · EFFECT MAP PREVIEW ONLY</div>
          </div>
          {onClearFuturePositionPreview && (
            <button
              type="button"
              className="mt-3 min-h-[32px] w-full rounded border border-amber-400/70 px-2 py-1 text-amber-300 hover:bg-amber-400/10"
              aria-label="Cancel future position preview"
              onClick={(event) => {
                event.stopPropagation();
                onClearFuturePositionPreview();
              }}
            >
              CANCEL FUTURE POSITION PREVIEW
            </button>
          )}
        </section>
      )}

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
      {(stabMode === StabMode.GND || isOffCenter) && (
        <button
          onClick={(e) => { e.stopPropagation(); onResetStab(); }}
          className="absolute bottom-6 right-6 z-30 w-14 h-14 flex items-center justify-center bg-slate-900/90 border-2 border-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] text-emerald-400 hover:bg-emerald-900 transition-all active:scale-90 pointer-events-auto group"
          aria-label="Recenter map on ownship"
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
          returnFocusRef={mapRootRef}
          title={pieMenu.type === 'ENTITY' ? pieMenu.target?.label || 'ENTITY' : 'MAP ACTION'}
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
