export const METERS_PER_NAUTICAL_MILE = 1852;

export type TacticalUnitSymbol = 'NM' | 'KM' | 'M' | 'FT' | 'KT' | 'KMH' | 'S' | 'MIN' | 'H' | 'DEG';

export type TacticalUnitDimension = 'DISTANCE' | 'SPEED' | 'TIME' | 'ANGLE';

export interface TacticalUnitDefinition {
  symbol: TacticalUnitSymbol;
  dimension: TacticalUnitDimension;
  factorToBase: number;
  aliases: readonly string[];
}

export interface TacticalQuantity {
  originalValue: number;
  originalUnit: string | null;
  value: number;
  unit: TacticalUnitSymbol;
  dimension: TacticalUnitDimension;
  assumed: boolean;
}

export type TacticalUnitErrorCode =
  | 'UNKNOWN_UNIT'
  | 'NON_FINITE_VALUE'
  | 'INCOMPATIBLE_UNITS'
  | 'INVALID_VALUE';

export class TacticalUnitError extends Error {
  readonly code: TacticalUnitErrorCode;

  constructor(code: TacticalUnitErrorCode, message: string) {
    super(message);
    this.name = 'TacticalUnitError';
    this.code = code;
    Object.setPrototypeOf(this, TacticalUnitError.prototype);
  }
}

export interface TacticalQuantityOptions {
  allowZero?: boolean;
  allowNegative?: boolean;
  allowImplicitNauticalMile?: boolean;
}

const definitions: readonly TacticalUnitDefinition[] = [
  {
    symbol: 'NM',
    dimension: 'DISTANCE',
    factorToBase: METERS_PER_NAUTICAL_MILE,
    aliases: ['NM', 'NMI', 'MN', 'NAUTICAL MILE', 'NAUTICAL MILES', 'MILLE NAUTIQUE', 'MILLES NAUTIQUES'],
  },
  {
    symbol: 'KM',
    dimension: 'DISTANCE',
    factorToBase: 1000,
    aliases: ['KM'],
  },
  {
    symbol: 'M',
    dimension: 'DISTANCE',
    factorToBase: 1,
    aliases: ['M', 'METER', 'METERS'],
  },
  {
    symbol: 'FT',
    dimension: 'DISTANCE',
    factorToBase: 0.3048,
    aliases: ['FT', 'FEET'],
  },
  {
    symbol: 'KT',
    dimension: 'SPEED',
    factorToBase: METERS_PER_NAUTICAL_MILE / 3600,
    aliases: ['KT', 'KTS', 'KNOT', 'KNOTS'],
  },
  {
    symbol: 'KMH',
    dimension: 'SPEED',
    factorToBase: 1000 / 3600,
    aliases: ['KMH', 'KM/H'],
  },
  {
    symbol: 'S',
    dimension: 'TIME',
    factorToBase: 1,
    aliases: ['S', 'SEC'],
  },
  {
    symbol: 'MIN',
    dimension: 'TIME',
    factorToBase: 60,
    aliases: ['MIN'],
  },
  {
    symbol: 'H',
    dimension: 'TIME',
    factorToBase: 3600,
    aliases: ['H', 'HR'],
  },
  {
    symbol: 'DEG',
    dimension: 'ANGLE',
    factorToBase: 1,
    aliases: ['DEG', '°'],
  },
];

const definitionsByAlias = new Map<string, TacticalUnitDefinition>();
for (const definition of definitions) {
  for (const alias of definition.aliases) {
    definitionsByAlias.set(alias.toUpperCase(), definition);
  }
}

export function normalizeTacticalUnit(input: string): TacticalUnitDefinition {
  const normalized = input.trim().toUpperCase();
  const definition = definitionsByAlias.get(normalized);
  if (!definition) {
    throw new TacticalUnitError('UNKNOWN_UNIT', `Unknown tactical unit: ${input}`);
  }
  return definition;
}

export function createTacticalQuantity(
  value: number,
  unit?: string,
  options: TacticalQuantityOptions = {},
): TacticalQuantity {
  if (!Number.isFinite(value)) {
    throw new TacticalUnitError('NON_FINITE_VALUE', 'Tactical quantity value must be finite');
  }
  if (value === 0 && options.allowZero !== true) {
    throw new TacticalUnitError('INVALID_VALUE', 'Zero tactical quantity values are not allowed');
  }
  if (value < 0 && options.allowNegative !== true) {
    throw new TacticalUnitError('INVALID_VALUE', 'Negative tactical quantity values are not allowed');
  }

  const assumed = unit === undefined;
  if (assumed && options.allowImplicitNauticalMile !== true) {
    throw new TacticalUnitError('INVALID_VALUE', 'A tactical quantity unit is required');
  }

  const originalUnit = unit ?? null;
  const definition = normalizeTacticalUnit(unit ?? 'NM');
  return {
    originalValue: value,
    originalUnit,
    value,
    unit: definition.symbol,
    dimension: definition.dimension,
    assumed,
  };
}

export function convertTacticalQuantity(
  quantity: TacticalQuantity,
  targetUnit: string,
): TacticalQuantity {
  const sourceDefinition = normalizeTacticalUnit(quantity.unit);
  const targetDefinition = normalizeTacticalUnit(targetUnit);
  if (sourceDefinition.dimension !== targetDefinition.dimension) {
    throw new TacticalUnitError(
      'INCOMPATIBLE_UNITS',
      `Cannot convert ${sourceDefinition.symbol} to ${targetDefinition.symbol}`,
    );
  }

  return {
    originalValue: quantity.originalValue,
    originalUnit: quantity.originalUnit,
    value: quantity.value * sourceDefinition.factorToBase / targetDefinition.factorToBase,
    unit: targetDefinition.symbol,
    dimension: targetDefinition.dimension,
    assumed: quantity.assumed,
  };
}
