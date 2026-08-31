import { ClassificationAssessment, Track } from './mission';
import { SensorReport } from './sensors';

const unknownClassification = (observedAt: number): ClassificationAssessment => ({
  affiliation: 'UNKNOWN',
  confidence: 0,
  assessedAt: observedAt,
  evidence: [],
  alternatives: [],
});

export const createTrackFromReport = (report: SensorReport): Track => ({
  id: report.trackId,
  label: report.trackId.toUpperCase(),
  position: report.position,
  heading: report.heading,
  speed: report.speed,
  sources: [report.sensor],
  firstSeenAt: report.observedAt,
  lastSeenAt: report.observedAt,
  quality: report.quality,
  uncertainty: { horizontalMeters: Math.max(0, report.accuracyMeters) },
  classification: unknownClassification(report.observedAt),
});

export const mergeSensorReport = (track: Track, report: SensorReport): Track => {
  if (report.observedAt < track.lastSeenAt) return track;

  return {
    ...track,
    position: report.position,
    heading: report.heading ?? track.heading,
    speed: report.speed ?? track.speed,
    sources: track.sources.includes(report.sensor)
      ? track.sources
      : [...track.sources, report.sensor],
    lastSeenAt: report.observedAt,
    quality: report.quality,
    uncertainty: { horizontalMeters: Math.max(0, report.accuracyMeters) },
  };
};
