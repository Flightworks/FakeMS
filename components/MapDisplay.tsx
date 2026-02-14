
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Entity, EntityType, MapMode, PrototypeSettings } from '../types';
import { HelicopterSymbol, WaypointSymbol, EnemySymbol, AirportSymbol } from './IconSymbols';
import { PieMenu, PieMenuOption } from './PieMenu';
import { 
  MapPin, Crosshair, Navigation, Info, Trash2, CircleDashed, Radio, 
  Zap, Shield, FileText, Scan, Eye, Slash, Target, Settings, Router, 
  Lock, Anchor, Flag, Video, Wifi, Globe, Thermometer, Activity, 
  ArrowLeftRight, CornerUpRight, Flame, TrendingUp
} from 'lucide-react';
import { EARTH_RADIUS, ORIGIN_SHIFT, latLonToMeters } from '../utils/geo';

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
  // Added setGestureSettings to props to fix line 371 error
  setGestureSettings: React.Dispatch<React.SetStateAction<PrototypeSettings>>;
}

const GRID_SIZE = 1000; 

const TILE_SIZE = 256;
const INITIAL_RESOLUTION = 2 * Math.PI * EARTH_RADIUS / TILE_SIZE;

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
  // Destructured setGestureSettings from props to fix missing name error
  setGestureSettings
}) => {
  const [isInteracting, setIsInteracting] = useState(false);
  const [pieMenu, setPieMenu] = useState<{ x: number, y: number, type: 'ENTITY' | 'MAP', entityId?: string } | null>(null);
  const clickBlockerRef = useRef(false);

  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indicatorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const startTapTime = useRef(0);
  const [longPressIndicator, setLongPressIndicator] = useState<{x: number, y: number} | null>(null);

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

  const worldToScreen = (wx: number, wy: number) => {
    const dx = wx - viewCenterX;
    const dy = wy - viewCenterY;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    const sx = rx * safeZoomLevel;
    const sy = ry * safeZoomLevel;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    return { x: cx + sx, y: cy + sy };
  };

  const closePieMenu = () => {
     setPieMenu(null);
     clickBlockerRef.current = true;
     setTimeout(() => { clickBlockerRef.current = false; }, 400); 
  };

  const tiles = useMemo(() => {
    const tileMap = new Map();
    const radius = 4;
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
    addTilesAround(originMeters.x + ownship.position.x, originMeters.y - ownship.position.y);
    return Array.from(tileMap.values());
  }, [viewGlobalX, viewGlobalY, originMeters, optimalTileZoom, ownship.position.x, ownship.position.y]);

  const getEntityIcon = (entity: Entity) => {
    const isSelected = entity.id === selectedEntityId;
    switch (entity.type) {
      case EntityType.OWNSHIP: return <HelicopterSymbol />;
      case EntityType.ENEMY: return <EnemySymbol selected={isSelected} />;
      case EntityType.AIRPORT: return <AirportSymbol selected={isSelected} />;
      default: return <WaypointSymbol selected={isSelected} />;
    }
  };

  const mapStyle: React.CSSProperties = {
    transform: `scale(${safeZoomLevel}) rotate(${rotation}deg) translate(${-viewCenterX}px, ${-viewCenterY}px)`,
    transformOrigin: '0 0',
    width: '0px', height: '0px', position: 'absolute', left: '50%', top: '50%', willChange: 'transform'
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

  const rotateVector = (x: number, y: number, angleDeg: number) => {
    const rad = angleDeg * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return { x: x * cos - y * sin, y: x * sin + y * cos };
  };

  const speedVectors = useMemo(() => {
    if (!gestureSettings.showSpeedVectors) return null;
    return entities.map(entity => {
      if (!entity.speed || entity.speed === 0 || entity.heading === undefined) return null;
      
      // Calculate end point based on heading and speed
      // Simulation moves by 0.5 units per frame, 1 knot = ~1852m/h
      // Let's draw a vector representing 1 minute of travel at current speed for visualization
      // Or just a standard scale factor
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

  const gestureState = useRef({
    startPanOffset: { x: 0, y: 0 },
    startClient: { x: 0, y: 0 },
    mode: 'NONE' as 'NONE' | 'PAN' | 'PINCH'
  });

  const getClientCenter = (touches: React.TouchList | React.MouseEvent) => {
    if ('clientX' in touches) return { x: touches.clientX, y: touches.clientY };
    if (touches.length === 0) return { x: 0, y: 0 };
    let x = 0, y = 0;
    for (let i = 0; i < touches.length; i++) { x += touches[i].clientX; y += touches[i].clientY; }
    return { x: x / touches.length, y: x / touches.length };
  };

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

  const handleTouchStart = (e: React.TouchEvent) => {
    if (pieMenu) return; 
    setIsInteracting(true);
    const center = getClientCenter(e.touches);
    gestureState.current.startPanOffset = { ...panOffset };
    gestureState.current.startClient = center;
    startTapTime.current = Date.now();
    
    if (e.touches.length === 2) {
      gestureState.current.mode = 'PINCH';
      cancelLongPress(); 
    } else {
      gestureState.current.mode = 'PAN';
      startLongPress(center.x, center.y);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isInteracting || pieMenu) return;
    const center = getClientCenter(e.touches);
    const moveDist = Math.hypot(center.x - gestureState.current.startClient.x, center.y - gestureState.current.startClient.y);
    
    if (moveDist > gestureSettings.jitterTolerance) cancelLongPress();
    if (longPressTriggered.current) return;

    if (gestureState.current.mode === 'PAN') {
      const dxScreen = center.x - gestureState.current.startClient.x;
      const dyScreen = center.y - gestureState.current.startClient.y;
      const rotatedDelta = rotateVector(dxScreen, dyScreen, -rotation);
      onPan({ x: gestureState.current.startPanOffset.x - rotatedDelta.x / safeZoomLevel, y: gestureState.current.startPanOffset.y - rotatedDelta.y / safeZoomLevel });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    cancelLongPress();
    if (e.touches.length === 0) {
      setIsInteracting(false);
      gestureState.current.mode = 'NONE';
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || pieMenu) return;
    setIsInteracting(true);
    gestureState.current.mode = 'PAN';
    gestureState.current.startClient = { x: e.clientX, y: e.clientY };
    gestureState.current.startPanOffset = { ...panOffset };
    startTapTime.current = Date.now();
    startLongPress(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    cancelLongPress();
    setIsInteracting(false);
    gestureState.current.mode = 'NONE';
  };

  const handleEntityClick = (e: React.MouseEvent | React.TouchEvent, entity: Entity) => {
    e.stopPropagation();
    if (clickBlockerRef.current) return;
    const dur = Date.now() - startTapTime.current;
    
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
    <div className="absolute inset-0 bg-slate-950 overflow-hidden cursor-move touch-none z-0" 
        onClick={() => { if (!longPressTriggered.current) { onSelectEntity(null); setPieMenu(null); } }}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown} onMouseMove={handleTouchMove} onMouseUp={handleMouseUp}
        onWheel={(e) => { const scale = Math.exp(-e.deltaY * 0.001); onZoom(zoomLevel * scale); }}
        onContextMenu={(e) => e.preventDefault()}
    >
      <div style={mapStyle}>
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
          <div key={entity.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center cursor-pointer group" style={{ left: `${entity.position.x}px`, top: `${entity.position.y}px`, width: `${40 / safeZoomLevel}px`, height: `${40 / safeZoomLevel}px`, zIndex: 10 }} onClick={(e) => handleEntityClick(e, entity)}>
            <div className="w-full h-full" style={{ filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.8))' }}>{getEntityIcon(entity)}</div>
          </div>
        ))}
        <div className="absolute transform -translate-x-1/2 -translate-y-1/2" style={{ left: `${ownship.position.x}px`, top: `${ownship.position.y}px`, transform: `translate(-50%, -50%) rotate(${mapMode === MapMode.NORTH_UP ? (ownship.heading || 0) : 0}deg)`, width: `${64 / safeZoomLevel}px`, height: `${64 / safeZoomLevel}px`, zIndex: 50 }} onClick={(e) => handleEntityClick(e, ownship)}>
          <div className="w-full h-full"><HelicopterSymbol color="text-cyan-400" /></div>
        </div>
      </div>
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
