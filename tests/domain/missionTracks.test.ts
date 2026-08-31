import { describe, expect, it } from 'vitest';
import { ageSeconds, classifyTrackAge, clampConfidence } from '../../domain/tracks';
import { createTrackFromReport, mergeSensorReport } from '../../domain/trackBuilder';
import { SensorReport } from '../../domain/sensors';

describe('mission track domain', () => {
  const report: SensorReport = {
    id: 'radar-1',
    trackId: 'track-1',
    sensor: 'RADAR',
    position: { lat: 34.1, lon: -118.2 },
    observedAt: 10_000,
    accuracyMeters: 40,
    quality: 'GOOD',
  };

  it('creates a track with provenance and unknown classification', () => {
    const track = createTrackFromReport(report);

    expect(track.id).toBe('track-1');
    expect(track.sources).toEqual(['RADAR']);
    expect(track.firstSeenAt).toBe(10_000);
    expect(track.lastSeenAt).toBe(10_000);
    expect(track.classification.affiliation).toBe('UNKNOWN');
    expect(track.classification.confidence).toBe(0);
    expect(track.uncertainty.horizontalMeters).toBe(40);
  });

  it('merges a newer report without losing source history', () => {
    const first = createTrackFromReport(report);
    const updated = mergeSensorReport(first, {
      ...report,
      id: 'ais-1',
      sensor: 'AIS',
      position: { lat: 34.11, lon: -118.21 },
      observedAt: 12_000,
      accuracyMeters: 10,
    });

    expect(updated.lastSeenAt).toBe(12_000);
    expect(updated.position).toEqual({ lat: 34.11, lon: -118.21 });
    expect(updated.sources).toEqual(['RADAR', 'AIS']);
    expect(updated.uncertainty.horizontalMeters).toBe(10);
  });

  it('marks old tracks stale and bounds confidence', () => {
    const track = createTrackFromReport(report);

    expect(ageSeconds(track, 12_000)).toBe(2);
    expect(classifyTrackAge(track, 12_000, 1)).toBe('STALE');
    expect(classifyTrackAge(track, 12_000, 5)).toBe('FRESH');
    expect(clampConfidence(-1)).toBe(0);
    expect(clampConfidence(2)).toBe(1);
  });
});
