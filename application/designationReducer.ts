import type { ProjectionPreview, SimulatedDesignation } from '../domain/designations';
import { createSimulatedDesignation } from '../domain/designations';

export type DesignationPhase = 'IDLE' | 'PREVIEWED' | 'CONFIRMED_SIM' | 'CANCELLED';

export type DesignationEvent =
  | { type: 'PREVIEWED'; cycleId: number }
  | { type: 'CONFIRMED_SIM'; cycleId: number; designationId: string }
  | { type: 'CANCELLED'; cycleId: number };

export interface DesignationState {
  phase: DesignationPhase;
  activePreview: ProjectionPreview | null;
  activeCycleId: number | null;
  confirmedDesignations: SimulatedDesignation[];
  events: DesignationEvent[];
  nextCycleId: number;
  nextDesignationSequence: number;
}

export type DesignationAction =
  | { type: 'PREVIEW_DESIGNATION'; preview: ProjectionPreview }
  | { type: 'CONFIRM_DESIGNATION' }
  | { type: 'CANCEL_DESIGNATION' };

export const createDesignationState = (): DesignationState => ({
  phase: 'IDLE',
  activePreview: null,
  activeCycleId: null,
  confirmedDesignations: [],
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
  }
};
