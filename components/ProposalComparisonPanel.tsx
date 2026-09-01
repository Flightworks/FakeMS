import type { RouteProposal, RouteProposalSet } from '../domain/proposals';

interface ProposalComparisonPanelProps {
  result: RouteProposalSet | null;
  onWhy: (preferred: RouteProposal, alternative: RouteProposal) => void;
  onAccept: (proposal: RouteProposal) => void;
  onReject: () => void;
  onModify?: () => void;
  acceptedProposalId?: string | null;
}

const statusLabel: Record<RouteProposal['status'], string> = {
  FEASIBLE: 'FEASIBLE',
  CONSTRAINED: 'CONSTRAINED',
  PROHIBITED: 'PROHIBITED',
};

const statusClass: Record<RouteProposal['status'], string> = {
  FEASIBLE: 'border-emerald-500/70 text-emerald-300',
  CONSTRAINED: 'border-amber-500/70 text-amber-300',
  PROHIBITED: 'border-red-500/70 text-red-300',
};

export const ProposalComparisonPanel = ({
  result,
  onWhy,
  onAccept,
  onReject,
  onModify,
  acceptedProposalId,
}: ProposalComparisonPanelProps) => {
  if (!result) return null;

  return (
    <section
      className="pointer-events-auto fixed inset-x-4 top-24 z-[80] mx-auto max-w-4xl rounded-lg border border-cyan-500/60 bg-slate-950/95 p-4 font-mono text-xs text-slate-100 shadow-2xl"
      aria-label="Proposal comparison"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold tracking-wider text-cyan-300">DECISION SUPPORT · SIMULATION</h2>
          <p className="mt-1 text-[10px] text-slate-500">Two deterministic alternatives · no operational execution</p>
        </div>
        <div className="flex gap-2">
          {onModify && (
            <button
              type="button"
              aria-label="Modify route intent"
              onClick={onModify}
              className="min-h-10 rounded border border-violet-500/70 px-3 py-2 text-violet-200 hover:bg-violet-900/40"
            >
              MODIFY
            </button>
          )}
          <button
            type="button"
            aria-label="Reject all route proposals"
            onClick={onReject}
            className="min-h-10 rounded border border-slate-600 px-3 py-2 text-slate-300 hover:border-red-400 hover:text-red-200"
          >
            REJECT ALL
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {result.proposals.map((proposal, index) => {
          const alternative = result.proposals[index === 0 ? 1 : 0];
          const isAccepted = acceptedProposalId === proposal.id;
          return (
            <article key={proposal.id} className="rounded border border-slate-700 bg-slate-900/70 p-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-white">{proposal.label}</h3>
                <span className={`rounded border px-2 py-1 text-[10px] font-bold ${statusClass[proposal.status]}`}>
                  {isAccepted ? 'ACCEPTED · SIM' : statusLabel[proposal.status]}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <div><dt className="text-slate-500">DISTANCE</dt><dd>{proposal.distanceNm.toFixed(1)} NM</dd></div>
                <div><dt className="text-slate-500">FUEL</dt><dd>{proposal.estimatedFuelUnits.toFixed(1)} U</dd></div>
                <div><dt className="text-slate-500">ETE</dt><dd>{proposal.estimatedTimeMinutes === null ? 'N/A' : `${proposal.estimatedTimeMinutes.toFixed(1)} MIN`}</dd></div>
                <div><dt className="text-slate-500">FUEL MARGIN</dt><dd>{proposal.margins.fuelUnits.toFixed(1)} U</dd></div>
              </dl>
              <div className="mt-3 text-[10px] text-slate-400">
                <div className="font-bold text-slate-300">REASONS</div>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {proposal.reasons.map(reason => <li key={`${proposal.id}:${reason.code}`}>{reason.message}</li>)}
                </ul>
              </div>
              {proposal.tradeoffs.length > 0 && (
                <div className="mt-3 text-[10px] text-amber-200">
                  <div className="font-bold">TRADEOFFS</div>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {proposal.tradeoffs.map(tradeoff => <li key={`${proposal.id}:${tradeoff}`}>{tradeoff}</li>)}
                  </ul>
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  aria-label="Explain proposal contrast"
                  onClick={() => onWhy(proposal, alternative)}
                  className="min-h-10 flex-1 rounded border border-cyan-500/70 px-2 py-2 text-cyan-200 hover:bg-cyan-900/40"
                >
                  WHY?
                </button>
                {proposal.status !== 'PROHIBITED' && (
                  <button
                    type="button"
                    aria-label="Accept route proposal for simulation"
                    disabled={isAccepted}
                    onClick={() => onAccept(proposal)}
                    className="min-h-10 flex-1 rounded border border-emerald-500/70 px-2 py-2 text-emerald-200 hover:bg-emerald-900/40 disabled:cursor-default disabled:opacity-60"
                  >
                    {isAccepted ? 'ACCEPTED · SIM' : 'ACCEPT SIM'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
