const FEET_PER_NAUTICAL_MILE = 6076.11548556;

export type VerticalCalculationUnavailableReason =
  | 'GROUND_SPEED_ZERO'
  | 'DISTANCE_ZERO'
  | 'VERTICAL_SPEED_ZERO'
  | 'ALTITUDE_CHANGE_ZERO'
  | 'SIGN_INCONSISTENT'
  | 'INVALID_INPUT';

export type VerticalCalculationResult<T> =
  | ({ status: 'AVAILABLE' } & T)
  | { status: 'UNAVAILABLE'; reason: VerticalCalculationUnavailableReason; formula: string };

export interface GradientInput {
  verticalSpeedFpm: number;
  groundSpeedKnots: number;
}

export interface GradientAvailable {
  feetPerNauticalMile: number;
  percent: number;
  angleDegrees: number;
  formula: string;
}

export interface VerticalSpeedRequiredInput {
  altitudeChangeFeet: number;
  distanceNauticalMiles: number;
  groundSpeedKnots: number;
}

export interface VerticalSpeedRequiredAvailable {
  altitudeChangeFeet: number;
  timeMinutes: number;
  verticalSpeedFpm: number;
  formula: string;
}

export interface TopOfDescentInput {
  fromAltitudeFeet: number;
  toAltitudeFeet: number;
  verticalSpeedFpm: number;
  groundSpeedKnots: number;
}

export interface TopOfDescentAvailable {
  altitudeChangeFeet: number;
  timeMinutes: number;
  distanceNauticalMiles: number;
  formula: string;
}

const finite = (value: number): boolean => Number.isFinite(value);

export const calculateGradient = (
  input: GradientInput,
): VerticalCalculationResult<GradientAvailable> => {
  if (!finite(input.verticalSpeedFpm) || !finite(input.groundSpeedKnots) || input.groundSpeedKnots <= 0) {
    return { status: 'UNAVAILABLE', reason: 'GROUND_SPEED_ZERO', formula: 'VS / (GS / 60)' };
  }
  const feetPerNauticalMile = input.verticalSpeedFpm * 60 / input.groundSpeedKnots;
  const percent = feetPerNauticalMile / FEET_PER_NAUTICAL_MILE * 100;
  const angleDegrees = Math.atan(feetPerNauticalMile / FEET_PER_NAUTICAL_MILE) * 180 / Math.PI;
  return {
    status: 'AVAILABLE',
    feetPerNauticalMile,
    percent,
    angleDegrees,
    formula: 'VS / (GS / 60); ft/NM / 6076.1155 × 100; atan(ft/NM / 6076.1155)',
  };
};

export const calculateVerticalSpeedRequired = (
  input: VerticalSpeedRequiredInput,
): VerticalCalculationResult<VerticalSpeedRequiredAvailable> => {
  if (!finite(input.altitudeChangeFeet) || !finite(input.distanceNauticalMiles) || !finite(input.groundSpeedKnots)) {
    return { status: 'UNAVAILABLE', reason: 'INVALID_INPUT', formula: 'time = distance / GS; VS = altitude change / time' };
  }
  if (input.distanceNauticalMiles <= 0) {
    return { status: 'UNAVAILABLE', reason: 'DISTANCE_ZERO', formula: 'time = distance / GS; VS = altitude change / time' };
  }
  if (input.groundSpeedKnots <= 0) {
    return { status: 'UNAVAILABLE', reason: 'GROUND_SPEED_ZERO', formula: 'time = distance / GS; VS = altitude change / time' };
  }
  const timeMinutes = input.distanceNauticalMiles / input.groundSpeedKnots * 60;
  return {
    status: 'AVAILABLE',
    altitudeChangeFeet: input.altitudeChangeFeet,
    timeMinutes,
    verticalSpeedFpm: input.altitudeChangeFeet / timeMinutes,
    formula: 'time = distance / GS; VS = altitude change / time',
  };
};

export const calculateTopOfDescent = (
  input: TopOfDescentInput,
): VerticalCalculationResult<TopOfDescentAvailable> => {
  if (![input.fromAltitudeFeet, input.toAltitudeFeet, input.verticalSpeedFpm, input.groundSpeedKnots].every(finite)) {
    return { status: 'UNAVAILABLE', reason: 'INVALID_INPUT', formula: 'time = |altitude change / VS|; TOD distance = GS × time / 60' };
  }
  const altitudeChangeFeet = input.toAltitudeFeet - input.fromAltitudeFeet;
  if (altitudeChangeFeet === 0) {
    return { status: 'UNAVAILABLE', reason: 'ALTITUDE_CHANGE_ZERO', formula: 'time = |altitude change / VS|; TOD distance = GS × time / 60' };
  }
  if (input.verticalSpeedFpm === 0) {
    return { status: 'UNAVAILABLE', reason: 'VERTICAL_SPEED_ZERO', formula: 'time = |altitude change / VS|; TOD distance = GS × time / 60' };
  }
  if (input.groundSpeedKnots <= 0) {
    return { status: 'UNAVAILABLE', reason: 'GROUND_SPEED_ZERO', formula: 'time = |altitude change / VS|; TOD distance = GS × time / 60' };
  }
  if ((altitudeChangeFeet < 0 && input.verticalSpeedFpm >= 0)
    || (altitudeChangeFeet > 0 && input.verticalSpeedFpm <= 0)) {
    return { status: 'UNAVAILABLE', reason: 'SIGN_INCONSISTENT', formula: 'time = |altitude change / VS|; TOD distance = GS × time / 60' };
  }
  const timeMinutes = Math.abs(altitudeChangeFeet / input.verticalSpeedFpm);
  return {
    status: 'AVAILABLE',
    altitudeChangeFeet,
    timeMinutes,
    distanceNauticalMiles: input.groundSpeedKnots * timeMinutes / 60,
    formula: 'time = |altitude change / VS|; TOD distance = GS × time / 60',
  };
};
