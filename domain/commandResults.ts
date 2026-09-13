export const RESULT_STATES = [
  'AVAILABLE',
  'PARTIAL',
  'INCOMPLETE',
  'AMBIGUOUS',
  'UNAVAILABLE',
] as const;

export type ResultState = typeof RESULT_STATES[number];
export type ResultStatus = ResultState;
export type CommandResultState = ResultState;

export const RESULT_KINDS = [
  'READ_ONLY',
  'MAP_PREVIEW',
  'LOCAL_ACTION',
  'COMPLETION',
] as const;

export type ResultKind = typeof RESULT_KINDS[number];
export type CommandResultKind = ResultKind;

export const RESULT_CAPABILITIES = [
  'COPY',
  'DETAILS',
  'MAP_PREVIEW',
  'CONFIRM',
] as const;

export type ResultCapability = typeof RESULT_CAPABILITIES[number];
export type CommandResultCapability = ResultCapability;

export const RESULT_INPUTS = ['POSITION', 'SPEED', 'VECTOR', 'CLOCK'] as const;
export type ResultInput = typeof RESULT_INPUTS[number];
/** Contract-friendly alias for callers that use the shorter vocabulary. */
export type InputKind = ResultInput;

export const RESULT_INPUT_ORIGINS = [
  'SCENARIO',
  'GPS',
  'USER_INPUT',
  'RETAINED_FIX',
] as const;

export type ResultInputOrigin = typeof RESULT_INPUT_ORIGINS[number];
/** Contract-friendly alias for the provenance origin type. */
export type InputOrigin = ResultInputOrigin;

export type InputQualificationStatus =
  | 'AVAILABLE'
  | 'MISSING'
  | 'STALE'
  | 'NOT_APPLICABLE'
  | 'UNKNOWN';

export interface InputQualification {
  readonly input: ResultInput;
  readonly origin: ResultInputOrigin;
  readonly objectId?: string;
  readonly ageSeconds?: number | null;
  readonly timestampMs?: number | null;
  readonly source?: string;
  readonly qualification?: string;
  readonly status?: InputQualificationStatus;
  readonly assumption?: string;
}

export interface DisplayValue {
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
}

export interface DisplayReason {
  /** Stable, user-facing reason code. */
  readonly code: string;
  /** Short explanation suitable for the primary result view. */
  readonly message: string;
  /** Optional next step that can resolve the result. */
  readonly remedy?: string;
  /** Original domain/registry code retained for details and diagnostics. */
  readonly rawCode?: string;
  /** Original codes when more than one input contributed to the reason. */
  readonly rawCodes?: readonly string[];
}

export interface ResultCandidate {
  readonly id: string;
  readonly label: string;
  readonly type?: string;
  readonly reference?: string;
}

export interface CommandResultBase {
  readonly id: string;
  readonly kind: ResultKind;
  readonly references: readonly string[];
  readonly qualifications: readonly InputQualification[];
  readonly capabilities: readonly ResultCapability[];
  /** Optional structured details, including raw technical codes. */
  readonly details?: readonly DisplayValue[];
}

export interface AvailableCommandResult extends CommandResultBase {
  readonly state: 'AVAILABLE';
  readonly primary: DisplayValue;
  readonly secondary: readonly DisplayValue[];
  readonly reason?: undefined;
  readonly candidates?: undefined;
}

export interface PartialCommandResult extends CommandResultBase {
  readonly state: 'PARTIAL';
  readonly primary: DisplayValue;
  readonly secondary: readonly DisplayValue[];
  readonly reason: DisplayReason;
  readonly candidates?: undefined;
}

export interface IncompleteCommandResult extends CommandResultBase {
  readonly state: 'INCOMPLETE';
  readonly reason: DisplayReason;
  readonly primary?: undefined;
  readonly secondary?: undefined;
  readonly candidates?: undefined;
}

