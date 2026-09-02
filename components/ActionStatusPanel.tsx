import type { DirectToProposal } from '../domain/commands';

interface ActionStatusPanelProps {
  proposal: DirectToProposal | null;
  onAccept: () => void;
  onReject: () => void;
}

const statusLabel: Record<DirectToProposal['status'], string> = {
  PROPOSED: 'AWAITING AUTHORIZATION',
  ACCEPTED: 'AUTHORIZED · SIM ROUTE SET',
  REJECTED: 'REJECTED',
};

export const ActionStatusPanel = ({
  proposal,
  onAccept,
  onReject,
}: ActionStatusPanelProps) => {
  if (!proposal) return null;

  return (
    <aside
      className="pointer-events-auto fixed bottom-4 left-1/2 z-[90] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-amber-500/60 bg-slate-950/95 p-3 font-mono text-xs text-slate-100 shadow-2xl"
      role="dialog"
      aria-modal="false"
      aria-live="polite"
      aria-label="Direct-to route proposal status"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold tracking-wider text-amber-300">DCT PROPOSAL</span>
        <span className="text-[10px] text-slate-400">{statusLabel[proposal.status]}</span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span className="text-sm text-white">{proposal.targetLabel}</span>
        <span className="text-[10px] text-slate-400">
          {proposal.position.lat.toFixed(4)}, {proposal.position.lon.toFixed(4)}
        </span>
      </div>
      {proposal.status === 'PROPOSED' && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            aria-label="Accept route proposal"
            onClick={onAccept}
            className="min-h-10 flex-1 rounded border border-emerald-500 bg-emerald-900/50 px-3 py-2 font-bold text-emerald-200 hover:bg-emerald-800"
          >
            AUTHORIZE SIM
          </button>
          <button
            type="button"
            aria-label="Reject route proposal"
            onClick={onReject}
            className="min-h-10 flex-1 rounded border border-red-500/70 bg-red-950/40 px-3 py-2 font-bold text-red-200 hover:bg-red-900/60"
          >
            REJECT
          </button>
        </div>
      )}
    </aside>
  );
};
