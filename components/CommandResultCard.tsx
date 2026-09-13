import { useState } from 'react';
import type {
  CommandResult,
  DisplayReason,
  InputQualification,
  ResultState,
} from '../domain/commandResults';
import { presentCommandResult } from '../application/presentCommandResult';

export interface CommandResultCardProps {
  /** One immutable result calculated outside the presentation layer. */
  result: CommandResult;
  /** Optional host-provided copy transport. Returning false reports a failure. */
  onCopy?: (
    result: CommandResult,
    text: string,
  ) => void | boolean | Promise<void | boolean>;
  /** Optional notification when the native details disclosure is toggled. */
  onDetails?: (result: CommandResult) => void;
  /** Only used for explicitly confirmable, non-read-only results. */
  onExecute?: (result: CommandResult) => void | Promise<void>;
}

const stateClasses: Record<ResultState, string> = {
  AVAILABLE: 'border-emerald-400/60 bg-emerald-950/40 text-emerald-100',
  PARTIAL: 'border-amber-400/70 bg-amber-950/40 text-amber-100',
  INCOMPLETE: 'border-slate-500/70 bg-slate-900/80 text-slate-200',
  AMBIGUOUS: 'border-orange-400/70 bg-orange-950/40 text-orange-100',
  UNAVAILABLE: 'border-rose-400/70 bg-rose-950/40 text-rose-100',
};

const reasonClasses: Record<ResultState, string> = {
  AVAILABLE: 'border-slate-700/70 bg-slate-900/50 text-slate-300',
  PARTIAL: 'border-amber-400/50 bg-amber-950/30 text-amber-100',
  INCOMPLETE: 'border-slate-500/60 bg-slate-900/70 text-slate-200',
  AMBIGUOUS: 'border-orange-400/50 bg-orange-950/30 text-orange-100',
  UNAVAILABLE: 'border-rose-400/60 bg-rose-950/30 text-rose-100',
};

const originLabel = (origin: InputQualification['origin']): string => {
  if (origin === 'SCENARIO') return 'SCÉNARIO';
  if (origin === 'RETAINED_FIX') return 'RETENU/PÉRIMÉ';
  return origin;
};

const qualificationLabel = (qualification: InputQualification): string => {
  const origin = originLabel(qualification.origin);
  const assumption = qualification.assumption?.toUpperCase() ?? '';
  if (qualification.input === 'SPEED'
    && (qualification.origin === 'USER_INPUT' || assumption.includes('HYPOTHESIS'))) {
    return 'GS HYPOTHÈSE';
  }
  if (qualification.status === 'NOT_APPLICABLE') {
    return `${qualification.input}: NON APPLICABLE`;
  }
  if (qualification.status === 'STALE' || qualification.origin === 'RETAINED_FIX') {
    return `${qualification.input}: ${origin}`;
  }
  if (qualification.status === 'MISSING') {
    return `${qualification.input === 'SPEED' ? 'GS' : qualification.input} ABSENT · ${origin}`;
  }
  return `${qualification.input}: ${origin}`;
};

const copyTextFor = (result: CommandResult): string => (
  presentCommandResult(result).lines.join('\n')
);

const hasCapability = (result: CommandResult, capability: 'COPY' | 'DETAILS' | 'CONFIRM'): boolean => (
  result.capabilities.includes(capability)
);

const canUseNativeClipboard = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (window.isSecureContext === false) return false;
  const localHttpHost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  if (window.location.protocol === 'http:' && !localHttpHost && window.isSecureContext !== true) return false;
  return typeof navigator.clipboard?.writeText === 'function';
};

const copyFailureMessage = 'Copie impossible : presse-papiers sécurisé non disponible.';

const mainReasonMessage = (reason: DisplayReason): string => {
  if (reason.code === 'SPEED_MISSING' || reason.code === 'SPEED_UNAVAILABLE' || reason.rawCode === 'SPEED_UNAVAILABLE') {
    return 'Vitesse sol absente.';
  }
  if (reason.code === 'CLOCK_MISSING' || reason.code === 'SCENARIO_TIME_UNAVAILABLE' || reason.rawCode === 'SCENARIO_TIME_UNAVAILABLE') {
    return 'Heure de scénario absente ; ETE reste disponible.';
  }
  if (reason.code === 'REFERENCE_AMBIGUOUS') return 'Référence ambiguë.';
  if (reason.code === 'REFERENCE_UNKNOWN') return 'Référence inconnue.';
  if (reason.code === 'QUALITY_NOT_APPLICABLE') return 'Qualité non applicable à ce point fixe.';
  return reason.message;
};