export interface AmbiguousCommandResult extends CommandResultBase {
  readonly state: 'AMBIGUOUS';
  readonly candidates: readonly ResultCandidate[];
  readonly reason: DisplayReason;
  readonly primary?: undefined;
  readonly secondary?: undefined;
}

export interface UnavailableCommandResult extends CommandResultBase {
  readonly state: 'UNAVAILABLE';
  readonly reason: DisplayReason;
  readonly primary?: undefined;
  readonly secondary?: undefined;
  readonly candidates?: undefined;
}

export type CommandResult =
  | AvailableCommandResult
  | PartialCommandResult
  | IncompleteCommandResult
  | AmbiguousCommandResult
  | UnavailableCommandResult;

interface CommandResultCommonInput {
  readonly id: string;
  readonly kind: ResultKind;
  readonly references?: readonly string[];
  readonly qualifications?: readonly InputQualification[];
  readonly capabilities?: readonly ResultCapability[];
  readonly details?: readonly DisplayValue[];
}

export interface AvailableCommandResultInput extends CommandResultCommonInput {
  readonly state?: 'AVAILABLE';
  readonly primary: DisplayValue;
  readonly secondary?: readonly DisplayValue[];
}

export interface PartialCommandResultInput extends CommandResultCommonInput {
  readonly state?: 'PARTIAL';
  readonly primary: DisplayValue;
  readonly secondary?: readonly DisplayValue[];
  readonly reason: DisplayReason;
}

export interface IncompleteCommandResultInput extends CommandResultCommonInput {
  readonly state: 'INCOMPLETE';
  readonly reason: DisplayReason;
}

export interface AmbiguousCommandResultInput extends CommandResultCommonInput {
  readonly state: 'AMBIGUOUS';
  readonly candidates: readonly ResultCandidate[];
  readonly reason: DisplayReason;
}

export interface UnavailableCommandResultInput extends CommandResultCommonInput {
  readonly state: 'UNAVAILABLE';
  readonly reason: DisplayReason;
}

export type CommandResultInput =
  | AvailableCommandResultInput
  | PartialCommandResultInput
  | IncompleteCommandResultInput
  | AmbiguousCommandResultInput
  | UnavailableCommandResultInput;

const copyDisplayValue = (value: DisplayValue): DisplayValue => ({
  label: value.label,
  value: value.value,
  ...(value.unit === undefined ? {} : { unit: value.unit }),
});

const copyQualification = (qualification: InputQualification): InputQualification => ({
  input: qualification.input,
  origin: qualification.origin,
  ...(qualification.objectId === undefined ? {} : { objectId: qualification.objectId }),
  ...(qualification.ageSeconds === undefined ? {} : { ageSeconds: qualification.ageSeconds }),
  ...(qualification.timestampMs === undefined ? {} : { timestampMs: qualification.timestampMs }),
  ...(qualification.source === undefined ? {} : { source: qualification.source }),
  ...(qualification.qualification === undefined ? {} : { qualification: qualification.qualification }),
  ...(qualification.status === undefined ? {} : { status: qualification.status }),
  ...(qualification.assumption === undefined ? {} : { assumption: qualification.assumption }),
});

const copyReason = (reason: DisplayReason): DisplayReason => ({
  code: reason.code,
  message: reason.message,
  ...(reason.remedy === undefined ? {} : { remedy: reason.remedy }),
  ...(reason.rawCode === undefined ? {} : { rawCode: reason.rawCode }),
  ...(reason.rawCodes === undefined ? {} : { rawCodes: [...reason.rawCodes] }),
});

const copyCandidate = (candidate: ResultCandidate): ResultCandidate => ({
  id: candidate.id,
  label: candidate.label,
  ...(candidate.type === undefined ? {} : { type: candidate.type }),
  ...(candidate.reference === undefined ? {} : { reference: candidate.reference }),
});

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
};

