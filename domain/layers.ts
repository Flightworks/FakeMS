export type TacticalLayerId = 'TRACKS' | 'VECTORS' | 'ROUTE';

export interface TacticalLayer {
  id: TacticalLayerId;
  label: string;
  available: boolean;
  visible: boolean;
  source: string;
}

export type TacticalLayerState = Record<TacticalLayerId, TacticalLayer>;

export type LayerUpdateResult =
  | { status: 'AVAILABLE'; state: TacticalLayerState }
  | { status: 'UNAVAILABLE'; state: TacticalLayerState; reason: 'LAYER_UNKNOWN' | 'LAYER_UNAVAILABLE' };

export const createLayerState = (options: { routeAvailable?: boolean } = {}): TacticalLayerState => ({
  TRACKS: {
    id: 'TRACKS',
    label: 'TRACKS',
    available: true,
    visible: true,
    source: 'LOCAL SIMULATION ENTITIES',
  },
  VECTORS: {
    id: 'VECTORS',
    label: 'VECTORS',
    available: true,
    visible: true,
    source: 'LOCAL KINEMATICS',
  },
  ROUTE: {
    id: 'ROUTE',
    label: 'ROUTE',
    available: options.routeAvailable !== false,
    visible: true,
    source: 'LOCAL SIMULATED ROUTE',
  },
});

export const setLayerVisibility = (
  state: TacticalLayerState,
  layerId: TacticalLayerId,
  visible: boolean,
): LayerUpdateResult => {
  const layer = state[layerId];
  if (!layer) return { status: 'UNAVAILABLE', state, reason: 'LAYER_UNKNOWN' };
  if (!layer.available) return { status: 'UNAVAILABLE', state, reason: 'LAYER_UNAVAILABLE' };
  return {
    status: 'AVAILABLE',
    state: {
      ...state,
      [layerId]: { ...layer, visible },
    },
  };
};
