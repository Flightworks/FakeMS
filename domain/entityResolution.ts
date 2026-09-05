import type { Entity, Position } from '../types';
import { distanceBetween } from '../utils/geo';
import { METERS_PER_NAUTICAL_MILE } from './tacticalUnits';

export type EntityResolutionStatus =
  | 'RESOLVED'
  | 'AMBIGUOUS_REFERENCE'
  | 'UNKNOWN_REFERENCE'
  | 'FUZZY_SUGGESTION';

export type EntityResolutionMatch =
  | 'IDENTIFIER_EXACT'
  | 'LABEL_EXACT'
  | 'PREFIX'
  | 'FUZZY'
  | 'NONE';

export interface EntityReferenceCandidate {
  id: string;
  label: string;
  type: Entity['type'];
  distanceToOwnshipNm: number;
}

export interface EntityReferenceResolution {
  reference: string;
  normalizedReference: string;
  status: EntityResolutionStatus;
  code: EntityResolutionStatus;
  match: EntityResolutionMatch;
  executable: boolean;
  entity?: Entity;
  candidates: EntityReferenceCandidate[];
}

const stripDiacritics = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const normalizeEntityReference = (value: string): string =>
  stripDiacritics(value).trim().replace(/\s+/g, ' ').toUpperCase();

const copyPosition = (position: Position): Position => ({
  lat: position.lat,
  lon: position.lon,
});

const copyEntity = (entity: Entity): Entity => ({
  ...entity,
  position: copyPosition(entity.position),
  ...(entity.waypoints
    ? { waypoints: entity.waypoints.map(copyPosition) }
    : {}),
  ...(entity.metadata
    ? { metadata: { ...entity.metadata } }
    : {}),
});

const uniqueEntityPool = (entities: readonly Entity[], ownship: Entity): Entity[] => {
  const pool: Entity[] = [ownship];
  for (const entity of entities) {
    if (entity === ownship) continue;
    if (entity.id === ownship.id && entity.type === ownship.type) continue;
    pool.push(entity);
  }
  return pool;
};

const distanceToOwnshipNm = (entity: Entity, ownship: Entity): number => {
  const positions = [
    entity.position.lat,
    entity.position.lon,
    ownship.position.lat,
    ownship.position.lon,
  ];
  if (!positions.every(Number.isFinite)) return Number.POSITIVE_INFINITY;

  return distanceBetween(
    entity.position.lat,
    entity.position.lon,
    ownship.position.lat,
    ownship.position.lon,
  ) / METERS_PER_NAUTICAL_MILE;
};

const compareCandidate = (
  left: EntityReferenceCandidate,
  right: EntityReferenceCandidate,
): number => {
  const labelDifference = normalizeEntityReference(left.label)
    .localeCompare(normalizeEntityReference(right.label));
  if (labelDifference !== 0) return labelDifference;
  return left.id.localeCompare(right.id);
};

const toCandidate = (entity: Entity, ownship: Entity): EntityReferenceCandidate => ({
  id: entity.id,
  label: entity.label,
  type: entity.type,
  distanceToOwnshipNm: distanceToOwnshipNm(entity, ownship),
});

const toCandidates = (entities: readonly Entity[], ownship: Entity): EntityReferenceCandidate[] =>
  entities.map(entity => toCandidate(entity, ownship)).sort(compareCandidate);

const levenshteinDistance = (left: string, right: string): number => {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex];
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + substitutionCost,
      );
      diagonal = above;
    }
  }

  return previous[right.length];
};

const fuzzyScore = (query: string, entity: Entity): number => {
  const values = [normalizeEntityReference(entity.label), normalizeEntityReference(entity.id)];
  return Math.min(...values.map(value => {
    const denominator = Math.max(query.length, value.length, 1);
    return levenshteinDistance(query, value) / denominator;
  }));
};

