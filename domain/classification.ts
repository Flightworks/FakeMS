import { Entity, EntityType, Position } from '../types';
import { Track, TrackAffiliation, TrackFreshness } from './mission';
import { ageSeconds, classifyTrackAge, clampConfidence } from './tracks';
import { SensorType } from './sensors';

export interface TruthEntity {
  role: 'SCENARIO_TRUTH';
  id: string;
  type: EntityType;
  label: string;
  position: Position;
  heading?: number;
  speed?: number;
}

export interface ClassificationAssessmentInput {
  affiliation: TrackAffiliation;
  confidence: number;
  evidence: Array<{ source: SensorType | 'OPERATOR'; statement: string }>;
  alternatives?: Array<{ affiliation: TrackAffiliation; confidence: number }>;
}

export interface DisplayTrack {
  trackId: string;
  sourceLabel: string;
  ageSeconds: number;
  freshness: TrackFreshness;
  classification: TrackAffiliation;
  confidence: number;
  uncertaintyMeters: number;
}

export const createTruthEntity = (entity: Omit<Entity, 'metadata'>): TruthEntity => ({
  role: 'SCENARIO_TRUTH',
  id: entity.id,
  type: entity.type,
  label: entity.label,
  position: { ...entity.position },
  heading: entity.heading,
  speed: entity.speed,
});

export const assessClassification = (
  track: Track,
  assessment: ClassificationAssessmentInput,
): Track => ({
  ...track,
  classification: {
    affiliation: assessment.affiliation,
    confidence: clampConfidence(assessment.confidence),
    assessedAt: track.lastSeenAt,
    evidence: assessment.evidence.map(item => ({ ...item })),
    alternatives: (assessment.alternatives ?? track.classification.alternatives).map(item => ({
      affiliation: item.affiliation,
      confidence: clampConfidence(item.confidence),
    })),
  },
});

export const createDisplayTrack = (track: Track, now: number): DisplayTrack => ({
  trackId: track.id,
  sourceLabel: track.sources.join('+'),
  ageSeconds: ageSeconds(track, now),
  freshness: classifyTrackAge(track, now, 5),
  classification: track.classification.affiliation,
  confidence: track.classification.confidence,
  uncertaintyMeters: track.uncertainty.horizontalMeters,
});
