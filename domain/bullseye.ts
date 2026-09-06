import type { Position } from '../types';
import { calculateTacticalMeasurement } from './tacticalMeasurements';
import {
  projectTacticalPosition,
  TACTICAL_PROJECTION_METHOD,
} from './tacticalProjection';

export interface BullseyeEntity {
  id: string;
  label: string;
  position: Position;
}

export interface BullseyeReference {
  type: 'SIMULATED_BULLSEYE';
  entityId: string;
  label: string;
  position: Position;
  source: 'SCENARIO_ENTITY';
  state: 'SET';
}

export interface BullseyeProjectionPreview {
  type: 'BULLSEYE_PROJECTION_PREVIEW';
  referenceLabel: string;
  referencePosition: Position;
  targetPosition: Position;
  line: [Position, Position];
  bearingDegrees: number;
  rangeNauticalMiles: number;
  unit: 'NM';
  method: typeof TACTICAL_PROJECTION_METHOD;
}

export type BullseyeMeasurementQualification = 'CALCULATED' | 'UNAVAILABLE';
export type BullseyeMeasurementReason =
  | 'NO_BULLSEYE'
  | 'IDENTICAL_POSITIONS'
  | 'STALE_POSITION'
  | 'INVALID_POSITION';

export interface BullseyeMeasurement {
  from: { id: 'bullseye'; label: 'BULLSEYE' };
  to: { id: string; label: string };
  bearingTrueDegrees: number | null;
  rangeNauticalMiles: number | null;
  source: 'BULLSEYE';
  qualification: BullseyeMeasurementQualification;
  reason?: BullseyeMeasurementReason;
}

const copyPosition = (position: Position): Position => ({
  lat: position.lat,
  lon: position.lon,
});

const validateEntity = (entity: BullseyeEntity): void => {
  if (!entity.id.trim() || !entity.label.trim()) {
    throw new Error('Bullseye entity must have an id and label');
  }
  if (!Number.isFinite(entity.position.lat)
    || !Number.isFinite(entity.position.lon)
    || entity.position.lat < -90
    || entity.position.lat > 90
    || entity.position.lon < -180
    || entity.position.lon > 180) {
    throw new Error('Bullseye entity must have finite geographic coordinates');
  }
};

export const createBullseye = (entity: BullseyeEntity): BullseyeReference => {
  validateEntity(entity);
  return {
    type: 'SIMULATED_BULLSEYE',
    entityId: entity.id,
    label: entity.label,
    position: copyPosition(entity.position),
    source: 'SCENARIO_ENTITY',
    state: 'SET',
  };
};

export const createBullseyeProjectionPreview = (
  bullseye: BullseyeReference,
  bearingDegrees: number,
  rangeNauticalMiles: number,
): BullseyeProjectionPreview => {
  const projection = projectTacticalPosition(
    bullseye.position,
    bearingDegrees,
    rangeNauticalMiles,
  );
  const referencePosition = copyPosition(bullseye.position);
  const targetPosition = copyPosition(projection.position);
  return {
    type: 'BULLSEYE_PROJECTION_PREVIEW',
    referenceLabel: bullseye.label,
    referencePosition,
    targetPosition,
    line: [copyPosition(referencePosition), copyPosition(targetPosition)],
    bearingDegrees,
    rangeNauticalMiles,
    unit: 'NM',
    method: projection.method,
  };
};

const unavailableMeasurement = (
  target: BullseyeEntity,
  reason: BullseyeMeasurementReason,
): BullseyeMeasurement => ({
  from: { id: 'bullseye', label: 'BULLSEYE' },
  to: { id: target.id, label: target.label },
  bearingTrueDegrees: null,
  rangeNauticalMiles: null,
  source: 'BULLSEYE',
  qualification: 'UNAVAILABLE',
  reason,
});

export const calculateFromBullseye = (
  bullseye: BullseyeReference | null,
  target: BullseyeEntity,
): BullseyeMeasurement => {
  if (!bullseye) return unavailableMeasurement(target, 'NO_BULLSEYE');

  const measurement = calculateTacticalMeasurement(
    {
      id: 'bullseye',
      label: 'BULLSEYE',
      position: copyPosition(bullseye.position),
    },
    {
      id: target.id,
      label: target.label,
      position: copyPosition(target.position),
    },
  );

  return {
    from: { id: 'bullseye', label: 'BULLSEYE' },
    to: { id: target.id, label: target.label },
    bearingTrueDegrees: measurement.bearingTrueDegrees,
    rangeNauticalMiles: measurement.rangeNauticalMiles,
    source: 'BULLSEYE',
    qualification: measurement.qualification,
    ...(measurement.reason ? { reason: measurement.reason } : {}),
  };
};