const copyBase = (input: CommandResultCommonInput): CommandResultBase => ({
  id: input.id,
  kind: input.kind,
  references: [...(input.references ?? [])],
  qualifications: (input.qualifications ?? []).map(copyQualification),
  capabilities: [...(input.capabilities ?? [])],
  ...(input.details === undefined ? {} : { details: input.details.map(copyDisplayValue) }),
});

const appendReasonDetail = (
  details: readonly DisplayValue[] | undefined,
  reason: DisplayReason,
): readonly DisplayValue[] | undefined => {
  if (!reason.rawCode) return details;
  if (details?.some(detail => detail.label === 'TECHNICAL REASON' && detail.value === reason.rawCode)) {
    return details;
  }
  return [...(details ?? []), { label: 'TECHNICAL REASON', value: reason.rawCode }];
};

export const displayValue = (label: string, value: string, unit?: string): DisplayValue => deepFreeze({
  label,
  value,
  ...(unit === undefined ? {} : { unit }),
});

export const createDisplayValue = displayValue;

export const displayReason = (
  code: string,
  message: string,
  remedy?: string,
  rawCode?: string,
): DisplayReason => deepFreeze({
  code,
  message,
  ...(remedy === undefined ? {} : { remedy }),
  ...(rawCode === undefined ? {} : { rawCode }),
  ...(rawCode === undefined ? {} : { rawCodes: [rawCode] }),
});

export const createDisplayReason = displayReason;

export const freezeCommandResult = (result: CommandResult): CommandResult => {
  const base = copyBase(result);
  const reasonForDetails = result.state === 'AVAILABLE' ? undefined : result.reason;
  const detailsWithReason = reasonForDetails
    ? appendReasonDetail(base.details, reasonForDetails)
    : base.details;
  const normalizedBase = detailsWithReason === base.details
    ? base
    : { ...base, details: detailsWithReason };
  const copy: CommandResult = result.state === 'AVAILABLE'
    ? {
      ...normalizedBase,
      state: 'AVAILABLE',
      primary: copyDisplayValue(result.primary),
      secondary: result.secondary.map(copyDisplayValue),
    }
    : result.state === 'PARTIAL'
      ? {
        ...normalizedBase,
        state: 'PARTIAL',
        primary: copyDisplayValue(result.primary),
        secondary: result.secondary.map(copyDisplayValue),
        reason: copyReason(result.reason),
      }
      : result.state === 'AMBIGUOUS'
        ? {
          ...normalizedBase,
          state: 'AMBIGUOUS',
          candidates: result.candidates.map(copyCandidate),
          reason: copyReason(result.reason),
        }
        : {
          ...normalizedBase,
          state: result.state,
          reason: copyReason(result.reason),
        };

  return deepFreeze(copy);
};

export const createCommandResult = (input: CommandResultInput): CommandResult => {
  if (input.state === 'INCOMPLETE' || input.state === 'AMBIGUOUS' || input.state === 'UNAVAILABLE') {
    const base = copyBase(input);
    const reason = copyReason(input.reason);
    return freezeCommandResult({
      ...base,
      ...(appendReasonDetail(base.details, reason) === undefined
        ? {}
        : { details: appendReasonDetail(base.details, reason) }),
      state: input.state,
      ...(input.state === 'AMBIGUOUS' ? {
        candidates: input.candidates.map(copyCandidate),
      } : {}),
      reason,
    } as CommandResult);
  }

  const base = copyBase(input);
  const reason = input.state === 'PARTIAL' ? copyReason(input.reason) : undefined;
  return freezeCommandResult({
    ...base,
    ...(reason && appendReasonDetail(base.details, reason) !== undefined
      ? { details: appendReasonDetail(base.details, reason) }
      : {}),
    state: input.state ?? 'AVAILABLE',
    primary: copyDisplayValue(input.primary),
    secondary: (input.secondary ?? []).map(copyDisplayValue),
    ...(reason ? { reason } : {}),
  } as CommandResult);
};

