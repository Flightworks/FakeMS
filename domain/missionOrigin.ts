import type { Position } from '../types';

export const DEFAULT_MISSION_ORIGIN: Readonly<Position> = Object.freeze({
  lat: 43.1183,
  lon: 5.9098,
});

export const DEFAULT_MISSION_AIRPORT: Readonly<Position> = Object.freeze({
  lat: 43.0973,
  lon: 6.1460,
});

export const LEGACY_SCENARIO_ORIGIN: Readonly<Position> = Object.freeze({
  lat: 34.0522,
  lon: -118.2437,
});

export const translateScenarioPosition = (position: Position): Position => ({
  lat: DEFAULT_MISSION_ORIGIN.lat + (position.lat - LEGACY_SCENARIO_ORIGIN.lat),
  lon: DEFAULT_MISSION_ORIGIN.lon + (position.lon - LEGACY_SCENARIO_ORIGIN.lon),
});
