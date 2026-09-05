import type { Position } from '../types';
import { EARTH_RADIUS } from '../utils/geo';
import { METERS_PER_NAUTICAL_MILE } from './tacticalUnits';

export const TACTICAL_PROJECTION_METHOD = 'SPHERICAL DIRECT' as const;
export const MAX_TACTICAL_PROJECTION_NM = 500;

export type TacticalProjectionErrorCode =
  | 'INVALID_POSITION'
  | 'INVALID_BEARING'
  | 'INVALID_RANGE';

export class TacticalProjectionError extends Error {
  readonly code: TacticalProjectionErrorCode;

  constructor(code: TacticalProjectionErrorCode, message: string) {
    super(message);
    this.name = 'TacticalProjectionError';
    this.code = code;
    Object.setPrototypeOf(this, TacticalProjectionError.prototype);
  }
}

export interface TacticalProjectionResult {
  position: Position;
  method: typeof TACTICAL_PROJECTION_METHOD;
}

const degreesToRadians = (degrees: number): number => degrees * Math.PI / 180;
const radiansToDegrees = (radians: number): number => radians * 180 / Math.PI;
const normalizeLongitude = (longitude: number): number =>
  ((longitude + 180) % 360 + 360) % 360 - 180;
const clampUnitInterval = (value: number): number => Math.max(-1, Math.min(1, value));

const validateReference = (reference: Position): void => {
  if (!Number.isFinite(reference.lat)
    || !Number.isFinite(reference.lon)
    || reference.lat < -90
    || reference.lat > 90) {
    throw new TacticalProjectionError(
      'INVALID_POSITION',
      'Projection reference must contain finite coordinates and a latitude between -90 and 90 degrees.',
    );
  }
};

const validateBearing = (bearingDegrees: number): void => {
  if (!Number.isFinite(bearingDegrees) || bearingDegrees < 0 || bearingDegrees >= 360) {
    throw new TacticalProjectionError(
      'INVALID_BEARING',
      'Projection bearing must be between 000 and 359.999 degrees.',
    );
  }
};

const validateRange = (rangeNauticalMiles: number): void => {
  if (!Number.isFinite(rangeNauticalMiles)
    || rangeNauticalMiles <= 0
    || rangeNauticalMiles > MAX_TACTICAL_PROJECTION_NM) {
    throw new TacticalProjectionError(
      'INVALID_RANGE',
      `Projection range must be greater than 0 and at most ${MAX_TACTICAL_PROJECTION_NM} NM.`,
    );
  }
};

export const projectTacticalPosition = (
  reference: Position,
  bearingDegrees: number,
  rangeNauticalMiles: number,
): TacticalProjectionResult => {
  validateReference(reference);
  validateBearing(bearingDegrees);
  validateRange(rangeNauticalMiles);

  const latitude = degreesToRadians(reference.lat);
  const longitude = degreesToRadians(reference.lon);
  const bearing = degreesToRadians(bearingDegrees);
  const angularDistance = rangeNauticalMiles * METERS_PER_NAUTICAL_MILE / EARTH_RADIUS;

  const destinationLatitude = Math.asin(clampUnitInterval(
    Math.sin(latitude) * Math.cos(angularDistance)
      + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
  ));
  const destinationLongitude = longitude + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
    Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(destinationLatitude),
  );

  return {
    position: {
      lat: radiansToDegrees(destinationLatitude),
      lon: normalizeLongitude(radiansToDegrees(destinationLongitude)),
    },
    method: TACTICAL_PROJECTION_METHOD,
  };
};
