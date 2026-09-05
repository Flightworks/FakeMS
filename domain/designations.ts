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

const copyPosition = (position: Position): Position => ({
  lat: position.lat,
  lon: position.lon,
});

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