const mainReasonRemedy = (reason: DisplayReason): string | undefined => {
  if (reason.code === 'SPEED_MISSING' || reason.code === 'SPEED_UNAVAILABLE' || reason.rawCode === 'SPEED_UNAVAILABLE') {
    return 'Fournir une vitesse sol qualifiée ou saisir une hypothèse.';
  }
  if (reason.code === 'CLOCK_MISSING' || reason.code === 'SCENARIO_TIME_UNAVAILABLE' || reason.rawCode === 'SCENARIO_TIME_UNAVAILABLE') {
    return 'Fournir une heure de scénario pour calculer une ETA absolue.';
  }
  return reason.remedy;
};

const isTechnicalDetailLine = (line: string): boolean => (
  /^(?:REASON CODE|RAW CODE|TECHNICAL REASON):/i.test(line)
);

export const CommandResultCard = ({
  result,
  onCopy,
  onDetails,
  onExecute,
}: CommandResultCardProps) => {
  const [copyState, setCopyState] = useState<'IDLE' | 'COPYING' | 'COPIED' | 'FAILED'>('IDLE');
  const presentation = presentCommandResult(result);
  const detailLines = presentation.lines.filter(line => !isTechnicalDetailLine(line));
  const primary = presentation.primary;
  const reason: DisplayReason | undefined = presentation.reason;
  const canShowCopy = hasCapability(result, 'COPY');
  const canShowDetails = hasCapability(result, 'DETAILS');
  const canShowExecute = Boolean(
    onExecute
      && result.kind !== 'READ_ONLY'
      && result.state === 'AVAILABLE'
      && hasCapability(result, 'CONFIRM'),
  );

  const handleCopy = async () => {
    if (copyState === 'COPYING') return;
    setCopyState('COPYING');
    try {
      const text = copyTextFor(result);
      if (onCopy) {
        const copied = await onCopy(result, text);
        if (copied === false) throw new Error('COPY_REJECTED');
      } else {
        if (!canUseNativeClipboard()) throw new Error('CLIPBOARD_UNAVAILABLE');
        await navigator.clipboard.writeText(text);
      }
      setCopyState('COPIED');
    } catch {
      setCopyState('FAILED');
    }
  };

  const handleExecute = async () => {
    if (!onExecute || !canShowExecute) return;
    await onExecute(result);
  };

  return (
    <article
      className="w-full min-w-0 max-w-full overflow-hidden rounded-md border border-slate-700/70 bg-slate-950/70 p-2 font-mono text-[10px]"
      data-testid="command-result-card"
      data-result-state={result.state}
    >
      <div className="min-w-0 max-w-full space-y-2">
        <div
          className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1 text-[9px] uppercase tracking-wide text-slate-400"
          data-testid="command-result-command-target"
        >
          <span className="shrink-0 text-slate-500">COMMAND:</span>
          <span className="min-w-0 break-words text-slate-200 [overflow-wrap:anywhere]">{result.id}</span>
          {result.references.length > 0 && (
            <span
              className="min-w-0 break-words text-cyan-300 [overflow-wrap:anywhere]"
              data-testid="command-result-target"
            >
              TARGET: {result.references.join(' · ')}
            </span>
          )}
          <span
            className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold ${stateClasses[result.state]}`}
            data-testid="command-result-state"
          >
            STATE: {result.state}
          </span>
        </div>

        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2" data-testid="command-result-summary">
          {primary ? (
            <div
              className={`inline-flex min-w-0 max-w-full flex-wrap items-baseline gap-x-2 gap-y-1 rounded border px-2 py-1 text-[10px] ${stateClasses[result.state]}`}
              data-testid="command-result-primary"
            >
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide opacity-80">{primary.label}</span>
              <strong className="min-w-0 max-w-full break-words text-sm leading-tight [overflow-wrap:anywhere]">
                {' '}{primary.value}
              </strong>
              {primary.unit && (
                <span className="shrink-0 whitespace-normal text-[10px] font-semibold">{' '}{primary.unit}</span>
              )}
            </div>
          ) : (
            <div
              className="inline-flex min-h-[30px] max-w-full items-center rounded border border-current/30 px-2 py-1 text-[10px] text-current/80"
              data-testid="command-result-no-primary"
            >
              VALEUR PRINCIPALE INDISPONIBLE
            </div>
          )}

          {presentation.qualifications.length > 0 && (
            <div
              className="flex min-w-0 max-w-full flex-wrap items-center gap-1"
              data-testid="command-result-qualification"
            >
              {presentation.qualifications.map((qualification, index) => (
                <span
                  key={`${qualification.input}-${qualification.objectId ?? index}`}
                  className="min-w-0 max-w-full break-words rounded border border-cyan-400/40 bg-cyan-950/30 px-1.5 py-1 text-[9px] text-cyan-100 [overflow-wrap:anywhere]"
                >
                  {qualificationLabel(qualification)}
                </span>
              ))}
            </div>
          )}
        </div>

        {reason && (
          <div
            className={`min-w-0 max-w-full rounded border px-2 py-1 leading-snug ${reasonClasses[result.state]}`}
            data-testid="command-result-reason"
            role={result.state === 'UNAVAILABLE' || result.state === 'INCOMPLETE' ? 'alert' : 'status'}
            aria-live="polite"
          >
            <div className="break-words [overflow-wrap:anywhere]">
              <span className="font-semibold">REASON:</span> {mainReasonMessage(reason)}
            </div>
            {mainReasonRemedy(reason) && (
              <div className="mt-0.5 break-words text-[9px] opacity-90 [overflow-wrap:anywhere]">
                <span className="font-semibold">REMEDY:</span> {mainReasonRemedy(reason)}
              </div>
            )}
          </div>
        )}

        {result.state === 'AMBIGUOUS' && result.candidates.length > 0 && (
          <div
            className="min-w-0 max-w-full rounded border border-orange-400/50 bg-orange-950/20 px-2 py-1 text-orange-100"
            data-testid="command-result-candidates"
          >
            <div className="mb-1 font-semibold">CANDIDATES:</div>
            <ul className="min-w-0 max-w-full space-y-0.5 pl-3">
              {result.candidates.map(candidate => (
                <li key={candidate.id} className="min-w-0 max-w-full break-words [overflow-wrap:anywhere]">
                  {candidate.label} ({candidate.id})
                </li>
              ))}
            </ul>
          </div>
        )}

        {(canShowDetails || canShowCopy || canShowExecute) && (
          <div className="flex min-w-0 max-w-full flex-wrap items-start gap-2 border-t border-slate-800 pt-1.5">
            {canShowDetails && (
              <details
                className="min-w-0 max-w-full flex-1"
                onClick={(event) => event.stopPropagation()}
                onToggle={() => onDetails?.(result)}
              >
                <summary role="button" className="min-h-[32px] cursor-pointer list-none rounded border border-slate-600 px-2 py-1 text-slate-200 hover:border-cyan-400/70 focus:outline-none focus:ring-1 focus:ring-cyan-400 [&::-webkit-details-marker]:hidden">
                  Détails
                </summary>
                <div
                  className="mt-1 max-h-44 min-w-0 max-w-full overflow-x-hidden overflow-y-auto rounded border border-slate-800 bg-slate-900/60 p-2 leading-snug text-slate-300"
                  data-testid="command-result-details"
                  tabIndex={0}
                >
                  {detailLines.map((line, index) => (
                    <div key={`${index}-${line}`} className="min-w-0 max-w-full break-words [overflow-wrap:anywhere]">
                      {line}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {canShowCopy && (
              <button
                type="button"
                className="min-h-[32px] shrink-0 rounded border border-slate-600 px-2 py-1 text-slate-200 hover:border-cyan-400/70 hover:text-cyan-200 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                aria-label="Copier le résultat"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleCopy();
                }}
              >
                Copier
              </button>
            )}

            {canShowExecute && (
              <button
                type="button"
                className="min-h-[32px] shrink-0 rounded border border-amber-400/70 px-2 py-1 text-amber-100 hover:bg-amber-400/10 focus:outline-none focus:ring-1 focus:ring-amber-400"
                aria-label="Exécuter le résultat"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleExecute();
                }}
              >
                Exécuter
              </button>
            )}
          </div>
        )}

        {copyState === 'COPIED' && (
          <div className="break-words text-[9px] text-emerald-300" role="status" aria-live="polite">
            Copie effectuée.
          </div>
        )}
        {copyState === 'FAILED' && (
          <div className="break-words text-[9px] text-rose-300" role="alert" aria-live="assertive">
            {copyFailureMessage}
          </div>
        )}
      </div>
    </article>
  );
};
