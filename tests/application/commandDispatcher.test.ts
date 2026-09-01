import { describe, expect, it } from 'vitest';
import { dispatchCommand, createCommandState } from '../../application/commandDispatcher';
import { Position } from '../../types';

const target: Position = { lat: 34.1, lon: -118.2 };

describe('command dispatcher', () => {
  it('focuses the map without creating a navigation order', () => {
    const state = dispatchCommand(createCommandState(), {
      type: 'CENTER_MAP',
      position: target,
      issuedAt: 100,
    });

    expect(state.mapFocus).toEqual(target);
    expect(state.directToProposal).toBeNull();
    expect(state.route).toBeNull();
    expect(state.events).toHaveLength(1);
  });

  it('creates a DCT proposal without changing the route', () => {
    const state = dispatchCommand(createCommandState(), {
      type: 'PROPOSE_DIRECT_TO',
      targetId: 'track-1',
      targetLabel: 'G01',
      position: target,
      issuedAt: 200,
    });

    expect(state.mapFocus).toBeNull();
    expect(state.directToProposal).toMatchObject({
      targetId: 'track-1',
      targetLabel: 'G01',
      position: target,
      status: 'PROPOSED',
    });
    expect(state.route).toBeNull();
  });

  it('changes the route only after accepting the matching proposal', () => {
    const proposed = dispatchCommand(createCommandState(), {
      type: 'PROPOSE_DIRECT_TO',
      targetId: 'track-1',
      targetLabel: 'G01',
      position: target,
      issuedAt: 200,
    });
    const accepted = dispatchCommand(proposed, {
      type: 'ACCEPT_ROUTE_PROPOSAL',
      proposalId: proposed.directToProposal!.id,
      authorizedAt: 300,
    });

    expect(accepted.route).toEqual({ targetId: 'track-1', position: target });
    expect(accepted.directToProposal?.status).toBe('ACCEPTED');
    expect(accepted.events.at(-1)).toMatchObject({ kind: 'ROUTE_ACCEPTED', simTimeMs: 300 });
  });

  it('rejects an unknown proposal without mutating the route', () => {
    const state = dispatchCommand(createCommandState(), {
      type: 'ACCEPT_ROUTE_PROPOSAL',
      proposalId: 'missing',
      authorizedAt: 300,
    });

    expect(state).toEqual(createCommandState());
  });
});
