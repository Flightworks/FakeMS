import type {
  CommandIntentType,
  CommandParseError,
  CommandToken,
  ParsedCommand,
} from './commandLanguage';
import { createTacticalQuantity, normalizeTacticalUnit, TacticalUnitError } from './tacticalUnits';

const NON_FINITE_MARKER = '<NON_FINITE>';
const COMMAND_TOKENS = new Set([
  'PROJ',
  'PROJECTION',
  'COORD',
  'COORDINATE',
  'ETA',
  'ETE',
  'BRG',
  'RNG',
  'BRG/RNG',
  'RADAR',
  'ADSB',
  'AIS',
  'EOTS',
  'SIM',
  'SYSTEM',
  'LAYER',
  'LAYERS',
  'SEARCH',
  'NOTE',
  'CALC',
]);

const stripDiacritics = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalizeText = (value: string): string =>
  stripDiacritics(value).trim().replace(/\s+/g, ' ').toUpperCase();

const isNonFiniteLexeme = (value: string): boolean =>
  /^(?:[+-]?(?:NAN|INFINITY|INF))$/i.test(value.trim());

const safeTokenValue = (value: string): string =>
  isNonFiniteLexeme(value) ? NON_FINITE_MARKER : value;

const tokenize = (input: string): CommandToken[] => {
  const rawTokens = input.trim().match(/[^\s,/]+/g) ?? [];

  return rawTokens.map((raw, index): CommandToken => ({
    kind: index === 0 ? 'COMMAND' : 'ARGUMENT',
    raw: safeTokenValue(raw),
    normalized: normalizeText(safeTokenValue(raw)),
  }));
};

const createResult = (
  type: CommandIntentType,
  tokens: CommandToken[],
  parameters: Record<string, string | number | null>,
  warnings: string[] = [],
  errors: CommandParseError[] = [],
  assumptions: string[] = [],
): ParsedCommand => ({
  type,
  tokens,
  parameters,
  assumptions,
  warnings,
  errors,
});

const parseFiniteNumber = (token: CommandToken | undefined): number | null => {
  if (!token || token.normalized === NON_FINITE_MARKER) return null;

  const value = Number(token.normalized);
  return Number.isFinite(value) ? value : null;
};

const hasNonFiniteToken = (token: CommandToken | undefined): boolean =>
  token?.normalized === NON_FINITE_MARKER;

const nonFiniteError = (): CommandParseError => ({
  code: 'NON_FINITE_NUMBER',
  message: 'Numeric value is not finite.',
});

const parseCoordinate = (tokens: CommandToken[]): ParsedCommand => {
  const latitudeToken = tokens[1];
  const longitudeToken = tokens[2];
  const latitude = parseFiniteNumber(latitudeToken);
  const longitude = parseFiniteNumber(longitudeToken);
  const errors: CommandParseError[] = [];

  if (hasNonFiniteToken(latitudeToken) || hasNonFiniteToken(longitudeToken)) {
    errors.push(nonFiniteError());
  } else if (latitudeToken && latitude === null) {
    errors.push({ code: 'INVALID_NUMBER', message: 'Latitude must be numeric.' });
  } else if (longitudeToken && longitude === null) {
    errors.push({ code: 'INVALID_NUMBER', message: 'Longitude must be numeric.' });
  }

  const parameters: Record<string, string | number | null> = {};
  if (latitudeToken) parameters.latitude = latitude;
  if (longitudeToken) parameters.longitude = longitude;

  return createResult('COORDINATE', tokens, parameters, [], errors);
};

const PROJECTION_NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

const isProjectionNumber = (value: string | undefined): boolean => {
  if (!value) return false;
  return value === NON_FINITE_MARKER || PROJECTION_NUMBER_PATTERN.test(value);
};

const normalizeProjectionPart = (value: string): string =>
  normalizeText(safeTokenValue(value));

const splitNumericAndUnit = (
  value: string | undefined,
): { numberToken?: string; unitToken?: string } => {
  if (!value) return {};
  if (value === NON_FINITE_MARKER) return { numberToken: value };

  const match = value.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+|NAN|INFINITY|INF))(.*)$/i);
  if (!match) return { numberToken: value };

  return {
    numberToken: normalizeProjectionPart(match[1]),
    unitToken: match[2] ? normalizeProjectionPart(match[2]) : undefined,
  };
};

