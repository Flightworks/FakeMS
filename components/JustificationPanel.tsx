import type { RouteProposal } from '../domain/proposals';

interface JustificationPanelProps {
  preferred: RouteProposal | null;
  alternative: RouteProposal | null;
  onClose: () => void;
}

export const JustificationPanel = ({ preferred, alternative, onClose }: JustificationPanelProps) => {
  if (!preferred || !alternative) return null;

  return (
    <aside
      className="pointer-events-auto fixed bottom-4 left-1/2 z-[85] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-violet-500/60 bg-slate-950/95 p-4 font-mono text-xs text-slate-100 shadow-2xl"
      aria-label="Contrastive justification"
      role="dialog"
      aria-modal="false"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold tracking-wider text-violet-300">WHY {preferred.label}?</h2>
        <button
          type="button"
          aria-label="Close justification"
          onClick={onClose}
          className="min-h-10 rounded border border-slate-600 px-3 py-2 text-slate-300 hover:border-violet-400 hover:text-white"
        >
          CLOSE
        </button>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">
        Contrast derived from structured local solver outputs; no generative explanation is used.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <section>
          <h3 className="font-bold text-emerald-300">SELECTED REASONS</h3>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[10px] text-slate-300">
            {preferred.reasons.map(reason => <li key={`${preferred.id}:${reason.code}`}>{reason.message}</li>)}
          </ul>
          <div className="mt-2 text-[10px] text-slate-400">
            Fuel margin: {preferred.margins.fuelUnits.toFixed(1)} U · {preferred.distanceNm.toFixed(1)} NM
          </div>
          {preferred.tradeoffs.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] text-amber-200">
              {preferred.tradeoffs.map(tradeoff => <li key={`${preferred.id}:${tradeoff}`}>{tradeoff}</li>)}
            </ul>
          )}
        </section>
        <section>
          <h3 className="font-bold text-slate-400">ALTERNATIVE · {alternative.label}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[10px] text-slate-400">
            {alternative.reasons.map(reason => <li key={`${alternative.id}:${reason.code}`}>{reason.message}</li>)}
          </ul>
          <div className="mt-2 text-[10px] text-slate-500">
            Fuel margin: {alternative.margins.fuelUnits.toFixed(1)} U · {alternative.distanceNm.toFixed(1)} NM
          </div>
          {alternative.tradeoffs.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] text-amber-200">
              {alternative.tradeoffs.map(tradeoff => <li key={`${alternative.id}:${tradeoff}`}>{tradeoff}</li>)}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
};
