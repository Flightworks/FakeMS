import { describe, expect, it } from 'vitest';
import type { ActiveSimulatedRoute } from '../../domain/routeSummary';
import {
  createMissionPlanState,
  missionPlanReducer,
  type MissionPlanAction,
} from '../../application/missionPlanReducer';

const activeRoute: ActiveSimulatedRoute = {
  id: 'active-route',
  label: 'ACTIVE SIM ROUTE',
  origin: { lat: 43, lon: 6 },
  waypoints: [
    { id: 'active-1', label: 'ACTIVE 1', position: { lat: 43.1, lon: 6.1 } },
  ],
  remainingWaypointCount: 1,
};

const reduce = (
  state: ReturnType<typeof createMissionPlanState>,
  action: MissionPlanAction,
) => missionPlanReducer(state, action);

const addLocalPoint = (
  state: ReturnType<typeof createMissionPlanState>,
  label: string,
  position: { lat: number; lon: number },
) => reduce(state, {
  type: 'ADD_WAYPOINT',
  label,
  position,
  source: 'LOCAL_USER',
});

describe('mission plan reducer', () => {
  it('adds stable local and radial waypoint ids without changing the active route', () => {
    const originalActiveRoute = JSON.parse(JSON.stringify(activeRoute)) as ActiveSimulatedRoute;
    const position = { lat: 43.2, lon: 6.2 };
    const first = addLocalPoint(createMissionPlanState(activeRoute), 'ALPHA', position);
    const second = reduce(first, {
      type: 'ADD_WAYPOINT',
      label: 'BRAVO',
      position: { lat: 43.3, lon: 6.3 },
      source: 'RADIAL',
    });

    expect(first.draft.waypoints[0]).toMatchObject({
      id: 'waypoint-1',
      label: 'ALPHA',
      source: 'LOCAL_USER',
      position,
    });
    expect(first.draft.waypoints[0].position).not.toBe(position);
    expect(second.draft.waypoints.map(point => point.id)).toEqual(['waypoint-1', 'waypoint-2']);
    expect(second.draft.waypoints[1].source).toBe('RADIAL');
    expect(second.activeRoute).toBe(activeRoute);
    expect(activeRoute).toEqual(originalActiveRoute);
  });

  it('renames, removes, and undoes the last removed route point immutably', () => {
    const initial = addLocalPoint(createMissionPlanState(activeRoute), 'ALPHA', { lat: 43.2, lon: 6.2 });
    const withSecond = reduce(initial, {
      type: 'ADD_ROUTE_POINT',
      label: 'BRAVO',
      position: { lat: 43.3, lon: 6.3 },
      source: 'RADIAL',
    });
    const renamed = reduce(withSecond, {
      type: 'RENAME_WAYPOINT',
      waypointId: 'waypoint-1',
      label: 'ALPHA RENAMED',
    });
    const removed = reduce(renamed, {
      type: 'REMOVE_ROUTE_POINT',
      waypointId: 'waypoint-2',
    });

    expect(renamed.draft.waypoints.map(point => point.label)).toEqual(['ALPHA RENAMED', 'BRAVO']);
    expect(withSecond.draft.waypoints.map(point => point.label)).toEqual(['ALPHA', 'BRAVO']);
    expect(removed.draft.waypoints.map(point => point.id)).toEqual(['waypoint-1']);

    const undone = reduce(removed, { type: 'UNDO_REMOVE_WAYPOINT' });
    expect(undone.draft.waypoints.map(point => point.id)).toEqual(['waypoint-1', 'waypoint-2']);
    expect(removed.draft.waypoints.map(point => point.id)).toEqual(['waypoint-1']);
    expect(undone.activeRoute).toBe(activeRoute);
  });

  it('adds, reorders, and removes route points while preserving order explicitly', () => {
    let state = createMissionPlanState();
    state = addLocalPoint(state, 'ALPHA', { lat: 43.1, lon: 6.1 });
    state = reduce(state, {
      type: 'ADD_ROUTE_POINT',
      id: 'radial-point',
      label: 'BRAVO',
      position: { lat: 43.2, lon: 6.2 },
      source: 'RADIAL',
    });
    state = reduce(state, {
      type: 'ADD_ROUTE_POINT',
      id: 'user-point',
      label: 'CHARLIE',
      position: { lat: 43.3, lon: 6.3 },
      source: 'LOCAL_USER',
    });

    const reordered = reduce(state, {
      type: 'REORDER_ROUTE_POINT',
      waypointId: 'user-point',
      toIndex: 0,
    });
    const removed = reduce(reordered, {
      type: 'REMOVE_WAYPOINT',
      waypointId: 'radial-point',
    });

    expect(state.draft.waypoints.map(point => point.id)).toEqual(['waypoint-1', 'radial-point', 'user-point']);
    expect(reordered.draft.waypoints.map(point => point.id)).toEqual(['user-point', 'waypoint-1', 'radial-point']);
    expect(removed.draft.waypoints.map(point => point.id)).toEqual(['user-point', 'waypoint-1']);
  });

  it('clears and cancels a draft without touching an active simulated route', () => {
    const populated = addLocalPoint(createMissionPlanState(activeRoute), 'ALPHA', { lat: 43.2, lon: 6.2 });
    const cleared = reduce(populated, { type: 'CLEAR_DRAFT' });
    const cancelled = reduce(populated, { type: 'CANCEL_DRAFT' });

    expect(cleared.draft.waypoints).toEqual([]);
    expect(cancelled.draft.waypoints).toEqual([]);
    expect(cleared.activationProposal).toBeNull();
    expect(cancelled.activationProposal).toBeNull();
    expect(cleared.activeRoute).toBe(activeRoute);
    expect(cancelled.activeRoute).toBe(activeRoute);
  });

  it('returns unavailable results for invalid coordinates, blank labels, and duplicate ids', () => {
    const initial = createMissionPlanState();
    const invalidCoordinates = reduce(initial, {
      type: 'ADD_WAYPOINT',
      id: 'invalid-coordinates',
      label: 'ALPHA',
      position: { lat: 90.1, lon: 6 },
      source: 'LOCAL_USER',
    });
    const blankLabel = reduce(initial, {
      type: 'ADD_WAYPOINT',
      id: 'blank-label',
      label: '   ',
      position: { lat: 43, lon: 6 },
      source: 'LOCAL_USER',
    });
    const populated = addLocalPoint(initial, 'ALPHA', { lat: 43, lon: 6 });
    const duplicateId = reduce(populated, {
      type: 'ADD_WAYPOINT',
      id: 'waypoint-1',
      label: 'BRAVO',
      position: { lat: 44, lon: 7 },
      source: 'RADIAL',
    });

    expect(invalidCoordinates.draft).toBe(initial.draft);
    expect(invalidCoordinates.lastResult).toMatchObject({ status: 'UNAVAILABLE', reason: 'INVALID_COORDINATES' });
    expect(blankLabel.draft).toBe(initial.draft);
    expect(blankLabel.lastResult).toMatchObject({ status: 'UNAVAILABLE', reason: 'BLANK_LABEL' });
    expect(duplicateId.draft).toBe(populated.draft);
    expect(duplicateId.lastResult).toMatchObject({ status: 'UNAVAILABLE', reason: 'DUPLICATE_ID' });
  });

  it('promotes a copied draft snapshot to an activation proposal without activating navigation', () => {
    const prepared = addLocalPoint(createMissionPlanState(activeRoute), 'ALPHA', { lat: 43.2, lon: 6.2 });
    const proposed = reduce(prepared, {
      type: 'PROPOSE_ACTIVATION',
      label: 'LOCAL PATROL',
    });

    expect(proposed.activationProposal).toMatchObject({
      id: 'mission-plan-proposal-1',
      label: 'LOCAL PATROL',
      status: 'PROPOSED',
    });
    expect(proposed.activationProposal?.waypoints).toEqual(prepared.draft.waypoints);
    expect(proposed.activationProposal?.waypoints).not.toBe(prepared.draft.waypoints);
    expect(proposed.activationProposal?.waypoints[0].position).not.toBe(prepared.draft.waypoints[0].position);
    expect(proposed.activeRoute).toBe(activeRoute);
    expect(proposed.lastResult).toMatchObject({ status: 'AVAILABLE', operation: 'PROPOSE_ACTIVATION' });
  });
});
