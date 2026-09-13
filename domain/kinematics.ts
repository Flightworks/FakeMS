import type { Entity, Position } from '../types';
import { getDestinationPoint, distanceBetween, bearingBetween } from '../utils/geo';

const KNOTS_TO_M_S = 0.514444;

export type KinematicsSource = 'SCENARIO' | 'GPS' | 'SIMULATION' | 'SENSOR';
export type KinematicsQualification = 'SIMULATED' | 'MEASURED' | 'OBSERVED' | 'UNAVAILABLE';
export type KinematicsFreshness = 'FRESH' | 'STALE' | 'UNKNOWN';

export interface KinematicsSnapshot {
  id: string;
  label: string;
  position: Position;
  headingDegrees: number | null;
  groundTrackDegrees: number | null;
  groundSpeedKnots: number | null;
  source: KinematicsSource;
  sourceLabel?: string;
  qualification: KinematicsQualification;
  timestampMs: number | null;
  freshness: KinematicsFreshness;
  ageSeconds: number | null;
  assumption: 'CONSTANT VELOCITY';
}

export interface KinematicsSnapshotOptions {
  source?: KinematicsSource;
  sourceLabel?: string;
  qualification?: KinematicsQualification;
  position?: Position;
  /** An explicit null prevents fallback to the entity's stale motion value. */
  headingDegrees?: number | null;
  /** An explicit null prevents fallback to the entity's stale motion value. */
  groundSpeedKnots?: number | null;
  timestampMs?: number | null;
  freshness?: KinematicsFreshness;
  ageSeconds?: number | null;
  /** Metadata vectors are only a fallback when no live vector is present. */
  allowMetadataVector?: boolean;
}

const hasOwn = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);

const readMetadataNumber = (entity: Entity, key: string): number | undefined => {
  const value = entity.metadata?.[key];
  return typeof value === 'number' ? value : undefined;
};

const readMetadataFreshness = (entity: Entity): KinematicsFreshness | undefined => {
  const value = entity.metadata?.freshness;
  return value === 'FRESH' || value === 'STALE' || value === 'UNKNOWN' ? value : undefined;
};

const defaultQualification = (source: KinematicsSource): KinematicsQualification => {
  if (source === 'GPS') return 'MEASURED';
  if (source === 'SENSOR') return 'OBSERVED';
  return 'SIMULATED';
};

/**
 * Capture one immutable, source-qualified kinematic view.
 *
 * The adapter deliberately prefers the current entity vector over copied
 * metadata, and never mutates either the entity or its metadata.  Callers that
 * have a different source (for example a GPS fix) pass explicit values,
 * including null when that source does not provide a vector.
 */
export const createKinematicsSnapshot = (
  entity: Entity,
  options: KinematicsSnapshotOptions = {},
): KinematicsSnapshot => {
  const source = options.source ?? 'SCENARIO';
  const sourceLabel = options.sourceLabel
    ?? (typeof entity.metadata?.source === 'string' ? entity.metadata.source : undefined);
  const qualification = options.qualification ?? defaultQualification(source);
  const hasExplicitHeading = hasOwn(options, 'headingDegrees');
  const hasExplicitSpeed = hasOwn(options, 'groundSpeedKnots');
  const entityHeading = typeof entity.heading === 'number' ? entity.heading : null;
  const entitySpeed = typeof entity.speed === 'number' ? entity.speed : null;
  const liveVectorPresent = entityHeading !== null || entitySpeed !== null;
  const useMetadataVector = options.allowMetadataVector !== false
    && !hasExplicitHeading
    && !hasExplicitSpeed
    && !liveVectorPresent;
  const metadataTrack = readMetadataNumber(entity, 'groundTrackDegrees');
  const metadataSpeed = readMetadataNumber(entity, 'groundSpeedKnots');
  const headingDegrees = hasExplicitHeading
    ? (options.headingDegrees as number | null)
    : useMetadataVector
      ? (metadataTrack ?? null)
      : entityHeading;
  const groundTrackDegrees = headingDegrees;
  const groundSpeedKnots = hasExplicitSpeed
    ? (options.groundSpeedKnots as number | null)
    : useMetadataVector
      ? (metadataSpeed ?? null)
      : entitySpeed;
  const usingMetadataVector = useMetadataVector && (metadataTrack !== undefined || metadataSpeed !== undefined);
  const timestampMs = hasOwn(options, 'timestampMs')
    ? (options.timestampMs as number | null)
    : readMetadataNumber(entity, 'updatedAt')
      ?? readMetadataNumber(entity, 'lastSeenAtMs')
      ?? null;
  const ageSeconds = hasOwn(options, 'ageSeconds')
    ? (options.ageSeconds as number | null)
    : usingMetadataVector
      ? readMetadataNumber(entity, 'ageSeconds') ?? null
      : liveVectorPresent || hasExplicitHeading || hasExplicitSpeed ? 0 : null;
  const freshness = options.freshness
    ?? (usingMetadataVector ? readMetadataFreshness(entity) : undefined)
    ?? 'FRESH';

  return {
    id: entity.id,
    label: entity.label,
    position: {
      ...(options.position ?? entity.position),
    },
    headingDegrees,
    groundTrackDegrees,
    groundSpeedKnots,
    source,
    ...(sourceLabel ? { sourceLabel } : {}),
    qualification,
    timestampMs,
    freshness,
    ageSeconds,
    assumption: 'CONSTANT VELOCITY',
  };
};

