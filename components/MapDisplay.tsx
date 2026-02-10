
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useSpring, animated, to } from '@react-spring/web';
import { useGesture } from '@use-gesture/react';
import { Entity, EntityType, MapMode, PrototypeSettings } from '../types';
import { HelicopterSymbol, WaypointSymbol, EnemySymbol, AirportSymbol } from './IconSymbols';
import { PieMenu, PieMenuOption } from './PieMenu';
import { 
  MapPin, Crosshair, Navigation, Info, Trash2, CircleDashed, Radio, 
  Zap, Shield, FileText, Scan, Eye, Slash, Target, Settings, Router, 
  Lock, Anchor, Flag, Video, Wifi, Globe, Thermometer, Activity, 
  ArrowLeftRight, CornerUpRight, Flame, TrendingUp
} from 'lucide-react';

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

const GRID_SIZE = 1000; 
const TILE_SIZE = 256;
const EARTH_RADIUS = 6378137;
const INITIAL_RESOLUTION = 2 * Math.PI * EARTH_RADIUS / TILE_SIZE;
const ORIGIN_SHIFT = 2 * Math.PI * EARTH_RADIUS / 2.0;

const latLonToMeters = (lat: number, lon: number) => {
  const mx = lon * ORIGIN_SHIFT / 180.0;
  let my = Math.log(Math.tan((90 + lat) * Math.PI / 360.0)) / (Math.PI / 180.0);
  my = my * ORIGIN_SHIFT / 180.0;
  return { x: mx, y: my };
};

const metersToTile = (mx: number, my: number, zoom: number) => {
  const res = INITIAL_RESOLUTION / Math.pow(2, zoom);
  const px = (mx + ORIGIN_SHIFT) / res;
  const py = (ORIGIN_SHIFT - my) / res;
  return { tx: Math.floor(px / TILE_SIZE), ty: Math.floor(py / TILE_SIZE) };
};

const getResolution = (zoom: number) => INITIAL_RESOLUTION / Math.pow(2, zoom);

