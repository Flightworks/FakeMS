import type { GeographicBounds } from './constraints';
import { METERS_PER_NAUTICAL_MILE } from './tacticalUnits';
import type { Position } from '../types';
import { distanceBetween } from '../utils/geo';

export type ZoneGeometry =
  | { kind: 'RECTANGLE'; bounds: GeographicBounds }
  | { kind: 'CIRCLE'; center: Position; radiusNm: number }
  | { kind: 'POLYGON'; points: Position[] };

export interface NamedZone {
  id: string;
  label: string;
  source: string;
  simulatedState: string;
  geometry: ZoneGeometry;
}

export type ZoneContainment = 'INSIDE' | 'OUTSIDE' | 'ON BOUNDARY';
export interface ZoneValidation { valid: boolean; reason?: 'INVALID_GEOMETRY' | 'OUT_OF_BOUNDS' }

const EPSILON = 1e-8;
const CIRCLE_BOUNDARY_EPSILON_NM = 0.001;

const isFinitePosition = (position: Position): boolean => Number.isFinite(position.lat)
  && Number.isFinite(position.lon)
  && position.lat >= -90 && position.lat <= 90
  && position.lon >= -180 && position.lon <= 180;

const orientation = (a: Position, b: Position, c: Position): number => (
  (b.lon - a.lon) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lon - a.lon)
);

const onSegment = (a: Position, b: Position, point: Position): boolean => (
  Math.abs(orientation(a, b, point)) <= EPSILON
  && point.lat >= Math.min(a.lat, b.lat) - EPSILON
  && point.lat <= Math.max(a.lat, b.lat) + EPSILON
  && point.lon >= Math.min(a.lon, b.lon) - EPSILON
  && point.lon <= Math.max(a.lon, b.lon) + EPSILON
);

const segmentsIntersect = (a: Position, b: Position, c: Position, d: Position): boolean => {
  const first = orientation(a, b, c);
  const second = orientation(a, b, d);
  const third = orientation(c, d, a);
  const fourth = orientation(c, d, b);
  if (Math.abs(first) <= EPSILON && onSegment(a, b, c)) return true;
  if (Math.abs(second) <= EPSILON && onSegment(a, b, d)) return true;
  if (Math.abs(third) <= EPSILON && onSegment(c, d, a)) return true;
  if (Math.abs(fourth) <= EPSILON && onSegment(c, d, b)) return true;
  return (first > 0) !== (second > 0) && (third > 0) !== (fourth > 0);
};

const validatePolygon = (points: Position[]): ZoneValidation => {
  if (points.length < 3 || points.some(point => !isFinitePosition(point))) return { valid: false, reason: 'INVALID_GEOMETRY' };
  for (let first = 0; first < points.length; first += 1) {
    const firstEnd = (first + 1) % points.length;
    for (let second = first + 1; second < points.length; second += 1) {
      const secondEnd = (second + 1) % points.length;
      if (first === second || firstEnd === second || secondEnd === first) continue;
      if (first === 0 && secondEnd === 0) continue;
      if (segmentsIntersect(points[first], points[firstEnd], points[second], points[secondEnd])) {
        return { valid: false, reason: 'INVALID_GEOMETRY' };
      }
    }
  }
  return { valid: true };
};

export const validateZone = (zone: NamedZone): ZoneValidation => {
  if (!zone.id.trim() || !zone.label.trim()) return { valid: false, reason: 'INVALID_GEOMETRY' };
  if (zone.geometry.kind === 'RECTANGLE') {
    const { bounds } = zone.geometry;
    if (![bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon].every(Number.isFinite)
      || bounds.minLat < -90 || bounds.maxLat > 90 || bounds.minLon < -180 || bounds.maxLon > 180
      || bounds.minLat >= bounds.maxLat || bounds.minLon >= bounds.maxLon) {
      return { valid: false, reason: 'OUT_OF_BOUNDS' };
    }
    return { valid: true };
  }
  if (zone.geometry.kind === 'CIRCLE') {
    if (!isFinitePosition(zone.geometry.center) || !Number.isFinite(zone.geometry.radiusNm)
      || zone.geometry.radiusNm <= 0 || zone.geometry.radiusNm > 10_000) {
      return { valid: false, reason: 'INVALID_GEOMETRY' };
    }
    return { valid: true };
  }
  return validatePolygon(zone.geometry.points);
};

