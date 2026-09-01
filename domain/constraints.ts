import type { Position } from '../types';

export type ReturnPolicy = 'NONE' | 'PREFERRED' | 'REQUIRED';

export interface GeographicBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface RouteConstraints {
  fuelAvailableUnits: number;
  fuelReserveUnits: number;
  fuelBurnUnitsPerNm: number;
  returnPolicy: ReturnPolicy;
  returnTo?: Position;
  allowedArea?: GeographicBounds;
  minAltitudeFt?: number;
  maxAltitudeFt?: number;
  minSpeedKnots?: number;
  maxSpeedKnots?: number;
}
