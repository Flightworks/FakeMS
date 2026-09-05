import type { Position } from '../types';
import {
  projectTacticalPosition,
  TACTICAL_PROJECTION_METHOD,
} from './tacticalProjection';

export interface ProjectionPreview {
  type: 'PROJECTION_PREVIEW';
  referenceLabel: string;
  referencePosition: Position;
  targetPosition: Position;
  line: [Position, Position];
  bearingDegrees: number;
  rangeNauticalMiles: number;
  unit: 'NM';
  method: typeof TACTICAL_PROJECTION_METHOD;
}

export interface SimulatedDesignation {
  type: 'SIMULATED_DESIGNATION';
  id: string;
  label: string;
  position: Position;
  source: 'PROJECTION_PREVIEW';
}

const copyPosition = (position: Position): Position => ({
  lat: position.lat,
  lon: position.lon,
});

export const createSimulatedDesignation = (
  preview: ProjectionPreview,
  sequence: number,
): SimulatedDesignation => {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('Designation sequence must be a positive integer');
  }

  return {
    type: 'SIMULATED_DESIGNATION',
    id: `designation-${sequence}`,
    label: `P${sequence}`,
    position: copyPosition(preview.targetPosition),
    source: 'PROJECTION_PREVIEW',
  };
};

export const createProjectionPreview = (
  referenceLabel: string,
  referencePosition: Position,
  bearingDegrees: number,
  rangeNauticalMiles: number,
): ProjectionPreview => {
  const projection = projectTacticalPosition(
    referencePosition,
    bearingDegrees,
    rangeNauticalMiles,
  );
  const previewReference = copyPosition(referencePosition);
  const previewTarget = copyPosition(projection.position);

  return {
    type: 'PROJECTION_PREVIEW',
    referenceLabel,
    referencePosition: previewReference,
    targetPosition: previewTarget,
    line: [copyPosition(previewReference), copyPosition(previewTarget)],
    bearingDegrees,
    rangeNauticalMiles,
    unit: 'NM',
    method: projection.method,
  };
};
