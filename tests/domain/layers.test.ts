import { describe, expect, it } from 'vitest';
import {
  createLayerState,
  setLayerVisibility,
} from '../../domain/layers';

describe('local tactical layers', () => {
  it('creates one deterministic registry for rendered local layers', () => {
    const state = createLayerState();
    expect(state).toEqual({
      TRACKS: { id: 'TRACKS', label: 'TRACKS', available: true, visible: true, source: 'LOCAL SIMULATION ENTITIES' },
      VECTORS: { id: 'VECTORS', label: 'VECTORS', available: true, visible: true, source: 'LOCAL KINEMATICS' },
      ROUTE: { id: 'ROUTE', label: 'ROUTE', available: true, visible: true, source: 'LOCAL SIMULATED ROUTE' },
    });
  });

  it('changes visibility without changing availability or scenario entities', () => {
    const state = createLayerState();
    const hidden = setLayerVisibility(state, 'TRACKS', false);
    expect(hidden.status).toBe('AVAILABLE');
    if (hidden.status === 'AVAILABLE') {
      expect(hidden.state.TRACKS.visible).toBe(false);
      expect(hidden.state.VECTORS).toEqual(state.VECTORS);
    }
  });

  it('reports unknown or unavailable layers without creating phantom state', () => {
    const state = createLayerState({ routeAvailable: false });
    const unavailable = setLayerVisibility(state, 'ROUTE', true);
    expect(unavailable).toMatchObject({ status: 'UNAVAILABLE', reason: 'LAYER_UNAVAILABLE' });
    const unknown = setLayerVisibility(state, 'GRID' as never, true);
    expect(unknown).toMatchObject({ status: 'UNAVAILABLE', reason: 'LAYER_UNKNOWN' });
  });
});
