import type { Position } from '../types';
import { bearingBetween, distanceBetween } from '../utils/geo';
import { METERS_PER_NAUTICAL_MILE } from './tacticalUnits';

export const MAX_BEARING_INTERSECTION_NM = 500;
export const MIN_INTERSECTION_ANGLE_DEGREES = 5;
export const BEARING_INTERSECTION_METHOD = 'SPHERICAL GREAT CIRCLE' as const;

type Vector = { x: number; y: number; z: number };

export interface BearingLine {
  reference: string;
  position: Position;
  bearingDegrees: number;
}

export interface BearingIntersectionLeg {
  reference: string;
  position: Position;
  bearingDegrees: number;
  rangeNauticalMiles: number;
}

export type BearingIntersectionErrorCode =
  | 'INVALID_POSITION'
  | 'INVALID_BEARING'
  | 'DUPLICATE_REFERENCE'
  | 'PARALLEL_LINES'
  | 'INTERSECTION_BEHIND_REFERENCE'
  | 'RANGE_EXCEEDED'
  | 'AMBIGUOUS_INTERSECTION';

export class BearingIntersectionError extends Error {
  readonly code: BearingIntersectionErrorCode;

  constructor(code: BearingIntersectionErrorCode, message: string) {
    super(message);
    this.name = 'BearingIntersectionError';
    this.code = code;
    Object.setPrototypeOf(this, BearingIntersectionError.prototype);
  }
}

export type BearingIntersectionQuality = 'GOOD' | 'GEOMETRY_WEAK';

export interface BearingIntersectionResult {
  position: Position;
  legs: [BearingIntersectionLeg, BearingIntersectionLeg];
  crossingAngleDegrees: number;
  quality: BearingIntersectionQuality;
  canConfirm: boolean;
  method: typeof BEARING_INTERSECTION_METHOD;
}

const degreesToRadians = (degrees: number): number => degrees * Math.PI / 180;
const radiansToDegrees = (radians: number): number => radians * 180 / Math.PI;
const normalizeDegrees = (degrees: number): number => ((degrees % 360) + 360) % 360;
const normalizeLongitude = (degrees: number): number => {
  const normalized = ((degrees + 180) % 360 + 360) % 360 - 180;
  return normalized === -180 && degrees > 0 ? 180 : normalized;
};
const clampUnit = (value: number): number => Math.max(-1, Math.min(1, value));

const vectorMagnitude = (vector: Vector): number => Math.hypot(vector.x, vector.y, vector.z);

const normalizeVector = (vector: Vector): Vector => {
  const magnitude = vectorMagnitude(vector);
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new BearingIntersectionError('PARALLEL_LINES', 'Bearing lines do not define a unique intersection.');
  }
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    z: vector.z / magnitude,
  };
};

const cross = (left: Vector, right: Vector): Vector => ({
  x: left.y * right.z - left.z * right.y,
  y: left.z * right.x - left.x * right.z,
  z: left.x * right.y - left.y * right.x,
});

const dot = (left: Vector, right: Vector): number =>
  left.x * right.x + left.y * right.y + left.z * right.z;

const positionToVector = (position: Position): Vector => {
  const latitude = degreesToRadians(position.lat);
  const longitude = degreesToRadians(position.lon);
  return {
    x: Math.cos(latitude) * Math.cos(longitude),
    y: Math.cos(latitude) * Math.sin(longitude),
    z: Math.sin(latitude),
  };
};

const vectorToPosition = (vector: Vector): Position => ({
  lat: radiansToDegrees(Math.asin(clampUnit(vector.z))),
  lon: normalizeLongitude(radiansToDegrees(Math.atan2(vector.y, vector.x))),
});

const validateLine = (line: BearingLine): void => {
  if (!Number.isFinite(line.position.lat)
    || !Number.isFinite(line.position.lon)
    || line.position.lat < -90
    || line.position.lat > 90
    || line.position.lon < -180
    || line.position.lon > 180) {
    throw new BearingIntersectionError(
      'INVALID_POSITION',
      `Invalid position for bearing reference ${line.reference}.`,
    );
  }
  if (!Number.isFinite(line.bearingDegrees) || line.bearingDegrees < 0 || line.bearingDegrees >= 360) {
    throw new BearingIntersectionError(
      'INVALID_BEARING',
      `Invalid bearing for bearing reference ${line.reference}.`,
    );
  }
  if (!line.reference.trim()) {
    throw new BearingIntersectionError('INVALID_POSITION', 'Bearing reference must not be empty.');
  }
};

const tangentAtBearing = (position: Position, bearingDegrees: number): Vector => {
  const latitude = degreesToRadians(position.lat);
  const longitude = degreesToRadians(position.lon);
  const bearing = degreesToRadians(bearingDegrees);
  const north: Vector = {
    x: -Math.sin(latitude) * Math.cos(longitude),
    y: -Math.sin(latitude) * Math.sin(longitude),
    z: Math.cos(latitude),
  };
  const east: Vector = {
    x: -Math.sin(longitude),
    y: Math.cos(longitude),
    z: 0,
  };
  return {
    x: north.x * Math.cos(bearing) + east.x * Math.sin(bearing),
    y: north.y * Math.cos(bearing) + east.y * Math.sin(bearing),
    z: north.z * Math.cos(bearing) + east.z * Math.sin(bearing),
  };
};

