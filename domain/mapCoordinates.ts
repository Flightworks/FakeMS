import { EARTH_RADIUS } from '../utils/geo';
import type { Position } from '../types';

export interface MeterOffset {
  eastMeters: number;
  northMeters: number;
}

const degreesToRadians = (degrees: number): number => degrees * Math.PI / 180;
const radiansToDegrees = (radians: number): number => radians * 180 / Math.PI;
const normalizeLongitude = (longitude: number): number => ((longitude + 180) % 360 + 360) % 360 - 180;
const shortestLongitudeDelta = (delta: number): number => normalizeLongitude(delta);

/**
 * Convert a geographic target to a local east/north offset from a reference.
 * This is the only boundary used when a map view needs metre offsets.
 */
export const positionToMeterOffset = (
  reference: Position,
  target: Position,
): MeterOffset => {
  const referenceLatitudeRadians = degreesToRadians(reference.lat);
  return {
    eastMeters: degreesToRadians(shortestLongitudeDelta(target.lon - reference.lon))
      * EARTH_RADIUS
      * Math.cos(referenceLatitudeRadians),
    northMeters: degreesToRadians(target.lat - reference.lat) * EARTH_RADIUS,
  };
};

export const meterOffsetToPosition = (
  reference: Position,
  offset: MeterOffset,
): Position => {
  const referenceLatitudeRadians = degreesToRadians(reference.lat);
  const cosLatitude = Math.cos(referenceLatitudeRadians);

  if (Math.abs(cosLatitude) < Number.EPSILON) {
    throw new Error('Cannot convert longitude offset at a pole');
  }

  return {
    lat: reference.lat + radiansToDegrees(offset.northMeters / EARTH_RADIUS),
    lon: normalizeLongitude(reference.lon + radiansToDegrees(offset.eastMeters / (EARTH_RADIUS * cosLatitude))),
  };
};