export const createAvailableCommandResult = (
  input: Omit<AvailableCommandResultInput, 'state'>,
): AvailableCommandResult => createCommandResult({ ...input, state: 'AVAILABLE' }) as AvailableCommandResult;

export const createPartialCommandResult = (
  input: Omit<PartialCommandResultInput, 'state'>,
): PartialCommandResult => createCommandResult({ ...input, state: 'PARTIAL' }) as PartialCommandResult;

export const createIncompleteCommandResult = (
  input: Omit<IncompleteCommandResultInput, 'state'>,
): IncompleteCommandResult => createCommandResult({ ...input, state: 'INCOMPLETE' }) as IncompleteCommandResult;

export const createAmbiguousCommandResult = (
  input: Omit<AmbiguousCommandResultInput, 'state'>,
): AmbiguousCommandResult => createCommandResult({ ...input, state: 'AMBIGUOUS' }) as AmbiguousCommandResult;

export const createUnavailableCommandResult = (
  input: Omit<UnavailableCommandResultInput, 'state'>,
): UnavailableCommandResult => createCommandResult({ ...input, state: 'UNAVAILABLE' }) as UnavailableCommandResult;

export const createAvailableResult = createAvailableCommandResult;
export const createPartialResult = createPartialCommandResult;
export const createIncompleteResult = createIncompleteCommandResult;
export const createAmbiguousResult = createAmbiguousCommandResult;
export const createUnavailableResult = createUnavailableCommandResult;

interface ReasonTemplate {
  readonly code: string;
  readonly message: string;
  readonly remedy?: string;
}

