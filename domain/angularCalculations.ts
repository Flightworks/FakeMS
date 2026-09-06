export type AngularInputKind = 'HEADING' | 'TRACK' | 'TRUE_BEARING' | 'RELATIVE_BEARING';
export type AngularCalculationStatus = 'AVAILABLE' | 'UNAVAILABLE';
export type AngularDirection = 'LEFT' | 'RIGHT' | 'ON_AXIS';
export type AngularOperation = 'RECIPROCAL' | 'DELTA' | 'RELATIVE';

interface AngularCalculationBase {
  operation: AngularOperation;
  inputKind: AngularInputKind;
  outputKind: AngularInputKind;
  status: AngularCalculationStatus;
  valueDegrees: number | null;
  source: string;
  reason?: 'INVALID_ANGLE';
}

export interface ReciprocalResult extends AngularCalculationBase {
  operation: 'RECIPROCAL';
  inputKind: Exclude<AngularInputKind, 'RELATIVE_BEARING'>;
  outputKind: Exclude<AngularInputKind, 'RELATIVE_BEARING'>;
}

export interface DeltaResult extends AngularCalculationBase {
  operation: 'DELTA';
  inputKind: Exclude<AngularInputKind, 'RELATIVE_BEARING'>;
  outputKind: Exclude<AngularInputKind, 'RELATIVE_BEARING'>;
  deltaDegrees: number | null;
  signedDeltaDegrees: number | null;
  direction: AngularDirection | null;
}

export interface RelativeBearingResult extends AngularCalculationBase {
  operation: 'RELATIVE';
  inputKind: 'TRUE_BEARING';
  outputKind: 'RELATIVE_BEARING';
  referenceKind: 'HEADING' | 'TRACK';
}

export type AngularCalculationResult = ReciprocalResult | DeltaResult | RelativeBearingResult;

export const normalizeAngle = (angleDegrees: number): number | null => {
  if (!Number.isFinite(angleDegrees)) return null;
  return ((angleDegrees % 360) + 360) % 360;
};

const unavailableReason = <T extends AngularCalculationBase>(
  result: T,
): T => ({
  ...result,
  status: 'UNAVAILABLE',
  valueDegrees: null,
  reason: 'INVALID_ANGLE',
});

export const calculateReciprocal = (
  angleDegrees: number,
  inputKind: Exclude<AngularInputKind, 'RELATIVE_BEARING'> = 'HEADING',
): ReciprocalResult => {
  const normalized = normalizeAngle(angleDegrees);
  const result: ReciprocalResult = {
    operation: 'RECIPROCAL',
    inputKind,
    outputKind: inputKind,
    status: normalized === null ? 'UNAVAILABLE' : 'AVAILABLE',
    valueDegrees: normalized === null ? null : normalizeAngle(normalized + 180),
    source: `${inputKind} reciprocal`,
  };

  return normalized === null ? unavailableReason(result) : result;
};

export const calculateDelta = (
  fromDegrees: number,
  toDegrees: number,
  inputKind: Exclude<AngularInputKind, 'RELATIVE_BEARING'> = 'HEADING',
): DeltaResult => {
  const from = normalizeAngle(fromDegrees);
  const to = normalizeAngle(toDegrees);
  const base: DeltaResult = {
    operation: 'DELTA',
    inputKind,
    outputKind: inputKind,
    status: from === null || to === null ? 'UNAVAILABLE' : 'AVAILABLE',
    valueDegrees: null,
    deltaDegrees: null,
    signedDeltaDegrees: null,
    direction: null,
    source: `${inputKind} delta`,
  };

  if (from === null || to === null) return unavailableReason(base);

  const rawDelta = to - from;
  const signedDelta = rawDelta > 180
    ? rawDelta - 360
    : rawDelta < -180
      ? rawDelta + 360
      : rawDelta;
  const delta = Math.abs(signedDelta);

  return {
    ...base,
    valueDegrees: delta,
    deltaDegrees: delta,
    signedDeltaDegrees: signedDelta,
    direction: signedDelta === 0 ? 'ON_AXIS' : signedDelta > 0 ? 'RIGHT' : 'LEFT',
  };
};

export const calculateRelativeBearing = (
  trueBearingDegrees: number,
  referenceHeadingDegrees: number,
  referenceKind: 'HEADING' | 'TRACK' = 'HEADING',
): RelativeBearingResult => {
  const trueBearing = normalizeAngle(trueBearingDegrees);
  const reference = normalizeAngle(referenceHeadingDegrees);
  const base: RelativeBearingResult = {
    operation: 'RELATIVE',
    inputKind: 'TRUE_BEARING',
    outputKind: 'RELATIVE_BEARING',
    referenceKind,
    status: trueBearing === null || reference === null ? 'UNAVAILABLE' : 'AVAILABLE',
    valueDegrees: null,
    source: `TRUE_BEARING relative to ${referenceKind}`,
  };

  if (trueBearing === null || reference === null) return unavailableReason(base);

  return {
    ...base,
    valueDegrees: normalizeAngle(trueBearing - reference),
  };
};
