import type { Position } from '../types';
import type { ActiveSimulatedRoute } from '../domain/routeSummary';
import {
  addMissionPlanWaypoint,
  copyMissionPlanDraft,
  copyMissionPlanWaypoint,
  createMissionPlanActivationProposal,
  createMissionPlanDraft,
  isMissionPlanWaypointSource,
  removeMissionPlanWaypoint,
  renameMissionPlanWaypoint,
  reorderMissionPlanWaypoint,
  type MissionPlanActivationProposal,
  type MissionPlanDraft,
  type MissionPlanRejectionReason,
  type MissionPlanWaypoint,
  type MissionPlanWaypointSource,
} from '../domain/missionPlanDraft';

export interface MissionPlanStateOptions {
  activeRoute?: ActiveSimulatedRoute | null;
  draft?: MissionPlanDraft;
}

export interface RemovedMissionPlanWaypoint {
  waypoint: MissionPlanWaypoint;
  index: number;
}

export type MissionPlanOperation =
  | 'ADD_WAYPOINT'
  | 'ADD_ROUTE_POINT'
  | 'RENAME_WAYPOINT'
  | 'RENAME_ROUTE_POINT'
  | 'REMOVE_WAYPOINT'
  | 'REMOVE_ROUTE_POINT'
  | 'UNDO_REMOVE_WAYPOINT'
  | 'UNDO_LAST_REMOVE'
  | 'REORDER_WAYPOINT'
  | 'REORDER_ROUTE_POINT'
  | 'CLEAR_DRAFT'
  | 'CANCEL_DRAFT'
  | 'PROPOSE_ACTIVATION'
  | 'PROPOSE_ROUTE_ACTIVATION'
  | 'CANCEL_ACTIVATION_PROPOSAL';

export type MissionPlanReducerResult =
  | {
      status: 'AVAILABLE';
      operation: MissionPlanOperation;
      waypointId?: string;
      proposalId?: string;
    }
  | {
      status: 'UNAVAILABLE';
      operation: MissionPlanOperation;
      reason: MissionPlanRejectionReason;
    };

export interface MissionPlanState {
  draft: MissionPlanDraft;
  /** The simulated route is owned elsewhere and is never changed by this reducer. */
  activeRoute: ActiveSimulatedRoute | null;
  activationProposal: MissionPlanActivationProposal | null;
  lastRemovedWaypoint: RemovedMissionPlanWaypoint | null;
  lastResult: MissionPlanReducerResult | null;
  nextWaypointSequence: number;
  nextProposalSequence: number;
}

export type MissionPlanReducerState = MissionPlanState;

export type MissionPlanAction =
  | {
      type: 'ADD_WAYPOINT' | 'ADD_ROUTE_POINT';
      id?: string;
      waypointId?: string;
      label: string;
      position: Position;
      source?: MissionPlanWaypointSource;
      provenance?: MissionPlanWaypointSource;
      createdAt?: number;
      updatedAt?: number;
    }
  | {
      type: 'RENAME_WAYPOINT' | 'RENAME_ROUTE_POINT';
      waypointId?: string;
      id?: string;
      label: string;
      updatedAt?: number;
    }
  | {
      type: 'REMOVE_WAYPOINT' | 'REMOVE_ROUTE_POINT';
      waypointId?: string;
      id?: string;
    }
  | {
      type: 'UNDO_REMOVE_WAYPOINT' | 'UNDO_LAST_REMOVE';
    }
  | {
      type: 'REORDER_WAYPOINT' | 'REORDER_ROUTE_POINT';
      waypointId?: string;
      id?: string;
      toIndex: number;
    }
  | { type: 'CLEAR_DRAFT' }
  | { type: 'CANCEL_DRAFT' }
  | {
      type: 'PROPOSE_ACTIVATION' | 'PROPOSE_ROUTE_ACTIVATION';
      label?: string;
      proposalId?: string;
    }
  | {
      type: 'CANCEL_ACTIVATION_PROPOSAL';
      proposalId?: string;
    };

const generatedWaypointId = (sequence: number): string => `waypoint-${sequence}`;
const generatedProposalId = (sequence: number): string => `mission-plan-proposal-${sequence}`;

const isNonEmptyId = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const availableResult = (
  operation: MissionPlanOperation,
  details: Pick<MissionPlanReducerResult & { status: 'AVAILABLE' }, 'waypointId' | 'proposalId'> = {},
): MissionPlanReducerResult => ({
  status: 'AVAILABLE',
  operation,
  ...details,
});

const unavailableResult = (
  operation: MissionPlanOperation,
  reason: MissionPlanRejectionReason,
): MissionPlanReducerResult => ({
  status: 'UNAVAILABLE',
  operation,
  reason,
});

