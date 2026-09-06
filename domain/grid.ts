import type { Position } from '../types';

export interface GridState {
  enabled: boolean;
  stepMinutes: number;
}

export type GridUpdateResult =
  | { status: 'AVAILABLE'; state: GridState }
  | { status: 'UNAVAILABLE'; state: GridState; reason: 'INVALID_STEP' };

export const MIN_GRID_STEP_MINUTES = 1;
export const MAX_GRID_STEP_MINUTES = 60;
const MAX_LINES_PER_AXIS = 20;

export const createGridState = (): GridState => ({ enabled: false, stepMinutes: 1 });

export const setGridEnabled = (state: GridState, enabled: boolean): GridState => ({ ...state, enabled });

export const setGridStep = (state: GridState, stepMinutes: number): GridUpdateResult => {
  if (!Number.isInteger(stepMinutes) || stepMinutes < MIN_GRID_STEP_MINUTES || stepMinutes > MAX_GRID_STEP_MINUTES) {
    return { status: 'UNAVAILABLE', state, reason: 'INVALID_STEP' };
  }
  return { status: 'AVAILABLE', state: { ...state, stepMinutes } };
};

const normalizeLongitude = (longitude: number): number => {
  const normalized = ((longitude + 180) % 360 + 360) % 360 - 180;
  return normalized === -180 ? 180 : normalized;
};

const roundCoordinate = (value: number): number => Number(value.toFixed(6));

export const buildGridLines = (
  center: Position,
  zoom: number,
  stepMinutes: number,
): Position[][] => {
  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lon) || !Number.isFinite(zoom)) return [];
  if (!Number.isInteger(stepMinutes) || stepMinutes < MIN_GRID_STEP_MINUTES || stepMinutes > MAX_GRID_STEP_MINUTES) return [];

  const stepDegrees = stepMinutes / 60;
  const zoomSpan = 180 / (2 ** Math.max(1, zoom - 1));
  const spanDegrees = Math.min(90, zoomSpan, stepDegrees * MAX_LINES_PER_AXIS);
  const latitudeSpan = Math.max(stepDegrees, spanDegrees);
  const cosLatitude = Math.max(0.1, Math.cos(center.lat * Math.PI / 180));
  const longitudeSpan = Math.min(180, latitudeSpan / cosLatitude);
  const minLat = Math.max(-89, center.lat - latitudeSpan);
  const maxLat = Math.min(89, center.lat + latitudeSpan);
  const minLon = center.lon - longitudeSpan;
  const maxLon = center.lon + longitudeSpan;
  const lines: Position[][] = [];

  const firstLatitude = Math.ceil(minLat / stepDegrees) * stepDegrees;
  for (let latitude = firstLatitude; latitude <= maxLat + stepDegrees / 2; latitude += stepDegrees) {
    lines.push([
      { lat: roundCoordinate(latitude), lon: normalizeLongitude(minLon) },
      { lat: roundCoordinate(latitude), lon: normalizeLongitude(maxLon) },
    ]);
  }

  const firstLongitude = Math.ceil(minLon / stepDegrees) * stepDegrees;
  for (let longitude = firstLongitude; longitude <= maxLon + stepDegrees / 2; longitude += stepDegrees) {
    const normalized = normalizeLongitude(longitude);
    lines.push([
      { lat: roundCoordinate(minLat), lon: normalized },
      { lat: roundCoordinate(maxLat), lon: normalized },
    ]);
  }

  return lines.slice(0, MAX_LINES_PER_AXIS * 2 + 2);
};