const createResolution = (
  reference: string,
  normalizedReference: string,
  status: EntityResolutionStatus,
  match: EntityResolutionMatch,
  candidates: EntityReferenceCandidate[],
  entity?: Entity,
): EntityReferenceResolution => ({
  reference,
  normalizedReference,
  status,
  code: status,
  match,
  executable: status === 'RESOLVED',
  ...(entity ? { entity: copyEntity(entity) } : {}),
  candidates,
});

export const resolveEntityReference = (
  reference: string,
  entities: readonly Entity[],
  ownship: Entity,
): EntityReferenceResolution => {
  const normalizedReference = normalizeEntityReference(reference);
  const entityPool = uniqueEntityPool(entities, ownship);

  if (normalizedReference.length === 0) {
    return createResolution(
      reference,
      normalizedReference,
      'UNKNOWN_REFERENCE',
      'NONE',
      [],
    );
  }

  const exactIdentifierMatches = entityPool.filter(entity => (
    normalizeEntityReference(entity.id) === normalizedReference
  ));
  if (exactIdentifierMatches.length > 0) {
    const candidates = toCandidates(exactIdentifierMatches, ownship);
    return exactIdentifierMatches.length === 1
      ? createResolution(
        reference,
        normalizedReference,
        'RESOLVED',
        'IDENTIFIER_EXACT',
        candidates,
        exactIdentifierMatches[0],
      )
      : createResolution(
        reference,
        normalizedReference,
        'AMBIGUOUS_REFERENCE',
        'IDENTIFIER_EXACT',
        candidates,
      );
  }

  const exactLabelMatches = entityPool.filter(entity => (
    normalizeEntityReference(entity.label) === normalizedReference
  ));
  if (exactLabelMatches.length > 0) {
    const candidates = toCandidates(exactLabelMatches, ownship);
    return exactLabelMatches.length === 1
      ? createResolution(
        reference,
        normalizedReference,
        'RESOLVED',
        'LABEL_EXACT',
        candidates,
        exactLabelMatches[0],
      )
      : createResolution(
        reference,
        normalizedReference,
        'AMBIGUOUS_REFERENCE',
        'LABEL_EXACT',
        candidates,
      );
  }

  const prefixMatches = entityPool.filter(entity => (
    normalizeEntityReference(entity.id).startsWith(normalizedReference)
    || normalizeEntityReference(entity.label).startsWith(normalizedReference)
  ));
  if (prefixMatches.length > 0) {
    const candidates = toCandidates(prefixMatches, ownship);
    return prefixMatches.length === 1
      ? createResolution(
        reference,
        normalizedReference,
        'RESOLVED',
        'PREFIX',
        candidates,
        prefixMatches[0],
      )
      : createResolution(
        reference,
        normalizedReference,
        'AMBIGUOUS_REFERENCE',
        'PREFIX',
        candidates,
      );
  }

  const fuzzyMatches = entityPool
    .map(entity => ({ entity, score: fuzzyScore(normalizedReference, entity) }))
    .filter(({ score }) => score <= 0.45)
    .sort((left, right) => {
      const scoreDifference = left.score - right.score;
      if (scoreDifference !== 0) return scoreDifference;
      return compareCandidate(toCandidate(left.entity, ownship), toCandidate(right.entity, ownship));
    })
    .slice(0, 5)
    .map(({ entity }) => entity);

  if (fuzzyMatches.length > 0) {
    const candidates = toCandidates(fuzzyMatches, ownship);
    const status: EntityResolutionStatus = candidates.length === 1
      ? 'FUZZY_SUGGESTION'
      : 'AMBIGUOUS_REFERENCE';
    return createResolution(
      reference,
      normalizedReference,
      status,
      'FUZZY',
      candidates,
    );
  }

  return createResolution(
    reference,
    normalizedReference,
    'UNKNOWN_REFERENCE',
    'NONE',
    [],
  );
};

export const resolveReference = resolveEntityReference;
export const resolveTacticalEntityReference = resolveEntityReference;

export const formatEntityReferenceCandidate = (
  candidate: EntityReferenceCandidate,
): string => `${candidate.label} · ${candidate.type} · id=${candidate.id} · ${candidate.distanceToOwnshipNm.toFixed(1)} NM from OWNSHIP`;