const withResult = (
  state: MissionPlanState,
  lastResult: MissionPlanReducerResult,
  changes: Partial<MissionPlanState> = {},
): MissionPlanState => ({
  ...state,
  ...changes,
  lastResult,
});

const resolveSeed = (
  activeRouteOrOptions: ActiveSimulatedRoute | MissionPlanStateOptions | null,
  initialDraft: MissionPlanDraft | undefined,
): { activeRoute: ActiveSimulatedRoute | null; draft: MissionPlanDraft } => {
  if (
    activeRouteOrOptions
    && typeof activeRouteOrOptions === 'object'
    && ('activeRoute' in activeRouteOrOptions || 'draft' in activeRouteOrOptions)
  ) {
    return {
      activeRoute: activeRouteOrOptions.activeRoute ?? null,
      draft: copyMissionPlanDraft(activeRouteOrOptions.draft ?? createMissionPlanDraft()),
    };
  }

  return {
    activeRoute: activeRouteOrOptions as ActiveSimulatedRoute | null,
    draft: copyMissionPlanDraft(initialDraft ?? createMissionPlanDraft()),
  };
};

export const createMissionPlanState = (
  activeRouteOrOptions: ActiveSimulatedRoute | MissionPlanStateOptions | null = null,
  initialDraft?: MissionPlanDraft,
): MissionPlanState => {
  const seed = resolveSeed(activeRouteOrOptions, initialDraft);
  return {
    draft: seed.draft,
    activeRoute: seed.activeRoute,
    activationProposal: null,
    lastRemovedWaypoint: null,
    lastResult: null,
    nextWaypointSequence: 1,
    nextProposalSequence: 1,
  };
};

const resolveWaypointId = (action: {
  waypointId?: string;
  id?: string;
}): string | null => {
  if (action.waypointId !== undefined && action.id !== undefined && action.waypointId !== action.id) {
    return null;
  }
  return action.waypointId ?? action.id ?? null;
};

const resolveAddId = (action: {
  waypointId?: string;
  id?: string;
}, generatedId: string): string | null => {
  if (action.waypointId !== undefined && action.id !== undefined && action.waypointId !== action.id) {
    return null;
  }
  return action.waypointId ?? action.id ?? generatedId;
};

const resolveSource = (action: {
  source?: MissionPlanWaypointSource;
  provenance?: MissionPlanWaypointSource;
}): MissionPlanWaypointSource | null => {
  if (
    action.source !== undefined
    && action.provenance !== undefined
    && action.source !== action.provenance
  ) {
    return null;
  }
  const source = action.source ?? action.provenance ?? 'LOCAL_USER';
  return isMissionPlanWaypointSource(source) ? source : null;
};

