import type { Entity } from '../types';
import type {
  Track,
  TrackAffiliation,
  TrackQuality,
} from './mission';

export type DisplayTrackFreshness = 'FRESH' | 'STALE' | 'UNKNOWN';
export type DisplayTrackQuality = TrackQuality | 'UNKNOWN';

export interface TrackDisplayDetails {
  trackId: string;
  label: string;
  sourceLabel: string | null;
  ageSeconds: number | null;
  freshness: DisplayTrackFreshness;
  quality: DisplayTrackQuality;
  uncertaintyMeters: number | null;
  classification: TrackAffiliation | 'UNKNOWN';
  confidence: number | null;
}

const finiteNonNegative = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0
);

const metadataString = (entity: Entity, key: string): string | null => {
  const value = entity.metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

const metadataNumber = (entity: Entity, key: string): number | null => {
  const value = entity.metadata?.[key];
  return finiteNonNegative(value) ? value : null;
};

const readFreshness = (value: string | null): DisplayTrackFreshness => (
  value === 'FRESH' || value === 'STALE' ? value : 'UNKNOWN'
);

const readQuality = (value: string | null): DisplayTrackQuality => (
  value === 'GOOD' || value === 'DEGRADED' || value === 'LOST' ? value : 'UNKNOWN'
);

const readClassification = (value: string | null): TrackAffiliation | 'UNKNOWN' => (
  value === 'UNKNOWN'
  || value === 'FRIENDLY'
  || value === 'NEUTRAL'
  || value === 'SUSPECT'
  || value === 'HOSTILE'
    ? value
    : 'UNKNOWN'
);

const readConfidence = (entity: Entity): number | null => {
  const value = entity.metadata?.confidence;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : null;
};

const readEntityAge = (entity: Entity, nowMs?: number): number | null => {
  const explicitAge = metadataNumber(entity, 'ageSeconds');
  if (explicitAge !== null) return explicitAge;
  const lastSeenAtMs = metadataNumber(entity, 'lastSeenAtMs');
  if (lastSeenAtMs !== null && typeof nowMs === 'number' && Number.isFinite(nowMs)) {
    return Math.max(0, (nowMs - lastSeenAtMs) / 1000);
  }
  return null;
};

export const createTrackDetails = (
  track: Track,
  nowMs: number,
  staleAfterSeconds?: number,
): TrackDisplayDetails => {
  const ageSeconds = Math.max(0, (nowMs - track.lastSeenAt) / 1000);
  const freshness: DisplayTrackFreshness = finiteNonNegative(staleAfterSeconds)
    ? ageSeconds > staleAfterSeconds ? 'STALE' : 'FRESH'
    : 'UNKNOWN';
  const confidence = Number.isFinite(track.classification.confidence)
    && track.classification.confidence >= 0
    && track.classification.confidence <= 1
    ? track.classification.confidence
    : null;
  return {
    trackId: track.id,
    label: track.label,
    sourceLabel: track.sources.length > 0 ? track.sources.join('+') : null,
    ageSeconds,
    freshness,
    quality: track.quality,
    uncertaintyMeters: finiteNonNegative(track.uncertainty.horizontalMeters)
      ? track.uncertainty.horizontalMeters
      : null,
    classification: track.classification.affiliation,
    confidence,
  };
};

export const createEntityTrackDetails = (entity: Entity, nowMs?: number): TrackDisplayDetails => ({
  trackId: entity.id,
  label: entity.label,
  sourceLabel: metadataString(entity, 'source'),
  ageSeconds: readEntityAge(entity, nowMs),
  freshness: readFreshness(metadataString(entity, 'freshness')?.toUpperCase() ?? null),
  quality: readQuality(metadataString(entity, 'quality')?.toUpperCase() ?? null),
  uncertaintyMeters: metadataNumber(entity, 'uncertaintyMeters'),
  classification: readClassification(metadataString(entity, 'classification')?.toUpperCase() ?? null),
  confidence: readConfidence(entity),
});

export const listStaleEntityDetails = (
  entities: readonly Entity[],
  nowMs?: number,
): TrackDisplayDetails[] => entities
  .map(entity => createEntityTrackDetails(entity, nowMs))
  .filter(details => details.freshness === 'STALE')
  .sort((left, right) => {
    const leftAge = left.ageSeconds ?? -1;
    const rightAge = right.ageSeconds ?? -1;
    return rightAge - leftAge || left.trackId.localeCompare(right.trackId);
  });