const parseNormalizedNumber = (value: string | undefined): number | null => {
  if (!value || value === NON_FINITE_MARKER) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isExplicitProjectionCommand = (value: string | undefined): boolean =>
  value === 'PROJ' || value === 'PROJECTION';

const looksLikeProjection = (input: string, tokens: CommandToken[]): boolean => {
  const first = tokens[0]?.normalized;
  if (isExplicitProjectionCommand(first)) return true;
  if (COMMAND_TOKENS.has(first)) return false;
  if (tokens.some(token => token.normalized === 'BRG' || token.normalized === 'RNG')) return true;

  return (input.includes('/') && tokens.some(token => isProjectionNumber(token.normalized)))
    || (tokens.length >= 3 && isProjectionNumber(tokens[1]?.normalized));
};

const resolveUnitPart = (
  parts: string[],
  index: number,
): { text: string; nextIndex: number } | null => {
  const candidate = parts[index];
  if (!candidate) return null;

  try {
    normalizeTacticalUnit(candidate);
    return { text: candidate, nextIndex: index + 1 };
  } catch {
    const combined = parts.slice(index, index + 2).join(' ');
    try {
      normalizeTacticalUnit(combined);
      return { text: combined, nextIndex: index + 2 };
    } catch {
      return { text: candidate, nextIndex: index + 1 };
    }
  }
};

const findUnlabeledBearingIndex = (parts: string[], startIndex: number): number | null => {
  for (let candidateIndex = startIndex; candidateIndex < parts.length; candidateIndex += 1) {
    if (!isProjectionNumber(parts[candidateIndex])) continue;

    const candidateRange = splitNumericAndUnit(parts[candidateIndex + 1]);
    if (!isProjectionNumber(candidateRange.numberToken)) continue;

    let nextIndex = candidateIndex + 2;
    if (!candidateRange.unitToken
      && nextIndex < parts.length
      && !isProjectionNumber(parts[nextIndex])) {
      const resolvedUnit = resolveUnitPart(parts, nextIndex);
      if (resolvedUnit) nextIndex = resolvedUnit.nextIndex;
    }

    if (nextIndex === parts.length) return candidateIndex;
  }

  return null;
};

const formatBearing = (bearing: number): string => (
  Number.isInteger(bearing)
    ? bearing.toFixed(0)
    : bearing.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
);

const parseProjection = (input: string, tokens: CommandToken[]): ParsedCommand => {
  const parts = input.trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap(part => part.split('/'))
    .map(normalizeProjectionPart)
    .filter(Boolean);
  let index = 0;
  const explicitCommand = isExplicitProjectionCommand(parts[0]);

  if (explicitCommand) index += 1;
  if (parts[index] === 'FROM') index += 1;

  const referenceParts: string[] = [];
  const bearingMarkerIndex = parts.indexOf('BRG', index);
  const referenceBoundary = bearingMarkerIndex >= 0
    ? bearingMarkerIndex
    : findUnlabeledBearingIndex(parts, index);
  while (index < parts.length
    && parts[index] !== 'BRG'
    && parts[index] !== 'RNG'
    && (referenceBoundary === null
      ? !isProjectionNumber(parts[index])
      : index < referenceBoundary)) {
    referenceParts.push(parts[index]);
    index += 1;
  }

  const reference = referenceParts.length > 0 ? referenceParts.join(' ') : 'OWNSHIP';
  const parameters: Record<string, string | number | null> = { reference };
  if (reference !== 'OWNSHIP') parameters.target = reference;

  if (parts[index] === 'BRG') index += 1;
  const bearingToken = parts[index];
  if (bearingToken) index += 1;
  if (parts[index] === 'RNG') index += 1;

  const rawRangeToken = parts[index];
  if (rawRangeToken) index += 1;
  const rangeParts = splitNumericAndUnit(rawRangeToken);
  let unitText = rangeParts.unitToken;

  if (explicitCommand && !bearingToken && !rawRangeToken) delete parameters.reference;

  if (!unitText && rangeParts.numberToken && index < parts.length) {
    const resolvedUnit = resolveUnitPart(parts, index);
    if (resolvedUnit) {
      unitText = resolvedUnit.text;
      index = resolvedUnit.nextIndex;
    }
  }

  const errors: CommandParseError[] = [];
  const warnings: string[] = [];
  const assumptions: string[] = [];
  const bearing = parseNormalizedNumber(bearingToken);
  const range = parseNormalizedNumber(rangeParts.numberToken);

  if (!bearingToken || !rawRangeToken) {
    errors.push({
      code: 'INCOMPLETE_COMMAND',
      message: 'Projection requires a reference, bearing, and range.',
    });
  }

  if (bearingToken) {
    parameters.bearing = bearing;
    if (bearingToken === NON_FINITE_MARKER) {
      errors.push(nonFiniteError());
    } else if (bearing === null) {
      errors.push({ code: 'INVALID_NUMBER', message: 'Bearing must be numeric.' });
    } else if (bearing < 0 || bearing >= 360) {
      errors.push({
        code: 'INVALID_BEARING',
        message: 'Bearing must be between 000 and 359.999 degrees.',
      });
    }
  }

  let quantity: ReturnType<typeof createTacticalQuantity> | undefined;
  if (rawRangeToken) {
    parameters.range = range;
    if (unitText) parameters.unit = unitText;

    if (rawRangeToken === NON_FINITE_MARKER || rangeParts.numberToken === NON_FINITE_MARKER) {
      errors.push(nonFiniteError());
    } else if (range === null) {
      errors.push({ code: 'INVALID_NUMBER', message: 'Range must be numeric.' });
    } else if (range <= 0) {
      errors.push({ code: 'INVALID_RANGE', message: 'Projection range must be positive.' });
    } else if (!unitText && !(input.includes('/') && !explicitCommand)) {
      errors.push({ code: 'MISSING_UNIT', message: 'Projection range requires an explicit unit.' });
    } else {
      try {
        quantity = createTacticalQuantity(range, unitText, {
          allowImplicitNauticalMile: input.includes('/') && !explicitCommand,
        });
        if (quantity.dimension !== 'DISTANCE') {
          errors.push({
            code: 'INCOMPATIBLE_UNIT',
            message: 'Projection range requires a distance unit.',
          });
        } else {
          parameters.unit = quantity.unit;
          if (quantity.assumed) assumptions.push('ASSUMED NM');
        }
      } catch (error) {
        if (error instanceof TacticalUnitError) {
          const code: CommandParseError['code'] = error.code === 'UNKNOWN_UNIT'
            ? 'UNKNOWN_UNIT'
            : 'INVALID_RANGE';
          errors.push({ code, message: error.message });
        } else {
          errors.push({ code: 'INVALID_RANGE', message: 'Projection range is invalid.' });
        }
      }
    }
  }

  if (errors.length === 0 && bearing !== null && quantity) {
    parameters.canonical = `FROM ${reference} BRG ${formatBearing(bearing)}°T RNG ${quantity.value.toFixed(1)} ${quantity.unit}`;
  }

  if (errors.length > 0) warnings.push('EXECUTION_NOT_ATTEMPTED');
  return createResult('PROJECTION', tokens, parameters, warnings, errors, assumptions);
};

const inferIntent = (tokens: CommandToken[], normalizedInput: string): CommandIntentType => {
  if (looksLikeProjection(normalizedInput, tokens)) return 'PROJECTION';

  const command = tokens[0]?.normalized ?? '';

  if (command === 'PROJ' || command === 'PROJECTION') return 'PROJECTION';
  if (command === 'COORD' || command === 'COORDINATE') return 'COORDINATE';
  if (command === 'ETA' || command === 'ETE' || command === 'BRG' || command === 'RNG' || command === 'BRG/RNG') {
    return 'MEASUREMENT';
  }
  if (COMMAND_TOKENS.has(command) && ['RADAR', 'ADSB', 'AIS', 'EOTS', 'SIM', 'SYSTEM', 'LAYER', 'LAYERS'].includes(command)) {
    return 'SYSTEM';
  }
  if (command === 'SEARCH') return 'SEARCH';
  if (command === 'NOTE') return 'NOTE';
  if (command === 'CALC' || /(?:^|\s)[+*/%=^-](?:\s|$)/.test(normalizedInput)) return 'CALCULATION';
  return 'NOTE';
};

export const parseCommand = (input: string): ParsedCommand => {
  const normalizedInput = normalizeText(input);
  const tokens = tokenize(input);

  if (tokens.length === 0) {
    return createResult('NOTE', [], { text: '' }, ['EMPTY_INPUT']);
  }

  const type = inferIntent(tokens, normalizedInput);
  if (type === 'PROJECTION') return parseProjection(input, tokens);
  if (type === 'COORDINATE') return parseCoordinate(tokens);

  if (type === 'SYSTEM') {
    return createResult('SYSTEM', tokens, { system: tokens[1]?.normalized ?? tokens[0].normalized });
  }

  if (type === 'MEASUREMENT') {
    return createResult('MEASUREMENT', tokens, {
      command: tokens[0].normalized,
      query: tokens.slice(1).map(token => token.normalized).join(' '),
    });
  }

  if (type === 'SEARCH') {
    return createResult('SEARCH', tokens, {
      query: tokens.slice(1).map(token => token.normalized).join(' '),
    });
  }

  if (type === 'CALCULATION') {
    const expression = tokens.slice(tokens[0].normalized === 'CALC' ? 1 : 0)
      .map(token => token.normalized)
      .join(' ');
    const errors = tokens.some(token => token.normalized === NON_FINITE_MARKER)
      ? [nonFiniteError()]
      : [];
    return createResult('CALCULATION', tokens, { expression }, [], errors);
  }

  return createResult('NOTE', tokens, {
    text: tokens.map(token => token.normalized).join(' '),
  });
};
