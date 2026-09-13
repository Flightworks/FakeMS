import type { GroundSpeedInput } from './etaEte';

export type NavigationGroundSpeedSource = 'GPS' | 'SIMULATION';
export type NavigationGroundSpeedQualification = 'MEASURED' | 'SIMULATED' | 'UNAVAILABLE';
export type NavigationGroundSpeedStatus =
  | 'AVAILABLE'
  | 'ABSENT'
  | 'NULL'
  | 'ZERO'
  | 'NEGATIVE'
  | 'NON_FINITE'
  | 'STALE';

export type NavigationGroundSpeedReason =
  | 'SPEED_ABSENT'
  | 'SPEED_NULL'
  | 'SPEED_ZERO'
  | 'SPEED_NEGATIVE'
  | 'SPEED_NON_FINITE';

export interface QualifiedGroundSpeed {
  speedKnots: number | null;
  source: NavigationGroundSpeedSource;
  qualification: NavigationGroundSpeedQualification;
  status: NavigationGroundSpeedStatus;
  reason?: NavigationGroundSpeedReason;
  updatedAt?: number;
}

export const KNOTS_PER_METRE_PER_SECOND = 3600 / 1852;

export const metersPerSecondToKnots = (speedMetersPerSecond: number): number => (
  speedMetersPerSecond * KNOTS_PER_METRE_PER_SECOND
);

export const qualifyGpsGroundSpeed = (
  speedMetersPerSecond: number | null | undefined,
  updatedAt?: number,
): QualifiedGroundSpeed => {
  if (speedMetersPerSecond === null) {
    return {
      speedKnots: null,
      source: 'GPS',
      qualification: 'UNAVAILABLE',
      status: 'NULL',
      reason: 'SPEED_NULL',
      updatedAt,
    };
  }

  if (speedMetersPerSecond === 0) {
    return {
      speedKnots: 0,
      source: 'GPS',
      qualification: 'MEASURED',
      status: 'ZERO',
      reason: 'SPEED_ZERO',
      updatedAt,
    };
  }

  if (typeof speedMetersPerSecond === 'number'
    && Number.isFinite(speedMetersPerSecond)
    && speedMetersPerSecond < 0) {
    return {
      speedKnots: null,
      source: 'GPS',
      qualification: 'UNAVAILABLE',
      status: 'NEGATIVE',
      reason: 'SPEED_NEGATIVE',
      updatedAt,
    };
  }

  if (typeof speedMetersPerSecond === 'number'
    && !Number.isFinite(speedMetersPerSecond)) {
    return {
      speedKnots: null,
      source: 'GPS',
      qualification: 'UNAVAILABLE',
      status: 'NON_FINITE',
      reason: 'SPEED_NON_FINITE',
      updatedAt,
    };
  }

  if (typeof speedMetersPerSecond === 'number'
    && Number.isFinite(speedMetersPerSecond)
    && speedMetersPerSecond > 0) {
    return {
      speedKnots: metersPerSecondToKnots(speedMetersPerSecond),
      source: 'GPS',
      qualification: 'MEASURED',
      status: 'AVAILABLE',
      updatedAt,
    };
  }

  return {
    speedKnots: null,
    source: 'GPS',
    qualification: 'UNAVAILABLE',
    status: 'ABSENT',
    reason: 'SPEED_ABSENT',
    updatedAt,
  };
};

export const qualifySimulationGroundSpeed = (
  speedKnots: number | null | undefined,
  updatedAt?: number,
): QualifiedGroundSpeed => {
  if (typeof speedKnots === 'number' && Number.isFinite(speedKnots) && speedKnots > 0) {
    return {
      speedKnots,
      source: 'SIMULATION',
      qualification: 'SIMULATED',
      status: 'AVAILABLE',
      updatedAt,
    };
  }

  return {
    speedKnots: null,
    source: 'SIMULATION',
    qualification: 'UNAVAILABLE',
    status: 'ABSENT',
    reason: 'SPEED_ABSENT',
    updatedAt,
  };
};

export const toGroundSpeedInput = (
  qualified: QualifiedGroundSpeed,
): GroundSpeedInput | undefined => {
  if (qualified.status !== 'AVAILABLE' || qualified.speedKnots === null) return undefined;

  const input: GroundSpeedInput = {
    speedKnots: qualified.speedKnots,
    source: qualified.source,
    qualification: qualified.source === 'GPS' ? 'MEASURED' : 'SIMULATED',
  };
  if (qualified.updatedAt !== undefined) input.updatedAt = qualified.updatedAt;
  return input;
};

export const selectGroundSpeedInput = (
  source: 'GPS' | 'SIM',
  simulationSpeedKnots: number | null | undefined,
  gpsGroundSpeed?: QualifiedGroundSpeed,
): GroundSpeedInput | undefined => source === 'SIM'
  ? toGroundSpeedInput(qualifySimulationGroundSpeed(simulationSpeedKnots))
  : gpsGroundSpeed
    ? toGroundSpeedInput(gpsGroundSpeed)
    : undefined;
