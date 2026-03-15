import { describe, it, expect } from 'vitest';
import {
  EARTH_RADIUS,
  latLonToMeters,
  metersToLatLon,
  projectPoint,
  getDestinationPoint,
  distanceBetween,
  bearingBetween
} from '../../utils/geo';

describe('geo utils', () => {

  describe('distanceBetween', () => {
    it('should calculate distance between two points accurately in meters', () => {
      // New York to London
      const ny = { lat: 40.7128, lon: -74.0060 };
      const london = { lat: 51.5074, lon: -0.1278 };

      const distance = distanceBetween(ny.lat, ny.lon, london.lat, london.lon);
      // Roughly 5570 km = 5570000 meters
      expect(distance).toBeGreaterThan(5500000);
      expect(distance).toBeLessThan(5600000);
    });

    it('should return 0 for identical points', () => {
      expect(distanceBetween(0, 0, 0, 0)).toBe(0);
    });
  });

  describe('bearingBetween', () => {
    it('should calculate bearing accurately', () => {
      const p1 = { lat: 0, lon: 0 };
      const pNorth = { lat: 10, lon: 0 };
      const pEast = { lat: 0, lon: 10 };
      const pSouth = { lat: -10, lon: 0 };
      const pWest = { lat: 0, lon: -10 };

      expect(bearingBetween(p1.lat, p1.lon, pNorth.lat, pNorth.lon)).toBeCloseTo(0);
      expect(bearingBetween(p1.lat, p1.lon, pEast.lat, pEast.lon)).toBeCloseTo(90);
      expect(bearingBetween(p1.lat, p1.lon, pSouth.lat, pSouth.lon)).toBeCloseTo(180);
      expect(bearingBetween(p1.lat, p1.lon, pWest.lat, pWest.lon)).toBeCloseTo(270);
    });
  });

  describe('getDestinationPoint', () => {
    it('should project a point accurately given bearing and distance', () => {
      // 1 degree latitude is approx 60 nm = ~111120 meters
      const bearing = 0; // North
      const distance = 111120; // meters

      const projected = getDestinationPoint(0, 0, distance, bearing);

      expect(projected.lat).toBeCloseTo(1, 1);
      expect(projected.lon).toBeCloseTo(0, 1);
    });
  });

  describe('latLonToMeters and metersToLatLon', () => {
    it('should be invertible operations', () => {
      const pt = { lat: 40, lon: -74 };
      const meters = latLonToMeters(pt.lat, pt.lon);
      const backToPt = metersToLatLon(meters.x, meters.y);

      expect(backToPt.lat).toBeCloseTo(pt.lat, 4);
      expect(backToPt.lon).toBeCloseTo(pt.lon, 4);
    });

    it('should convert the origin correctly', () => {
      const pt = { lat: 0, lon: 0 };
      const meters = latLonToMeters(pt.lat, pt.lon);

      expect(meters.x).toBeCloseTo(0, 4);
      expect(meters.y).toBeCloseTo(0, 4);
    });
  });

  describe('projectPoint', () => {
    it('should project point in cartesian coordinate space', () => {
      const start = { x: 0, y: 0 };
      const bearing = 90; // East
      const distance = 100;

      const result = projectPoint(start, bearing, distance);

      expect(result.x).toBeCloseTo(100);
      expect(result.y).toBeCloseTo(0);
    });
  });
});
