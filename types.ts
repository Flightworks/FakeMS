export enum MapMode {
  NORTH_UP = 'NORTH_UP',
  HEADING_UP = 'HEADING_UP',
}

export enum StabMode {
  HELICO = 'HELICO',
  GND = 'GND',
}

export enum NavMode {
  REAL = 'REAL',
  SIM = 'SIM',
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
  continuousTurn?: 'L' | 'R' | null; // orbit left or right indefinitely

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

export interface HistoryEntry {
  original: string;
  timestamp: number;
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
  stabAutoGndOnPan: boolean;
  stabFreezeHeadingDrop: boolean;
  stabSnapRecenter: boolean;
  stabRecenterOnOrientSwitch: boolean;
  stabAutoRecenterDelay: number;  // 0=OFF, 5000/10000/15000 ms
  stabSmoothUnfreeze: boolean;    // Animate map rotation on GND->HELICO
  stabMaintainScreenPosOnOrient: boolean;
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

// ── TRAJECTORY SOLVER TYPES (CONOPS AMI / SIGMA) ─────────────────────────────

export interface SolverMetrics {
  timeToTarget: number;       // 0 - 100 (Focus rapidité transit / ETE)
  fuelEconomy: number;        // 0 - 100 (Focus vent arrière, Bingo Fuel)
  sensorCoverage: number;     // 0 - 100 (Optique FLIR / Radar Lobe)
  timeOnStation: number;      // 0 - 100 (Présence sur zone)
  stealthSOD: number;         // 0 - 100 (Maintien distance de sécurité Stand-off)
  munitionsDelivery: number;  // 0 - 100 (Point de largage MTO)
}

export type SolverPreset = 'FOCUS_MENACE' | 'ECO_VENTS' | 'BAYESIAN_GOFAST' | 'MTO_STRIKE';

export interface TrajectoryLeg {
  from: Position;
  to: Position;
  distanceNm: number;
  bearingDeg: number;
  speedKts: number;
  eteMin: number;
  fuelBurnKg: number;
  label?: string;
}

export interface TrajectoryOption {
  id: string;
  preset: SolverPreset;
  title: string;
  subtitle: string;
  color: string;
  waypoints: (Position & { label?: string })[];
  legs: TrajectoryLeg[];
  totalDistanceNm: number;
  totalEteMin: number;
  fuelBurnKg: number;
  fuelRemainingAtFrigateKg: number;
  bingoMarginMin: number;
  detectionProbability: number; // 0 - 100 %
  limitingFactor: string;
  tacticalRationale: string;
  score: number;
  sensorFootprints?: {
    radarLobeDeg?: number;
    flirSweepAngle?: number;
  };
}

export interface AirplanArea {
  id: string;
  name: string;
  topLeft: Position;
  bottomRight: Position;
  color?: string;
}

export interface DatumConfig {
  origin: Position;
  estimatedHeading: number;
  estimatedSpeedKts: number;
  timeOfDepartureAgoMin: number;
  confidenceHeading: number; // 0 - 100 %
  confidenceSpeed: number;   // 0 - 100 %
}

export interface SolverEnvironment {
  windDirectionDeg: number; // Wind FROM direction (0-360)
  windSpeedKts: number;
  ownshipSpeedKts: number;
  frigatePosition: Position;
  frigateLabel: string;
  fuelCurrentKg: number;
  fuelConsumptionKgPerHour: number;
  bingoMinReserveKg: number;
}

export interface BayesianCell {
  lat: number;
  lon: number;
  probability: number;
  color: string;
}

export interface AltitudeOption {
  altitudeFt: number;
  radarRangeNm: number;
  opticalFlirRangeNm: number;
  smallTargetPd: number;
  areaCoverageRateNm2PerHour: number;
  fuelBurnKgPerHour: number;
  recommendedFor: string;
  isOptimal: boolean;
  rationale: string;
}

export interface ContrastiveQA {
  id: string;
  question: string;
  category: 'ALTITUDE' | 'ROUTING' | 'SPEED' | 'SAFETY';
  responseTitle: string;
  tradeOffs: { label: string; value: string; positive: boolean }[];
  primaryConflict: string;
  aiRationale: string;
  suggestedActionLabel?: string;
  suggestedActionPreset?: SolverPreset;
  suggestedMetricsDelta?: Partial<SolverMetrics>;
}

export interface BayesianSearchModel {
  datumCenter: Position;
  estimatedCurrentPos: Position;
  headingDeg: number;
  speedKts: number;
  timeElapsedMin: number;
  contours: {
    level: 'OUTER' | 'MID' | 'CORE';
    probabilityLabel: string;
    color: string;
    fillOpacity: number;
    points: [number, number][];
  }[];
  transversalSweepLeg: {
    start: Position;
    end: Position;
  };
}

export interface TrackClassification {
  entityId: string;
  label: string;
  type: string;
  classification: 'CIVIL_CONFIRMED' | 'SUSPECT_LEVEL_1' | 'SUSPECT_LEVEL_2' | 'HOSTILE';
  confidenceScore: number; // 1 to 5
  radarSERM2: number;
  aisBroadcastLengthM?: number;
  polCompliance: 'COMPLIANT_ROUTE' | 'DEVIATION' | 'SUSPECT_RENDEZVOUS' | 'NO_AIS_EMISSION';
  rationale: string;
  recommendedAction: string;
}

