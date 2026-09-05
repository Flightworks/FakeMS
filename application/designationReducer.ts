import type { ProjectionPreview, SimulatedDesignation } from '../domain/designations';
import { createSimulatedDesignation } from '../domain/designations';

export type DesignationPhase = 'IDLE' | 'PREVIEWED' | 'CONFIRMED_SIM' | 'CANCELLED';

export type DesignationEvent =
  | { type: 'PREVIEWED'; cycleId: number }
  | { type: 'CONFIRMED_SIM'; cycleId: number; designationId: string }
  | { type: 'CANCELLED'; cycleId: number }
  | { type: 'RENAMED'; designationId: string; label: string }
  | { type: 'DELETED'; designationId: string }
  | { type: 'CLEAR_PROPOSED'; designationIds: string[] }
  | { type: 'CLEARED'; designationIds: string[] }
  | { type: 'CLEAR_CANCELLED'; designationIds: string[] };

export interface ClearDesignationsProposal {
  designationIds: string[];
}

export interface DesignationState {
  phase: DesignationPhase;
  activePreview: ProjectionPreview | null;
  activeCycleId: number | null;
  confirmedDesignations: SimulatedDesignation[];
  clearProposal: ClearDesignationsProposal | null;
  events: DesignationEvent[];
  nextCycleId: number;
  nextDesignationSequence: number;
}

export type DesignationAction =
  | { type: 'PREVIEW_DESIGNATION'; preview: ProjectionPreview }
  | { type: 'CONFIRM_DESIGNATION' }
  | { type: 'CANCEL_DESIGNATION' }
  | { type: 'RENAME_DESIGNATION'; designationId: string; label: string }
  | { type: 'DELETE_DESIGNATION'; designationId: string }
  | { type: 'PROPOSE_CLEAR_DESIGNATIONS' }
  | { type: 'CONFIRM_CLEAR_DESIGNATIONS' }
  | { type: 'CANCEL_CLEAR_DESIGNATIONS' };

export const createDesignationState = (): DesignationState => ({
  phase: 'IDLE',
  activePreview: null,
  activeCycleId: null,
  confirmedDesignations: [],
  clearProposal: null,
  events: [],
  nextCycleId: 1,
  nextDesignationSequence: 1,
});

export const designationReducer = (
  state: DesignationState,
  action: DesignationAction,
): DesignationState => {
  switch (action.type) {
    case 'PREVIEW_DESIGNATION': {
      const cycleId = state.nextCycleId;
      const replacedPreviewEvent = state.phase === 'PREVIEWED' && state.activeCycleId !== null
        ? [{ type: 'CANCELLED' as const, cycleId: state.activeCycleId }]
        : [];

      return {
        ...state,
        phase: 'PREVIEWED',
        activePreview: action.preview,
        activeCycleId: cycleId,
        events: [
          ...state.events,
          ...replacedPreviewEvent,
          { type: 'PREVIEWED', cycleId },
        ],
        nextCycleId: cycleId + 1,
      };
    }

    case 'CONFIRM_DESIGNATION': {
      if (state.phase !== 'PREVIEWED' || !state.activePreview || state.activeCycleId === null) {
        return state;
      }

      const designation = createSimulatedDesignation(
        state.activePreview,
        state.nextDesignationSequence,
      );

      return {
        ...state,
        phase: 'CONFIRMED_SIM',
        activePreview: null,
        activeCycleId: null,
        confirmedDesignations: [...state.confirmedDesignations, designation],
        events: [
          ...state.events,
          {
            type: 'CONFIRMED_SIM',
            cycleId: state.activeCycleId,
            designationId: designation.id,
          },
        ],
        nextDesignationSequence: state.nextDesignationSequence + 1,
      };
    }

    case 'CANCEL_DESIGNATION': {
      if (state.phase !== 'PREVIEWED' || state.activeCycleId === null) {
        return state;
      }

      return {
        ...state,
        phase: 'CANCELLED',
        activePreview: null,
        activeCycleId: null,
        events: [
          ...state.events,
          { type: 'CANCELLED', cycleId: state.activeCycleId },
        ],
      };
    }

    case 'RENAME_DESIGNATION': {
      const designation = state.confirmedDesignations.find(
        candidate => candidate.id === action.designationId,
      );
      const label = action.label.trim();
      if (!designation || label.length === 0) return state;

      const normalizedLabel = label.toLocaleUpperCase();
      const duplicate = state.confirmedDesignations.some(candidate => (
        candidate.id !== action.designationId
        && candidate.label.trim().toLocaleUpperCase() === normalizedLabel
      ));
      if (duplicate || designation.label === label) return state;

      return {
        ...state,
        confirmedDesignations: state.confirmedDesignations.map(candidate => (
          candidate.id === action.designationId
            ? { ...candidate, label }
            : candidate
        )),
        events: [
          ...state.events,
          { type: 'RENAMED', designationId: action.designationId, label },
        ],
      };
    }

    case 'DELETE_DESIGNATION': {
      if (!state.confirmedDesignations.some(candidate => candidate.id === action.designationId)) {
        return state;
      }

      return {
        ...state,
        confirmedDesignations: state.confirmedDesignations.filter(
          candidate => candidate.id !== action.designationId,
        ),
        events: [
          ...state.events,
          { type: 'DELETED', designationId: action.designationId },
        ],
      };
    }

    case 'PROPOSE_CLEAR_DESIGNATIONS': {
      if (state.clearProposal) return state;
      const designationIds = state.confirmedDesignations.map(designation => designation.id);
      return {
        ...state,
        clearProposal: { designationIds },
        events: [
          ...state.events,
          { type: 'CLEAR_PROPOSED', designationIds: [...designationIds] },
        ],
      };
    }

    case 'CONFIRM_CLEAR_DESIGNATIONS': {
      if (!state.clearProposal) return state;
      const { designationIds } = state.clearProposal;
      return {
        ...state,
        confirmedDesignations: [],
        clearProposal: null,
        events: [
          ...state.events,
          { type: 'CLEARED', designationIds: [...designationIds] },
        ],
      };
    }

    case 'CANCEL_CLEAR_DESIGNATIONS': {
      if (!state.clearProposal) return state;
      const { designationIds } = state.clearProposal;
      return {
        ...state,
        clearProposal: null,
        events: [
          ...state.events,
          { type: 'CLEAR_CANCELLED', designationIds: [...designationIds] },
        ],
      };
    }
  }
};
