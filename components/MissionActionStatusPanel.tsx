import type { MissionActionIntent } from '../application/missionActionReducer';
import type { MissionActionRecord, MissionActionStatus, MissionActionJournalEntry } from '../domain/missionActions';

interface MissionActionStatusPanelProps {
  action: MissionActionRecord | null;
  journal?: MissionActionJournalEntry[];
  onIntent: (intent: MissionActionIntent) => void;
}

const statusLabels: Record<MissionActionStatus, string> = {
  PROPOSED: 'PROPOSED',
  PREVIEWED: 'AWAITING AUTHORIZATION',
  AUTHORIZED: 'AUTHORIZED · READY TO EXECUTE',
  REJECTED: 'REJECTED',
  EXECUTING_SIM: 'EXECUTING · SIMULATION',
  COMPLETED_SIM: 'COMPLETED · SIMULATION',
  FAILED_SIM: 'FAILED · SIMULATION',
  NOT_IMPLEMENTED: 'NOT IMPLEMENTED',
};

export const MissionActionStatusPanel = ({ action, journal = [], onIntent }: MissionActionStatusPanelProps) => {
  if (!action) return null;

  const actionJournal = journal.filter(entry => entry.actionId === action.id);

  return (
    <aside
      className="pointer-events-auto fixed bottom-32 left-1/2 z-[89] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-cyan-500/60 bg-slate-950/95 p-3 font-mono text-xs text-slate-100 shadow-2xl"
      role="dialog"
      aria-modal="false"
      aria-live="polite"
      aria-label="Mission action status"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold tracking-wider text-cyan-300">MISSION ACTION</span>
        <span className="text-[10px] text-slate-400">{statusLabels[action.status]}</span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span className="text-sm text-white">{action.label}</span>
        <span className="text-[10px] uppercase text-slate-500">{action.category}</span>
      </div>
      {action.targetId && <div className="mt-1 text-[10px] text-slate-400">TARGET: {action.targetId}</div>}
      {action.failureReason && <div className="mt-2 text-[10px] text-amber-300">{action.failureReason}</div>}
      {actionJournal.length > 0 && (
        <ol aria-label="Mission action journal" className="mt-2 space-y-0.5 border-l border-slate-700 pl-2 text-[9px] text-slate-500">
          {actionJournal.slice(-5).map((entry) => (
            <li key={`${entry.actionId}:${entry.at}:${entry.status}`}>
              {entry.status} · {entry.at}
              {entry.reason ? ` · ${entry.reason}` : ''}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-3 flex gap-2">
        {action.status === 'PROPOSED' && (
          <>
            <button
              type="button"
              aria-label="Preview mission action"
              onClick={() => onIntent({ type: 'PREVIEW', at: Date.now() })}
              className="min-h-10 flex-1 rounded border border-cyan-500 bg-cyan-950/50 px-3 py-2 font-bold text-cyan-200 hover:bg-cyan-900"
            >
              PREVIEW
            </button>
            <button
              type="button"
              aria-label="Reject mission action"
              onClick={() => onIntent({ type: 'REJECT', at: Date.now(), reason: 'Rejected by operator' })}
              className="min-h-10 flex-1 rounded border border-red-500/70 bg-red-950/40 px-3 py-2 font-bold text-red-200 hover:bg-red-900/60"
            >
              REJECT
            </button>
          </>
        )}
        {action.status === 'PREVIEWED' && (
          <>
            <button
              type="button"
              aria-label="Authorize mission action"
              onClick={() => onIntent({ type: 'AUTHORIZE', at: Date.now() })}
              className="min-h-10 flex-1 rounded border border-amber-500 bg-amber-950/50 px-3 py-2 font-bold text-amber-200 hover:bg-amber-900"
            >
              AUTHORIZE
            </button>
            <button
              type="button"
              aria-label="Reject mission action"
              onClick={() => onIntent({ type: 'REJECT', at: Date.now(), reason: 'Rejected by operator' })}
              className="min-h-10 flex-1 rounded border border-red-500/70 bg-red-950/40 px-3 py-2 font-bold text-red-200 hover:bg-red-900/60"
            >
              REJECT
            </button>
          </>
        )}
        {action.status === 'AUTHORIZED' && (
          <>
            <button
              type="button"
              aria-label="Execute simulated action"
              onClick={() => onIntent({ type: 'EXECUTE_SIM', at: Date.now() })}
              className="min-h-10 flex-1 rounded border border-emerald-500 bg-emerald-950/50 px-3 py-2 font-bold text-emerald-200 hover:bg-emerald-900"
            >
              EXECUTE SIM
            </button>
            <button
              type="button"
              aria-label="Cancel mission action"
              onClick={() => onIntent({ type: 'CANCEL', at: Date.now() })}
              className="min-h-10 flex-1 rounded border border-red-500/70 bg-red-950/40 px-3 py-2 font-bold text-red-200 hover:bg-red-900/60"
            >
              CANCEL
            </button>
          </>
        )}
      </div>
    </aside>
  );
};
