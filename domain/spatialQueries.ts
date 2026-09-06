import type { Entity, EntityType } from '../types';
import { bearingBetween, distanceBetween } from '../utils/geo';
import type { TacticalPositionFreshness } from './tacticalMeasurements';
import { METERS_PER_NAUTICAL_MILE } from './tacticalUnits';

export type NearestCategory = 'WAYPOINT' | 'TRACK' | 'AIRPORT';
export type NearestFreshness = TacticalPositionFreshness;
export type NearestQuality = 'GOOD' | 'DEGRADED' | 'LOST' | 'UNKNOWN';

export interface NearestQuery {
  reference: Entity;
  entities: readonly Entity[];
  category: NearestCategory;
  limit: number;
  freshnessOf?: (entity: Entity) => NearestFreshness;
}

export interface NearestCandidate {
  id: string;
  label: string;
  type: EntityType;
  position: { lat: number; lon: number };
  bearingTrueDegrees: number | null;
  rangeNauticalMiles: number;
  freshness: NearestFreshness;
  quality: NearestQuality;
  source: string;
  uncertaintyMeters: number | null;
}

export interface NearestSearchResult {
  status: 'OK' | 'EMPTY';
  referenceId: string;
  category: NearestCategory;
  limit: number;
  candidates: NearestCandidate[];
}

const validPosition = (entity: Pick<Entity, 'position'>): boolean => (
  Number.isFinite(entity.position.lat)
  && Number.isFinite(entity.position.lon)
  && entity.position.lat >= -90
  && entity.position.lat <= 90
  && entity.position.lon >= -180
  && entity.position.lon <= 180
);

const matchesCategory = (entity: Entity, category: NearestCategory): boolean => {
  if (category === 'WAYPOINT') return entity.type === 'WAYPOINT';
  if (category === 'AIRPORT') return entity.type === 'AIRPORT';
  return entity.type === 'ENEMY' || entity.type === 'FRIENDLY';
};

const metadataString = (entity: Entity, key: string): string | undefined => {
  const value = entity.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const metadataQuality = (entity: Entity): NearestQuality => {
  const value = metadataString(entity, 'quality')?.toUpperCase();
  return value === 'GOOD' || value === 'DEGRADED' || value === 'LOST' ? value : 'UNKNOWN';
};

const metadataUncertainty = (entity: Entity): number | null => {
  const value = entity.metadata?.uncertaintyMeters;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
};

const normalizeBearing = (value: number): number => ((value % 360) + 360) % 360;

export const findNearestEntities = (query: NearestQuery): NearestSearchResult => {
  if (!Number.isInteger(query.limit) || query.limit <= 0) {
    throw new Error('Nearest result count must be a positive integer');
  }
  if (!validPosition(query.reference)) {
    throw new Error('Nearest reference position is invalid');
  }

  const candidates = query.entities
    .filter(entity => entity.id !== query.reference.id)
    .filter(entity => matchesCategory(entity, query.category))
    .filter(validPosition)
    .map(entity => {
      const distanceMeters = distanceBetween(
        query.reference.position.lat,
        query.reference.position.lon,
        entity.position.lat,
        entity.position.lon,
      );
      const rawBearing = distanceMeters === 0
        ? null
        : bearingBetween(
          query.reference.position.lat,
          query.reference.position.lon,
          entity.position.lat,
          entity.position.lon,
        );
      return {
        id: entity.id,
        label: entity.label,
        type: entity.type,
        position: { ...entity.position },
        bearingTrueDegrees: rawBearing === null ? null : normalizeBearing(rawBearing),
        rangeNauticalMiles: distanceMeters / METERS_PER_NAUTICAL_MILE,
        freshness: query.freshnessOf?.(entity) ?? 'UNKNOWN',
        quality: metadataQuality(entity),
        source: metadataString(entity, 'source') ?? 'UNKNOWN',
        uncertaintyMeters: metadataUncertainty(entity),
      } satisfies NearestCandidate;
    })
    .sort((left, right) => {
      const distanceDifference = left.rangeNauticalMiles - right.rangeNauticalMiles;
      if (Math.abs(distanceDifference) > 1e-9) return distanceDifference;
      return left.id.localeCompare(right.id);
    })
    .slice(0, query.limit);

  return {
    status: candidates.length > 0 ? 'OK' : 'EMPTY',
    referenceId: query.reference.id,
    category: query.category,
    limit: query.limit,
    candidates,
  };
};
