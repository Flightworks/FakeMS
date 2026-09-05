import type {
  CommandIntentType,
  CommandParseError,
  CommandToken,
  ParsedCommand,
} from './commandLanguage';

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
): ParsedCommand => ({
  type,
  tokens,
  parameters,
  assumptions: [],
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

const parseProjection = (tokens: CommandToken[]): ParsedCommand => {
  const targetToken = tokens[1];
  const bearingToken = tokens[2];
  const rangeToken = tokens[3];
  const parameters: Record<string, string | number | null> = {};
  const errors: CommandParseError[] = [];
  const warnings: string[] = [];

  if (targetToken) parameters.target = targetToken.normalized;

  if (!targetToken || !bearingToken || !rangeToken) {
    errors.push({
      code: 'INCOMPLETE_COMMAND',
      message: 'Projection requires a target, bearing, and range.',
    });
  }

  const bearing = parseFiniteNumber(bearingToken);
  if (bearingToken) {
    parameters.bearing = bearing;
    if (hasNonFiniteToken(bearingToken)) errors.push(nonFiniteError());
  }

  if (rangeToken) {
    const rangeMatch = rangeToken.normalized.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(.*)$/);
    const rangeValue = rangeMatch ? Number(rangeMatch[1]) : null;
    const unit = rangeMatch?.[2] ?? '';
    parameters.range = Number.isFinite(rangeValue) ? rangeValue : null;
    if (unit) parameters.unit = unit;

    if (hasNonFiniteToken(rangeToken)) {
      errors.push(nonFiniteError());
    } else if (rangeValue === null || !Number.isFinite(rangeValue)) {
      errors.push({ code: 'INVALID_NUMBER', message: 'Range must be numeric.' });
    } else if (!unit) {
      errors.push({ code: 'MISSING_UNIT', message: 'Projection range requires an explicit unit.' });
    }
  }

  if (errors.length > 0) warnings.push('EXECUTION_NOT_ATTEMPTED');
  return createResult('PROJECTION', tokens, parameters, warnings, errors);
};

const inferIntent = (tokens: CommandToken[], normalizedInput: string): CommandIntentType => {
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
  if (type === 'PROJECTION') return parseProjection(tokens);
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