export const missionPlanReducer = (
  state: MissionPlanState,
  action: MissionPlanAction,
): MissionPlanState => {
  switch (action.type) {
    case 'ADD_WAYPOINT':
    case 'ADD_ROUTE_POINT': {
      const operation = action.type;
      const id = resolveAddId(action, generatedWaypointId(state.nextWaypointSequence));
      const source = resolveSource(action);
      if (id === null || !isNonEmptyId(id)) {
        return withResult(state, unavailableResult(operation, 'INVALID_ID'));
      }
      if (source === null) {
        return withResult(state, unavailableResult(operation, 'INVALID_SOURCE'));
      }

      const result = addMissionPlanWaypoint(state.draft, {
        id,
        label: action.label,
        position: action.position,
        source,
        ...(typeof action.createdAt === 'number' ? { createdAt: action.createdAt } : {}),
        ...(typeof action.updatedAt === 'number' ? { updatedAt: action.updatedAt } : {}),
      });
      if (result.status === 'UNAVAILABLE') {
        return withResult(state, unavailableResult(operation, result.reason));
      }

      return withResult(
        state,
        availableResult(operation, { waypointId: id }),
        {
          draft: result.value,
          ...(action.id === undefined && action.waypointId === undefined
            ? { nextWaypointSequence: state.nextWaypointSequence + 1 }
            : {}),
        },
      );
    }

    case 'RENAME_WAYPOINT':
    case 'RENAME_ROUTE_POINT': {
      const operation = action.type;
      const waypointId = resolveWaypointId(action);
      if (waypointId === null || !isNonEmptyId(waypointId)) {
        return withResult(state, unavailableResult(operation, 'INVALID_ID'));
      }

      const result = renameMissionPlanWaypoint(state.draft, waypointId, action.label, action.updatedAt);
      if (result.status === 'UNAVAILABLE') {
        return withResult(state, unavailableResult(operation, result.reason));
      }
      return withResult(state, availableResult(operation, { waypointId }), { draft: result.value });
    }

    case 'REMOVE_WAYPOINT':
    case 'REMOVE_ROUTE_POINT': {
      const operation = action.type;
      const waypointId = resolveWaypointId(action);
      if (waypointId === null || !isNonEmptyId(waypointId)) {
        return withResult(state, unavailableResult(operation, 'INVALID_ID'));
      }

      const index = state.draft.waypoints.findIndex(waypoint => waypoint.id === waypointId);
      const result = removeMissionPlanWaypoint(state.draft, waypointId);
      if (result.status === 'UNAVAILABLE') {
        return withResult(state, unavailableResult(operation, result.reason));
      }
      const removedWaypoint = state.draft.waypoints[index];
      return withResult(
        state,
        availableResult(operation, { waypointId }),
        {
          draft: result.value,
          lastRemovedWaypoint: {
            waypoint: copyMissionPlanWaypoint(removedWaypoint),
            index,
          },
        },
      );
    }

    case 'UNDO_REMOVE_WAYPOINT':
    case 'UNDO_LAST_REMOVE': {
      const operation = action.type;
      const removed = state.lastRemovedWaypoint;
      if (!removed) return withResult(state, unavailableResult(operation, 'NO_REMOVAL_TO_UNDO'));
      if (state.draft.waypoints.some(waypoint => waypoint.id === removed.waypoint.id)) {
        return withResult(state, unavailableResult(operation, 'DUPLICATE_ID'));
      }

      const waypoints = copyMissionPlanDraft(state.draft).waypoints.slice();
      const insertionIndex = Math.min(removed.index, waypoints.length);
      waypoints.splice(insertionIndex, 0, copyMissionPlanWaypoint(removed.waypoint));
      return withResult(
        state,
        availableResult(operation, { waypointId: removed.waypoint.id }),
        {
          draft: { waypoints },
          lastRemovedWaypoint: null,
        },
      );
    }

    case 'REORDER_WAYPOINT':
    case 'REORDER_ROUTE_POINT': {
      const operation = action.type;
      const waypointId = resolveWaypointId(action);
      if (waypointId === null || !isNonEmptyId(waypointId)) {
        return withResult(state, unavailableResult(operation, 'INVALID_ID'));
      }

      const result = reorderMissionPlanWaypoint(state.draft, waypointId, action.toIndex);
      if (result.status === 'UNAVAILABLE') {
        return withResult(state, unavailableResult(operation, result.reason));
      }
      return withResult(state, availableResult(operation, { waypointId }), { draft: result.value });
    }

    case 'CLEAR_DRAFT':
    case 'CANCEL_DRAFT': {
      return withResult(
        state,
        availableResult(action.type),
        {
          draft: createMissionPlanDraft(),
          activationProposal: null,
          lastRemovedWaypoint: null,
        },
      );
    }

    case 'PROPOSE_ACTIVATION':
    case 'PROPOSE_ROUTE_ACTIVATION': {
      const operation = action.type;
      if (state.activationProposal) {
        return withResult(state, unavailableResult(operation, 'ACTIVATION_PROPOSAL_EXISTS'));
      }
      if (state.draft.waypoints.length === 0) {
        return withResult(state, unavailableResult(operation, 'EMPTY_DRAFT'));
      }
      if (action.label !== undefined && action.label.trim().length === 0) {
        return withResult(state, unavailableResult(operation, 'BLANK_PLAN_LABEL'));
      }
      if (action.proposalId !== undefined && !isNonEmptyId(action.proposalId)) {
        return withResult(state, unavailableResult(operation, 'INVALID_ID'));
      }

      const proposalId = action.proposalId ?? generatedProposalId(state.nextProposalSequence);
      const label = action.label ?? 'LOCAL MISSION PLAN';
      const proposal = createMissionPlanActivationProposal(proposalId, label, state.draft);
      return withResult(
        state,
        availableResult(operation, { proposalId }),
        {
          activationProposal: proposal,
          nextProposalSequence: state.nextProposalSequence + 1,
        },
      );
    }

    case 'CANCEL_ACTIVATION_PROPOSAL': {
      if (!state.activationProposal) {
        return withResult(state, unavailableResult(action.type, 'PROPOSAL_NOT_FOUND'));
      }
      if (
        action.proposalId !== undefined
        && action.proposalId !== state.activationProposal.id
      ) {
        return withResult(state, unavailableResult(action.type, 'PROPOSAL_NOT_FOUND'));
      }
      return withResult(state, availableResult(action.type, { proposalId: state.activationProposal.id }), {
        activationProposal: null,
      });
    }
  }
};
