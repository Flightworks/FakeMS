import type { Position } from '../types';
import {
  projectTacticalPosition,
  TACTICAL_PROJECTION_METHOD,
} from './tacticalProjection';

export const MAX_FUTURE_PROJECTION_MINUTES = 60;
export const MAX_FUTURE_PROJECTION_NM = 500;

export type FuturePositionFreshness = 'FRESH' | 'STALE' | 'UNKNOWN';
export type FuturePositionHorizonUnit = 'MIN' | 'NM';
export type FuturePositionHorizonLimit = 'TIME' | 'DISTANCE' | 'NONE';

export type FuturePositionUnavailableReason =
  | 'INVALID_POSITION'
  | 'MISSING_GROUND_TRACK'
  | 'INVALID_GROUND_TRACK'
  | 'MISSING_GROUND_SPEED'
  | 'INVALID_GROUND_SPEED'
  | 'UNKNOWN_FRESHNESS'
  | 'STALE_TRACK'
  | 'INVALID_HORIZON'
  | 'DISTANCE_HORIZON_WITHOUT_MOTION';

export interface FuturePositionTrack {
  id: string;
  label: string;
  position: Position;
  groundTrackDegrees?: number;
  groundSpeedKnots?: number;
  freshness?: FuturePositionFreshness;
  lastSeenAtMs?: number;
  ageSeconds?: number;
}

export interface FuturePositionRequest {
  track: FuturePositionTrack;
  horizon: {
    value: number;
    unit: FuturePositionHorizonUnit;
  };
  nowMs?: number;
}

interface FuturePositionResultBase {
  method: typeof TACTICAL_PROJECTION_METHOD;
  referencePosition: Position;
  targetPosition: Position | null;
  line: [Position, Position] | null;
  projectedRangeNauticalMiles: number | null;
  effectiveHorizonMinutes: number | null;
  projectedAtMs: number | null;
  ageSeconds: number | null;
  horizonLimit: FuturePositionHorizonLimit;
  assumption: 'CONSTANT GROUND TRACK / GROUND SPEED';
}

export interface FuturePositionAvailable extends FuturePositionResultBase {
  status: 'AVAILABLE';
  targetPosition: Position;
  line: [Position, Position];
  projectedRangeNauticalMiles: number;
  effectiveHorizonMinutes: number;
  reason?: undefined;
}

export interface FuturePositionUnavailable extends FuturePositionResultBase {
  status: 'UNAVAILABLE';
  reason: FuturePositionUnavailableReason;
  targetPosition: null;
  line: null;
  projectedRangeNauticalMiles: null;
  effectiveHorizonMinutes: null;
  projectedAtMs: null;
  horizonLimit: 'NONE';
}

export type FuturePositionResult = FuturePositionAvailable | FuturePositionUnavailable;

export interface FuturePositionPreview {
  type: 'FUTURE_POSITION_PREVIEW';
  trackId: string;
  trackLabel: string;
  groundTrackDegrees: number;
  groundSpeedKnots: number;
  result: FuturePositionAvailable;
}

const copyPosition = (position: Position): Position => ({ lat: position.lat, lon: position.lon });

const baseResult = (track: FuturePositionTrack): FuturePositionResultBase => ({
  method: TACTICAL_PROJECTION_METHOD,
  referencePosition: copyPosition(track.position),
  targetPosition: null,
  line: null,
  projectedRangeNauticalMiles: null,
  effectiveHorizonMinutes: null,
  projectedAtMs: null,
  ageSeconds: null,
  horizonLimit: 'NONE',
  assumption: 'CONSTANT GROUND TRACK / GROUND SPEED',
});

const unavailable = (
  track: FuturePositionTrack,
  reason: FuturePositionUnavailableReason,
): FuturePositionUnavailable => ({
  ...baseResult(track),
  status: 'UNAVAILABLE',
  reason,
  targetPosition: null,
  line: null,
  projectedRangeNauticalMiles: null,
  effectiveHorizonMinutes: null,
  projectedAtMs: null,
  horizonLimit: 'NONE',
});

const isValidPosition = (position: Position): boolean => (
  Number.isFinite(position.lat)
  && Number.isFinite(position.lon)
  && position.lat >= -90
  && position.lat <= 90
  && position.lon >= -180
  && position.lon <= 180
);

