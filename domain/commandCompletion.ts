import type { Entity } from '../types';
import { resolveEntityReference } from './entityResolution';

export type TacticalCompletionStage = 'REFERENCE' | 'BEARING_RANGE' | 'RANGE' | 'UNIT';

export interface TacticalCompletion {
  stage: TacticalCompletionStage;
  label: string;
  value: string;
  subLabel: string;
}

const normalizeReference = (value: string): string => value.trim().replace(/\s+/g, ' ').toUpperCase();

const resolveUniqueReference = (reference: string, entities: Entity[], ownship: Entity): Entity | null => {
  const resolution = resolveEntityReference(reference, entities, ownship);
  return resolution.executable && resolution.entity ? resolution.entity : null;
};

const referenceCompletion = (entity: Entity): TacticalCompletion => ({
  stage: 'REFERENCE',
  label: entity.label,
  value: `${entity.label} `,
  subLabel: `REFERENCE · ${entity.type} · ${entity.id}`,
});

export const getTacticalCompletions = (
  input: string,
  entities: Entity[],
  ownship: Entity,
): TacticalCompletion[] => {
  if (!input.trim()) return [];

  const trimmed = input.trim();
  const normalized = normalizeReference(trimmed);
  const hasTrailingSpace = /\s$/.test(input);

  if (!hasTrailingSpace && !normalized.includes('/') && !/\s/.test(normalized)) {
    const entity = resolveUniqueReference(normalized, entities, ownship);
    if (entity && normalizeReference(entity.label) !== normalized) {
      return [referenceCompletion(entity)];
    }
    if (entity && normalizeReference(entity.label) === normalized) {
      return [referenceCompletion(entity)];
    }
    return [];
  }

  if (hasTrailingSpace && !normalized.includes('/')) {
    const entity = resolveUniqueReference(trimmed, entities, ownship);
    if (!entity) return [];
    return [{
      stage: 'BEARING_RANGE',
      label: 'CAP/PORTÉE',
      value: `${entity.label} 000/`,
      subLabel: 'FORMAT STRUCTURÉ · CAP VRAI / PORTÉE',
    }];
  }

  const bearingMatch = trimmed.match(/^(.+?)\s+(\d+(?:\.\d+)?)\/$/);
  if (bearingMatch) {
    const entity = resolveUniqueReference(bearingMatch[1], entities, ownship);
    if (!entity) return [];
    return [{
      stage: 'RANGE',
      label: 'PORTÉE',
      value: `${entity.label} ${bearingMatch[2]}/5`,
      subLabel: 'DISTANCE · AJOUTER UNE VALEUR NUMÉRIQUE',
    }];
  }

  const rangeMatch = trimmed.match(/^(.+?)\s+(\d+(?:\.\d+)?)\/(\d+(?:\.\d*)?)$/);
  if (rangeMatch) {
    const entity = resolveUniqueReference(rangeMatch[1], entities, ownship);
    if (!entity) return [];
    return ['NM', 'KM', 'M'].map(unit => ({
      stage: 'UNIT' as const,
      label: unit,
      value: `${entity.label} ${rangeMatch[2]}/${rangeMatch[3]}${unit}`,
      subLabel: `UNITÉ DE PORTÉE · ${unit}`,
    }));
  }

  return [];
};
