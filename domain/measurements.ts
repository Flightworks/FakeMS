import type { Entity, Position } from '../types';
import { distanceBetween } from '../utils/geo';

export type MeasurementSource =
  | 'UNAVAILABLE'
  | 'SIMULATED_TERRAIN'
  | 'DERIVED_POSITION_SPEED';
export type MeasurementQualification = 'UNAVAILABLE' | 'SIMULATED' | 'CALCULATED';

export interface NumericMeasurement {
  value: number | null;
  unit: string;
  source: MeasurementSource;
  qualification: MeasurementQualification;
}

export const deriveHeightAboveTerrain = (
  entity: Entity | ({ metadata?: Entity['metadata'] } & Record<string, unknown>),
): NumericMeasurement => {
  const rawValue = entity.metadata?.hgtFt;
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue) || rawValue < 0) {
    return {
      value: null,
      unit: 'ft',
      source: 'UNAVAILABLE',
      qualification: 'UNAVAILABLE',
    };
  }

  return {
    value: rawValue,
    unit: 'ft',
    source: 'SIMULATED_TERRAIN',
    qualification: 'SIMULATED',
  };
};

export const calculateEta = (
  origin: Position,
  destination: Position,
  speedKnots: number,
): NumericMeasurement => {
  const speedMps = Number.isFinite(speedKnots) && speedKnots > 0
    ? speedKnots * 0.514444
    : 0;

  if (speedMps <= 0) {
    return {
      value: null,
      unit: 'min',
      source: 'DERIVED_POSITION_SPEED',
      qualification: 'UNAVAILABLE',
    };
  }

  const distanceMeters = distanceBetween(
    origin.lat,
    origin.lon,
    destination.lat,
    destination.lon,
  );

  return {
    value: distanceMeters / speedMps / 60,
    unit: 'min',
    source: 'DERIVED_POSITION_SPEED',
    qualification: 'CALCULATED',
  };
};

export const formatMeasurement = (measurement: NumericMeasurement, precision = 1): string => {
  if (measurement.value === null) return `N/A · ${measurement.source}`;
  return `${measurement.value.toFixed(precision)} ${measurement.unit} · ${measurement.source}`;
};
