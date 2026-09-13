import type { Position } from '../types';
import {
  qualifyGpsGroundSpeed,
  type QualifiedGroundSpeed,
} from './navigationInputs';

export type PositionSource = 'SIM' | 'GPS';

export type NavigationValidity =
  | 'SIMULATED'
  | 'ACQUIRING'
  | 'VALID'
  | 'STALE'
  | 'DENIED'
  | 'LOST';

export type NavigationPositionStatus = 'CURRENT' | 'RETAINED';
export type NavigationPositionQualification = 'SIMULATED' | 'MEASURED' | 'RETAINED';

export interface NavigationUpdateOptions {
  speedMetersPerSecond?: number | null;
  headingDegrees?: number | null;
}

export interface OwnshipNavigationState {
  /** Source selected or being acquired by the navigation mode. */
  source: PositionSource;
  validity: NavigationValidity;
  position: Position;
  /** Time of the last navigation state transition. */
  updatedAt: number;
  /** Source and qualification of the position currently held. */
  positionSource?: PositionSource;
  positionStatus?: NavigationPositionStatus;
  positionQualification?: NavigationPositionQualification;
  /** Time of the last accepted position, not the last error transition. */
  positionUpdatedAt?: number;
  accuracyMeters?: number;
  groundSpeed?: QualifiedGroundSpeed;
  headingDegrees?: number;
}

export const createNavigationState = (
  position: Position,
  updatedAt: number = Date.now(),
): OwnshipNavigationState => ({
  source: 'SIM',
  validity: 'SIMULATED',
  position,
  updatedAt,
  positionSource: 'SIM',
  positionStatus: 'CURRENT',
  positionQualification: 'SIMULATED',
  positionUpdatedAt: updatedAt,
});

export const markNavigationUpdate = (
  previous: OwnshipNavigationState,
  position: Position,
  updatedAt: number,
  accuracyMeters?: number,
  options?: NavigationUpdateOptions,
): OwnshipNavigationState => ({
  ...previous,
  source: 'GPS',
  validity: 'VALID',
  position,
  updatedAt,
  positionSource: 'GPS',
  positionStatus: 'CURRENT',
  positionQualification: 'MEASURED',
  positionUpdatedAt: updatedAt,
  accuracyMeters,
  groundSpeed: options ? qualifyGpsGroundSpeed(options.speedMetersPerSecond, updatedAt) : undefined,
  headingDegrees: options && typeof options.headingDegrees === 'number'
    && Number.isFinite(options.headingDegrees)
    ? options.headingDegrees
    : undefined,
});

export const markNavigationError = (
  previous: OwnshipNavigationState,
  validity: Extract<NavigationValidity, 'ACQUIRING' | 'DENIED' | 'LOST' | 'STALE'>,
  updatedAt: number,
): OwnshipNavigationState => {
  const positionSource = previous.positionSource ?? previous.source;
  return {
    ...previous,
    source: 'GPS',
    validity,
    updatedAt,
    positionStatus: positionSource === 'GPS' ? 'RETAINED' : previous.positionStatus,
    positionQualification: positionSource === 'GPS' ? 'RETAINED' : previous.positionQualification,
    groundSpeed: previous.groundSpeed?.source === 'GPS'
      && previous.groundSpeed.status === 'AVAILABLE'
      ? { ...previous.groundSpeed, status: 'STALE' }
      : previous.groundSpeed,
  };
};

export const markSimulationUpdate = (
  previous: OwnshipNavigationState,
  position: Position,
  updatedAt: number,
  speedKnots?: number | null,
  headingDegrees?: number | null,
): OwnshipNavigationState => ({
  ...previous,
  source: 'SIM',
  validity: 'SIMULATED',
  position,
  updatedAt,
  positionSource: 'SIM',
  positionStatus: 'CURRENT',
  positionQualification: 'SIMULATED',
  positionUpdatedAt: updatedAt,
  accuracyMeters: undefined,
  groundSpeed: undefined,
  headingDegrees: typeof headingDegrees === 'number' && Number.isFinite(headingDegrees)
    ? headingDegrees
    : undefined,
  ...(typeof speedKnots === 'number' && Number.isFinite(speedKnots)
    ? {
        groundSpeed: {
          speedKnots,
          source: 'SIMULATION' as const,
          qualification: 'SIMULATED' as const,
          status: speedKnots > 0 ? 'AVAILABLE' as const : 'ZERO' as const,
          updatedAt,
        },
      }
    : {}),
});

export const navigationStatusLabel = (state: OwnshipNavigationState): string => {
  const label = state.source === 'SIM'
    ? 'SIM'
    : state.validity === 'VALID'
      ? 'GPS OK'
      : `GPS ${state.validity}`;
  return state.positionStatus === 'RETAINED'
    ? `${label} · POSITION RETAINED`
    : label;
};

export const navigationPositionLabel = (state: OwnshipNavigationState): string => {
  const positionSource = state.positionSource ?? state.source;
  return positionSource === 'SIM'
    ? 'SIMULATION POSITION'
    : state.positionStatus === 'RETAINED'
      ? 'GPS POSITION RETAINED'
      : 'GPS POSITION';
};

export const navigationQualificationLabel = (state: OwnshipNavigationState): string => {
  const positionSource = state.positionSource ?? state.source;
  if (positionSource === 'SIM') return 'SIMULATED MOVEMENT';
  if (state.positionStatus === 'RETAINED') return 'RETAINED GPS POSITION';
  return 'MEASURED GPS POSITION';
};
