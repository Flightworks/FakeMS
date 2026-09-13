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

export interface EntityReferencePairCandidate {
  from: EntityReferenceCandidate;
  to: EntityReferenceCandidate;
}

export interface EntityReferencePairResolution {
  reference: string;
  normalizedReference: string;
  status: EntityResolutionStatus;
  code: EntityResolutionStatus;
  match: EntityResolutionMatch;
  executable: boolean;
  from?: Entity;
  to?: Entity;
  candidates: EntityReferencePairCandidate[];
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

type ResolutionCandidateEntity = {
  candidate: EntityReferenceCandidate;
  entity: Entity;
};

const entitiesForResolution = (
  resolution: EntityReferenceResolution,
  entityPool: readonly Entity[],
  ownship: Entity,
): ResolutionCandidateEntity[] => {
  if (resolution.entity) {
    return [{
      candidate: toCandidate(resolution.entity, ownship),
      entity: resolution.entity,
    }];
  }

  return resolution.candidates.flatMap(candidate => {
    const entity = entityPool.find(item => (
      item.id === candidate.id && item.type === candidate.type
    ));
    return entity ? [{ candidate, entity }] : [];
  });
};

const pairCandidateKey = (candidate: EntityReferencePairCandidate): string => (
  `${candidate.from.type}:${candidate.from.id}->${candidate.to.type}:${candidate.to.id}`
);

const pairMatch = (
  from: EntityReferenceResolution,
  to: EntityReferenceResolution,
): EntityResolutionMatch => {
  if (from.match === 'FUZZY' || to.match === 'FUZZY') return 'FUZZY';
  if (from.match === 'PREFIX' || to.match === 'PREFIX') return 'PREFIX';
  if (from.match === 'IDENTIFIER_EXACT' && to.match === 'IDENTIFIER_EXACT') return 'IDENTIFIER_EXACT';
  return 'LABEL_EXACT';
};

export const resolveEntityPairReference = (
  reference: string,
  entities: readonly Entity[],
  ownship: Entity,
): EntityReferencePairResolution => {
  const normalizedReference = normalizeEntityReference(reference);
  const entityPool = uniqueEntityPool(entities, ownship);
  const words = normalizedReference.split(' ').filter(Boolean);
  const pairCandidates: EntityReferencePairCandidate[] = [];
  const resolvedPairCandidates: EntityReferencePairCandidate[] = [];
  const pairResolutions: Array<{
    from: EntityReferenceResolution;
    to: EntityReferenceResolution;
  }> = [];
  const seen = new Set<string>();

  for (let splitIndex = 1; splitIndex < words.length; splitIndex += 1) {
    const fromResolution = resolveEntityReference(
      words.slice(0, splitIndex).join(' '),
      entities,
      ownship,
    );
    const toResolution = resolveEntityReference(
      words.slice(splitIndex).join(' '),
      entities,
      ownship,
    );
    const fromCandidates = entitiesForResolution(fromResolution, entityPool, ownship);
    const toCandidates = entitiesForResolution(toResolution, entityPool, ownship);
    if (fromCandidates.length === 0 || toCandidates.length === 0) continue;

    pairResolutions.push({ from: fromResolution, to: toResolution });
    for (const from of fromCandidates) {
      for (const to of toCandidates) {
        if (from.entity.id === to.entity.id && from.entity.type === to.entity.type) continue;
        const candidate: EntityReferencePairCandidate = {
          from: from.candidate,
          to: to.candidate,
        };
        const key = pairCandidateKey(candidate);
        if (!seen.has(key)) {
          seen.add(key);
          pairCandidates.push(candidate);
        }
        if (fromResolution.status === 'RESOLVED'
          && toResolution.status === 'RESOLVED'
          && !resolvedPairCandidates.some(item => pairCandidateKey(item) === key)) {
          resolvedPairCandidates.push(candidate);
        }
      }
    }
  }

  const pairWasFuzzy = pairResolutions.some(({ from, to }) => (
    from.status === 'FUZZY_SUGGESTION' || to.status === 'FUZZY_SUGGESTION'
  ));
  const pairWasAmbiguous = pairResolutions.some(({ from, to }) => (
    from.status === 'AMBIGUOUS_REFERENCE' || to.status === 'AMBIGUOUS_REFERENCE'
  ));
  const effectiveCandidates = resolvedPairCandidates.length > 0
    ? resolvedPairCandidates
    : pairCandidates;
  const exactPairResolution = pairResolutions.find(({ from, to }) => (
    from.status === 'RESOLVED' && to.status === 'RESOLVED'
  ));
  const match = exactPairResolution
    ? pairMatch(exactPairResolution.from, exactPairResolution.to)
    : pairResolutions.length > 0
      ? pairMatch(pairResolutions[0].from, pairResolutions[0].to)
    : 'NONE';
  const status: EntityResolutionStatus = resolvedPairCandidates.length === 1
    ? 'RESOLVED'
    : resolvedPairCandidates.length > 1
      ? 'AMBIGUOUS_REFERENCE'
      : pairWasAmbiguous || effectiveCandidates.length > 1
        ? 'AMBIGUOUS_REFERENCE'
        : effectiveCandidates.length === 1 || pairWasFuzzy
        ? 'FUZZY_SUGGESTION'
        : 'UNKNOWN_REFERENCE';
  const resolvedCandidate = status === 'RESOLVED' ? resolvedPairCandidates[0] : undefined;
  const resolvedFrom = resolvedCandidate
    ? entityPool.find(entity => entity.id === resolvedCandidate.from.id
      && entity.type === resolvedCandidate.from.type)
    : undefined;
  const resolvedTo = resolvedCandidate
    ? entityPool.find(entity => entity.id === resolvedCandidate.to.id
      && entity.type === resolvedCandidate.to.type)
    : undefined;

  return {
    reference,
    normalizedReference,
    status,
    code: status,
    match,
    executable: status === 'RESOLVED',
    ...(resolvedFrom ? { from: copyEntity(resolvedFrom) } : {}),
    ...(resolvedTo ? { to: copyEntity(resolvedTo) } : {}),
    candidates: effectiveCandidates,
  };
};

export const resolveReference = resolveEntityReference;
export const resolveTacticalEntityReference = resolveEntityReference;

export const formatEntityReferenceCandidate = (
  candidate: EntityReferenceCandidate,
): string => `${candidate.label} · ${candidate.type} · id=${candidate.id} · ${candidate.distanceToOwnshipNm.toFixed(1)} NM from OWNSHIP`;
