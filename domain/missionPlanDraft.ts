import type { Position } from '../types';

export type MissionPlanWaypointSource = 'LOCAL_USER' | 'RADIAL';

export interface MissionPlanWaypoint {
  id: string;
  label: string;
  position: Position;
  source: MissionPlanWaypointSource;
  createdAt?: number;
  updatedAt?: number;
}

export interface MissionPlanDraft {
  waypoints: readonly MissionPlanWaypoint[];
}

export interface MissionPlanWaypointInput {
  id: string;
  label: string;
  position: Position;
  source: MissionPlanWaypointSource;
  createdAt?: number;
  updatedAt?: number;
}

export interface MissionPlanActivationProposal {
  type: 'MISSION_PLAN_ACTIVATION_PROPOSAL';
  id: string;
  label: string;
  status: 'PROPOSED';
  waypoints: readonly MissionPlanWaypoint[];
}

export type MissionPlanRejectionReason =
  | 'INVALID_COORDINATES'
  | 'BLANK_LABEL'
  | 'DUPLICATE_ID'
  | 'INVALID_ID'
  | 'INVALID_SOURCE'
  | 'WAYPOINT_NOT_FOUND'
  | 'INVALID_ORDER'
  | 'EMPTY_DRAFT'
  | 'BLANK_PLAN_LABEL'
  | 'ACTIVATION_PROPOSAL_EXISTS'
  | 'PROPOSAL_NOT_FOUND'
  | 'NO_REMOVAL_TO_UNDO';

export type MissionPlanResult<T> =
  | { status: 'AVAILABLE'; value: T }
  | { status: 'UNAVAILABLE'; reason: MissionPlanRejectionReason };

export const isMissionPlanWaypointSource = (
  value: unknown,
): value is MissionPlanWaypointSource => value === 'LOCAL_USER' || value === 'RADIAL';

export const isValidMissionPlanPosition = (value: unknown): value is Position => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { lat?: unknown; lon?: unknown };
  return typeof candidate.lat === 'number'
    && Number.isFinite(candidate.lat)
    && candidate.lat >= -90
    && candidate.lat <= 90
    && typeof candidate.lon === 'number'
    && Number.isFinite(candidate.lon)
    && candidate.lon >= -180
    && candidate.lon <= 180;
};

export const copyMissionPlanPosition = (position: Position): Position => ({
  lat: position.lat,
  lon: position.lon,
});

export const copyMissionPlanWaypoint = (waypoint: MissionPlanWaypoint): MissionPlanWaypoint => ({
  ...waypoint,
  position: copyMissionPlanPosition(waypoint.position),
});

export const createMissionPlanDraft = (): MissionPlanDraft => ({
  waypoints: [],
});

export const copyMissionPlanDraft = (draft: MissionPlanDraft): MissionPlanDraft => ({
  waypoints: draft.waypoints.map(copyMissionPlanWaypoint),
});

const unavailable = <T>(reason: MissionPlanRejectionReason): MissionPlanResult<T> => ({
  status: 'UNAVAILABLE',
  reason,
});

const available = <T>(value: T): MissionPlanResult<T> => ({
  status: 'AVAILABLE',
  value,
});

const validateWaypoint = (waypoint: MissionPlanWaypointInput): MissionPlanRejectionReason | null => {
  if (typeof waypoint.id !== 'string' || waypoint.id.trim().length === 0) return 'INVALID_ID';
  if (typeof waypoint.label !== 'string' || waypoint.label.trim().length === 0) return 'BLANK_LABEL';
  if (!isValidMissionPlanPosition(waypoint.position)) return 'INVALID_COORDINATES';
  if (!isMissionPlanWaypointSource(waypoint.source)) return 'INVALID_SOURCE';
  return null;
};

export const addMissionPlanWaypoint = (
  draft: MissionPlanDraft,
  waypoint: MissionPlanWaypointInput,
): MissionPlanResult<MissionPlanDraft> => {
  const invalidReason = validateWaypoint(waypoint);
  if (invalidReason) return unavailable(invalidReason);
  if (draft.waypoints.some(candidate => candidate.id === waypoint.id)) return unavailable('DUPLICATE_ID');

  return available({
    waypoints: [
      ...draft.waypoints.map(copyMissionPlanWaypoint),
      {
        ...waypoint,
        position: copyMissionPlanPosition(waypoint.position),
      },
    ],
  });
};

export const renameMissionPlanWaypoint = (
  draft: MissionPlanDraft,
  waypointId: string,
  label: string,
  updatedAt?: number,
): MissionPlanResult<MissionPlanDraft> => {
  if (typeof waypointId !== 'string' || waypointId.trim().length === 0) return unavailable('INVALID_ID');
  if (typeof label !== 'string' || label.trim().length === 0) return unavailable('BLANK_LABEL');
  if (!draft.waypoints.some(waypoint => waypoint.id === waypointId)) return unavailable('WAYPOINT_NOT_FOUND');

  return available({
    waypoints: draft.waypoints.map(waypoint => waypoint.id === waypointId
      ? {
          ...copyMissionPlanWaypoint(waypoint),
          label,
          ...(typeof updatedAt === 'number' ? { updatedAt } : {}),
        }
      : copyMissionPlanWaypoint(waypoint)),
  });
};

export const removeMissionPlanWaypoint = (
  draft: MissionPlanDraft,
  waypointId: string,
): MissionPlanResult<MissionPlanDraft> => {
  if (typeof waypointId !== 'string' || waypointId.trim().length === 0) return unavailable('INVALID_ID');
  if (!draft.waypoints.some(waypoint => waypoint.id === waypointId)) return unavailable('WAYPOINT_NOT_FOUND');

  return available({
    waypoints: draft.waypoints
      .filter(waypoint => waypoint.id !== waypointId)
      .map(copyMissionPlanWaypoint),
  });
};

export const reorderMissionPlanWaypoint = (
  draft: MissionPlanDraft,
  waypointId: string,
  toIndex: number,
): MissionPlanResult<MissionPlanDraft> => {
  if (typeof waypointId !== 'string' || waypointId.trim().length === 0) return unavailable('INVALID_ID');
  if (!draft.waypoints.some(waypoint => waypoint.id === waypointId)) return unavailable('WAYPOINT_NOT_FOUND');
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= draft.waypoints.length) {
    return unavailable('INVALID_ORDER');
  }

  const waypoints = draft.waypoints.map(copyMissionPlanWaypoint);
  const [moved] = waypoints.splice(waypoints.findIndex(waypoint => waypoint.id === waypointId), 1);
  waypoints.splice(toIndex, 0, moved);
  return available({ waypoints });
};

export const clearMissionPlanDraft = (_draft?: MissionPlanDraft): MissionPlanDraft => createMissionPlanDraft();

export const createMissionPlanActivationProposal = (
  id: string,
  label: string,
  draft: MissionPlanDraft,
): MissionPlanActivationProposal => ({
  type: 'MISSION_PLAN_ACTIVATION_PROPOSAL',
  id,
  label,
  status: 'PROPOSED',
  waypoints: copyMissionPlanDraft(draft).waypoints,
});

export const addRoutePoint = addMissionPlanWaypoint;
export const renameRoutePoint = renameMissionPlanWaypoint;
export const removeRoutePoint = removeMissionPlanWaypoint;
export const reorderRoutePoint = reorderMissionPlanWaypoint;
