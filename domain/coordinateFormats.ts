import type { Position } from '../types';

export type CoordinateFormat = 'DD' | 'DDM' | 'DMS';

const isValidPosition = (position: Position): boolean => (
  Number.isFinite(position.lat)
  && Number.isFinite(position.lon)
  && position.lat >= -90
  && position.lat <= 90
  && position.lon >= -180
  && position.lon <= 180
);

const assertValidPosition = (position: Position): void => {
  if (!isValidPosition(position)) {
    throw new Error('Coordinate must contain finite latitude [-90, 90] and longitude [-180, 180]');
  }
};

const directionFor = (value: number, positive: string, negative: string): string => (
  value < 0 ? negative : positive
);

const formatDegrees = (value: number, width: number): string => value.toFixed(0).padStart(width, '0');

const roundedParts = (value: number, minuteDecimals: number): { degrees: number; minutes: number } => {
  let degrees = Math.floor(Math.abs(value));
  let minutes = Number(((Math.abs(value) - degrees) * 60).toFixed(minuteDecimals));
  const minuteLimit = 60;
  if (minutes >= minuteLimit) {
    degrees += 1;
    minutes = 0;
  }
  return { degrees, minutes };
};

const formatDdmComponent = (
  value: number,
  positive: string,
  negative: string,
  degreeWidth: number,
): string => {
  const { degrees, minutes } = roundedParts(value, 2);
  return `${directionFor(value, positive, negative)}${formatDegrees(degrees, degreeWidth)}°${minutes.toFixed(2).padStart(5, '0')}'`;
};

const formatDmsComponent = (
  value: number,
  positive: string,
  negative: string,
  degreeWidth: number,
): string => {
  let degrees = Math.floor(Math.abs(value));
  let minutes = Math.floor((Math.abs(value) - degrees) * 60);
  let seconds = Number((((Math.abs(value) - degrees) * 60 - minutes) * 60).toFixed(1));
  if (seconds >= 60) {
    minutes += 1;
    seconds = 0;
  }
  if (minutes >= 60) {
    degrees += 1;
    minutes = 0;
  }
  return `${directionFor(value, positive, negative)}${formatDegrees(degrees, degreeWidth)}°${minutes.toFixed(0).padStart(2, '0')}'${seconds.toFixed(1).padStart(4, '0')}"`;
};

const parseComponent = (value: string): { value: number; axis: 'lat' | 'lon' } => {
  const match = value.trim().match(/^([NSEW])\s*(\d+(?:\.\d+)?)(?:°\s*(\d+(?:\.\d+)?)['′])?(?:\s*(\d+(?:\.\d+)?)\s*["″])?$/u);
  if (!match) throw new Error(`Invalid hemispheric coordinate component: ${value}`);

  const direction = match[1];
  const degrees = Number(match[2]);
  const minutes = match[3] === undefined ? 0 : Number(match[3]);
  const seconds = match[4] === undefined ? 0 : Number(match[4]);
  if (!Number.isFinite(degrees) || !Number.isFinite(minutes) || !Number.isFinite(seconds)
    || minutes >= 60 || seconds >= 60) {
    throw new Error(`Invalid coordinate component: ${value}`);
  }

  const axis = direction === 'N' || direction === 'S' ? 'lat' : 'lon';
  const maxDegrees = axis === 'lat' ? 90 : 180;
  if (degrees > maxDegrees || (degrees === maxDegrees && (minutes > 0 || seconds > 0))) {
    throw new Error(`Coordinate component is outside ${axis} bounds: ${value}`);
  }

  const magnitude = degrees + minutes / 60 + seconds / 3600;
  return {
    value: direction === 'S' || direction === 'W' ? -magnitude : magnitude,
    axis,
  };
};

const parseDecimal = (input: string): Position | null => {
  const match = input.trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*[, ]\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/u);
  if (!match) return null;
  const position = { lat: Number(match[1]), lon: Number(match[2]) };
  assertValidPosition(position);
  return position;
};

export const parseCoordinate = (input: string): Position => {
  const normalized = input.trim().replace(/\s+/gu, ' ');
  if (!normalized) throw new Error('Coordinate input is empty');

  const decimal = parseDecimal(normalized);
  if (decimal) return decimal;

  const components = normalized.split(' ');
  if (components.length !== 2) throw new Error('Coordinate must contain latitude and longitude');
  const first = parseComponent(components[0]);
  const second = parseComponent(components[1]);
  if (first.axis !== 'lat' || second.axis !== 'lon') {
    throw new Error('Coordinate must list latitude before longitude');
  }
  const position = { lat: first.value, lon: second.value };
  assertValidPosition(position);
  return position;
};

export const formatCoordinate = (position: Position, format: CoordinateFormat): string => {
  assertValidPosition(position);
  if (format === 'DD') return `${position.lat.toFixed(5)}, ${position.lon.toFixed(5)}`;
  if (format === 'DDM') {
    return `${formatDdmComponent(position.lat, 'N', 'S', 2)} ${formatDdmComponent(position.lon, 'E', 'W', 3)}`;
  }
  if (format === 'DMS') {
    return `${formatDmsComponent(position.lat, 'N', 'S', 2)} ${formatDmsComponent(position.lon, 'E', 'W', 3)}`;
  }
  throw new Error(`Unsupported coordinate format: ${format}`);
};
