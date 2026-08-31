import { Position } from '../types';
import { SensorType } from './sensors';

export type TrackFreshness = 'FRESH' | 'STALE';
export type TrackQuality = 'GOOD' | 'DEGRADED' | 'LOST';
export type TrackAffiliation = 'UNKNOWN' | 'FRIENDLY' | 'NEUTRAL' | 'SUSPECT' | 'HOSTILE';

export interface TrackUncertainty {
  horizontalMeters: number;
}

export interface ClassificationEvidence {
  source: SensorType | 'OPERATOR';
  statement: string;
}

export interface ClassificationAssessment {
  affiliation: TrackAffiliation;
  confidence: number;
  assessedAt: number;
  evidence: ClassificationEvidence[];
  alternatives: Array<{ affiliation: TrackAffiliation; confidence: number }>;
}

export interface Track {
  id: string;
  label: string;
  position: Position;
  heading?: number;
  speed?: number;
  sources: SensorType[];
  firstSeenAt: number;
  lastSeenAt: number;
  quality: TrackQuality;
  uncertainty: TrackUncertainty;
  classification: ClassificationAssessment;
}
