import type {
  CommandResult,
  DisplayReason,
  DisplayValue,
  InputQualification,
  ResultCandidate,
  ResultCapability,
  ResultKind,
  ResultState,
} from '../domain/commandResults';

export interface CommandResultPresentation {
  readonly id: string;
  readonly state: ResultState;
  readonly kind: ResultKind;
  readonly references: readonly string[];
  readonly primary?: DisplayValue;
  readonly secondary: readonly DisplayValue[];
  readonly qualifications: readonly InputQualification[];
  readonly reason?: DisplayReason;
  readonly candidates: readonly ResultCandidate[];
  readonly capabilities: readonly ResultCapability[];
  /** Ordered, display-ready lines. No domain calculation occurs here. */
  readonly lines: readonly string[];
}

const formatDisplayValue = (value: DisplayValue): string => (
  value.unit ? `${value.value} ${value.unit}` : value.value
);

const formatQualification = (qualification: InputQualification): string => {
  const parts = [`${qualification.input}: ${qualification.origin}`];
  if (qualification.qualification) parts.push(qualification.qualification);
  if (qualification.assumption) parts.push(qualification.assumption);
  return parts.join(' · ');
};

const formatAge = (ageSeconds: number | null | undefined): string | null => {
  if (ageSeconds === null || ageSeconds === undefined || !Number.isFinite(ageSeconds)) return null;
  return `${Number.isInteger(ageSeconds) ? ageSeconds.toFixed(0) : ageSeconds.toFixed(1)} S`;
};

const reasonLines = (reason: DisplayReason | undefined): string[] => {
  if (!reason) return [];
  const lines = [`REASON CODE: ${reason.code}`, `REASON: ${reason.message}`];
  if (reason.remedy) lines.push(`REMEDY: ${reason.remedy}`);
  const rawCodes = reason.rawCodes && reason.rawCodes.length > 0
    ? reason.rawCodes
    : reason.rawCode
      ? [reason.rawCode]
      : [];
  if (rawCodes.length > 0) lines.push(`RAW CODE: ${rawCodes.join(', ')}`);
  return lines;
};

const candidateLines = (candidates: readonly ResultCandidate[] | undefined): string[] => (
  candidates?.map(candidate => `CANDIDATE: ${candidate.label} (${candidate.id})`) ?? []
);

/**
 * Convert one already-calculated result envelope into display lines.
 *
 * This function intentionally accepts only the envelope. It does not have
 * access to entities, clocks, units, or calculation inputs and therefore
 * cannot silently recalculate a value in a component.
 */
export const presentCommandResult = (result: CommandResult): CommandResultPresentation => {
  const primary = result.state === 'AVAILABLE' || result.state === 'PARTIAL'
    ? result.primary
    : undefined;
  const secondary = result.state === 'AVAILABLE' || result.state === 'PARTIAL'
    ? result.secondary
    : [];
  const candidates = result.state === 'AMBIGUOUS' ? result.candidates : [];
  const lines: string[] = [
    `STATE: ${result.state}`,
    `KIND: ${result.kind}`,
  ];

  if (result.references.length > 0) lines.push(`REFERENCES: ${result.references.join(', ')}`);
  if (primary) lines.push(`${primary.label}: ${formatDisplayValue(primary)}`);
  secondary.forEach(value => lines.push(`${value.label}: ${formatDisplayValue(value)}`));
  result.qualifications.forEach(qualification => {
    lines.push(formatQualification(qualification));
    if (qualification.objectId) lines.push(`${qualification.input} OBJECT: ${qualification.objectId}`);
    if (qualification.source) lines.push(`${qualification.input} SOURCE: ${qualification.source}`);
    const age = formatAge(qualification.ageSeconds);
    if (age) lines.push(`${qualification.input} AGE: ${age}`);
    if (qualification.status) lines.push(`${qualification.input} STATUS: ${qualification.status}`);
    if (qualification.timestampMs !== undefined && qualification.timestampMs !== null) {
      lines.push(`${qualification.input} TIMESTAMP: ${qualification.timestampMs}`);
    }
  });
  result.details?.forEach(value => lines.push(`${value.label}: ${formatDisplayValue(value)}`));
  lines.push(...reasonLines('reason' in result ? result.reason : undefined));
  lines.push(...candidateLines(candidates));
  if (result.capabilities.length > 0) lines.push(`CAPABILITIES: ${result.capabilities.join(', ')}`);

  return Object.freeze({
    id: result.id,
    state: result.state,
    kind: result.kind,
    references: Object.freeze([...result.references]),
    ...(primary ? { primary } : {}),
    secondary: Object.freeze([...secondary]),
    qualifications: Object.freeze([...result.qualifications]),
    ...('reason' in result ? { reason: result.reason } : {}),
    candidates: Object.freeze([...candidates]),
    capabilities: Object.freeze([...result.capabilities]),
    lines: Object.freeze(lines),
  });
};

/** Alias useful to non-React callers that only need ordered text. */
export const formatCommandResult = (result: CommandResult): readonly string[] => (
  presentCommandResult(result).lines
);
