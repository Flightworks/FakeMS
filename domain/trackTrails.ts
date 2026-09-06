import type { Position } from '../types';
import { distanceBetween } from '../utils/geo';

export const TRAIL_SAMPLE_INTERVAL_MS = 2_000;
export const TRAIL_MIN_DISTANCE_METERS = 5;
export const TRAIL_MAX_AGE_MS = 30 * 60 * 1_000;
export const TRAIL_MAX_POINTS = 900;
export const TRAIL_MAX_GPS_ACCURACY_METERS = 100;
export const TRAIL_MAX_SEGMENT_GAP_MS = 30_000;

export interface TrailPoint {
  position: Position;
  atMs: number;
  segmentId: number;
}

export interface TrackTrail {
  targetId: string;
  label: string;
  visible: boolean;
  points: TrailPoint[];
  limited: boolean;
}

export interface TrackTrailState {
  trails: Record<string, TrackTrail>;
  lastIgnoredReason?: string;
}

export interface TrailSample {
  targetId: string;
  label: string;
  position: Position;
  atMs: number;
  source?: 'SIM' | 'GPS';
  accuracyMeters?: number;
}

export type TrailSampleResult =
  | { status: 'RECORDED'; state: TrackTrailState; point: TrailPoint }
  | { status: 'IGNORED'; state: TrackTrailState; reason: 'GPS ACCURACY LOW' | 'INVALID POSITION' | 'SAMPLE INTERVAL' | 'MINIMUM DISTANCE' | 'INVALID TIME' };

export const createTrailState = (): TrackTrailState => ({ trails: {} });

const cloneState = (state: TrackTrailState): TrackTrailState => ({
  trails: Object.fromEntries(Object.entries(state.trails).map(([id, trail]) => [id, {
    ...trail,
    points: trail.points.map(point => ({ ...point, position: { ...point.position } })),
  }])),
  ...(state.lastIgnoredReason ? { lastIgnoredReason: state.lastIgnoredReason } : {}),
});

const validPosition = (position: Position): boolean => Number.isFinite(position.lat)
  && Number.isFinite(position.lon)
  && position.lat >= -90 && position.lat <= 90
  && position.lon >= -180 && position.lon <= 180;

const nextSegmentId = (trail: TrackTrail): number => trail.points.reduce(
  (maximum, point) => Math.max(maximum, point.segmentId),
  0,
) + 1;

const appendAndLimit = (trail: TrackTrail, point: TrailPoint, nowMs: number): TrackTrail => {
  let points = [...trail.points, point];
  let limited = trail.limited;
  const oldestAllowed = nowMs - TRAIL_MAX_AGE_MS;
  if (points.some(existing => existing.atMs < oldestAllowed)) {
    points = points.filter(existing => existing.atMs >= oldestAllowed);
    limited = true;
  }
  if (points.length > TRAIL_MAX_POINTS) {
    points = points.slice(-TRAIL_MAX_POINTS);
    limited = true;
  }
  return { ...trail, points, limited };
};

export const appendTrailSample = (state: TrackTrailState, sample: TrailSample): TrailSampleResult => {
  const next = cloneState(state);
  if (sample.source === 'GPS' && (!Number.isFinite(sample.accuracyMeters)
    || (sample.accuracyMeters ?? Number.POSITIVE_INFINITY) > TRAIL_MAX_GPS_ACCURACY_METERS)) {
    return { status: 'IGNORED', state: { ...next, lastIgnoredReason: 'GPS ACCURACY LOW' }, reason: 'GPS ACCURACY LOW' };
  }
  if (!validPosition(sample.position)) return { status: 'IGNORED', state: { ...next, lastIgnoredReason: 'INVALID POSITION' }, reason: 'INVALID POSITION' };
  if (!Number.isFinite(sample.atMs)) return { status: 'IGNORED', state: { ...next, lastIgnoredReason: 'INVALID TIME' }, reason: 'INVALID TIME' };

  const existing = next.trails[sample.targetId];
  if (!existing || existing.points.length === 0) {
    const point: TrailPoint = { position: { ...sample.position }, atMs: sample.atMs, segmentId: 1 };
    const trail: TrackTrail = existing
      ? appendAndLimit({ ...existing, label: sample.label }, point, sample.atMs)
      : { targetId: sample.targetId, label: sample.label, visible: false, points: [point], limited: false };
    next.trails[sample.targetId] = trail;
    next.lastIgnoredReason = undefined;
    return { status: 'RECORDED', state: next, point };
  }

  const last = existing.points[existing.points.length - 1];
  const deltaMs = sample.atMs - last.atMs;
  const distanceMeters = distanceBetween(last.position.lat, last.position.lon, sample.position.lat, sample.position.lon);
  const startsNewSegment = deltaMs < 0 || deltaMs > TRAIL_MAX_SEGMENT_GAP_MS;
  if (deltaMs === 0) {
    return { status: 'IGNORED', state: { ...next, lastIgnoredReason: 'SAMPLE INTERVAL' }, reason: 'SAMPLE INTERVAL' };
  }
  if (!startsNewSegment && deltaMs < TRAIL_SAMPLE_INTERVAL_MS) {
    return { status: 'IGNORED', state: { ...next, lastIgnoredReason: 'SAMPLE INTERVAL' }, reason: 'SAMPLE INTERVAL' };
  }
  if (!startsNewSegment && distanceMeters < TRAIL_MIN_DISTANCE_METERS) {
    return { status: 'IGNORED', state: { ...next, lastIgnoredReason: 'MINIMUM DISTANCE' }, reason: 'MINIMUM DISTANCE' };
  }

  const point: TrailPoint = {
    position: { ...sample.position },
    atMs: sample.atMs,
    segmentId: startsNewSegment ? nextSegmentId(existing) : last.segmentId,
  };
  next.trails[sample.targetId] = appendAndLimit({ ...existing, label: sample.label }, point, sample.atMs);
  next.lastIgnoredReason = undefined;
  return { status: 'RECORDED', state: next, point };
};

export const setTrailVisibility = (
  state: TrackTrailState,
  targetId: string,
  visible: boolean,
  label = targetId,
): TrackTrailState => {
  const next = cloneState(state);
  const existing = next.trails[targetId];
  next.trails[targetId] = existing
    ? { ...existing, visible }
    : { targetId, label, visible, points: [], limited: false };
  return next;
};

export const clearTrail = (state: TrackTrailState, targetId: string): TrackTrailState => {
  const next = cloneState(state);
  const existing = next.trails[targetId];
  if (existing) next.trails[targetId] = { ...existing, points: [], limited: false };
  return next;
};

export const resetTrailState = (): TrackTrailState => createTrailState();

export const getTrailSegments = (trail: TrackTrail | undefined): TrailPoint[][] => {
  if (!trail || trail.points.length === 0) return [];
  const segments: TrailPoint[][] = [];
  for (const point of trail.points) {
    const current = segments[segments.length - 1];
    if (!current || current[0].segmentId !== point.segmentId) segments.push([{ ...point, position: { ...point.position } }]);
    else current.push({ ...point, position: { ...point.position } });
  }
  return segments;
};
