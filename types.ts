export enum MapMode {
  NORTH_UP = 'NORTH_UP',
  HEADING_UP = 'HEADING_UP',
}

export enum EntityType {
  OWNSHIP = 'OWNSHIP',
  WAYPOINT = 'WAYPOINT',
  ENEMY = 'ENEMY',
  FRIENDLY = 'FRIENDLY',
  AIRPORT = 'AIRPORT'
}

export interface Position {
  lat: number;
  lon: number;
}

export interface Entity {
  id: string;
  type: EntityType;
  position: Position;
  label: string;

  // Kinematics
  heading?: number;      // Current Heading (Degrees True)
  targetHeading?: number;// Desired Heading (Degrees True)
  turnRate?: number;     // Degrees per second
  speed?: number;        // Current Speed (Knots)
  targetSpeed?: number;  // Desired Speed (Knots)
  acceleration?: number; // Knots per second

  altitude?: number;     // Current Altitude (Feet)

  // Navigation
  waypoints?: Position[]; // List of coordinates to follow

  metadata?: Record<string, string | number>;
}

export interface SystemStatus {
  radar: boolean;
  adsb: boolean;
  ais: boolean;
  eots: boolean; // Electro-Optical Targeting System
}

export type OwnshipPanelPos = 'BL' | 'TL' | 'BR' | 'TR';

export interface PrototypeSettings {
  // Gestures
  tapThreshold: number;      // ms
  indicatorDelay: number;    // ms
  longPressDuration: number; // ms
  jitterTolerance: number;   // pixels
  // Visuals
  uiScale: number;           // Multiplier
  glowIntensity: number;     // 0-1
  animationSpeed: number;    // ms (base duration)
  mapDim: number;            // 0-1
  hapticEnabled: boolean;
  // Ownship Panel Prototyping
  ownshipPanelPos: OwnshipPanelPos;
  ownshipPanelScale: number;
  ownshipPanelOpacity: number;
  ownshipShowCoords: boolean;
  ownshipShowDetails: boolean; // Declutter toggle for Speed/Alt/Hdg
  // Track Management
  showSpeedVectors: boolean;   // Velocity leaders for entities
}

export interface AppState {
  ownship: Entity;
  entities: Entity[];
  mapMode: MapMode;
  selectedEntityId: string | null;
  systems: SystemStatus;
  sidebarOpen: boolean;
  zoomLevel: number; // Scale factor
  prototypeSettings: PrototypeSettings;
}