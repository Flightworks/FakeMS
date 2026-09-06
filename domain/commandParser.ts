import type {
  CommandIntentType,
  CommandParameter,
  CommandParseError,
  CommandToken,
  ParsedCommand,
} from './commandLanguage';
import {
  createTacticalQuantity,
  convertTacticalQuantity,
  normalizeTacticalUnit,
  TacticalUnitError,
  type TacticalQuantity,
} from './tacticalUnits';
import { parseCoordinate as parseCoordinateValue, type CoordinateFormat } from './coordinateFormats';
import { MIN_GRID_STEP_MINUTES, MAX_GRID_STEP_MINUTES } from './grid';
import { MIN_SIMULATION_SPEED, MAX_SIMULATION_SPEED } from '../simulation/clock';

const NON_FINITE_MARKER = '<NON_FINITE>';
const COMMAND_TOKENS = new Set([
  'PROJ',
  'PROJECTION',
  'INT',
  'COORD',
  'COORDINATE',
  'COPY',
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
  'PREDICT',
  'NEAREST',
  'NOTE',
  'CALC',
  'RECIP',
  'DELTA',
  'REL',
  'CLOSURE',
  'CPA',
  'INFO',
  'AGE',
  'QUALITY',
  'STALE',
  'TIMER',
  'TIMERS',
  'CONVERT',
  'PIN',
  'TEMPLATE',
  'FAVORITES',
  'UNPIN',
  'WITHIN',
  'GRAD',
  'VSREQ',
  'TOD',
  'DECLUTTER',
  'LEGEND',
  'GRID',
  'ZONE',
  'TIME',
  'DIST',
  'GS',
  'ROUTE',
  'LEG',
  'NEXT',
  'SET',
  'BULL',
  'CLEAR',
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
  parameters: Record<string, CommandParameter>,
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
const COMPACT_PROJECTION_SEPARATOR_PATTERN = /(?:^|\s)[+-]?(?:\d+(?:\.\d*)?|\.\d+|NAN|INFINITY|INF)\s*\/\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+|NAN|INFINITY|INF)/i;

const isProjectionNumber = (value: string | undefined): boolean => {
  if (!value) return false;
  return value === NON_FINITE_MARKER || PROJECTION_NUMBER_PATTERN.test(value);
};

const hasCompactProjectionSeparator = (input: string): boolean =>
  COMPACT_PROJECTION_SEPARATOR_PATTERN.test(input.trim());

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
  const containsSlash = input.includes('/');
  const hasValidCompactSeparator = hasCompactProjectionSeparator(input);

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

  if (containsSlash && rawRangeToken && !hasValidCompactSeparator) {
    errors.push({
      code: 'INVALID_SYNTAX',
      message: 'Projection slash must separate the bearing and range.',
    });
  }

  if (index < parts.length) {
    errors.push({
      code: 'UNEXPECTED_ARGUMENT',
      message: `Unexpected projection argument: ${parts.slice(index).join(' ')}`,
    });
  }

  if (!bearingToken || !rawRangeToken) {
    if (bearingToken && !rawRangeToken) {
      errors.push({
        code: 'INCOMPLETE_COMMAND',
        message: `PORTÉE MANQUANTE — exemple : ${reference} ${formatBearing(bearing ?? 180)}/5NM`,
        hint: 'Complete the range after the slash.',
      });
    } else if (!bearingToken && rawRangeToken) {
      errors.push({
        code: 'INCOMPLETE_COMMAND',
        message: `CAP MANQUANT — exemple : ${reference} 180/${rawRangeToken}`,
        hint: 'Enter a true bearing from 000 to 359.999 degrees.',
      });
    } else {
      errors.push({
        code: 'INCOMPLETE_COMMAND',
        message: `CAP ET PORTÉE MANQUANTS — exemple : ${reference} 180/5NM`,
        hint: 'Enter a bearing and a range.',
      });
    }
  }

  if (bearingToken) {
    parameters.bearing = bearing;
    if (bearingToken === NON_FINITE_MARKER) {
      errors.push(nonFiniteError());
    } else if (bearing === null) {
      errors.push({ code: 'INVALID_NUMBER', message: 'CAP INVALIDE — le cap doit être numérique.' });
    } else if (bearing < 0 || bearing >= 360) {
      errors.push({
        code: 'INVALID_BEARING',
        message: 'CAP HORS LIMITES — attendu : 000 à 359.999°',
        hint: 'Normalize the true bearing to the range [000, 360).',
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
    } else if (!unitText && !(hasValidCompactSeparator && !explicitCommand)) {
      errors.push({ code: 'MISSING_UNIT', message: 'Projection range requires an explicit unit.' });
    } else {
      try {
        quantity = createTacticalQuantity(range, unitText, {
          allowImplicitNauticalMile: hasValidCompactSeparator && !explicitCommand,
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
          errors.push({
            code,
            message: code === 'UNKNOWN_UNIT'
              ? 'UNITÉ INCONNUE — NM, KM ou M'
              : 'PORTÉE INVALIDE — attend une distance positive.',
            ...(code === 'UNKNOWN_UNIT'
              ? { hint: 'Supported projection units: NM, KM or M.' }
              : {}),
          });
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

const ETA_SPEED_NUMBER_PATTERN = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+|NAN|INFINITY|INF)';

const parseEtaEte = (input: string, tokens: CommandToken[]): ParsedCommand => {
  const command = tokens[0]?.normalized ?? '';
  const body = input.trim().replace(/^\S+\s*/u, '');
  const atIndex = body.indexOf('@');
  const referenceText = (atIndex >= 0 ? body.slice(0, atIndex) : body).trim();
  const speedText = atIndex >= 0 ? body.slice(atIndex + 1).trim() : '';
  const references = referenceText.split(/\s+/).filter(Boolean);
  const parameters: Record<string, string | number | null> = {
    command,
    query: referenceText,
  };
  const errors: CommandParseError[] = [];
  const assumptions: string[] = [];

  if (references.length === 0) {
    errors.push({
      code: 'INCOMPLETE_COMMAND',
      message: `${command} requires at least one entity reference.`,
      hint: `Use ${command} <REFERENCE> or ${command} <FROM> <TO>.`,
    });
  } else if (references.length === 1) {
    parameters.fromReference = 'OWNSHIP';
    parameters.toReference = references[0];
  } else {
    parameters.fromReference = references[0];
    parameters.toReference = references.slice(1).join(' ');
  }

  if (atIndex >= 0) {
    const speedMatch = speedText.match(new RegExp(`^(${ETA_SPEED_NUMBER_PATTERN})(?:\\s*(.*))?$`, 'i'));
    if (!speedMatch) {
      errors.push({
        code: 'INVALID_NUMBER',
        message: 'Ground speed must be numeric.',
      });
    } else {
      const rawSpeed = speedMatch[1];
      const unitText = speedMatch[2]?.trim() ?? '';
      parameters.speed = rawSpeed.toUpperCase() === 'NAN'
        || rawSpeed.toUpperCase() === 'INFINITY'
        || rawSpeed.toUpperCase() === 'INF'
        ? null
        : Number(rawSpeed);
      parameters.speedUnit = unitText || null;

      if (!unitText) {
        errors.push({
          code: 'MISSING_UNIT',
          message: 'Ground speed requires an explicit unit, for example @ 140KT.',
          hint: 'Use KT, KTS, KNOT, KNOTS, KMH, or KM/H.',
        });
      } else {
        try {
          const quantity = createTacticalQuantity(Number(parameters.speed), unitText);
          if (quantity.dimension !== 'SPEED') {
            errors.push({
              code: 'INCOMPATIBLE_UNIT',
              message: 'ETA/ETE speed requires a speed unit.',
            });
          } else {
            const normalizedSpeed = convertTacticalQuantity(quantity, 'KT');
            parameters.speed = normalizedSpeed.value;
            parameters.speedUnit = normalizedSpeed.unit;
            parameters.speedOriginal = quantity.originalValue;
            parameters.speedOriginalUnit = quantity.originalUnit;
            parameters.speedAssumed = 'USER ASSUMPTION';
            assumptions.push('USER ASSUMPTION');
          }
        } catch (error) {
          if (error instanceof TacticalUnitError) {
            errors.push({
              code: error.code === 'UNKNOWN_UNIT' ? 'UNKNOWN_UNIT' : 'INVALID_NUMBER',
              message: error.code === 'UNKNOWN_UNIT'
                ? 'UNITÉ INCONNUE — KT, KMH ou KM/H'
                : 'Ground speed must be a positive finite value.',
              ...(error.code === 'UNKNOWN_UNIT'
                ? { hint: 'Supported speed units: KT, KMH, or KM/H.' }
                : {}),
            });
          } else {
            errors.push({ code: 'INVALID_NUMBER', message: 'Ground speed is invalid.' });
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return createResult('MEASUREMENT', tokens, parameters, ['EXECUTION_NOT_ATTEMPTED'], errors, assumptions);
  }
  return createResult('MEASUREMENT', tokens, parameters, [], [], assumptions);
};

const TDS_QUANTITY_PATTERN = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+|NAN|INFINITY|INF))\s*(.*)$/i;

type TdsQuantityDimension = TacticalQuantity['dimension'];

const parseTdsQuantity = (
  raw: string,
  dimension: TdsQuantityDimension,
  key: string,
  parameters: Record<string, string | number | null>,
  errors: CommandParseError[],
): TacticalQuantity | undefined => {
  const match = raw.trim().match(TDS_QUANTITY_PATTERN);
  if (!match) {
    errors.push({ code: 'INVALID_NUMBER', message: `${key} must be numeric.` });
    return undefined;
  }

  const rawValue = match[1];
  const unitText = match[2].trim();
  if (isNonFiniteLexeme(rawValue)) {
    errors.push(nonFiniteError());
    parameters[key] = null;
    return undefined;
  }

  const value = Number(rawValue);
  parameters[key] = Number.isFinite(value) ? value : null;
  parameters[`${key}Unit`] = unitText || null;
  if (!unitText) {
    errors.push({
      code: 'MISSING_UNIT',
      message: `${key} requires an explicit unit.`,
      hint: 'Use NM, KM, M, FT, KT, KMH, S, MIN, or H as appropriate.',
    });
    return undefined;
  }

  try {
    const quantity = createTacticalQuantity(value, unitText);
    if (quantity.dimension !== dimension) {
      errors.push({
        code: 'INCOMPATIBLE_UNIT',
        message: `${key} requires a ${dimension.toLowerCase()} unit.`,
      });
      return undefined;
    }

    parameters[key] = quantity.value;
    parameters[`${key}Unit`] = quantity.unit;
    parameters[`${key}Original`] = quantity.originalValue;
    parameters[`${key}OriginalUnit`] = quantity.originalUnit;
    return quantity;
  } catch (error) {
    const code = error instanceof TacticalUnitError && error.code === 'UNKNOWN_UNIT'
      ? 'UNKNOWN_UNIT'
      : 'INVALID_NUMBER';
    errors.push({
      code,
      message: code === 'UNKNOWN_UNIT' ? `Unknown unit for ${key}.` : `${key} must be positive and finite.`,
    });
    return undefined;
  }
};

const parseTimeDistanceSpeed = (input: string, tokens: CommandToken[]): ParsedCommand => {
  const command = tokens[0]?.normalized ?? '';
  const body = input.trim().replace(/^\S+\s*/u, '');
  const separator = command === 'GS' ? '/' : '@';
  const parts = body.split(separator).map(part => part.trim());
  const parameters: Record<string, string | number | null> = { command };
  const errors: CommandParseError[] = [];

  if (parts.length !== 2 || parts.some(part => part.length === 0)) {
    errors.push({
      code: 'INVALID_SYNTAX',
      message: `${command} requires two quantities separated by ${separator}.`,
      hint: command === 'GS' ? 'Use GS <DISTANCE> / <TIME>.' : `Use ${command} <QUANTITY> @ <SPEED>.`,
    });
  } else if (command === 'TIME') {
    parseTdsQuantity(parts[0], 'DISTANCE', 'distance', parameters, errors);
    parseTdsQuantity(parts[1], 'SPEED', 'speed', parameters, errors);
  } else if (command === 'DIST') {
    parseTdsQuantity(parts[0], 'TIME', 'time', parameters, errors);
    parseTdsQuantity(parts[1], 'SPEED', 'speed', parameters, errors);
  } else {
    parseTdsQuantity(parts[0], 'DISTANCE', 'distance', parameters, errors);
    parseTdsQuantity(parts[1], 'TIME', 'time', parameters, errors);
  }

  return createResult(
    'CALCULATION',
    tokens,
    parameters,
    errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [],
    errors,
  );
};
const parseMeasurement = (input: string, tokens: CommandToken[]): ParsedCommand => {
  const normalizedInput = normalizeText(input);
  const match = normalizedInput.match(/^(BRG\/RNG|BRG|RNG)(?:\s+(.*))?$/);
  const command = match?.[1] ?? tokens[0]?.normalized ?? '';
  const query = match?.[2]?.trim() ?? '';
  const parameters: Record<string, string | number | null> = {
    command,
    query,
  };
  const errors: CommandParseError[] = [];

  if (!query) {
    errors.push({
      code: 'INCOMPLETE_COMMAND',
      message: `${command} requires at least one entity reference.`,
    });
  } else {
    const references = query.split(/\s+/).filter(Boolean);
    if (command === 'BRG/RNG' && references.length >= 2) {
      parameters.fromReference = references[0];
      parameters.toReference = references.slice(1).join(' ');
    } else {
      parameters.fromReference = 'OWNSHIP';
      parameters.toReference = query;
    }
  }

  if (errors.length > 0) return createResult('MEASUREMENT', tokens, parameters, ['EXECUTION_NOT_ATTEMPTED'], errors);
  return createResult('MEASUREMENT', tokens, parameters);
};

const NEAREST_CATEGORIES: Record<string, 'WAYPOINT' | 'TRACK' | 'AIRPORT'> = {
  WAYPOINT: 'WAYPOINT',
  WAYPOINTS: 'WAYPOINT',
  TRACK: 'TRACK',
  TRACKS: 'TRACK',
  AIRPORT: 'AIRPORT',
  AIRPORTS: 'AIRPORT',
};

const parseNearest = (tokens: CommandToken[]): ParsedCommand => {
  const body = tokens.slice(1).map(token => token.normalized);
  const errors: CommandParseError[] = [];
  let limit = 1;
  let remaining = [...body];

  const first = remaining[0];
  const firstLooksNumeric = first === NON_FINITE_MARKER || /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(first ?? '');
  if (firstLooksNumeric) {
    const parsedLimit = parseNormalizedNumber(first);
    if (parsedLimit === null) {
      errors.push(nonFiniteError());
    } else if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
      errors.push({
        code: 'INVALID_NUMBER',
        message: 'Nearest result count must be a positive integer.',
        hint: 'Use NEAREST <COUNT> <WAYPOINT|TRACK|AIRPORT>.',
      });
    } else {
      limit = parsedLimit;
    }
    remaining = remaining.slice(1);
  }

  const categoryToken = remaining.at(-1);
  const category = categoryToken ? NEAREST_CATEGORIES[categoryToken] : undefined;
  if (!category) {
    errors.push({
      code: 'UNEXPECTED_ARGUMENT',
      message: `Unknown nearest category: ${categoryToken ?? '<MISSING>'}.`,
      hint: 'Use WAYPOINT, TRACK, or AIRPORT.',
    });
  }

  const referenceParts = categoryToken ? remaining.slice(0, -1) : [];
  const reference = referenceParts.length > 0 ? referenceParts.join(' ') : 'OWNSHIP';
  const parameters: Record<string, string | number | null> = {
    command: 'NEAREST',
    category: category ?? categoryToken ?? null,
    limit,
    reference,
  };

  return createResult(
    'SEARCH',
    tokens,
    parameters,
    errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [],
    errors,
  );
};

const parsePredict = (tokens: CommandToken[]): ParsedCommand => {
  const parameters: Record<string, string | number | null> = { command: 'PREDICT' };
  const errors: CommandParseError[] = [];
  const body = tokens.slice(1).map(token => token.normalized);
  const horizonIndex = body.findIndex(token => token.startsWith('+'));

  if (horizonIndex < 0) {
    errors.push({
      code: 'INCOMPLETE_COMMAND',
      message: 'PREDICT requires a reference and a signed horizon.',
      hint: 'Use PREDICT BRAVO +2MIN or PREDICT BRAVO +10NM.',
    });
  } else if (horizonIndex !== body.length - 1) {
    errors.push({
      code: 'UNEXPECTED_ARGUMENT',
      message: 'PREDICT horizon must be the final argument.',
    });
  }

  const referenceParts = horizonIndex > 0 ? body.slice(0, horizonIndex) : [];
  if (referenceParts.length === 0) {
    errors.push({
      code: 'INCOMPLETE_COMMAND',
      message: 'PREDICT requires a target reference.',
    });
  } else {
    parameters.reference = referenceParts.join(' ');
  }

  const horizonToken = horizonIndex === body.length - 1 ? body[horizonIndex] : undefined;
  const horizonMatch = horizonToken?.match(/^\+((?:\d+(?:\.\d*)?|\.\d+))(MIN|NM)$/);
  if (!horizonMatch) {
    if (horizonToken && horizonToken === NON_FINITE_MARKER) {
      errors.push(nonFiniteError());
    } else if (horizonToken) {
      errors.push({
        code: 'INVALID_SYNTAX',
        message: 'Prediction horizon must use +<value>MIN or +<value>NM.',
      });
    }
  } else {
    const value = Number(horizonMatch[1]);
    parameters.horizonValue = value;
    parameters.horizonUnit = horizonMatch[2];
    if (!Number.isFinite(value) || value <= 0) {
      errors.push({
        code: 'INVALID_RANGE',
        message: 'Prediction horizon must be greater than zero.',
      });
    }
  }

  return createResult(
    'SEARCH',
    tokens,
    parameters,
    errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [],
    errors,
  );
};

const COORDINATE_FORMATS: CoordinateFormat[] = ['DD', 'DDM', 'DMS'];

const isCoordinateFormat = (value: string | undefined): value is CoordinateFormat =>
  value !== undefined && COORDINATE_FORMATS.includes(value as CoordinateFormat);

const coordinateLiteral = (value: string): boolean => (
  /[,]/.test(value)
  || /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.test(value)
  || /^[NSEW]\s*\d/.test(value)
  || /^(?:NAN|INFINITY|INF)(?:\s|$)/.test(value)
);

const parseCoordinateCommand = (input: string, tokens: CommandToken[]): ParsedCommand => {
  const normalizedInput = normalizeText(input);
  const copyCommand = /^COPY POS(?:\s|$)/.test(normalizedInput);
  const malformedCopyCommand = tokens[0]?.normalized === 'COPY' && !copyCommand;
  const command = copyCommand ? 'COPY POS' : tokens[0]?.normalized ?? 'COORD';
  const prefix = copyCommand ? /^COPY POS(?:\s+|$)/ : /^(?:COORDINATE|COORD)\s*/;
  const body = normalizedInput.replace(prefix, '').trim();
  const parts = body ? body.split(/\s+/) : [];
  const finalPart = parts.at(-1);
  const unknownFormatCandidate = finalPart !== undefined
    && parts.length > 1
    && /^[A-Z]+$/.test(finalPart);
  const hasFormat = isCoordinateFormat(finalPart) || unknownFormatCandidate;
  const format = isCoordinateFormat(finalPart)
    ? finalPart
    : unknownFormatCandidate
      ? finalPart
      : copyCommand
        ? 'DD'
        : undefined;
  const coordinateParts = hasFormat && finalPart ? parts.slice(0, -1) : parts;
  const coordinateText = coordinateParts.join(' ');
  const parameters: Record<string, string | number | null> = { command };
  const errors: CommandParseError[] = [];

  if (malformedCopyCommand) {
    errors.push({
      code: 'UNEXPECTED_ARGUMENT',
      message: 'COPY requires the exact POS subcommand.',
      hint: 'Use COPY POS BRAVO.',
    });
  } else if (!copyCommand && !hasFormat) {
    if (coordinateLiteral(coordinateText)) {
      return parseCoordinate(tokens);
    }
    errors.push({
      code: 'INCOMPLETE_COMMAND',
      message: `${command} requires a reference and output format.`,
      hint: 'Use COORD BRAVO DD, DDM, or DMS.',
    });
  } else if (!format || !isCoordinateFormat(format)) {
    errors.push({
      code: 'UNEXPECTED_ARGUMENT',
      message: `Unsupported coordinate format: ${format ?? '<MISSING>'}.`,
      hint: 'Use DD, DDM, or DMS. MGRS requires a separate datum-qualified feature.',
    });
  } else if (!coordinateText) {
    errors.push({
      code: 'INCOMPLETE_COMMAND',
      message: `${command} requires a coordinate or entity reference.`,
    });
  } else if (coordinateLiteral(coordinateText)) {
    try {
      const position = parseCoordinateValue(coordinateText);
      parameters.latitude = position.lat;
      parameters.longitude = position.lon;
    } catch {
      errors.push({ code: 'INVALID_NUMBER', message: 'Coordinate values are invalid.' });
    }
  } else {
    parameters.reference = coordinateText;
  }

  if (format) parameters.format = format;
  return createResult(
    'COORDINATE',
    tokens,
    parameters,
    errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [],
    errors,
  );
};

const INTERSECTION_NUMBER_PATTERN = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+|NAN|INFINITY|INF)';
const INTERSECTION_PATTERN = new RegExp(
  `^(.+?)\\s*/\\s*(${INTERSECTION_NUMBER_PATTERN})\\s+(.+?)\\s*/\\s*(${INTERSECTION_NUMBER_PATTERN})$`,
  'i',
);

const parseIntersection = (input: string, tokens: CommandToken[]): ParsedCommand => {
  const body = normalizeText(input).replace(/^INT(?:\s+|$)/, '').trim();
  const match = body.match(INTERSECTION_PATTERN);
  const parameters: Record<string, string | number | null> = { command: 'INT' };
  const errors: CommandParseError[] = [];

  if (!match) {
    errors.push({
      code: body ? 'INVALID_SYNTAX' : 'INCOMPLETE_COMMAND',
      message: body
        ? 'INT requires two references in the form REF/BRG REF/BRG.'
        : 'INT requires two bearing lines.',
      hint: 'Use INT BRAVO/090 G01/180.',
    });
  } else {
    const [, firstReference, rawFirstBearing, secondReference, rawSecondBearing] = match;
    const firstBearing = parseNormalizedNumber(normalizeProjectionPart(rawFirstBearing));
    const secondBearing = parseNormalizedNumber(normalizeProjectionPart(rawSecondBearing));
    parameters.firstReference = firstReference.trim();
    parameters.firstBearing = firstBearing;
    parameters.secondReference = secondReference.trim();
    parameters.secondBearing = secondBearing;

    if (rawFirstBearing.match(/^(?:NAN|INFINITY|INF)$/i)
      || rawSecondBearing.match(/^(?:NAN|INFINITY|INF)$/i)) {
      errors.push(nonFiniteError());
    } else if (firstBearing === null || secondBearing === null) {
      errors.push({ code: 'INVALID_NUMBER', message: 'Intersection bearings must be numeric.' });
    } else if (firstBearing < 0 || firstBearing >= 360 || secondBearing < 0 || secondBearing >= 360) {
      errors.push({
        code: 'INVALID_BEARING',
        message: 'Intersection bearings must be between 000 and 359.999 degrees.',
        hint: 'Normalize each true bearing to the range [000, 360).',
      });
    }
  }

  return createResult(
    'INTERSECTION',
    tokens,
    parameters,
    errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [],
    errors,
  );
};

const parseBullseye = (input: string, tokens: CommandToken[]): ParsedCommand => {
  const normalizedInput = normalizeText(input);
  const parameters: Record<string, string | number | null> = {};
  const errors: CommandParseError[] = [];
  const assumptions: string[] = [];

  if (/^SET\s+BULL(?:\s|$)/.test(normalizedInput)) {
    parameters.command = 'SET BULL';
    const reference = normalizedInput.replace(/^SET\s+BULL(?:\s+|$)/, '').trim();
    if (!reference) {
      errors.push({
        code: 'INCOMPLETE_COMMAND',
        message: 'SET BULL requires an exact entity reference.',
        hint: 'Use SET BULL BRAVO.',
      });
    } else {
      parameters.reference = reference;
    }
  } else if (/^CLEAR\s+BULL(?:\s|$)/.test(normalizedInput)) {
    parameters.command = 'CLEAR BULL';
    const extra = normalizedInput.replace(/^CLEAR\s+BULL(?:\s+|$)/, '').trim();
    if (extra) {
      errors.push({
        code: 'UNEXPECTED_ARGUMENT',
        message: `Unexpected CLEAR BULL argument: ${extra}.`,
        hint: 'Use CLEAR BULL.',
      });
    }
  } else {
    parameters.command = 'BULL';
    const body = normalizedInput.replace(/^BULL(?:\s+|$)/, '').trim();
    if (!body) {
      errors.push({
        code: 'INCOMPLETE_COMMAND',
        message: 'BULL requires a target reference or bearing/range projection.',
        hint: 'Use BULL HOSTILE 1 or BULL 270/15.',
      });
    } else if (body.includes('/')) {
      const slashParts = body.split('/');
      if (slashParts.length !== 2 || !slashParts[0].trim() || !slashParts[1].trim()) {
        errors.push({
          code: 'INVALID_SYNTAX',
          message: 'BULL projection requires BEARING/RANGE.',
          hint: 'Use BULL 270/15.',
        });
      } else {
        const bearingToken = normalizeProjectionPart(slashParts[0].trim());
        const rangeParts = splitNumericAndUnit(slashParts[1].trim());
        const bearing = parseNormalizedNumber(bearingToken);
        const range = parseNormalizedNumber(rangeParts.numberToken);
        parameters.bearing = bearing;
        parameters.range = range;
        if (rangeParts.unitToken) parameters.unit = rangeParts.unitToken;

        if (bearingToken === NON_FINITE_MARKER || rangeParts.numberToken === NON_FINITE_MARKER) {
          errors.push(nonFiniteError());
        } else if (bearing === null) {
          errors.push({ code: 'INVALID_NUMBER', message: 'BULL bearing must be numeric.' });
        } else if (bearing < 0 || bearing >= 360) {
          errors.push({
            code: 'INVALID_BEARING',
            message: 'BULL bearing must be between 000 and 359.999 degrees.',
            hint: 'Normalize the true bearing to the range [000, 360).',
          });
        }

        if (range === null) {
          errors.push({ code: 'INVALID_NUMBER', message: 'BULL range must be numeric.' });
        } else if (range <= 0) {
          errors.push({ code: 'INVALID_RANGE', message: 'BULL projection range must be positive.' });
        } else {
          try {
            const quantity = createTacticalQuantity(
              range,
              rangeParts.unitToken,
              { allowImplicitNauticalMile: true },
            );
            if (quantity.dimension !== 'DISTANCE') {
              errors.push({
                code: 'INCOMPATIBLE_UNIT',
                message: 'BULL projection range requires a distance unit.',
              });
            } else {
              parameters.unit = quantity.unit;
              if (quantity.assumed) assumptions.push('ASSUMED NM');
            }
          } catch (error) {
            errors.push({
              code: error instanceof TacticalUnitError && error.code === 'UNKNOWN_UNIT'
                ? 'UNKNOWN_UNIT'
                : 'INVALID_RANGE',
              message: error instanceof TacticalUnitError && error.code === 'UNKNOWN_UNIT'
                ? 'Unknown BULL projection range unit.'
                : 'BULL projection range is invalid.',
              ...(error instanceof TacticalUnitError && error.code === 'UNKNOWN_UNIT'
                ? { hint: 'Supported projection units: NM, KM or M.' }
                : {}),
            });
          }
        }
      }
    } else if (isProjectionNumber(body.split(/\s+/)[0])) {
      errors.push({
        code: 'INCOMPLETE_COMMAND',
        message: 'BULL projection requires a slash between bearing and range.',
        hint: 'Use BULL 270/15.',
      });
    } else {
      parameters.targetReference = body;
    }
  }

  return createResult(
    'BULLSEYE',
    tokens,
    parameters,
    errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [],
    errors,
    assumptions,
  );
};

const parseRoute = (tokens: CommandToken[]): ParsedCommand => {
  const commandToken = tokens[0]?.normalized ?? '';
  const subcommand = tokens[1]?.normalized;
  const errors: CommandParseError[] = [];
  let command: string;

  if (commandToken === 'ROUTE') {
    if (!subcommand) {
      errors.push({
        code: 'INCOMPLETE_COMMAND',
        message: 'ROUTE requires STATUS, ETE, SHOW, HIDE, or CLEAR.',
        hint: 'Use ROUTE STATUS, ROUTE ETE, ROUTE SHOW, ROUTE HIDE, or ROUTE CLEAR.',
      });
      command = 'STATUS';
    } else if (subcommand === 'STATUS' || subcommand === 'ETE' || subcommand === 'SHOW' || subcommand === 'HIDE' || subcommand === 'CLEAR') {
      command = subcommand;
    } else {
      errors.push({
        code: 'UNEXPECTED_ARGUMENT',
        message: `Unexpected route argument: ${subcommand}.`,
        hint: 'Use ROUTE STATUS, ROUTE ETE, ROUTE SHOW, ROUTE HIDE, or ROUTE CLEAR.',
      });
      command = subcommand;
    }
    if (tokens.length > 2) {
      errors.push({
        code: 'UNEXPECTED_ARGUMENT',
        message: `Unexpected route argument: ${tokens.slice(2).map(token => token.normalized).join(' ')}.`,
      });
    }
  } else if (commandToken === 'LEG' || commandToken === 'NEXT') {
    command = commandToken;
    if (tokens.length > 1) {
      errors.push({
        code: 'UNEXPECTED_ARGUMENT',
        message: `Unexpected ${commandToken} argument: ${tokens.slice(1).map(token => token.normalized).join(' ')}.`,
      });
    }
  } else {
    command = commandToken;
  }

  return createResult(
    'ROUTE',
    tokens,
    { command },
    errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [],
    errors,
  );
};

const parseAngularCalculation = (tokens: CommandToken[]): ParsedCommand => {
  const command = tokens[0]?.normalized ?? '';
  const parameters: Record<string, string | number | null> = { command };
  const errors: CommandParseError[] = [];
  const addUnexpectedArguments = (startIndex: number) => {
    if (tokens.length > startIndex) {
      errors.push({
        code: 'UNEXPECTED_ARGUMENT',
        message: `Unexpected angular argument: ${tokens.slice(startIndex).map(token => token.normalized).join(' ')}.`,
      });
    }
  };
  const validateAngle = (token: CommandToken | undefined, label: string): number | null => {
    const value = parseFiniteNumber(token);
    if (hasNonFiniteToken(token)) {
      errors.push(nonFiniteError());
    } else if (!token) {
      errors.push({
        code: 'INCOMPLETE_COMMAND',
        message: `${command} requires ${label}.`,
      });
    } else if (value === null) {
      errors.push({ code: 'INVALID_NUMBER', message: `${label} must be numeric.` });
    } else if (value < 0 || value >= 360) {
      errors.push({
        code: 'INVALID_BEARING',
        message: `${label} must be between 000 and 359.999 degrees.`,
        hint: 'Use a value in the range [000, 360).',
      });
    }
    return value;
  };

  if (command === 'RECIP') {
    const angle = validateAngle(tokens[1], 'RECIP angle');
    parameters.angle = angle;
    parameters.angleKind = 'HEADING';
    addUnexpectedArguments(2);
  } else if (command === 'DELTA') {
    const fromAngle = validateAngle(tokens[1], 'DELTA starting angle');
    const toAngle = validateAngle(tokens[2], 'DELTA target angle');
    parameters.fromAngle = fromAngle;
    parameters.toAngle = toAngle;
    parameters.angleKind = 'HEADING';
    addUnexpectedArguments(3);
  } else {
    const references = tokens.slice(1).map(token => token.normalized);
    if (references.length === 1) {
      parameters.fromReference = 'OWNSHIP';
      parameters.toReference = references[0];
    } else if (references.length === 2) {
      parameters.fromReference = references[0];
      parameters.toReference = references[1];
    } else {
      errors.push({
        code: 'INCOMPLETE_COMMAND',
        message: 'REL requires a target or an observer and target reference.',
        hint: 'Use REL BRAVO or REL G01 BRAVO.',
      });
    }
  }

  return createResult(
    'CALCULATION',
    tokens,
    parameters,
    errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [],
    errors,
  );
};

const parseRelativeMotionCalculation = (tokens: CommandToken[]): ParsedCommand => {
  const command = tokens[0]?.normalized ?? '';
  const parameters: Record<string, string | number | null> = { command };
  const errors: CommandParseError[] = [];
  const references = tokens.slice(1).map(token => token.normalized);

  if (command === 'CLOSURE') {
    if (references.length === 0) {
      errors.push({
        code: 'INCOMPLETE_COMMAND',
        message: 'CLOSURE requires a target reference.',
        hint: 'Use CLOSURE BRAVO.',
      });
    } else {
      parameters.targetReference = references.join(' ');
    }
  } else if (references.length === 1) {
    parameters.fromReference = 'OWNSHIP';
    parameters.toReference = references[0];
  } else if (references.length === 2) {
    parameters.fromReference = references[0];
    parameters.toReference = references[1];
  } else {
    errors.push({
      code: references.length === 0 ? 'INCOMPLETE_COMMAND' : 'UNEXPECTED_ARGUMENT',
      message: references.length === 0
        ? 'CPA requires a target or an observer and target reference.'
        : `Unexpected CPA argument: ${references.slice(2).join(' ')}.`,
      hint: 'Use CPA BRAVO or CPA G01 BRAVO.',
    });
  }

  return createResult(
    'CALCULATION',
    tokens,
    parameters,
    errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [],
    errors,
  );
};

const parseZoneCommand = (tokens: CommandToken[]): ParsedCommand => {
  const zoneCommand = tokens[1]?.normalized ?? '';
  const parameters: Record<string, CommandParameter> = {
    system: 'ZONE',
    command: 'ZONE',
    zoneCommand: zoneCommand || null,
  };
  const errors: CommandParseError[] = [];
  if (zoneCommand === 'LIST') {
    if (tokens.length !== 2) errors.push({ code: 'INVALID_SYNTAX', message: 'Use ZONE LIST.' });
  } else if (zoneCommand === 'SHOW') {
    parameters.zoneReference = tokens.slice(2).map(token => token.normalized).join(' ') || null;
    if (tokens.length < 3) errors.push({ code: 'INCOMPLETE_COMMAND', message: 'ZONE SHOW requires a zone reference.' });
  } else if (zoneCommand === 'CHECK') {
    parameters.pointReference = tokens[2]?.normalized ?? null;
    parameters.zoneReference = tokens.slice(3).map(token => token.normalized).join(' ') || null;
    if (tokens.length < 4) errors.push({ code: 'INCOMPLETE_COMMAND', message: 'Use ZONE CHECK <POINT> <ZONE>.' });
  } else {
    errors.push({ code: 'INVALID_SYNTAX', message: 'Use ZONE LIST, ZONE SHOW <ZONE>, or ZONE CHECK <POINT> <ZONE>.' });
  }
  return createResult('SYSTEM', tokens, parameters, errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [], errors);
};

const parseGridCommand = (tokens: CommandToken[]): ParsedCommand => {
  const parameters: Record<string, CommandParameter> = {
    system: 'GRID',
    command: 'GRID',
    gridType: tokens[1]?.normalized ?? null,
  };
  const errors: CommandParseError[] = [];
  if (tokens[1]?.normalized !== 'LATLON') {
    errors.push({ code: 'INVALID_SYNTAX', message: 'GRID MGRS is excluded; use GRID LATLON ON, OFF, or STEP <N>MIN.' });
  } else if (tokens[2]?.normalized === 'ON' || tokens[2]?.normalized === 'OFF') {
    parameters.enabled = tokens[2].normalized === 'ON';
    if (tokens.length > 3) errors.push({ code: 'UNEXPECTED_ARGUMENT', message: 'GRID LATLON ON/OFF takes no extra arguments.' });
  } else if (tokens[2]?.normalized === 'STEP') {
    const compact = splitNumericAndUnit(tokens[3]?.normalized);
    const separated = !compact.unitToken && tokens[4]
      ? splitNumericAndUnit(`${tokens[3]?.normalized}${tokens[4].normalized}`)
      : compact;
    const value = separated.numberToken && separated.numberToken !== NON_FINITE_MARKER
      ? Number(separated.numberToken)
      : null;
    parameters.stepMinutes = Number.isFinite(value) ? value : null;
    if (!separated.unitToken || separated.unitToken !== 'MIN' || typeof value !== 'number'
      || !Number.isInteger(value) || value < MIN_GRID_STEP_MINUTES || value > MAX_GRID_STEP_MINUTES) {
      errors.push({ code: 'INVALID_NUMBER', message: `GRID LATLON step must be an integer from ${MIN_GRID_STEP_MINUTES} to ${MAX_GRID_STEP_MINUTES}MIN.` });
    }
    const expectedLength = compact.unitToken ? 4 : 5;
    if (tokens.length !== expectedLength) errors.push({ code: 'INVALID_SYNTAX', message: 'Use GRID LATLON STEP <N>MIN.' });
  } else {
    errors.push({ code: 'INVALID_SYNTAX', message: 'Use GRID LATLON ON, OFF, or STEP <N>MIN.' });
  }
  return createResult('SYSTEM', tokens, parameters, errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [], errors);
};

const parseLegendCommand = (tokens: CommandToken[]): ParsedCommand => {
  const parameters: Record<string, CommandParameter> = {
    system: 'LEGEND',
    command: 'LEGEND',
    scope: 'ALL',
  };
  const errors: CommandParseError[] = [];
  const kind = tokens[1]?.normalized;
  const reference = tokens[2]?.normalized;
  if (tokens.length === 1) {
    return createResult('SYSTEM', tokens, parameters);
  }
  if ((kind !== 'SYMBOL' && kind !== 'LAYER') || !reference || tokens.length > 3) {
    errors.push({ code: 'INVALID_SYNTAX', message: 'Use LEGEND, LEGEND SYMBOL <ID>, or LEGEND LAYER <ID>.' });
  } else {
    const allowed = kind === 'SYMBOL'
      ? ['OWNSHIP', 'HOSTILE', 'WAYPOINT', 'AIRPORT']
      : ['TRACKS', 'VECTORS', 'ROUTE'];
    if (!allowed.includes(reference)) {
      errors.push({ code: 'INVALID_SYNTAX', message: `Unknown legend ${kind.toLowerCase()} reference: ${reference}.` });
    } else {
      parameters.scope = kind;
      parameters.kind = kind;
      parameters.reference = reference;
    }
  }
  return createResult('SYSTEM', tokens, parameters, errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [], errors);
};

const parseDeclutterCommand = (tokens: CommandToken[]): ParsedCommand => {
  const preset = tokens[1]?.normalized ?? '';
  const parameters: Record<string, CommandParameter> = {
    system: 'DECLUTTER',
    command: 'DECLUTTER',
    preset: preset || null,
  };
  const errors: CommandParseError[] = [];
  if (!['MINIMAL', 'NORMAL', 'FULL'].includes(preset) || tokens.length > 2) {
    errors.push({ code: 'INVALID_SYNTAX', message: 'Use DECLUTTER MINIMAL, NORMAL, or FULL.' });
  }
  return createResult('SYSTEM', tokens, parameters, errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [], errors);
};

const parseLayerCommand = (tokens: CommandToken[]): ParsedCommand => {
  const command = tokens[0]?.normalized ?? '';
  const parameters: Record<string, string | number | boolean | null> = {
    system: command,
    command,
  };
  const errors: CommandParseError[] = [];
  if (command === 'LAYERS') {
    if (tokens.length > 1) errors.push({ code: 'UNEXPECTED_ARGUMENT', message: 'LAYERS takes no arguments.' });
    return createResult('SYSTEM', tokens, parameters, errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [], errors);
  }
  const layerId = tokens[1]?.normalized ?? '';
  const operation = tokens[2]?.normalized ?? '';
  const allowedLayers = new Set(['TRACKS', 'VECTORS', 'ROUTE']);
  if (!allowedLayers.has(layerId) || !['ON', 'OFF'].includes(operation) || tokens.length > 3) {
    errors.push({ code: 'INVALID_SYNTAX', message: 'Use LAYER TRACKS|VECTORS|ROUTE ON|OFF.' });
  } else {
    parameters.layerId = layerId;
    parameters.visible = operation === 'ON';
  }
  return createResult('SYSTEM', tokens, parameters, errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [], errors);
};

const parseSimulationCommand = (tokens: CommandToken[]): ParsedCommand => {
  const action = tokens[1]?.normalized ?? '';
  const parameters: Record<string, string | number | null> = {
    system: 'SIM',
    command: `SIM ${action}`.trim(),
    simulationCommand: action || null,
  };
  const allowed = new Set(['STATUS', 'PAUSE', 'RESUME', 'RESET', 'REPLAY', 'TIME', 'SPEED']);
  const errors: CommandParseError[] = [];
  if (!action || !allowed.has(action)) {
    errors.push({ code: 'INVALID_SYNTAX', message: 'Use SIM STATUS, PAUSE, RESUME, RESET, REPLAY, TIME, or SPEED.' });
  } else if (action === 'TIME') {
    if (tokens.length > 2) errors.push({ code: 'UNEXPECTED_ARGUMENT', message: 'SIM TIME takes no arguments.' });
  } else if (action === 'SPEED') {
    const speedToken = tokens[2];
    const speed = parseFiniteNumber(speedToken);
    parameters.speed = speed;
    if (!speedToken) errors.push({ code: 'INCOMPLETE_COMMAND', message: 'SIM SPEED requires a value.' });
    else if (hasNonFiniteToken(speedToken)) errors.push(nonFiniteError());
    else if (speed === null) errors.push({ code: 'INVALID_NUMBER', message: 'Simulation speed must be numeric.' });
    else if (speed < MIN_SIMULATION_SPEED || speed > MAX_SIMULATION_SPEED) {
      errors.push({
        code: 'INVALID_NUMBER',
        message: `Simulation speed must be between ${MIN_SIMULATION_SPEED} and ${MAX_SIMULATION_SPEED}.`,
      });
    }
    if (tokens.length > 3) errors.push({ code: 'UNEXPECTED_ARGUMENT', message: 'SIM SPEED takes one value.' });
  }
  return createResult('SYSTEM', tokens, parameters, errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [], errors);
};

const parsePrefixedUnit = (token: CommandToken | undefined, prefix: string, unit: string): number | null => {
  if (!token) return null;
  const match = token.normalized.match(new RegExp(`^${prefix}([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+))${unit}$`));
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
};

const parseVerticalCalculation = (tokens: CommandToken[]): ParsedCommand => {
  const command = tokens[0]?.normalized ?? '';
  const parameters: Record<string, string | number | null> = { command };
  const errors: CommandParseError[] = [];
  const invalid = (message: string): void => {
    errors.push({ code: 'INVALID_SYNTAX', message });
  };
  const required = (value: number | null, name: string): value is number => {
    if (value === null) invalid(`${command} requires ${name}.`);
    return value !== null;
  };

  if (command === 'GRAD') {
    const verticalSpeed = parsePrefixedUnit(tokens[1], 'VS', 'FPM');
    const groundSpeed = parsePrefixedUnit(tokens[2], 'GS', 'KT');
    if (required(verticalSpeed, 'VS±NFPM') && required(groundSpeed, 'GSNKT')) {
      parameters.verticalSpeedFpm = verticalSpeed;
      parameters.groundSpeedKnots = groundSpeed;
    }
  } else if (command === 'VSREQ') {
    const altitudeToken = tokens.find(token => /^(?:LOSE|GAIN)/.test(token.normalized));
    const distanceToken = tokens.find(token => token.normalized.startsWith('IN'));
    const speedToken = [...tokens].reverse().find(token => /KT$/.test(token.normalized));
    const altitudeMagnitude = parsePrefixedUnit(altitudeToken, 'LOSE', 'FT')
      ?? parsePrefixedUnit(altitudeToken, 'GAIN', 'FT');
    const altitudeChange = altitudeToken?.normalized.startsWith('LOSE') && altitudeMagnitude !== null
      ? -altitudeMagnitude
      : altitudeMagnitude;
    const distance = parsePrefixedUnit(distanceToken, 'IN', 'NM');
    const speed = speedToken ? Number(speedToken.normalized.replace(/KT$/, '')) : null;
    if (altitudeChange === null || altitudeChange === undefined) invalid('VSREQ requires LOSE or GAIN with FT.');
    if (distance === null) invalid('VSREQ requires IN<N>NM.');
    if (speed === null || !Number.isFinite(speed)) invalid('VSREQ requires ground speed in KT.');
    parameters.altitudeChangeFeet = altitudeChange ?? null;
    parameters.distanceNauticalMiles = distance;
    parameters.groundSpeedKnots = speed;
  } else if (command === 'TOD') {
    const fromIndex = tokens.findIndex((token, index) => index > 0 && token.normalized.startsWith('FROM'));
    const toIndex = tokens.findIndex((token, index) => index > 0 && token.normalized.startsWith('TO'));
    const verticalToken = tokens.find(token => token.normalized.startsWith('VS'));
    const speedToken = [...tokens].reverse().find(token => /KT$/.test(token.normalized));
    const reference = fromIndex > 1 ? tokens.slice(1, fromIndex).map(token => token.normalized).join(' ') : '';
    const fromAltitude = parsePrefixedUnit(tokens[fromIndex], 'FROM', 'FT');
    const toAltitude = parsePrefixedUnit(tokens[toIndex], 'TO', 'FT');
    const verticalSpeed = parsePrefixedUnit(verticalToken, 'VS', 'FPM');
    const groundSpeed = speedToken ? Number(speedToken.normalized.replace(/KT$/, '')) : null;
    if (!reference) invalid('TOD requires a reference point.');
    if (fromAltitude === null) invalid('TOD requires FROM<N>FT.');
    if (toAltitude === null) invalid('TOD requires TO<N>FT.');
    if (verticalSpeed === null) invalid('TOD requires VS±NFPM.');
    if (groundSpeed === null || !Number.isFinite(groundSpeed)) invalid('TOD requires ground speed in KT.');
    parameters.reference = reference || null;
    parameters.fromAltitudeFeet = fromAltitude;
    parameters.toAltitudeFeet = toAltitude;
    parameters.verticalSpeedFpm = verticalSpeed;
    parameters.groundSpeedKnots = groundSpeed;
  }

  return createResult('CALCULATION', tokens, parameters, errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [], errors);
};

const parseWithinCommand = (tokens: CommandToken[]): ParsedCommand => {
  const parameters: Record<string, string | number | null> = {
    command: 'WITHIN',
    reference: 'OWNSHIP',
    range: null,
    rangeUnit: null,
  };
  const errors: CommandParseError[] = [];
  let rangeIndex = -1;
  let rangeEndIndex = -1;
  let rangeParts: ReturnType<typeof splitNumericAndUnit> = { numberToken: null, unitToken: undefined };
  for (let index = 1; index < tokens.length; index += 1) {
    const compactParts = splitNumericAndUnit(tokens[index].normalized);
    const separatedParts = tokens[index + 1]
      ? splitNumericAndUnit(`${tokens[index].normalized}${tokens[index + 1].normalized}`)
      : compactParts;
    const usesSeparatedUnit = !compactParts.unitToken && Boolean(separatedParts.unitToken);
    const candidateParts = compactParts.unitToken ? compactParts : separatedParts;
    if (candidateParts.numberToken !== null && candidateParts.unitToken) {
      rangeIndex = index;
      rangeEndIndex = usesSeparatedUnit ? index + 1 : index;
      rangeParts = candidateParts;
      break;
    }
  }
  if (rangeIndex < 0) {
    errors.push({ code: 'INCOMPLETE_COMMAND', message: 'WITHIN requires a range such as 10NM.' });
  } else {
    const parts = rangeParts;
    const range = parts.numberToken && parts.numberToken !== NON_FINITE_MARKER ? Number(parts.numberToken) : null;
    parameters.range = Number.isFinite(range) ? range : null;
    parameters.rangeUnit = parts.unitToken;
    const reference = tokens.slice(1, rangeIndex).map(token => token.normalized).join(' ');
    if (reference) parameters.reference = reference;
    if (parts.unitToken !== 'NM') {
      errors.push({ code: 'INCOMPATIBLE_UNIT', message: 'WITHIN range must use NM.' });
    }
    const suffix = tokens.slice(rangeEndIndex + 1);
    if (suffix.length > 0) {
      if (suffix[0]?.normalized !== 'TYPE' || suffix.length !== 2) {
        errors.push({ code: 'INVALID_SYNTAX', message: 'Use optional TYPE TRACK, TYPE WAYPOINT, or TYPE AIRPORT.' });
      } else if (suffix[1]?.normalized === 'TRACK' || suffix[1]?.normalized === 'WAYPOINT' || suffix[1]?.normalized === 'AIRPORT') {
        parameters.category = suffix[1].normalized;
      } else {
        errors.push({ code: 'INVALID_SYNTAX', message: 'WITHIN type must be TRACK, WAYPOINT, or AIRPORT.' });
      }
    }
    if (typeof range !== 'number' || !Number.isFinite(range) || range <= 0) {
      errors.push({ code: 'INVALID_NUMBER', message: 'WITHIN range must be a positive number.' });
    }
  }
  return createResult('SEARCH', tokens, parameters, errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [], errors);
};

const parseFavoriteCommand = (tokens: CommandToken[]): ParsedCommand => {
  const first = tokens[0]?.normalized ?? '';
  const parameters: Record<string, string | number | null> = { command: first };
  const errors: CommandParseError[] = [];

  if (first === 'FAVORITES') {
    if (tokens.length > 1) errors.push({ code: 'UNEXPECTED_ARGUMENT', message: 'FAVORITES does not accept arguments.' });
  } else if (first === 'UNPIN') {
    const id = parseFiniteNumber(tokens[1]);
    parameters.favoriteId = id;
    if (id === null || !Number.isInteger(id) || id <= 0) {
      errors.push({ code: 'INVALID_NUMBER', message: 'Favorite id must be a positive integer.' });
    }
    if (tokens.length > 2) errors.push({ code: 'UNEXPECTED_ARGUMENT', message: 'UNPIN accepts one favorite id.' });
  } else {
    const isTemplate = tokens[1]?.normalized === 'TEMPLATE';
    const command = isTemplate ? 'PIN TEMPLATE' : 'PIN';
    const valueTokens = tokens.slice(isTemplate ? 2 : 1);
    const favoriteCommand = valueTokens.map(token => token.normalized).join(' ').replace(/\bBRG RNGNM\b/g, 'BRG/RNGNM');
    parameters.command = command;
    parameters.favoriteKind = isTemplate ? 'TEMPLATE' : 'COMMAND';
    parameters.favoriteCommand = favoriteCommand;
    if (!favoriteCommand) errors.push({ code: 'INCOMPLETE_COMMAND', message: `${command} requires a command or template.` });
  }

  return createResult('SEARCH', tokens, parameters, errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [], errors);
};

const parseUnitConversion = (tokens: CommandToken[]): ParsedCommand => {
  const parameters: Record<string, string | number | null> = { command: 'CONVERT' };
  const errors: CommandParseError[] = [];
  const sourceParts = splitNumericAndUnit(tokens[0]?.normalized === 'CONVERT' ? tokens[1]?.normalized : tokens[0]?.normalized);
  const sourceValue = sourceParts.numberToken && sourceParts.numberToken !== NON_FINITE_MARKER
    ? Number(sourceParts.numberToken)
    : null;
  const sourceUnit = sourceParts.unitToken;
  const targetUnit = tokens[0]?.normalized === 'CONVERT' ? tokens[3]?.normalized : tokens[2]?.normalized;
  parameters.value = Number.isFinite(sourceValue) ? sourceValue : null;
  parameters.sourceUnit = sourceUnit;
  parameters.targetUnit = targetUnit;

  if (tokens[0]?.normalized === 'CONVERT') {
    errors.push({ code: 'INVALID_SYNTAX', message: 'Use <VALUE><UNIT> > <UNIT>.' });
  } else if (tokens.length !== 3 || tokens[1]?.normalized !== '>') {
    errors.push({ code: 'INVALID_SYNTAX', message: 'Use <VALUE><UNIT> > <UNIT>.' });
  } else if (sourceParts.numberToken === NON_FINITE_MARKER || !Number.isFinite(sourceValue)) {
    errors.push(nonFiniteError());
  } else if (!sourceUnit || !targetUnit) {
    errors.push({ code: 'UNKNOWN_UNIT', message: 'Source and target units are required.' });
  } else {
    try {
      const quantity = createTacticalQuantity(sourceValue as number, sourceUnit, {
        allowZero: true,
        allowNegative: true,
      });
      convertTacticalQuantity(quantity, targetUnit);
    } catch (error) {
      if (error instanceof TacticalUnitError) {
        errors.push({
          code: error.code === 'INCOMPATIBLE_UNITS' ? 'INCOMPATIBLE_UNIT' : error.code === 'UNKNOWN_UNIT' ? 'UNKNOWN_UNIT' : 'INVALID_NUMBER',
          message: error.message,
        });
      } else {
        errors.push({ code: 'INVALID_SYNTAX', message: 'Conversion is invalid.' });
      }
    }
  }

  return createResult('CALCULATION', tokens, parameters, errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [], errors);
};

const parseTimerCommand = (tokens: CommandToken[]): ParsedCommand => {
  const first = tokens[0]?.normalized ?? '';
  const isCancel = first === 'CANCEL' && tokens[1]?.normalized === 'TIMER';
  const command = isCancel ? 'CANCEL TIMER' : first;
  const parameters: Record<string, string | number | null> = { command };
  const errors: CommandParseError[] = [];

  if (first === 'TIMERS') {
    if (tokens.length > 1) errors.push({ code: 'UNEXPECTED_ARGUMENT', message: 'TIMERS does not accept arguments.' });
  } else if (isCancel) {
    const timerId = parseFiniteNumber(tokens[2]);
    parameters.timerId = timerId;
    if (!tokens[2]) errors.push({ code: 'INCOMPLETE_COMMAND', message: 'CANCEL TIMER requires a timer id.' });
    else if (timerId === null || !Number.isInteger(timerId) || timerId <= 0) {
      errors.push({ code: 'INVALID_NUMBER', message: 'Timer id must be a positive integer.' });
    }
    if (tokens.length > 3) errors.push({ code: 'UNEXPECTED_ARGUMENT', message: 'CANCEL TIMER accepts one timer id.' });
  } else {
    const durationToken = tokens[1];
    const parts = splitNumericAndUnit(durationToken?.normalized);
    const durationValue = parts.numberToken && parts.numberToken !== NON_FINITE_MARKER
      ? Number(parts.numberToken)
      : null;
    parameters.durationValue = Number.isFinite(durationValue) ? durationValue : null;
    parameters.durationUnit = parts.unitToken;
    if (!durationToken) errors.push({ code: 'INCOMPLETE_COMMAND', message: 'TIMER requires a duration.' });
    else if (parts.numberToken === NON_FINITE_MARKER || !Number.isFinite(durationValue)) errors.push(nonFiniteError());
    else if (durationValue === null || durationValue <= 0) errors.push({ code: 'INVALID_NUMBER', message: 'Timer duration must be positive.' });
    else if (parts.unitToken !== 'MIN') errors.push({ code: 'UNKNOWN_UNIT', message: 'Timer duration requires MIN.' });
    if (tokens.length > 2) {
      if (tokens[2]?.normalized !== 'CHECK' || tokens.length < 4) {
        errors.push({ code: 'INVALID_SYNTAX', message: 'Use TIMER <N>MIN CHECK <REF>.' });
      } else {
        parameters.checkReference = tokens.slice(3).map(token => token.normalized).join(' ');
      }
    }
  }

  return createResult('SEARCH', tokens, parameters, errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [], errors);
};

const parseTrackInfoCommand = (tokens: CommandToken[]): ParsedCommand => {
  const command = tokens[0]?.normalized ?? '';
  const parameters: Record<string, string | number | null> = { command };
  const errors: CommandParseError[] = [];
  const references = tokens.slice(1).map(token => token.normalized);

  if (command === 'STALE') {
    if (references.length > 0) {
      errors.push({
        code: 'UNEXPECTED_ARGUMENT',
        message: `Unexpected STALE argument: ${references.join(' ')}.`,
      });
    }
  } else if (references.length === 0) {
    errors.push({
      code: 'INCOMPLETE_COMMAND',
      message: `${command} requires a track reference.`,
      hint: `Use ${command} BRAVO.`,
    });
  } else {
    parameters.reference = references.join(' ');
  }

  return createResult(
    'SEARCH',
    tokens,
    parameters,
    errors.length > 0 ? ['EXECUTION_NOT_ATTEMPTED'] : [],
    errors,
  );
};

const inferIntent = (tokens: CommandToken[], normalizedInput: string): CommandIntentType => {
  if (looksLikeProjection(normalizedInput, tokens)) return 'PROJECTION';

  const command = tokens[0]?.normalized ?? '';

  if (command === 'PROJ' || command === 'PROJECTION') return 'PROJECTION';
  if (command === 'INT') return 'INTERSECTION';
  if (command === 'COORD' || command === 'COORDINATE' || command === 'COPY') return 'COORDINATE';
  if (command === 'PIN' || command === 'FAVORITES' || command === 'UNPIN' || command === 'WITHIN') return 'SEARCH';
  if (command === 'ETA' || command === 'ETE' || command === 'BRG' || command === 'RNG' || command === 'BRG/RNG') {
    return 'MEASUREMENT';
  }
  if (COMMAND_TOKENS.has(command) && ['RADAR', 'ADSB', 'AIS', 'EOTS', 'SIM', 'SYSTEM', 'LAYER', 'LAYERS', 'DECLUTTER', 'LEGEND', 'GRID', 'ZONE'].includes(command)) {
    return 'SYSTEM';
  }
  if (command === 'SEARCH' || command === 'PREDICT' || command === 'NEAREST'
    || command === 'INFO' || command === 'AGE' || command === 'QUALITY' || command === 'STALE'
    || command === 'TIMER' || command === 'TIMERS'
    || (command === 'CANCEL' && tokens[1]?.normalized === 'TIMER')) return 'SEARCH';
  if (command === 'BULL'
    || (command === 'SET' && tokens[1]?.normalized === 'BULL')
    || (command === 'CLEAR' && tokens[1]?.normalized === 'BULL')) return 'BULLSEYE';
  if (command === 'NOTE') return 'NOTE';
  if (command === 'CONVERT' || tokens[1]?.normalized === '>') return 'CALCULATION';
  if (command === 'TIME' || command === 'DIST' || command === 'GS') return 'CALCULATION';
  if (command === 'GRAD' || command === 'VSREQ' || command === 'TOD') return 'CALCULATION';
  if (command === 'RECIP' || command === 'DELTA' || command === 'REL'
    || command === 'CLOSURE' || command === 'CPA') return 'CALCULATION';
  if (command === 'ROUTE' || command === 'LEG' || command === 'NEXT') return 'ROUTE';
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
  if (type === 'INTERSECTION') return parseIntersection(input, tokens);
  if (type === 'BULLSEYE') return parseBullseye(input, tokens);
  if (type === 'COORDINATE') {
    if (tokens[0]?.normalized === 'COPY'
      || tokens[0]?.normalized === 'COORD'
      || tokens[0]?.normalized === 'COORDINATE') {
      return parseCoordinateCommand(input, tokens);
    }
    return parseCoordinate(tokens);
  }

  if (type === 'SYSTEM') {
    if (tokens[0]?.normalized === 'ZONE') return parseZoneCommand(tokens);
    if (tokens[0]?.normalized === 'GRID') return parseGridCommand(tokens);
    if (tokens[0]?.normalized === 'LEGEND') return parseLegendCommand(tokens);
    if (tokens[0]?.normalized === 'DECLUTTER') return parseDeclutterCommand(tokens);
    if (tokens[0]?.normalized === 'LAYER' || tokens[0]?.normalized === 'LAYERS') return parseLayerCommand(tokens);
    if (tokens[0]?.normalized === 'SIM') return parseSimulationCommand(tokens);
    return createResult('SYSTEM', tokens, { system: tokens[1]?.normalized ?? tokens[0].normalized });
  }

  if (type === 'MEASUREMENT') {
    const normalizedCommand = normalizedInput.split(/\s+/)[0] ?? '';
    if (normalizedCommand === 'ETA' || normalizedCommand === 'ETE') {
      return parseEtaEte(input, tokens);
    }
    if (normalizedCommand === 'BRG/RNG' || normalizedCommand === 'BRG' || normalizedCommand === 'RNG') {
      return parseMeasurement(input, tokens);
    }

    return createResult('MEASUREMENT', tokens, {
      command: tokens[0].normalized,
      query: tokens.slice(1).map(token => token.normalized).join(' '),
    });
  }

  if (type === 'SEARCH') {
    if (tokens[0]?.normalized === 'NEAREST') return parseNearest(tokens);
    if (tokens[0]?.normalized === 'PREDICT') return parsePredict(tokens);
    if (tokens[0]?.normalized === 'WITHIN') return parseWithinCommand(tokens);
    if (tokens[0]?.normalized === 'PIN'
      || tokens[0]?.normalized === 'FAVORITES'
      || tokens[0]?.normalized === 'UNPIN') return parseFavoriteCommand(tokens);
    if (tokens[0]?.normalized === 'TIMER'
      || tokens[0]?.normalized === 'TIMERS'
      || (tokens[0]?.normalized === 'CANCEL' && tokens[1]?.normalized === 'TIMER')) return parseTimerCommand(tokens);
    if (tokens[0]?.normalized === 'INFO'
      || tokens[0]?.normalized === 'AGE'
      || tokens[0]?.normalized === 'QUALITY'
      || tokens[0]?.normalized === 'STALE') return parseTrackInfoCommand(tokens);
    return createResult('SEARCH', tokens, {
      query: tokens.slice(1).map(token => token.normalized).join(' '),
    });
  }

  if (type === 'ROUTE') return parseRoute(tokens);

  if (type === 'CALCULATION') {
    if (tokens[0].normalized === 'CONVERT' || tokens[1]?.normalized === '>') {
      return parseUnitConversion(tokens);
    }
    if (tokens[0].normalized === 'GRAD'
      || tokens[0].normalized === 'VSREQ'
      || tokens[0].normalized === 'TOD') {
      return parseVerticalCalculation(tokens);
    }
    if (tokens[0].normalized === 'CLOSURE' || tokens[0].normalized === 'CPA') {
      return parseRelativeMotionCalculation(tokens);
    }
    if (tokens[0].normalized === 'RECIP' || tokens[0].normalized === 'DELTA' || tokens[0].normalized === 'REL') {
      return parseAngularCalculation(tokens);
    }
    if (tokens[0].normalized === 'TIME' || tokens[0].normalized === 'DIST' || tokens[0].normalized === 'GS') {
      return parseTimeDistanceSpeed(input, tokens);
    }
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
