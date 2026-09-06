import { convertTacticalQuantity, type TacticalQuantity } from './tacticalUnits';

export type TimeDistanceSpeedVariable = 'TIME' | 'DISTANCE' | 'SPEED';

export interface TimeDistanceSpeedInput {
  solveFor: TimeDistanceSpeedVariable;
  distance?: TacticalQuantity;
  speed?: TacticalQuantity;
  time?: TacticalQuantity;
}

export interface TimeDistanceSpeedResult {
  solveFor: TimeDistanceSpeedVariable;
  distanceNauticalMiles: number;
  speedKnots: number;
  timeSeconds: number;
}

export interface FormattedTimeDistanceSpeed {
  distance: string;
  speed: string;
  time: string;
}

const requireQuantity = (
  quantity: TacticalQuantity | undefined,
  expectedDimension: TacticalQuantity['dimension'],
  name: string,
): TacticalQuantity => {
  if (!quantity) throw new Error(`${name} is required`);
  if (!Number.isFinite(quantity.value) || quantity.value <= 0) {
    throw new Error(`${name} must be a positive finite value`);
  }
  if (quantity.dimension !== expectedDimension) {
    throw new Error(`${name} must use ${expectedDimension} units`);
  }
  return quantity;
};

const normalizedDistance = (quantity: TacticalQuantity): number =>
  convertTacticalQuantity(quantity, 'NM').value;

const normalizedSpeed = (quantity: TacticalQuantity): number =>
  convertTacticalQuantity(quantity, 'KT').value;

const normalizedTime = (quantity: TacticalQuantity): number =>
  convertTacticalQuantity(quantity, 'S').value;

export const solveTimeDistanceSpeed = (
  input: TimeDistanceSpeedInput,
): TimeDistanceSpeedResult => {
  if (input.solveFor === 'TIME') {
    const distanceNauticalMiles = normalizedDistance(requireQuantity(input.distance, 'DISTANCE', 'Distance'));
    const speedKnots = normalizedSpeed(requireQuantity(input.speed, 'SPEED', 'Speed'));
    return {
      solveFor: input.solveFor,
      distanceNauticalMiles,
      speedKnots,
      timeSeconds: distanceNauticalMiles / speedKnots * 3600,
    };
  }

  if (input.solveFor === 'DISTANCE') {
    const timeSeconds = normalizedTime(requireQuantity(input.time, 'TIME', 'Time'));
    const speedKnots = normalizedSpeed(requireQuantity(input.speed, 'SPEED', 'Speed'));
    return {
      solveFor: input.solveFor,
      distanceNauticalMiles: speedKnots * timeSeconds / 3600,
      speedKnots,
      timeSeconds,
    };
  }

  const distanceNauticalMiles = normalizedDistance(requireQuantity(input.distance, 'DISTANCE', 'Distance'));
  const timeSeconds = normalizedTime(requireQuantity(input.time, 'TIME', 'Time'));
  return {
    solveFor: input.solveFor,
    distanceNauticalMiles,
    speedKnots: distanceNauticalMiles * 3600 / timeSeconds,
    timeSeconds,
  };
};

const formatDuration = (seconds: number): string => {
  const roundedSeconds = Math.round(seconds);
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const remainingSeconds = roundedSeconds % 60;
  if (hours > 0) return `${hours} h ${minutes} min ${remainingSeconds} s`;
  return `${minutes} min ${remainingSeconds} s`;
};

export const formatTimeDistanceSpeed = (
  result: TimeDistanceSpeedResult,
): FormattedTimeDistanceSpeed => ({
  distance: `${result.distanceNauticalMiles.toFixed(1)} NM`,
  speed: `${result.speedKnots.toFixed(1)} KT`,
  time: formatDuration(result.timeSeconds),
});