const angularDistanceRadians = (left: Vector, right: Vector): number =>
  Math.acos(clampUnit(dot(left, right)));

const rangeNauticalMiles = (from: Position, to: Position): number =>
  distanceBetween(from.lat, from.lon, to.lat, to.lon) / METERS_PER_NAUTICAL_MILE;

const directionDifference = (left: number, right: number): number => {
  const difference = Math.abs(normalizeDegrees(left) - normalizeDegrees(right));
  return Math.min(difference, 360 - difference);
};

const isForward = (line: BearingLine, candidate: Position): boolean => {
  const candidateBearing = bearingBetween(
    line.position.lat,
    line.position.lon,
    candidate.lat,
    candidate.lon,
  );
  return directionDifference(line.bearingDegrees, candidateBearing) < 1e-4;
};

const finalBearingAt = (from: Position, target: Position): number => normalizeDegrees(
  bearingBetween(target.lat, target.lon, from.lat, from.lon) + 180,
);

const crossingAngle = (first: BearingLine, second: BearingLine, position: Position): number => {
  const firstBearing = finalBearingAt(first.position, position);
  const secondBearing = finalBearingAt(second.position, position);
  const directionalAngle = directionDifference(firstBearing, secondBearing);
  return Math.min(directionalAngle, 180 - directionalAngle);
};

const createLeg = (line: BearingLine, position: Position): BearingIntersectionLeg => ({
  reference: line.reference,
  position: { ...line.position },
  bearingDegrees: line.bearingDegrees,
  rangeNauticalMiles: rangeNauticalMiles(line.position, position),
});

export const intersectBearings = (
  first: BearingLine,
  second: BearingLine,
  maxRangeNauticalMiles = MAX_BEARING_INTERSECTION_NM,
): BearingIntersectionResult => {
  validateLine(first);
  validateLine(second);
  if (first.reference.trim().toUpperCase() === second.reference.trim().toUpperCase()) {
    throw new BearingIntersectionError(
      'DUPLICATE_REFERENCE',
      'Bearing intersection requires two distinct references.',
    );
  }
  if (!Number.isFinite(maxRangeNauticalMiles) || maxRangeNauticalMiles <= 0) {
    throw new BearingIntersectionError('RANGE_EXCEEDED', 'Intersection range limit must be positive.');
  }

  const firstPoint = positionToVector(first.position);
  const secondPoint = positionToVector(second.position);
  const firstNormal = cross(firstPoint, tangentAtBearing(first.position, first.bearingDegrees));
  const secondNormal = cross(secondPoint, tangentAtBearing(second.position, second.bearingDegrees));
  const intersectionAxis = cross(firstNormal, secondNormal);
  if (vectorMagnitude(intersectionAxis) < 1e-12) {
    throw new BearingIntersectionError(
      'PARALLEL_LINES',
      'Bearing lines are parallel or coincident; no unique intersection exists.',
    );
  }

  const candidate = normalizeVector(intersectionAxis);
  const candidates = [candidate, {
    x: -candidate.x,
    y: -candidate.y,
    z: -candidate.z,
  }];
  const viableCandidates = candidates.filter((vector) => {
    const position = vectorToPosition(vector);
    const firstRange = rangeNauticalMiles(first.position, position);
    const secondRange = rangeNauticalMiles(second.position, position);
    return firstRange > 1e-6
      && secondRange > 1e-6
      && isForward(first, position)
      && isForward(second, position);
  });

  if (viableCandidates.length === 0) {
    throw new BearingIntersectionError(
      'INTERSECTION_BEHIND_REFERENCE',
      'Intersection lies behind at least one bearing reference.',
    );
  }
  if (viableCandidates.length > 1) {
    throw new BearingIntersectionError(
      'AMBIGUOUS_INTERSECTION',
      'Two bearing intersection solutions remain; no solution was selected automatically.',
    );
  }

  const position = vectorToPosition(viableCandidates[0]);
  const firstRange = rangeNauticalMiles(first.position, position);
  const secondRange = rangeNauticalMiles(second.position, position);
  if (firstRange > maxRangeNauticalMiles || secondRange > maxRangeNauticalMiles) {
    throw new BearingIntersectionError(
      'RANGE_EXCEEDED',
      `Intersection must be within ${maxRangeNauticalMiles} NM of both references.`,
    );
  }

  const angle = crossingAngle(first, second, position);
  const quality: BearingIntersectionQuality = angle < MIN_INTERSECTION_ANGLE_DEGREES
    ? 'GEOMETRY_WEAK'
    : 'GOOD';
  return {
    position,
    legs: [createLeg(first, position), createLeg(second, position)],
    crossingAngleDegrees: angle,
    quality,
    canConfirm: quality === 'GOOD',
    method: BEARING_INTERSECTION_METHOD,
  };
};

// Keep the spherical-distance helper close to the domain contract so callers
// do not need to convert the result back from metres.
export const intersectionAngularDistance = (first: Position, second: Position): number =>
  angularDistanceRadians(positionToVector(first), positionToVector(second));
