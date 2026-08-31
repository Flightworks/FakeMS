import { EntityType, type Entity, type Position } from '../types';

export interface ScenarioDefinition {
  id: string;
  name: string;
  seed: number;
  startTimeMs: number;
  ownship: Entity;
  entities: Entity[];
}

const clonePosition = (position: Position): Position => ({
  lat: position.lat,
  lon: position.lon,
});

/**
 * Clone an entity and all of its mutable, nested values.
 *
 * Scenarios are used as the immutable source of truth for a simulation.  A
 * dedicated clone rather than a shallow spread keeps positions, waypoints,
 * and metadata independent between a scenario and its simulation state.
 */
export const cloneEntity = (entity: Entity): Entity => {
  const clone: Entity = {
    ...entity,
    position: clonePosition(entity.position),
  };

  if (entity.waypoints) {
    clone.waypoints = entity.waypoints.map(clonePosition);
  }

  if (entity.metadata) {
    clone.metadata = { ...entity.metadata };
  }

  return clone;
};

/**
 * Create an independent scenario snapshot suitable for use by the engine.
 */
export const cloneScenario = (scenario: ScenarioDefinition): ScenarioDefinition => ({
  ...scenario,
  ownship: cloneEntity(scenario.ownship),
  entities: scenario.entities.map(cloneEntity),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isPosition = (value: unknown): value is Position =>
  isRecord(value)
  && typeof value.lat === 'number'
  && Number.isFinite(value.lat)
  && typeof value.lon === 'number'
  && Number.isFinite(value.lon);

const isEntityType = (value: unknown): value is EntityType =>
  Object.values(EntityType).includes(value as EntityType);

const isEntity = (value: unknown): value is Entity =>
  isRecord(value)
  && typeof value.id === 'string'
  && value.id.length > 0
  && typeof value.label === 'string'
  && isEntityType(value.type)
  && isPosition(value.position)
  && (!('waypoints' in value) || (
    Array.isArray(value.waypoints) && value.waypoints.every(isPosition)
  ));

/**
 * Validate and clone a JSON-shaped scenario at the boundary of the engine.
 */
export const parseScenario = (input: unknown): ScenarioDefinition => {
  if (!isRecord(input)
    || typeof input.id !== 'string'
    || typeof input.name !== 'string'
    || typeof input.seed !== 'number'
    || !Number.isFinite(input.seed)
    || typeof input.startTimeMs !== 'number'
    || !Number.isFinite(input.startTimeMs)
    || !isEntity(input.ownship)
    || !Array.isArray(input.entities)
    || !input.entities.every(isEntity)) {
    throw new Error('Invalid scenario: expected id, name, seed, startTimeMs, ownship and entities');
  }

  return cloneScenario({
    id: input.id,
    name: input.name,
    seed: input.seed,
    startTimeMs: input.startTimeMs,
    ownship: input.ownship,
    entities: input.entities,
  });
};

export const parseScenarioJson = (json: string): ScenarioDefinition => {
  try {
    return parseScenario(JSON.parse(json) as unknown);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid scenario JSON');
    }
    throw error;
  }
};
