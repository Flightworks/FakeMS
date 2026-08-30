import { describe, it, expect } from 'vitest';
import {
  calculateGroundSpeed,
  buildTrajectoryLegs,
  solveTrajectories,
  evaluateAltitudeProfiles,
  CONTRASTIVE_KNOWLEDGE_BASE,
  generateEllipsePolygon,
  generateBayesianSearchModel,
  CLASSIFIED_TRACKS_DATABASE,
  DEFAULT_SOLVER_ENV,
  DEFAULT_SOLVER_METRICS,
  PRESET_METRICS
} from '../../utils/solverEngine';
import { Position } from '../../types';

describe('solverEngine', () => {
  describe('calculateGroundSpeed', () => {
    it('should increase ground speed when tailwind is present', () => {
      // Course 055° (NE), Wind from 235° (SW => pure tailwind)
      const res = calculateGroundSpeed(55, 130, 235, 20);
      expect(res.groundSpeedKts).toBeGreaterThan(130);
      expect(res.tailwindComponentKts).toBeGreaterThan(15);
    });

    it('should decrease ground speed when headwind is present', () => {
      // Course 235° (SW), Wind from 235° (SW => pure headwind)
      const res = calculateGroundSpeed(235, 130, 235, 20);
      expect(res.groundSpeedKts).toBeLessThan(130);
      expect(res.tailwindComponentKts).toBeLessThan(-15);
    });
  });

  describe('buildTrajectoryLegs', () => {
    it('should construct legs with positive distances and ETEs', () => {
      const waypoints: (Position & { label?: string })[] = [
        { lat: 34.0, lon: -118.0, label: 'WPT1' },
        { lat: 34.1, lon: -118.0, label: 'WPT2' },
        { lat: 34.1, lon: -118.1, label: 'WPT3' }
      ];

      const legs = buildTrajectoryLegs(waypoints, DEFAULT_SOLVER_ENV);
      expect(legs).toHaveLength(2);
      expect(legs[0].distanceNm).toBeGreaterThan(0);
      expect(legs[0].eteMin).toBeGreaterThan(0);
      expect(legs[0].fuelBurnKg).toBeGreaterThan(0);
      expect(legs[0].speedKts).toBeGreaterThan(50);
    });
  });

  describe('solveTrajectories', () => {
    it('should generate ranked candidate trajectory options', () => {
      const ownshipPos: Position = { lat: 34.05, lon: -118.24 };
      const suspectPos: Position = { lat: 34.07, lon: -118.10 };
      const secondaryTracks: Position[] = [{ lat: 34.10, lon: -118.20 }];

      const options = solveTrajectories(
        ownshipPos,
        suspectPos,
        secondaryTracks,
        DEFAULT_SOLVER_ENV,
        DEFAULT_SOLVER_METRICS
      );

      expect(options).toHaveLength(4);

      // Verify all expected presets exist
      const presets = options.map(o => o.preset);
      expect(presets).toContain('FOCUS_MENACE');
      expect(presets).toContain('ECO_VENTS');
      expect(presets).toContain('BAYESIAN_GOFAST');
      expect(presets).toContain('MTO_STRIKE');

      // Verify each option has valid waypoints and metrics
      options.forEach(opt => {
        expect(opt.waypoints.length).toBeGreaterThanOrEqual(3);
        expect(opt.totalDistanceNm).toBeGreaterThan(0);
        expect(opt.totalEteMin).toBeGreaterThan(0);
        expect(opt.fuelBurnKg).toBeGreaterThan(0);
        expect(opt.fuelRemainingAtFrigateKg).toBeGreaterThan(0);
        expect(opt.score).toBeGreaterThan(0);
        expect(opt.limitingFactor).toBeTruthy();
        expect(opt.tacticalRationale).toBeTruthy();
      });
    });

    it('should prioritize Focus Menace when timeToTarget has highest weight', () => {
      const ownshipPos: Position = { lat: 34.05, lon: -118.24 };
      const suspectPos: Position = { lat: 34.07, lon: -118.10 };

      const options = solveTrajectories(
        ownshipPos,
        suspectPos,
        [],
        DEFAULT_SOLVER_ENV,
        PRESET_METRICS.FOCUS_MENACE
      );

      expect(options[0].preset).toBe('FOCUS_MENACE');
    });

    it('should prioritize Eco-Vents when fuelEconomy has highest weight', () => {
      const ownshipPos: Position = { lat: 34.05, lon: -118.24 };
      const suspectPos: Position = { lat: 34.07, lon: -118.10 };

      const options = solveTrajectories(
        ownshipPos,
        suspectPos,
        [],
        DEFAULT_SOLVER_ENV,
        PRESET_METRICS.ECO_VENTS
      );

      expect(options[0].preset).toBe('ECO_VENTS');
    });
  });

  describe('evaluateAltitudeProfiles', () => {
    it('should return 3 altitude options with 2000ft recommended for standard maritime search', () => {
      const profiles = evaluateAltitudeProfiles('SMALL_SKIFF', true);
      expect(profiles).toHaveLength(3);
      const optimal = profiles.find(p => p.isOptimal);
      expect(optimal?.altitudeFt).toBe(2000);
      expect(optimal?.radarRangeNm).toBeGreaterThan(25);
    });

    it('should show 500ft has higher small target Pd but lower area coverage', () => {
      const profiles = evaluateAltitudeProfiles('SMALL_SKIFF', true);
      const low = profiles.find(p => p.altitudeFt === 500);
      const mid = profiles.find(p => p.altitudeFt === 2000);
      expect(low?.smallTargetPd).toBeGreaterThan(mid?.smallTargetPd || 0);
      expect(low?.areaCoverageRateNm2PerHour).toBeLessThan(mid?.areaCoverageRateNm2PerHour || 0);
    });
  });

  describe('CONTRASTIVE_KNOWLEDGE_BASE', () => {
    it('should contain explainable contrastive questions with trade-offs and rationale', () => {
      expect(CONTRASTIVE_KNOWLEDGE_BASE.length).toBeGreaterThanOrEqual(4);
      CONTRASTIVE_KNOWLEDGE_BASE.forEach(qa => {
        expect(qa.question).toBeTruthy();
        expect(qa.tradeOffs.length).toBeGreaterThanOrEqual(2);
        expect(qa.primaryConflict).toBeTruthy();
        expect(qa.aiRationale).toBeTruthy();
      });
    });
  });

  describe('generateEllipsePolygon', () => {
    it('should generate an array of closed coordinate points', () => {
      const points = generateEllipsePolygon(34.05, -118.24, 5000, 2500, 320, 36);
      expect(points).toHaveLength(36);
      expect(points[0]).toHaveLength(2);
    });
  });

  describe('generateBayesianSearchModel', () => {
    it('should generate 3 concentric probability contours and a transversal sweep leg', () => {
      const center: Position = { lat: 34.05, lon: -118.24 };
      const model = generateBayesianSearchModel(center, 320, 32, 15);
      expect(model.contours).toHaveLength(3);
      expect(model.contours[0].level).toBe('OUTER');
      expect(model.contours[1].level).toBe('MID');
      expect(model.contours[2].level).toBe('CORE');
      expect(model.transversalSweepLeg.start).toBeDefined();
      expect(model.transversalSweepLeg.end).toBeDefined();
    });
  });

  describe('CLASSIFIED_TRACKS_DATABASE', () => {
    it('should contain tracks with classifications, SER, and POL compliance', () => {
      expect(CLASSIFIED_TRACKS_DATABASE.length).toBeGreaterThanOrEqual(3);
      const suspect = CLASSIFIED_TRACKS_DATABASE.find(t => t.classification.includes('SUSPECT'));
      expect(suspect).toBeDefined();
      expect(suspect?.confidenceScore).toBeGreaterThanOrEqual(4);
    });
  });
});
