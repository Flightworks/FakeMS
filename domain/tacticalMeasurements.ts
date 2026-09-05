import type { Entity } from '../types';
import { bearingBetween, distanceBetween } from '../utils/geo';
import { METERS_PER_NAUTICAL_MILE } from './tacticalUnits';

export type TacticalPositionFreshness = 'CURRENT' | 'STALE' | 'UNKNOWN';
export type TacticalMeasurementQualification = 'CALCULATED' | 'UNAVAILABLE';
export type TacticalMeasurementSource = 'ENTITY_POSITIONS';
export type TacticalMeasurementReason =
  | 'IDENTICAL_POSITIONS'
  | 'STALE_POSITION'
  | 'INVALID_POSITION';
export type TacticalMeasurementKind = 'BRG' | 'RNG' | 'BRG/RNG';

export interface TacticalMeasurementOptions {
  fromFreshness?: TacticalPositionFreshness;
  toFreshness?: TacticalPositionFreshness;
}

export interface TacticalMeasurementReference {
  id: string;
  label: string;
}

export interface TacticalMeasurement {
  from: TacticalMeasurementReference;
  to: TacticalMeasurementReference;
  bearingTrueDegrees: number | null;
  rangeNauticalMiles: number | null;
  source: TacticalMeasurementSource;
  qualification: TacticalMeasurementQualification;
  reason?: TacticalMeasurementReason;
}

const referenceOf = (entity: Pick<Entity, 'id' | 'label'>): TacticalMeasurementReference => ({
  id: entity.id,
  label: entity.label,
});

const isValidPosition = (entity: Pick<Entity, 'position'>): boolean => (
  Number.isFinite(entity.position.lat)
  && Number.isFinite(entity.position.lon)
  && entity.position.lat >= -90
  && entity.position.lat <= 90
  && entity.position.lon >= -180
  && entity.position.lon <= 180
);

const isCurrent = (freshness: TacticalPositionFreshness | undefined): boolean =>
  freshness === undefined || freshness === 'CURRENT';

const unavailableMeasurement = (
  from: Pick<Entity, 'id' | 'label'>,
  to: Pick<Entity, 'id' | 'label'>,
  reason: TacticalMeasurementReason,
): TacticalMeasurement => ({
  from: referenceOf(from),
  to: referenceOf(to),
  bearingTrueDegrees: null,
  rangeNauticalMiles: null,
  source: 'ENTITY_POSITIONS',
  qualification: 'UNAVAILABLE',
  reason,
});

export const calculateTacticalMeasurement = (
  from: Pick<Entity, 'id' | 'label' | 'position'>,
  to: Pick<Entity, 'id' | 'label' | 'position'>,
  options: TacticalMeasurementOptions = {},
): TacticalMeasurement => {
  if (!isCurrent(options.fromFreshness) || !isCurrent(options.toFreshness)) {
    return unavailableMeasurement(from, to, 'STALE_POSITION');
  }

  if (!isValidPosition(from) || !isValidPosition(to)) {
    return unavailableMeasurement(from, to, 'INVALID_POSITION');
  }

  const distanceMeters = distanceBetween(
    from.position.lat,
    from.position.lon,
    to.position.lat,
    to.position.lon,
  );
  const rangeNauticalMiles = distanceMeters / METERS_PER_NAUTICAL_MILE;

  if (distanceMeters === 0) {
    return {
      from: referenceOf(from),
      to: referenceOf(to),
      bearingTrueDegrees: null,
      rangeNauticalMiles: 0,
      source: 'ENTITY_POSITIONS',
      qualification: 'CALCULATED',
      reason: 'IDENTICAL_POSITIONS',
    };
  }

  const rawBearing = bearingBetween(
    from.position.lat,
    from.position.lon,
    to.position.lat,
    to.position.lon,
  );
  const bearingTrueDegrees = ((rawBearing % 360) + 360) % 360;

  return {
    from: referenceOf(from),
    to: referenceOf(to),
    bearingTrueDegrees,
    rangeNauticalMiles,
    source: 'ENTITY_POSITIONS',
    qualification: 'CALCULATED',
  };
};

const formatBearing = (bearing: number | null): string => (
  bearing === null ? 'UNAVAILABLE' : `${bearing.toFixed(1).padStart(5, '0')}°T`
);

const formatRange = (range: number | null): string => (
  range === null ? 'UNAVAILABLE' : `${range.toFixed(1)} NM`
);

export const formatTacticalMeasurement = (
  measurement: TacticalMeasurement,
  kind: TacticalMeasurementKind,
): string => {
  const value = kind === 'BRG'
    ? `BRG ${formatBearing(measurement.bearingTrueDegrees)}`
    : kind === 'RNG'
      ? `RNG ${formatRange(measurement.rangeNauticalMiles)}`
      : `BRG ${formatBearing(measurement.bearingTrueDegrees)} · RNG ${formatRange(measurement.rangeNauticalMiles)}`;
  const reason = measurement.reason ? ` · ${measurement.reason}` : '';

  return `${value} · FROM ${measurement.from.label} TO ${measurement.to.label}`
    + ` · SRC ${measurement.source} · QUAL ${measurement.qualification}${reason}`;
};
