import type { Position } from '../types';
import { distanceBetween, bearingBetween } from '../utils/geo';
import { METERS_PER_NAUTICAL_MILE } from './tacticalUnits';

export type RelativeMotionFreshness = 'FRESH' | 'STALE' | 'UNKNOWN';
export type RelativeMotionCpaStatus = 'FUTURE_CPA' | 'PAST_CPA' | 'NO_RELATIVE_MOTION';

export type RelativeMotionUnavailableReason =
  | 'INVALID_POSITION'
  | 'MISSING_GROUND_TRACK'
  | 'INVALID_GROUND_TRACK'
  | 'MISSING_GROUND_SPEED'
  | 'INVALID_GROUND_SPEED'
  | 'UNKNOWN_FRESHNESS'
  | 'STALE_TRACK';

export interface RelativeMotionTrack {
  id: string;
  label: string;
  position: Position;
  groundTrackDegrees?: number;
  groundSpeedKnots?: number;
  freshness?: RelativeMotionFreshness;
}

export interface RelativeMotionRequest {
  reference: RelativeMotionTrack;
  target: RelativeMotionTrack;
}

interface RelativeMotionResultBase {
  referencePosition: Position;
  targetPosition: Position;
  assumption: 'CONSTANT VELOCITY';
}

export interface RelativeMotionAvailable extends RelativeMotionResultBase {
  status: 'AVAILABLE';
  closureRateKnots: number;
  relativeSpeedKnots: number;
  cpaDistanceNauticalMiles: number;
  tcpaMinutes: number | null;
  cpaStatus: RelativeMotionCpaStatus;
}

export interface RelativeMotionUnavailable extends RelativeMotionResultBase {
  status: 'UNAVAILABLE';
  reason: RelativeMotionUnavailableReason;
  closureRateKnots: null;
  relativeSpeedKnots: null;
  cpaDistanceNauticalMiles: null;
  tcpaMinutes: null;
  cpaStatus: null;
}

export type RelativeMotionResult = RelativeMotionAvailable | RelativeMotionUnavailable;

export interface RelativeMotionPreview {
  type: 'RELATIVE_MOTION_PREVIEW';
  command: 'CLOSURE' | 'CPA';
  referenceId: string;
  referenceLabel: string;
  targetId: string;
  targetLabel: string;
  result: RelativeMotionAvailable;
}

interface LocalVector {
  east: number;
  north: number;
}

const copyPosition = (position: Position): Position => ({ lat: position.lat, lon: position.lon });

const baseResult = (request: RelativeMotionRequest): RelativeMotionResultBase => ({
  referencePosition: copyPosition(request.reference.position),
  targetPosition: copyPosition(request.target.position),
  assumption: 'CONSTANT VELOCITY',
});

const unavailable = (
  request: RelativeMotionRequest,
  reason: RelativeMotionUnavailableReason,
): RelativeMotionUnavailable => ({
  ...baseResult(request),
  status: 'UNAVAILABLE',
  reason,
  closureRateKnots: null,
  relativeSpeedKnots: null,
  cpaDistanceNauticalMiles: null,
  tcpaMinutes: null,
  cpaStatus: null,
});

const validPosition = (position: Position): boolean => (
  Number.isFinite(position.lat)
  && Number.isFinite(position.lon)
  && position.lat >= -90
  && position.lat <= 90
  && position.lon >= -180
  && position.lon <= 180
);

const validateTrack = (
  request: RelativeMotionRequest,
  track: RelativeMotionTrack,
): RelativeMotionUnavailableReason | null => {
  if (!validPosition(track.position)) return 'INVALID_POSITION';
  if (track.freshness === 'STALE') return 'STALE_TRACK';
  if (track.freshness !== 'FRESH') return 'UNKNOWN_FRESHNESS';
  if (typeof track.groundTrackDegrees !== 'number') return 'MISSING_GROUND_TRACK';
  if (!Number.isFinite(track.groundTrackDegrees)
    || track.groundTrackDegrees < 0
    || track.groundTrackDegrees >= 360) return 'INVALID_GROUND_TRACK';
  if (typeof track.groundSpeedKnots !== 'number') return 'MISSING_GROUND_SPEED';
  if (!Number.isFinite(track.groundSpeedKnots) || track.groundSpeedKnots < 0) return 'INVALID_GROUND_SPEED';
  return null;
};