const checkRectangle = (bounds: GeographicBounds, point: Position): ZoneContainment => {
  const insideLatitude = point.lat >= bounds.minLat - EPSILON && point.lat <= bounds.maxLat + EPSILON;
  const insideLongitude = point.lon >= bounds.minLon - EPSILON && point.lon <= bounds.maxLon + EPSILON;
  if (!insideLatitude || !insideLongitude) return 'OUTSIDE';
  if (Math.abs(point.lat - bounds.minLat) <= EPSILON || Math.abs(point.lat - bounds.maxLat) <= EPSILON
    || Math.abs(point.lon - bounds.minLon) <= EPSILON || Math.abs(point.lon - bounds.maxLon) <= EPSILON) return 'ON BOUNDARY';
  return 'INSIDE';
};

const checkCircle = (center: Position, radiusNm: number, point: Position): ZoneContainment => {
  const distanceNm = distanceBetween(center.lat, center.lon, point.lat, point.lon) / METERS_PER_NAUTICAL_MILE;
  if (Math.abs(distanceNm - radiusNm) <= CIRCLE_BOUNDARY_EPSILON_NM) return 'ON BOUNDARY';
  return distanceNm < radiusNm ? 'INSIDE' : 'OUTSIDE';
};

const checkPolygon = (points: Position[], point: Position): ZoneContainment => {
  for (let index = 0; index < points.length; index += 1) {
    if (onSegment(points[index], points[(index + 1) % points.length], point)) return 'ON BOUNDARY';
  }
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const current = points[index];
    const prior = points[previous];
    const intersects = ((current.lat > point.lat) !== (prior.lat > point.lat))
      && (point.lon < (prior.lon - current.lon) * (point.lat - current.lat) / (prior.lat - current.lat) + current.lon);
    if (intersects) inside = !inside;
  }
  return inside ? 'INSIDE' : 'OUTSIDE';
};

export const checkZoneContainment = (zone: NamedZone, point: Position): ZoneContainment => {
  if (!validateZone(zone).valid || !isFinitePosition(point)) return 'OUTSIDE';
  if (zone.geometry.kind === 'RECTANGLE') return checkRectangle(zone.geometry.bounds, point);
  if (zone.geometry.kind === 'CIRCLE') return checkCircle(zone.geometry.center, zone.geometry.radiusNm, point);
  return checkPolygon(zone.geometry.points, point);
};

export const createDefaultZones = (): NamedZone[] => [
  {
    id: 'TRAINING-A', label: 'TRAINING-A', source: 'LOCAL SCENARIO', simulatedState: 'SIMULATED',
    geometry: { kind: 'RECTANGLE', bounds: { minLat: 33.9, maxLat: 34.2, minLon: -118.5, maxLon: -118.0 } },
  },
  {
    id: 'TRAINING-CIRCLE', label: 'TRAINING-CIRCLE', source: 'LOCAL SCENARIO', simulatedState: 'SIMULATED',
    geometry: { kind: 'CIRCLE', center: { lat: 34.05, lon: -118.2 }, radiusNm: 5 },
  },
  {
    id: 'TRAINING-POLYGON', label: 'TRAINING-POLYGON', source: 'LOCAL SCENARIO', simulatedState: 'SIMULATED',
    geometry: { kind: 'POLYGON', points: [
      { lat: 34.00, lon: -118.30 }, { lat: 34.15, lon: -118.25 },
      { lat: 34.12, lon: -118.10 }, { lat: 33.98, lon: -118.12 },
    ] },
  },
];

export const getZone = (zones: NamedZone[], reference: string): NamedZone | null => (
  zones.find(zone => zone.id === reference.trim().toUpperCase() || zone.label === reference.trim().toUpperCase()) ?? null
);
