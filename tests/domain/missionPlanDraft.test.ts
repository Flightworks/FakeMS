import { describe, expect, it } from 'vitest';
import {
  addMissionPlanWaypoint,
  createMissionPlanDraft,
  removeMissionPlanWaypoint,
  renameMissionPlanWaypoint,
  reorderMissionPlanWaypoint,
} from '../../domain/missionPlanDraft';

describe('mission plan draft domain', () => {
  it('adds a local waypoint with an exact copied geographic position', () => {
    const position = { lat: 43.1183, lon: 5.9098 };
    const result = addMissionPlanWaypoint(createMissionPlanDraft(), {
      id: 'waypoint-1',
      label: 'ALPHA',
      position,
      source: 'LOCAL_USER',
    });

    expect(result.status).toBe('AVAILABLE');
    if (result.status !== 'AVAILABLE') throw new Error('expected an available result');
    expect(result.value.waypoints).toHaveLength(1);
    expect(result.value.waypoints[0]).toMatchObject({
      id: 'waypoint-1',
      label: 'ALPHA',
      source: 'LOCAL_USER',
      position,
    });
    expect(result.value.waypoints[0].position).not.toBe(position);
  });

  it('rejects invalid coordinates, blank labels, and duplicate waypoint ids', () => {
    const draft = createMissionPlanDraft();
    const first = addMissionPlanWaypoint(draft, {
      id: 'waypoint-1',
      label: 'ALPHA',
      position: { lat: 43, lon: 6 },
      source: 'LOCAL_USER',
    });

    expect(first.status).toBe('AVAILABLE');
    if (first.status !== 'AVAILABLE') throw new Error('expected an available result');

    expect(addMissionPlanWaypoint(first.value, {
      id: 'waypoint-2',
      label: 'BRAVO',
      position: { lat: 91, lon: 6 },
      source: 'LOCAL_USER',
    })).toEqual({ status: 'UNAVAILABLE', reason: 'INVALID_COORDINATES' });
    expect(addMissionPlanWaypoint(first.value, {
      id: 'waypoint-2',
      label: '   ',
      position: { lat: 43, lon: 6 },
      source: 'LOCAL_USER',
    })).toEqual({ status: 'UNAVAILABLE', reason: 'BLANK_LABEL' });
    expect(addMissionPlanWaypoint(first.value, {
      id: 'waypoint-1',
      label: 'CHARLIE',
      position: { lat: 43.1, lon: 6.1 },
      source: 'RADIAL',
    })).toEqual({ status: 'UNAVAILABLE', reason: 'DUPLICATE_ID' });
  });

  it('renames, reorders, and removes draft waypoints without changing the prior draft', () => {
    const first = addMissionPlanWaypoint(createMissionPlanDraft(), {
      id: 'waypoint-1',
      label: 'ALPHA',
      position: { lat: 43, lon: 6 },
      source: 'LOCAL_USER',
    });
    if (first.status !== 'AVAILABLE') throw new Error('expected an available result');
    const second = addMissionPlanWaypoint(first.value, {
      id: 'waypoint-2',
      label: 'BRAVO',
      position: { lat: 44, lon: 7 },
      source: 'RADIAL',
    });
    if (second.status !== 'AVAILABLE') throw new Error('expected an available result');

    const renamed = renameMissionPlanWaypoint(second.value, 'waypoint-1', 'ALPHA RENAMED');
    if (renamed.status !== 'AVAILABLE') throw new Error('expected an available result');
    expect(renamed.value.waypoints.map(point => point.label)).toEqual(['ALPHA RENAMED', 'BRAVO']);
    expect(second.value.waypoints.map(point => point.label)).toEqual(['ALPHA', 'BRAVO']);

    const reordered = reorderMissionPlanWaypoint(renamed.value, 'waypoint-1', 1);
    if (reordered.status !== 'AVAILABLE') throw new Error('expected an available result');
    expect(reordered.value.waypoints.map(point => point.id)).toEqual(['waypoint-2', 'waypoint-1']);

    const removed = removeMissionPlanWaypoint(reordered.value, 'waypoint-2');
    if (removed.status !== 'AVAILABLE') throw new Error('expected an available result');
    expect(removed.value.waypoints.map(point => point.id)).toEqual(['waypoint-1']);
    expect(reordered.value.waypoints.map(point => point.id)).toEqual(['waypoint-2', 'waypoint-1']);
  });
});