const REASON_TEMPLATES: Record<string, ReasonTemplate> = {
  SPEED_UNAVAILABLE: {
    code: 'SPEED_MISSING',
    message: 'Ground speed is not available.',
    remedy: 'Provide a qualified ground speed or enter an explicit hypothesis.',
  },
  MISSING_GROUND_SPEED: {
    code: 'SPEED_MISSING',
    message: 'Ground speed is not available.',
    remedy: 'Provide a qualified ground speed or enter an explicit hypothesis.',
  },
  INVALID_GROUND_SPEED: {
    code: 'SPEED_INVALID',
    message: 'Ground speed is invalid.',
    remedy: 'Provide a finite non-negative ground speed.',
  },
  SPEED_STALE: {
    code: 'GROUND_SPEED_STALE',
    message: 'Ground speed is stale.',
    remedy: 'Refresh the speed source or enter an explicit hypothesis.',
  },
  SCENARIO_TIME_UNAVAILABLE: {
    code: 'CLOCK_MISSING',
    message: 'The scenario clock is unavailable; elapsed time remains available.',
    remedy: 'Provide a qualified scenario time to calculate an absolute ETA.',
  },
  MISSING_GROUND_TRACK: {
    code: 'VECTOR_MISSING',
    message: 'Ground track is not available.',
    remedy: 'Provide a qualified ground-track vector.',
  },
  INVALID_GROUND_TRACK: {
    code: 'VECTOR_INVALID',
    message: 'Ground track is invalid.',
    remedy: 'Provide a finite track from 0° through 359.9°.',
  },
  UNKNOWN_FRESHNESS: {
    code: 'FRESHNESS_UNKNOWN',
    message: 'Data freshness is unknown.',
    remedy: 'Refresh or qualify the source before using this calculation.',
  },
  STALE_TRACK: {
    code: 'DATA_STALE',
    message: 'The source track is stale.',
    remedy: 'Refresh the track before using this calculation.',
  },
  DISTANCE_HORIZON_WITHOUT_MOTION: {
    code: 'MOTION_ZERO',
    message: 'A distance horizon cannot be projected without motion.',
    remedy: 'Provide a positive qualified ground speed.',
  },
  INVALID_HORIZON: {
    code: 'HORIZON_INVALID',
    message: 'The projection horizon is invalid.',
    remedy: 'Provide a positive time or distance horizon with a supported unit.',
  },
  STALE_POSITION: {
    code: 'POSITION_STALE',
    message: 'The source position is stale.',
    remedy: 'Refresh the position before using this calculation.',
  },
  INVALID_POSITION: {
    code: 'POSITION_INVALID',
    message: 'The source position is invalid.',
    remedy: 'Use a finite latitude and longitude within range.',
  },
  INVALID_REFERENCE_POSITION: {
    code: 'POSITION_INVALID',
    message: 'The reference position is invalid.',
    remedy: 'Choose a scenario reference with a valid position.',
  },
  'AMBIGUOUS OR UNKNOWN REFERENCE': {
    code: 'REFERENCE_UNRESOLVED',
    message: 'The reference is ambiguous or unknown.',
    remedy: 'Choose one listed scenario reference.',
  },
  AMBIGUOUS_REFERENCE: {
    code: 'REFERENCE_AMBIGUOUS',
    message: 'The reference matches multiple scenario entities.',
    remedy: 'Choose one listed candidate.',
  },
  UNKNOWN_REFERENCE: {
    code: 'REFERENCE_UNKNOWN',
    message: 'No matching scenario reference was found.',
    remedy: 'Check the reference or choose a listed candidate.',
  },
  FUZZY_SUGGESTION: {
    code: 'REFERENCE_CONFIRMATION_REQUIRED',
    message: 'The reference is only a suggestion.',
    remedy: 'Choose the suggested reference explicitly.',
  },
  QUALITY_NOT_APPLICABLE: {
    code: 'QUALITY_NOT_APPLICABLE',
    message: 'Quality is not applicable to this fixed scenario point.',
    remedy: 'Use track quality for an observed track.',
  },
  WAYPOINT_QUALITY_NON_APPLICABLE: {
    code: 'QUALITY_NOT_APPLICABLE',
    message: 'Quality is not applicable to this fixed scenario point.',
    remedy: 'Use track quality for an observed track.',
  },
  QUALITY_UNKNOWN: {
    code: 'QUALITY_UNKNOWN',
    message: 'Track quality is unknown.',
    remedy: 'Qualify the source before relying on track quality.',
  },
  UNKNOWN_AGE: {
    code: 'AGE_UNKNOWN',
    message: 'Track age is unknown.',
    remedy: 'Provide a source timestamp or refresh the track.',
  },
  IDENTICAL_POSITIONS: {
    code: 'POSITION_IDENTICAL',
    message: 'The two references have the same position; bearing is undefined.',
    remedy: 'Choose references with distinct positions for a bearing.',
  },
  INCOMPLETE: {
    code: 'INPUT_INCOMPLETE',
    message: 'The command needs more input.',
    remedy: 'Complete the command parameters.',
  },
  INVALID_INPUT: {
    code: 'INPUT_INVALID',
    message: 'The supplied input is invalid.',
    remedy: 'Check the command parameters and units.',
  },
};

/** Translate a technical registry/domain reason without discarding its raw code. */
export const mapCommandReason = (rawCode: string): DisplayReason => {
  const raw = rawCode.trim();
  const template = REASON_TEMPLATES[raw.toUpperCase()] ?? {
    code: 'RESULT_UNAVAILABLE',
    message: 'This result is unavailable for the supplied inputs.',
    remedy: 'Check the inputs and source qualifications.',
  };
  return displayReason(template.code, template.message, template.remedy, raw || undefined);
};

export const toDisplayReason = mapCommandReason;

export const isCommandResult = (value: unknown): value is CommandResult => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CommandResult>;
  return typeof candidate.id === 'string'
    && typeof candidate.kind === 'string'
    && typeof candidate.state === 'string'
    && Array.isArray(candidate.references)
    && Array.isArray(candidate.qualifications)
    && Array.isArray(candidate.capabilities);
};