const toVelocityVector = (track: RelativeMotionTrack): LocalVector => {
  const bearingRadians = (track.groundTrackDegrees as number) * Math.PI / 180;
  const speed = track.groundSpeedKnots as number;
  return {
    east: speed * Math.sin(bearingRadians),
    north: speed * Math.cos(bearingRadians),
  };
};

const toRelativePosition = (reference: Position, target: Position): LocalVector => {
  const distanceNauticalMiles = distanceBetween(reference.lat, reference.lon, target.lat, target.lon)
    / METERS_PER_NAUTICAL_MILE;
  if (distanceNauticalMiles === 0) return { east: 0, north: 0 };
  const bearingRadians = bearingBetween(reference.lat, reference.lon, target.lat, target.lon) * Math.PI / 180;
  return {
    east: distanceNauticalMiles * Math.sin(bearingRadians),
    north: distanceNauticalMiles * Math.cos(bearingRadians),
  };
};

export const calculateRelativeMotion = (request: RelativeMotionRequest): RelativeMotionResult => {
  const referenceError = validateTrack(request, request.reference);
  if (referenceError) return unavailable(request, referenceError);
  const targetError = validateTrack(request, request.target);
  if (targetError) return unavailable(request, targetError);

  const relativePosition = toRelativePosition(request.reference.position, request.target.position);
  const referenceVelocity = toVelocityVector(request.reference);
  const targetVelocity = toVelocityVector(request.target);
  const relativeVelocity: LocalVector = {
    east: targetVelocity.east - referenceVelocity.east,
    north: targetVelocity.north - referenceVelocity.north,
  };
  const positionSquared = relativePosition.east ** 2 + relativePosition.north ** 2;
  const relativeSpeedSquared = relativeVelocity.east ** 2 + relativeVelocity.north ** 2;
  const distance = Math.sqrt(positionSquared);
  const relativeSpeed = Math.sqrt(relativeSpeedSquared);
  const dotProduct = relativePosition.east * relativeVelocity.east
    + relativePosition.north * relativeVelocity.north;
  const closureRate = distance === 0 ? 0 : -dotProduct / distance;

  if (relativeSpeedSquared <= Number.EPSILON) {
    return {
      ...baseResult(request),
      status: 'AVAILABLE',
      closureRateKnots: closureRate,
      relativeSpeedKnots: relativeSpeed,
      cpaDistanceNauticalMiles: distance,
      tcpaMinutes: null,
      cpaStatus: 'NO_RELATIVE_MOTION',
    };
  }

  const tcpaHours = -dotProduct / relativeSpeedSquared;
  const tcpaMinutes = tcpaHours * 60;
  if (tcpaHours < 0) {
    return {
      ...baseResult(request),
      status: 'AVAILABLE',
      closureRateKnots: closureRate,
      relativeSpeedKnots: relativeSpeed,
      cpaDistanceNauticalMiles: distance,
      tcpaMinutes,
      cpaStatus: 'PAST_CPA',
    };
  }

  const cpaEast = relativePosition.east + relativeVelocity.east * tcpaHours;
  const cpaNorth = relativePosition.north + relativeVelocity.north * tcpaHours;
  return {
    ...baseResult(request),
    status: 'AVAILABLE',
    closureRateKnots: closureRate,
    relativeSpeedKnots: relativeSpeed,
    cpaDistanceNauticalMiles: Math.sqrt(cpaEast ** 2 + cpaNorth ** 2),
    tcpaMinutes,
    cpaStatus: 'FUTURE_CPA',
  };
};