const LongPressRing = ({ x, y, duration }: { x: number, y: number, duration: number }) => {
  const [fill, setFill] = useState(false);
  
  useEffect(() => {
    requestAnimationFrame(() => setFill(true));
  }, []);

  const radius = 55; 
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="fixed pointer-events-none z-[100]" style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}>
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
  const clickBlockerRef = useRef(false);
  const isDraggingRef = useRef(false);
  const lastUpdateRef = useRef(0);
  const lastEmittedPanRef = useRef({ x: 0, y: 0 });

  const heading = typeof ownship.heading === 'number' ? ownship.heading : 0;
  const rotation = mapMode === MapMode.HEADING_UP ? -heading : 0;
  const viewCenterX = ownship.position.x + panOffset.x;
  const viewCenterY = ownship.position.y + panOffset.y;

  const vib = (pattern: number | number[]) => { if(gestureSettings.hapticEnabled && navigator.vibrate) navigator.vibrate(pattern); };

  const optimalTileZoom = useMemo(() => {
     if (!zoomLevel || zoomLevel <= 0) return 10; 
     const z = Math.log2(INITIAL_RESOLUTION * zoomLevel);
     return Math.max(0, Math.min(19, Math.floor(z)));
  }, [zoomLevel]);
  
  const originMeters = useMemo(() => latLonToMeters(origin.lat, origin.lon), [origin]);
  const viewGlobalX = originMeters.x + viewCenterX;
  const viewGlobalY = originMeters.y - viewCenterY; 
  const safeZoomLevel = zoomLevel || 1; 

  // --- Coordinate transformations ---
  const worldToScreen = (wx: number, wy: number) => {
    const dx = wx - viewCenterX;
    const dy = wy - viewCenterY;
    // Rotate around center (0,0 of screen relative to viewCenter)
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;

    // Scale and translate to screen center
    const sx = rx * safeZoomLevel;
    const sy = ry * safeZoomLevel;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    return { x: cx + sx, y: cy + sy };
  };

  const screenToWorld = (sx: number, sy: number, currentPan = panOffset, currentZoom = safeZoomLevel, currentRotation = rotation) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    // Undo translation
    const dx = sx - cx;
    const dy = sy - cy;

    // Undo scale
    const rx = dx / currentZoom;
    const ry = dy / currentZoom;

    // Undo rotation
    const rad = (-currentRotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const wx_rel = rx * cos - ry * sin;
    const wy_rel = rx * sin + ry * cos;

    // Undo pan (add view center)
    // viewCenter = ownship + panOffset
    const viewX = ownship.position.x + currentPan.x;
    const viewY = ownship.position.y + currentPan.y;

    return { x: viewX + wx_rel, y: viewY + wy_rel };
  };

  const closePieMenu = () => {
     setPieMenu(null);
     clickBlockerRef.current = true;
     setTimeout(() => { clickBlockerRef.current = false; }, 400); 
  };

  // --- Tile Generation ---
  const tiles = useMemo(() => {
    const tileMap = new Map();
    // Increase radius slightly to prevent blank edges during fast pans
    const radius = 5;
    const addTilesAround = (centerX: number, centerY: number) => {
        const centerTile = metersToTile(centerX, centerY, optimalTileZoom);
        const res = getResolution(optimalTileZoom);
        const tileMeters = TILE_SIZE * res;
        const maxTiles = Math.pow(2, optimalTileZoom);

        for (let x = centerTile.tx - radius; x <= centerTile.tx + radius; x++) {
          for (let y = centerTile.ty - radius; y <= centerTile.ty + radius; y++) {
            if (y < 0 || y >= maxTiles) continue;
            const wrappedX = ((x % maxTiles) + maxTiles) % maxTiles;
            const key = `${optimalTileZoom}-${wrappedX}-${y}`;
            if (tileMap.has(key)) continue;
            const tileMercatorX = (x * TILE_SIZE * res) - ORIGIN_SHIFT;
            const tileMercatorY_TopLeft = ORIGIN_SHIFT - (y * TILE_SIZE * res); 
            const localX = tileMercatorX - originMeters.x;
            const deltaMercatorY = tileMercatorY_TopLeft - originMeters.y;
            const localY = -deltaMercatorY;
            const subdomain = ['a', 'b', 'c'][(wrappedX + y) % 3];
            tileMap.set(key, {
              x: wrappedX, y, z: optimalTileZoom, subdomain, key,
              style: { position: 'absolute' as 'absolute', left: `${localX}px`, top: `${localY}px`, width: `${Math.ceil(tileMeters)}px`, height: `${Math.ceil(tileMeters)}px` }
            });
          }
        }
    };
    addTilesAround(viewGlobalX, viewGlobalY);
    // Also load around ownship if distinct? Maybe just viewCenter is enough.
    // addTilesAround(originMeters.x + ownship.position.x, originMeters.y - ownship.position.y);
    return Array.from(tileMap.values());
  }, [viewGlobalX, viewGlobalY, originMeters, optimalTileZoom]);

  const getEntityIcon = (entity: Entity) => {
    const isSelected = entity.id === selectedEntityId;
    switch (entity.type) {
      case EntityType.OWNSHIP: return <HelicopterSymbol />;
      case EntityType.ENEMY: return <EnemySymbol selected={isSelected} />;
      case EntityType.AIRPORT: return <AirportSymbol selected={isSelected} />;
      default: return <WaypointSymbol selected={isSelected} />;
    }
  };

  const gridLines = useMemo(() => {
    if (safeZoomLevel < 0.01) return [];
    const lines = [];
    const range = 20000;
    const startX = Math.floor((viewCenterX - range) / GRID_SIZE) * GRID_SIZE;
    const endX = Math.floor((viewCenterX + range) / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor((viewCenterY - range) / GRID_SIZE) * GRID_SIZE;
    const endY = Math.floor((viewCenterY + range) / GRID_SIZE) * GRID_SIZE;
    const majorColor = "rgba(0,0,0,0.3)";
    const minorColor = "rgba(0,0,0,0.1)";
    for (let x = startX; x <= endX; x += GRID_SIZE) {
      const isMajor = x % (GRID_SIZE * 5) === 0;
      lines.push(<line key={`v-${x}`} x1={x} y1={startY} x2={x} y2={endY} stroke={isMajor ? majorColor : minorColor} strokeWidth={isMajor ? 3 : 1} />);
    }
    for (let y = startY; y <= endY; y += GRID_SIZE) {
      const isMajor = y % (GRID_SIZE * 5) === 0;
      lines.push(<line key={`h-${y}`} x1={startX} y1={y} x2={endX} y2={y} stroke={isMajor ? majorColor : minorColor} strokeWidth={isMajor ? 3 : 1} />);
    }
    return lines;
  }, [viewCenterX, viewCenterY, safeZoomLevel]);

  const speedVectors = useMemo(() => {
    if (!gestureSettings.showSpeedVectors) return null;
    return entities.map(entity => {
      if (!entity.speed || entity.speed === 0 || entity.heading === undefined) return null;
      const scale = 10; 
      const vx = Math.cos((entity.heading - 90) * (Math.PI / 180)) * entity.speed * scale;
      const vy = Math.sin((entity.heading - 90) * (Math.PI / 180)) * entity.speed * scale;

      return (
        <line 
          key={`vec-${entity.id}`}
          x1={entity.position.x} 
          y1={entity.position.y} 
          x2={entity.position.x + vx} 
          y2={entity.position.y + vy} 
          stroke={entity.type === EntityType.ENEMY ? "rgba(239, 68, 68, 0.7)" : "rgba(16, 185, 129, 0.7)"} 
          strokeWidth={2 / safeZoomLevel}
          strokeDasharray={`${5 / safeZoomLevel}, ${2 / safeZoomLevel}`}
        />
      );
    });
  }, [entities, gestureSettings.showSpeedVectors, safeZoomLevel]);

  // --- Gesture Logic ---

  // Ref to track internal state for gestures to avoid closure staleness
  const stateRef = useRef({
    panOffset,
    zoomLevel,
    rotation
  });
  // Sync refs
  useEffect(() => {
    stateRef.current = { panOffset, zoomLevel, rotation };
  }, [panOffset, zoomLevel, rotation]);

  const [longPressIndicator, setLongPressIndicator] = useState<{x: number, y: number} | null>(null);
  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indicatorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTapTime = useRef(0);
  const longPressTriggered = useRef(false);

  // We use useSpring to drive values, but we essentially sync it to the parent state.
  // We use the spring to handle inertia and smoothing, but we report back to parent.
  // Since parent state update triggers re-render, we need to be careful.
  // Actually, for "State of the Art" feel, we might want to decouple render from parent state during interaction
  // but the whole App depends on parent state.
  // Let's use `onChange` to update parent.

  const onPanRef = useRef(onPan);
  const onZoomRef = useRef(onZoom);
  useEffect(() => {
    onPanRef.current = onPan;
    onZoomRef.current = onZoom;
  }, [onPan, onZoom]);

  // Controller for the map transform
  const [{ x, y, zoom }, api] = useSpring(() => ({
    x: panOffset.x,
    y: panOffset.y,
    zoom: zoomLevel,
    config: { friction: 20, tension: 200, mass: 1 },
    onChange: (result) => {
       const value = result.value;
       if (!value) return;

       // Throttle parent updates
       const now = Date.now();
       if (now - lastUpdateRef.current > 32) {
         lastUpdateRef.current = now;
         lastEmittedPanRef.current = { x: value.x, y: value.y };
         onPanRef.current({ x: value.x, y: value.y });
         onZoomRef.current(value.zoom);
       }
    },
    onRest: (result) => {
        const value = result.value;
        if (!value) return;
        // Ensure final position is synced on rest
        lastEmittedPanRef.current = { x: value.x, y: value.y };
        onPanRef.current({ x: value.x, y: value.y });
        onZoomRef.current(value.zoom);
    }
  }));

  // Sync spring with props
  useEffect(() => {
    // Echo Cancellation: Check if this prop update matches what we just sent
    const emitted = lastEmittedPanRef.current;
    if (Math.abs(panOffset.x - emitted.x) < 0.1 && Math.abs(panOffset.y - emitted.y) < 0.1) {
        // This update is an echo of our own change. Ignore it to preserve inertia/spring state.
        return;
    }

    // External update (e.g. Center Ownship) -> Force spring
    api.start({ x: panOffset.x, y: panOffset.y, zoom: zoomLevel, immediate: false });
  }, [panOffset, zoomLevel, api]);

  const transform = to([x, y, zoom], (xv, yv, zv) => {
    const sZoom = zv || 1;
    // Use spring values for visual transform (Fast, 60fps)
    // viewCenter logic duplicated with spring values
    const vCX = ownship.position.x + xv;
    const vCY = ownship.position.y + yv;

    return `scale(${sZoom}) rotate(${rotation}deg) translate(${-vCX}px, ${-vCY}px)`;
  });

  const startLongPress = (x: number, y: number) => {
    longPressTriggered.current = false;
    cancelLongPress(); 
    
    indicatorTimeout.current = setTimeout(() => {
      setLongPressIndicator({ x, y });
      vib(10); 
    }, gestureSettings.indicatorDelay);

    longPressTimeout.current = setTimeout(() => {
      setPieMenu({ x, y, type: 'MAP' });
      vib(50); 
      longPressTriggered.current = true;
      setLongPressIndicator(null); 
    }, gestureSettings.longPressDuration);
  };
  
  const cancelLongPress = () => {
    if (longPressTimeout.current) clearTimeout(longPressTimeout.current);
    if (indicatorTimeout.current) clearTimeout(indicatorTimeout.current);
    longPressTimeout.current = null;
    indicatorTimeout.current = null;
    setLongPressIndicator(null);
  };

  const bind = useGesture({
    onDrag: ({ event, first, movement: [mx, my], memo, cancel }) => {
      if (first) {
        isDraggingRef.current = true;
        startTapTime.current = Date.now();
        // start long press logic
        const client = (event as any).touches ? { x: (event as any).touches[0].clientX, y: (event as any).touches[0].clientY } : { x: (event as any).clientX, y: (event as any).clientY };

        startLongPress(client.x, client.y);

        // Store initial offset
        return { initialTx: x.get(), initialTy: y.get() };
      }

      // Cancel long press if moved significantly
      if (Math.hypot(mx, my) > gestureSettings.jitterTolerance) {
          cancelLongPress();
      }

      const { initialTx, initialTy } = memo;

      // Rotate movement
      const rad = (-stateRef.current.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const rmx = mx * cos - my * sin;
      const rmy = mx * sin + my * cos;

      const newX = initialTx - rmx / stateRef.current.zoomLevel;
      const newY = initialTy - rmy / stateRef.current.zoomLevel;

      api.start({ x: newX, y: newY, immediate: true });

      return memo;
    },
    onPointerDown: ({ event }) => {
        // Explicitly handle pointer down to start long press immediately for non-drag cases
        const client = (event as any).touches ? { x: (event as any).touches[0].clientX, y: (event as any).touches[0].clientY } : { x: (event as any).clientX, y: (event as any).clientY };
        startTapTime.current = Date.now();
        startLongPress(client.x, client.y);
    },
    onDragEnd: ({ velocity: [vx, vy], direction: [dx, dy], movement: [mx, my], memo }) => {
        cancelLongPress();
        setTimeout(() => { isDraggingRef.current = false; }, 50);

        // Inertia
        const power = 0.8 * gestureSettings.uiScale; // Adjust feel

        // Inertia Logic
        // vx, vy are absolute speeds
        // direction is [-1/0/1, -1/0/1]

        const screenThrowX = (vx * dx) * 200 * power;
        const screenThrowY = (vy * dy) * 200 * power;

        // Rotate throw
        const rad = (-stateRef.current.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const rThrowX = screenThrowX * cos - screenThrowY * sin;
        const rThrowY = screenThrowX * sin + screenThrowY * cos;

        const targetX = x.get() - rThrowX / stateRef.current.zoomLevel;
        const targetY = y.get() - rThrowY / stateRef.current.zoomLevel;

        api.start({ x: targetX, y: targetY, config: { friction: 50, tension: 200, mass: 1 } });
    },
    onPinch: ({ origin: [ox, oy], offset: [s], movement: [ms], event, memo }) => {
        // Pinch zoom

        if (!memo) {
            // Initial state
            const initialZoom = stateRef.current.zoomLevel;
            // Get world point under pinch center
            const worldPoint = screenToWorld(ox, oy, stateRef.current.panOffset, initialZoom, stateRef.current.rotation);
            return { initialZoom, worldPoint };
        }

        const { initialZoom, worldPoint } = memo;

        // offset[0] is scale factor
        const scaleFactor = s;
        const newZoom = Math.min(Math.max(initialZoom * scaleFactor, 0.0001), 5);

        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

        const rx = (ox - cx) / newZoom;
        const ry = (oy - cy) / newZoom;

        const rad = (stateRef.current.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const dx = rx * cos + ry * sin;
        const dy = -rx * sin + ry * cos;

        const newViewCenterX = worldPoint.x - dx;
        const newViewCenterY = worldPoint.y - dy;

        const newPanX = newViewCenterX - ownship.position.x;
        const newPanY = newViewCenterY - ownship.position.y;

        api.start({ x: newPanX, y: newPanY, zoom: newZoom, immediate: true });

        return memo;
    },
    onWheel: ({ event, delta: [dx, dy], memo }) => {
        // Zoom on wheel
        // Zoom towards mouse pointer
        const mouseX = (event as any).clientX;
        const mouseY = (event as any).clientY;

        const currentZoom = zoom.get(); // use animated value for smoothness?
        const scaleFactor = Math.exp(-dy * 0.001);
        const newZoom = Math.min(Math.max(currentZoom * scaleFactor, 0.0001), 5);

        // Calculate fix point
        const worldPoint = screenToWorld(mouseX, mouseY, { x: x.get(), y: y.get() }, currentZoom, stateRef.current.rotation);

        // Calculate new pan to keep worldPoint under mouse
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

        const rx = (mouseX - cx) / newZoom;
        const ry = (mouseY - cy) / newZoom;

        const rad = (stateRef.current.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const rdx = rx * cos + ry * sin;
        const rdy = -rx * sin + ry * cos;

        const newViewCenterX = worldPoint.x - rdx;
        const newViewCenterY = worldPoint.y - rdy;

        const newPanX = newViewCenterX - ownship.position.x;
        const newPanY = newViewCenterY - ownship.position.y;

        api.start({ x: newPanX, y: newPanY, zoom: newZoom });
    }
  }, {
    drag: {
        filterTaps: true,
        threshold: 10
    },
    pinch: {
        scaleBounds: { min: 0.1, max: 5 },
        rubberband: true
    }
  });

  const handleEntityClick = (e: React.MouseEvent | React.TouchEvent, entity: Entity) => {
    e.stopPropagation();
    if (clickBlockerRef.current || isDraggingRef.current) return;
    const dur = Date.now() - startTapTime.current;
    
    // Tap logic is now handled partly by useGesture (filterTaps), but we need to know if it was a drag or tap.
    // useGesture's onClick might be better?
    // We'll keep manual check for now, assuming drag didn't fire or movement was small.
    // If movement > threshold, drag fired.

    if (dur < gestureSettings.tapThreshold) {
      const screenPos = worldToScreen(entity.position.x, entity.position.y);
      setPieMenu({ x: screenPos.x, y: screenPos.y, type: 'ENTITY', entityId: entity.id });
      onSelectEntity(entity.id);
    }
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

  return (
    <div className="absolute inset-0 bg-slate-950 overflow-hidden cursor-move z-0"
        style={{ touchAction: 'none' }}
        {...bind()}
        onClick={() => { if (!clickBlockerRef.current) { onSelectEntity(null); setPieMenu(null); } }}
        onContextMenu={(e) => e.preventDefault()}
    >
      <animated.div style={{
          transform,
          transformOrigin: '0 0',
          width: '0px', height: '0px', position: 'absolute', left: '50%', top: '50%', willChange: 'transform'
      }}>
        <div className="absolute top-0 left-0 w-0 h-0 overflow-visible pointer-events-none" style={{ zIndex: -1 }}>
            {tiles.map(t => (
               <img key={t.key} src={`https://${t.subdomain}.tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`} className="absolute select-none max-w-none" style={t.style} />
            ))}
        </div>
        <svg className="overflow-visible absolute top-0 left-0" width="0" height="0">
          {gridLines}
          {speedVectors}
          {selectedEntityId && entities.find(e => e.id === selectedEntityId) && (
            <line x1={ownship.position.x} y1={ownship.position.y} x2={entities.find(e => e.id === selectedEntityId)?.position.x} y2={entities.find(e => e.id === selectedEntityId)?.position.y} stroke="rgba(255, 255, 255, 0.4)" strokeWidth={Math.max(2 / safeZoomLevel, 1)} strokeDasharray={`${20 / safeZoomLevel},${10 / safeZoomLevel}`} />
          )}
        </svg>
        {entities.map(entity => (
          <div key={entity.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center cursor-pointer group" style={{ left: `${entity.position.x}px`, top: `${entity.position.y}px`, width: `${48 / safeZoomLevel}px`, height: `${48 / safeZoomLevel}px`, zIndex: 10 }} onClick={(e) => handleEntityClick(e, entity)}>
            <div className="w-full h-full" style={{ filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.8))' }}>{getEntityIcon(entity)}</div>
          </div>
        ))}
        <div className="absolute transform -translate-x-1/2 -translate-y-1/2" style={{ left: `${ownship.position.x}px`, top: `${ownship.position.y}px`, transform: `translate(-50%, -50%) rotate(${mapMode === MapMode.NORTH_UP ? (ownship.heading || 0) : 0}deg)`, width: `${64 / safeZoomLevel}px`, height: `${64 / safeZoomLevel}px`, zIndex: 50 }} onClick={(e) => handleEntityClick(e, ownship)}>
          <div className="w-full h-full"><HelicopterSymbol color="text-cyan-400" /></div>
        </div>
      </animated.div>
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
    </div>
  );
};
