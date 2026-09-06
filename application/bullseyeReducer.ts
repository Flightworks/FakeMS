import type { BullseyeReference } from '../domain/bullseye';

export type BullseyeEvent =
  | {
      type: 'SET_BULLSEYE_CONFIRMED';
      entityId: string;
      replacedEntityId?: string;
    }
  | { type: 'CLEAR_BULLSEYE_CONFIRMED'; entityId?: string };

export interface BullseyeState {
  bullseye: BullseyeReference | null;
  events: BullseyeEvent[];
}

export type BullseyeAction =
  | { type: 'SET_BULLSEYE_PROPOSED'; bullseye: BullseyeReference }
  | { type: 'SET_BULLSEYE_CONFIRMED'; bullseye: BullseyeReference }
  | { type: 'CLEAR_BULLSEYE_PROPOSED' }
  | { type: 'CLEAR_BULLSEYE_CONFIRMED' };

export const createBullseyeState = (): BullseyeState => ({
  bullseye: null,
  events: [],
});

const copyBullseye = (bullseye: BullseyeReference): BullseyeReference => ({
  ...bullseye,
  position: { ...bullseye.position },
});

export const bullseyeReducer = (
  state: BullseyeState,
  action: BullseyeAction,
): BullseyeState => {
  switch (action.type) {
    case 'SET_BULLSEYE_PROPOSED':
    case 'CLEAR_BULLSEYE_PROPOSED':
      // Mission action authorization owns proposals. This state changes only
      // after the explicit simulated execution step.
      return state;

    case 'SET_BULLSEYE_CONFIRMED': {
      const previousEntityId = state.bullseye?.entityId;
      return {
        bullseye: copyBullseye(action.bullseye),
        events: [
          ...state.events,
          {
            type: 'SET_BULLSEYE_CONFIRMED',
            entityId: action.bullseye.entityId,
            ...(previousEntityId ? { replacedEntityId: previousEntityId } : {}),
          },
        ],
      };
    }

    case 'CLEAR_BULLSEYE_CONFIRMED':
      if (!state.bullseye) return state;
      return {
        bullseye: null,
        events: [
          ...state.events,
          {
            type: 'CLEAR_BULLSEYE_CONFIRMED',
            entityId: state.bullseye.entityId,
          },
        ],
      };
  }
};
