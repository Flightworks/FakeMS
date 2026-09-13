import { describe, expect, it, vi } from 'vitest';
import { CONTEXT_ACTION_IDS } from '../../domain/contextActions';
import {
  dispatchContextAction,
  type ContextActionRequest,
} from '../../application/buildCommandContext';
import { createCommandState, dispatchCommand } from '../../application/commandDispatcher';
import { EntityType, MapMode, StabMode } from '../../types';
import { createLayerState, setLayerVisibility } from '../../domain/layers';
import { createGridState, setGridEnabled } from '../../domain/grid';

describe('context action execution bridge', () => {
  it('dispatches a captured map action with its stable id and copied position', () => {
    const focusMapAt = vi.fn();
    const position = { lat: 43.12345, lon: 5.98765 };
    const request: ContextActionRequest = {
      actionId: CONTEXT_ACTION_IDS.MAP.CENTER_HERE,
      context: 'MAP',
      position,
    };

    const result = dispatchContextAction(request, { focusMapAt });

    expect(result).toEqual({
      status: 'HANDLED',
      actionId: CONTEXT_ACTION_IDS.MAP.CENTER_HERE,
    });
    expect(focusMapAt).toHaveBeenCalledWith(position);
    expect(focusMapAt.mock.calls[0]?.[0]).not.toBe(position);
  });

  it('routes map display actions to real layer and grid callbacks', () => {
    const toggleVectors = vi.fn();
    const toggleGrid = vi.fn();
    const toggleDeclutter = vi.fn();
    const focusMapAt = vi.fn();
    const onResetStab = vi.fn();
    const setMapMode = vi.fn();
    let layers = createLayerState();
    let grid = createGridState();
    const request = (actionId: string): ContextActionRequest => ({
      actionId,
      context: 'MAP',
      position: { lat: 43, lon: 6 },
    });

    expect(dispatchContextAction(request(CONTEXT_ACTION_IDS.MAP.VECTORS), {
      toggleVectors: () => {
        toggleVectors();
        const update = setLayerVisibility(layers, 'VECTORS', !layers.VECTORS.visible);
        if (update.status === 'AVAILABLE') layers = update.state;
      },
    })).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction(request(CONTEXT_ACTION_IDS.MAP.GRID), {
      toggleGrid: () => {
        toggleGrid();
        grid = setGridEnabled(grid, !grid.enabled);
      },
    })).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction(request(CONTEXT_ACTION_IDS.MAP.DECLUTTER), { toggleDeclutter })).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction(request(CONTEXT_ACTION_IDS.MAP.CENTER_HERE), { focusMapAt })).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction(request(CONTEXT_ACTION_IDS.MAP.RECENTER_OWNSHIP), { onResetStab })).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction(request(CONTEXT_ACTION_IDS.MAP.NORTH_UP), { setMapMode })).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction(request(CONTEXT_ACTION_IDS.MAP.HEADING_UP), { setMapMode })).toMatchObject({ status: 'HANDLED' });
    expect(toggleVectors).toHaveBeenCalledOnce();
    expect(toggleGrid).toHaveBeenCalledOnce();
    expect(toggleDeclutter).toHaveBeenCalledOnce();
    expect(focusMapAt).toHaveBeenCalledWith({ lat: 43, lon: 6 });
    expect(onResetStab).toHaveBeenCalledOnce();
    expect(setMapMode).toHaveBeenNthCalledWith(1, MapMode.NORTH_UP);
    expect(setMapMode).toHaveBeenNthCalledWith(2, MapMode.HEADING_UP);
    expect(layers.VECTORS.visible).toBe(false);
    expect(grid.enabled).toBe(true);
  });

  it('routes ownship stabilization, trail, future, and data actions', () => {
    const onResetStab = vi.fn();
    const setStabMode = vi.fn();
    const toggleTrailVisibility = vi.fn();
    const requestClearTrail = vi.fn();
    const previewFuturePosition = vi.fn();
    const selectEntity = vi.fn();
    const base: ContextActionRequest = {
      context: 'OWNSHIP',
      targetId: 'ownship',
      targetLabel: 'VIPER 1-1',
      targetType: EntityType.OWNSHIP,
      position: { lat: 43, lon: 6 },
      actionId: CONTEXT_ACTION_IDS.OWNSHIP.FOLLOW,
    };
    const handlers = {
      onResetStab,
      setStabMode,
      toggleTrailVisibility,
      requestClearTrail,
      previewFuturePosition,
      selectEntity,
    };

    expect(dispatchContextAction(base, handlers)).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction({ ...base, actionId: CONTEXT_ACTION_IDS.OWNSHIP.GROUND_ANCHOR }, handlers)).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction({ ...base, actionId: CONTEXT_ACTION_IDS.OWNSHIP.TRAIL_VISIBILITY }, handlers)).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction({ ...base, actionId: CONTEXT_ACTION_IDS.OWNSHIP.CLEAR_TRAIL }, handlers)).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction({ ...base, actionId: CONTEXT_ACTION_IDS.OWNSHIP.FUTURE_POSITION }, handlers)).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction({ ...base, actionId: CONTEXT_ACTION_IDS.OWNSHIP.DATA }, handlers)).toMatchObject({ status: 'HANDLED' });
    expect(onResetStab).toHaveBeenCalledOnce();
    expect(setStabMode).toHaveBeenCalledWith(StabMode.GND);
    expect(toggleTrailVisibility).toHaveBeenCalledWith('ownship', 'VIPER 1-1');
    expect(requestClearTrail).toHaveBeenCalledWith('ownship', 'VIPER 1-1');
    expect(previewFuturePosition).toHaveBeenCalledWith(expect.objectContaining({
      position: { lat: 43, lon: 6 },
    }));
    expect(selectEntity).toHaveBeenCalledWith('ownship');
  });

  it('routes waypoint, track, and base actions using the captured target', () => {
    const focusMapAt = vi.fn();
    const consult = vi.fn();
    const proposeDirectTo = vi.fn();
    const selectEntity = vi.fn();
    const toggleTrailVisibility = vi.fn();
    const proposeSetBullseye = vi.fn();
    const target = {
      targetId: 'wp-1',
      targetLabel: 'BRAVO',
      targetType: EntityType.WAYPOINT,
      position: { lat: 43.2, lon: 5.9 },
    };
    const waypoint = (actionId: string): ContextActionRequest => ({ context: 'WAYPOINT', actionId, ...target });
    const track = (actionId: string): ContextActionRequest => ({ context: 'TRACK', actionId, ...target, targetType: EntityType.ENEMY });
    const base = (actionId: string): ContextActionRequest => ({
      context: 'BASE',
      actionId,
      targetId: 'apt-base',
      targetLabel: 'BASE',
      targetType: EntityType.AIRPORT,
      position: { lat: 43, lon: 5.9 },
    });
    const handlers = { focusMapAt, consult, proposeDirectTo, selectEntity, toggleTrailVisibility, proposeSetBullseye };

    expect(dispatchContextAction(waypoint(CONTEXT_ACTION_IDS.WAYPOINT.DIRECT_SIM), handlers)).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction(waypoint(CONTEXT_ACTION_IDS.WAYPOINT.CENTER), handlers)).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction(waypoint(CONTEXT_ACTION_IDS.WAYPOINT.BRG_RNG), handlers)).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction(track(CONTEXT_ACTION_IDS.TRACK.INFO), handlers)).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction(track(CONTEXT_ACTION_IDS.TRACK.CENTER), handlers)).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction(track(CONTEXT_ACTION_IDS.TRACK.TRAIL), handlers)).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction(track(CONTEXT_ACTION_IDS.TRACK.BULLSEYE), handlers)).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction(base(CONTEXT_ACTION_IDS.BASE.DIRECT_SIM), handlers)).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction(base(CONTEXT_ACTION_IDS.BASE.IDENTITY_COORDINATES), handlers)).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction(base(CONTEXT_ACTION_IDS.BASE.CENTER), handlers)).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction(base(CONTEXT_ACTION_IDS.BASE.BULLSEYE), handlers)).toMatchObject({ status: 'HANDLED' });

    expect(proposeDirectTo).toHaveBeenCalledWith(expect.objectContaining({ id: 'wp-1', label: 'BRAVO', position: target.position }));
    expect(selectEntity).toHaveBeenCalledWith('wp-1');
    expect(consult).toHaveBeenCalledOnce();
    expect(toggleTrailVisibility).toHaveBeenCalledWith('wp-1', 'BRAVO');
    expect(proposeSetBullseye).toHaveBeenCalledWith(expect.objectContaining({ id: 'apt-base', label: 'BASE' }));
    expect(focusMapAt).toHaveBeenCalledTimes(3);
  });

  it('keeps DCT as a proposal that changes route state only after confirmation', () => {
    let commandState = createCommandState();
    const proposeDirectTo = vi.fn((target: { id: string; label: string; position: { lat: number; lon: number } }) => {
      commandState = dispatchCommand(commandState, {
        type: 'PROPOSE_DIRECT_TO',
        targetId: target.id,
        targetLabel: target.label,
        position: { ...target.position },
        issuedAt: 100,
      });
    });
    const request: ContextActionRequest = {
      actionId: CONTEXT_ACTION_IDS.WAYPOINT.DIRECT_SIM,
      context: 'WAYPOINT',
      targetId: 'wp-1',
      targetLabel: 'BRAVO',
      targetType: EntityType.WAYPOINT,
      position: { lat: 43.2, lon: 5.9 },
    };

    dispatchContextAction(request, { proposeDirectTo });
    expect(commandState.directToProposal?.status).toBe('PROPOSED');
    expect(commandState.route).toBeNull();
    commandState = dispatchCommand(commandState, {
      type: 'ACCEPT_ROUTE_PROPOSAL',
      proposalId: commandState.directToProposal?.id ?? '',
      authorizedAt: 200,
    });
    expect(commandState.directToProposal?.status).toBe('ACCEPTED');
    expect(commandState.route).toEqual({ targetId: 'wp-1', position: { lat: 43.2, lon: 5.9 } });
  });

  it('returns unavailable rather than silently executing an unsupported leaf', () => {
    const result = dispatchContextAction({
      actionId: CONTEXT_ACTION_IDS.TRACK.CPA,
      context: 'TRACK',
      targetId: 'track-1',
      targetLabel: 'TRACK 1',
      targetType: EntityType.ENEMY,
      position: { lat: 43, lon: 6 },
    }, {});

    expect(result).toEqual({
      status: 'UNAVAILABLE',
      actionId: CONTEXT_ACTION_IDS.TRACK.CPA,
      reason: 'UNSUPPORTED_ACTION',
    });
  });

  it('routes waypoint and base future-position leaves to the typed preview callback', () => {
    const previewFuturePosition = vi.fn();
    const request = (context: 'WAYPOINT' | 'BASE', actionId: string): ContextActionRequest => ({
      actionId,
      context,
      targetId: context === 'WAYPOINT' ? 'wp-1' : 'apt-base',
      targetLabel: context === 'WAYPOINT' ? 'BRAVO' : 'BASE',
      targetType: context === 'WAYPOINT' ? EntityType.WAYPOINT : EntityType.AIRPORT,
      position: { lat: 43.2, lon: 5.9 },
    });

    expect(dispatchContextAction(request('WAYPOINT', CONTEXT_ACTION_IDS.WAYPOINT.PROJECTION), { previewFuturePosition })).toMatchObject({ status: 'HANDLED' });
    expect(dispatchContextAction(request('BASE', CONTEXT_ACTION_IDS.BASE.PROJECTION), { previewFuturePosition })).toMatchObject({ status: 'HANDLED' });
    expect(previewFuturePosition).toHaveBeenCalledTimes(2);
  });
});