const calculateAgeSeconds = (request: FuturePositionRequest): number | null => {
  const { track, nowMs } = request;
  if (Number.isFinite(track.ageSeconds) && (track.ageSeconds as number) >= 0) {
    return track.ageSeconds as number;
  }
  if (Number.isFinite(nowMs) && Number.isFinite(track.lastSeenAtMs)) {
    return Math.max(0, ((nowMs as number) - (track.lastSeenAtMs as number)) / 1000);
  }
  return null;
};

export const projectFuturePosition = (request: FuturePositionRequest): FuturePositionResult => {
  const { track, horizon, nowMs } = request;
  if (!isValidPosition(track.position)) return unavailable(track, 'INVALID_POSITION');
  if (track.freshness === 'STALE') return unavailable(track, 'STALE_TRACK');
  if (track.freshness !== 'FRESH') return unavailable(track, 'UNKNOWN_FRESHNESS');
  if (typeof track.groundTrackDegrees !== 'number') return unavailable(track, 'MISSING_GROUND_TRACK');
  if (!Number.isFinite(track.groundTrackDegrees)
    || track.groundTrackDegrees < 0
    || track.groundTrackDegrees >= 360) {
    return unavailable(track, 'INVALID_GROUND_TRACK');
  }
  if (typeof track.groundSpeedKnots !== 'number') return unavailable(track, 'MISSING_GROUND_SPEED');
  if (!Number.isFinite(track.groundSpeedKnots) || track.groundSpeedKnots < 0) {
    return unavailable(track, 'INVALID_GROUND_SPEED');
  }
  if (!Number.isFinite(horizon.value) || horizon.value <= 0
    || (horizon.unit !== 'MIN' && horizon.unit !== 'NM')) {
    return unavailable(track, 'INVALID_HORIZON');
  }
  if (horizon.unit === 'NM' && track.groundSpeedKnots === 0) {
    return unavailable(track, 'DISTANCE_HORIZON_WITHOUT_MOTION');
  }

  const requestedMinutes = horizon.unit === 'MIN'
    ? horizon.value
    : horizon.value / track.groundSpeedKnots * 60;
  const requestedRange = horizon.unit === 'NM'
    ? horizon.value
    : track.groundSpeedKnots * horizon.value / 60;
  const timeLimitedMinutes = Math.min(requestedMinutes, MAX_FUTURE_PROJECTION_MINUTES);
  const distanceLimitedRange = Math.min(requestedRange, MAX_FUTURE_PROJECTION_NM);
  const rangeFromTime = track.groundSpeedKnots * timeLimitedMinutes / 60;
  const projectedRange = Math.min(distanceLimitedRange, rangeFromTime);
  const effectiveMinutes = track.groundSpeedKnots === 0
    ? timeLimitedMinutes
    : projectedRange / track.groundSpeedKnots * 60;
  const timeWasFirst = effectiveMinutes < requestedMinutes && timeLimitedMinutes <= (MAX_FUTURE_PROJECTION_NM / track.groundSpeedKnots * 60);
  const distanceWasFirst = projectedRange < requestedRange && !timeWasFirst;
  const horizonLimit: FuturePositionHorizonLimit = timeWasFirst
    ? 'TIME'
    : distanceWasFirst
      ? 'DISTANCE'
      : 'NONE';
  const targetPosition = projectedRange === 0
    ? copyPosition(track.position)
    : projectTacticalPosition(track.position, track.groundTrackDegrees, projectedRange).position;
  const referencePosition = copyPosition(track.position);
  const targetCopy = copyPosition(targetPosition);
  const ageSeconds = calculateAgeSeconds(request);
  const projectedAtMs = Number.isFinite(nowMs)
    ? (nowMs as number) + effectiveMinutes * 60_000
    : null;

  return {
    status: 'AVAILABLE',
    method: TACTICAL_PROJECTION_METHOD,
    referencePosition,
    targetPosition: targetCopy,
    line: [copyPosition(referencePosition), copyPosition(targetCopy)],
    projectedRangeNauticalMiles: projectedRange,
    effectiveHorizonMinutes: effectiveMinutes,
    projectedAtMs,
    ageSeconds,
    horizonLimit,
    assumption: 'CONSTANT GROUND TRACK / GROUND SPEED',
  };
};
