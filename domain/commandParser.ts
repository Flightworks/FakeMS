import type {
  CommandIntentType,
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
  'TIME',
  'DIST',
  'GS',
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
  if (command === 'TIME' || command === 'DIST' || command === 'GS') return 'CALCULATION';
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
    return createResult('SEARCH', tokens, {
      query: tokens.slice(1).map(token => token.normalized).join(' '),
    });
  }

  if (type === 'CALCULATION') {
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