/**
 * Project a snapshot into an independent Entity view for consumers such as
 * MapDisplay and the command palette.  The live simulation entity remains the
 * source of truth and is never changed by this helper.
 */
export const projectKinematicsToEntity = (
  entity: Entity,
  snapshot: KinematicsSnapshot,
): Entity => {
  const metadata = entity.metadata ? { ...entity.metadata } : {};
  const { groundTrackDegrees, groundSpeedKnots, freshness, timestampMs, ageSeconds } = snapshot;
  delete metadata.groundTrackDegrees;
  delete metadata.groundSpeedKnots;
  delete metadata.lastSeenAtMs;
  delete metadata.ageSeconds;
  metadata.freshness = freshness;
  metadata.source = snapshot.sourceLabel ?? snapshot.source;
  metadata.qualification = snapshot.qualification;
  if (groundTrackDegrees !== null) metadata.groundTrackDegrees = groundTrackDegrees;
  if (groundSpeedKnots !== null) metadata.groundSpeedKnots = groundSpeedKnots;
  if (timestampMs !== null) metadata.lastSeenAtMs = timestampMs;
  if (ageSeconds !== null) metadata.ageSeconds = ageSeconds;

  return {
    ...entity,
    position: { ...snapshot.position },
    heading: snapshot.headingDegrees ?? undefined,
    speed: snapshot.groundSpeedKnots ?? undefined,
    metadata,
  };
};

const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360;

const angleDifference = (current: number, target: number): number => {
  const diff = normalizeAngle(target - current);
  if (Math.abs(diff) < 0.1) return 0;
  return diff > 180 ? diff - 360 : diff;
};

export const stepEntity = (entity: Entity, dtSeconds: number): Entity => {
  if (!entity.speed && !entity.targetSpeed) return entity;

  let { lat, lon } = entity.position;
  let currentSpeed = entity.speed || 0;
  let currentHeading = entity.heading || 0;
  let targetHeading = entity.targetHeading ?? currentHeading;
  const targetSpeed = entity.targetSpeed ?? currentSpeed;
  const turnRate = entity.turnRate || 3.0;
  const acceleration = entity.acceleration || 5.0;

  let waypoints = entity.waypoints ? [...entity.waypoints] : undefined;
  if (waypoints && waypoints.length > 0) {
    const nextWp = waypoints[0];
    const distToWp = distanceBetween(lat, lon, nextWp.lat, nextWp.lon);

    if (distToWp < 200) {
      waypoints.shift();
      if (waypoints.length === 0) waypoints = undefined;
    } else {
      targetHeading = bearingBetween(lat, lon, nextWp.lat, nextWp.lon);
    }
  }

  if (entity.continuousTurn) {
    const change = turnRate * dtSeconds;
    currentHeading += (entity.continuousTurn === 'R' ? 1 : -1) * change;
    currentHeading = normalizeAngle(currentHeading);
    targetHeading = currentHeading;
  } else {
    const turnDiff = angleDifference(currentHeading, targetHeading);
    if (turnDiff !== 0) {
      const change = turnRate * dtSeconds;
      if (Math.abs(turnDiff) < change) {
        currentHeading = targetHeading;
      } else {
        currentHeading += Math.sign(turnDiff) * change;
      }
      currentHeading = normalizeAngle(currentHeading);
    }
  }

  if (Math.abs(currentSpeed - targetSpeed) > 0.1) {
    const speedDir = Math.sign(targetSpeed - currentSpeed);
    const speedChange = acceleration * dtSeconds;

    if (Math.abs(targetSpeed - currentSpeed) < speedChange) {
      currentSpeed = targetSpeed;
    } else {
      currentSpeed += speedDir * speedChange;
    }
    if (currentSpeed < 0) currentSpeed = 0;
  }

  if (currentSpeed > 0) {
    const distanceMeters = currentSpeed * KNOTS_TO_M_S * dtSeconds;
    const newPos = getDestinationPoint(lat, lon, distanceMeters, currentHeading);
    lat = newPos.lat;
    lon = newPos.lon;
  }

  return {
    ...entity,
    position: { lat, lon },
    heading: currentHeading,
    targetHeading,
    speed: currentSpeed,
    targetSpeed,
    waypoints,
  };
};
