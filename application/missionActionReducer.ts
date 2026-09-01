import {
  MissionActionJournalEntry,
  MissionActionRecord,
  MissionActionRequest,
  MissionActionStatus,
} from '../domain/missionActions';

export type MissionActionIntent =
  | { type: 'PROPOSE'; request: MissionActionRequest }
  | { type: 'PREVIEW'; at: number }
  | { type: 'AUTHORIZE'; at: number }
  | { type: 'EXECUTE_SIM'; at: number }
  | { type: 'REJECT'; at: number; reason?: string }
  | { type: 'CANCEL'; at: number; reason?: string };

export interface MissionActionState {
  active: MissionActionRecord | null;
  journal: MissionActionJournalEntry[];
}

export const createMissionActionState = (): MissionActionState => ({
  active: null,
  journal: [],
});

const appendJournal = (
  state: MissionActionState,
  record: MissionActionRecord,
  status: MissionActionStatus,
  at: number,
  reason?: string,
): MissionActionState => ({
  active: record,
  journal: [
    ...state.journal,
    {
      actionId: record.id,
      status,
      at,
      label: record.label,
      ...(record.targetId ? { targetId: record.targetId } : {}),
      ...(reason ? { reason } : {}),
    },
  ],
});

const withStatus = (
  record: MissionActionRecord,
  status: MissionActionStatus,
  extra: Partial<MissionActionRecord> = {},
): MissionActionRecord => ({ ...record, ...extra, status });

export const dispatchMissionAction = (
  state: MissionActionState,
  intent: MissionActionIntent,
): MissionActionState => {
  switch (intent.type) {
    case 'PROPOSE': {
      const record: MissionActionRecord = { ...intent.request, status: 'PROPOSED' };
      return appendJournal(state, record, 'PROPOSED', intent.request.issuedAt);
    }

    case 'PREVIEW': {
      if (!state.active || state.active.status !== 'PROPOSED') return state;
      return appendJournal(state, withStatus(state.active, 'PREVIEWED'), 'PREVIEWED', intent.at);
    }

    case 'AUTHORIZE': {
      if (!state.active || state.active.status !== 'PREVIEWED') return state;
      const record = withStatus(state.active, 'AUTHORIZED', { authorizedAt: intent.at });
      return appendJournal(state, record, 'AUTHORIZED', intent.at);
    }

    case 'EXECUTE_SIM': {
      if (!state.active || state.active.status !== 'AUTHORIZED') return state;
      const executing = withStatus(state.active, 'EXECUTING_SIM');
      const executingState = appendJournal(state, executing, 'EXECUTING_SIM', intent.at);
      if (state.active.implementation === 'NOT_IMPLEMENTED') {
        return appendJournal(
          executingState,
          withStatus(executing, 'NOT_IMPLEMENTED', {
            failureReason: 'No simulator effect is available for this action',
          }),
          'NOT_IMPLEMENTED',
          intent.at,
          'No simulator effect is available for this action',
        );
      }

      return appendJournal(
        executingState,
        withStatus(executing, 'COMPLETED_SIM', { completedAt: intent.at }),
        'COMPLETED_SIM',
        intent.at,
      );
    }

    case 'REJECT': {
      if (!state.active || !['PROPOSED', 'PREVIEWED'].includes(state.active.status)) return state;
      return appendJournal(
        state,
        withStatus(state.active, 'REJECTED', { failureReason: intent.reason }),
        'REJECTED',
        intent.at,
        intent.reason,
      );
    }

    case 'CANCEL': {
      if (!state.active || !['PROPOSED', 'PREVIEWED', 'AUTHORIZED'].includes(state.active.status)) return state;
      return appendJournal(
        state,
        withStatus(state.active, 'REJECTED', { failureReason: intent.reason ?? 'Action cancelled by operator' }),
        'REJECTED',
        intent.at,
        intent.reason ?? 'Action cancelled by operator',
      );
    }
  }
};
