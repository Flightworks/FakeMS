import { Position } from '../types';

export type PositionSource = 'SIM' | 'GPS';

export type NavigationValidity =
  | 'SIMULATED'
  | 'ACQUIRING'
  | 'VALID'
  | 'STALE'
  | 'DENIED'
  | 'LOST';

export interface OwnshipNavigationState {
  source: PositionSource;
  validity: NavigationValidity;
  position: Position;
  updatedAt: number;
  accuracyMeters?: number;
}

export const createNavigationState = (
  position: Position,
  updatedAt: number = Date.now(),
): OwnshipNavigationState => ({
  source: 'SIM',
  validity: 'SIMULATED',
  position,
  updatedAt,
});

export const markNavigationUpdate = (
  previous: OwnshipNavigationState,
  position: Position,
  updatedAt: number,
  accuracyMeters?: number,
): OwnshipNavigationState => ({
  ...previous,
  source: 'GPS',
  validity: 'VALID',
  position,
  updatedAt,
  accuracyMeters,
});

export const markNavigationError = (
  previous: OwnshipNavigationState,
  validity: Extract<NavigationValidity, 'ACQUIRING' | 'DENIED' | 'LOST' | 'STALE'>,
  updatedAt: number,
): OwnshipNavigationState => ({
  ...previous,
  source: 'GPS',
  validity,
  updatedAt,
});

export const navigationStatusLabel = (state: OwnshipNavigationState): string => {
  if (state.source === 'SIM') return 'SIM';
  if (state.validity === 'VALID') return 'GPS OK';
  return `GPS ${state.validity}`;
};
