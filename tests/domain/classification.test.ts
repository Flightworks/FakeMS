import { describe, expect, it } from 'vitest';
import { EntityType } from '../../types';
import {
  createDisplayTrack,
  createTruthEntity,
  assessClassification,
} from '../../domain/classification';
import { createTrackFromReport } from '../../domain/trackBuilder';
import { SensorReport } from '../../domain/sensors';

describe('mission truth, observations and display tracks', () => {
  it('keeps scenario truth separate from sensor observations', () => {
    const truth = createTruthEntity({
      id: 'truth-1',
      type: EntityType.ENEMY,
      label: 'SCENARIO CONTACT',
      position: { lat: 34, lon: -118 },
    });
    const report: SensorReport = {
      id: 'radar-report-1',
      trackId: 'track-1',
      sensor: 'RADAR',
      position: { lat: 34.001, lon: -118.002 },
      observedAt: 1000,
      accuracyMeters: 50,
      quality: 'GOOD',
    };
    const track = createTrackFromReport(report);

    expect(truth.role).toBe('SCENARIO_TRUTH');
    expect(track.classification.affiliation).toBe('UNKNOWN');
    expect(track.position).not.toEqual(truth.position);
  });

  it('creates display metadata from a track without changing its assessment', () => {
    const track = createTrackFromReport({
      id: 'ais-1',
      trackId: 'track-2',
      sensor: 'AIS',
      position: { lat: 34, lon: -118 },
      observedAt: 10_000,
      accuracyMeters: 12,
      quality: 'GOOD',
    });
    const assessed = assessClassification(track, {
      affiliation: 'SUSPECT',
      confidence: 0.7,
      evidence: [{ source: 'AIS', statement: 'identity unavailable' }],
      alternatives: [{ affiliation: 'UNKNOWN', confidence: 0.3 }],
    });
    const display = createDisplayTrack(assessed, 12_000);

    expect(display.trackId).toBe(track.id);
    expect(display.sourceLabel).toBe('AIS');
    expect(display.ageSeconds).toBe(2);
    expect(display.classification).toBe('SUSPECT');
    expect(display.confidence).toBe(0.7);
    expect(display.uncertaintyMeters).toBe(12);
    expect(assessed.classification.alternatives).toEqual([
      { affiliation: 'UNKNOWN', confidence: 0.3 },
    ]);
  });
});
