import { describe, expect, it } from 'vitest';
import {
  METERS_PER_NAUTICAL_MILE,
  TacticalUnitError,
  convertTacticalQuantity,
  createTacticalQuantity,
  normalizeTacticalUnit,
} from '../../domain/tacticalUnits';

describe('tactical unit dictionary', () => {
  it('normalizes every supported distance alias case-insensitively with outer whitespace', () => {
    const aliases: Array<[string, string]> = [
      [' NM ', 'NM'],
      ['nmi', 'NM'],
      ['Nautical Mile', 'NM'],
      ['nautical miles', 'NM'],
      [' km ', 'KM'],
      ['M', 'M'],
      ['meter', 'M'],
      ['METERS', 'M'],
      [' ft ', 'FT'],
      ['feet', 'FT'],
    ];

    for (const [input, symbol] of aliases) {
      expect(normalizeTacticalUnit(input).symbol, input).toBe(symbol);
      expect(normalizeTacticalUnit(input).dimension, input).toBe('DISTANCE');
    }
  });

  it('normalizes speed, time, and angle aliases', () => {
    const aliases: Array<[string, string, string]> = [
      ['KT', 'KT', 'SPEED'],
      ['kts', 'KT', 'SPEED'],
      ['Knot', 'KT', 'SPEED'],
      ['KNOTS', 'KT', 'SPEED'],
      [' KMH ', 'KMH', 'SPEED'],
      ['km/h', 'KMH', 'SPEED'],
      ['s', 'S', 'TIME'],
      ['sec', 'S', 'TIME'],
      ['min', 'MIN', 'TIME'],
      ['h', 'H', 'TIME'],
      ['hr', 'H', 'TIME'],
      ['deg', 'DEG', 'ANGLE'],
      [' ° ', 'DEG', 'ANGLE'],
    ];

    for (const [input, symbol, dimension] of aliases) {
      const definition = normalizeTacticalUnit(input);
      expect(definition.symbol, input).toBe(symbol);
      expect(definition.dimension, input).toBe(dimension);
    }
  });

  it('keeps metres distinct from nautical miles and exposes deterministic factors', () => {
    expect(METERS_PER_NAUTICAL_MILE).toBe(1852);
    expect(normalizeTacticalUnit('M')).toMatchObject({
      symbol: 'M',
      dimension: 'DISTANCE',
      factorToBase: 1,
    });
    expect(normalizeTacticalUnit('NM')).toMatchObject({
      symbol: 'NM',
      dimension: 'DISTANCE',
      factorToBase: 1852,
    });
    expect(normalizeTacticalUnit('FT').factorToBase).toBe(0.3048);
    expect(normalizeTacticalUnit('KT').factorToBase).toBe(1852 / 3600);
    expect(normalizeTacticalUnit('KMH').factorToBase).toBe(1000 / 3600);
    expect(normalizeTacticalUnit('S').factorToBase).toBe(1);
    expect(normalizeTacticalUnit('MIN').factorToBase).toBe(60);
    expect(normalizeTacticalUnit('H').factorToBase).toBe(3600);
    expect(normalizeTacticalUnit('DEG').factorToBase).toBe(1);
  });

  it('rejects unknown units with a structured error code', () => {
    try {
      normalizeTacticalUnit('parsecs');
      throw new Error('expected normalizeTacticalUnit to reject the unit');
    } catch (error) {
      expect(error).toBeInstanceOf(TacticalUnitError);
      expect((error as TacticalUnitError).code).toBe('UNKNOWN_UNIT');
    }
  });

  it('converts distance quantities through metres while preserving origin metadata', () => {
    const quantity = createTacticalQuantity(2, ' NM ');
    const converted = convertTacticalQuantity(quantity, 'km');

    expect(converted.value).toBeCloseTo(3.704, 12);
    expect(converted.unit).toBe('KM');
    expect(converted.dimension).toBe('DISTANCE');
    expect(converted.originalValue).toBe(2);
    expect(converted.originalUnit).toBe(' NM ');
    expect(converted.assumed).toBe(false);
  });

  it('converts metre and imperial distance values without treating M as NM', () => {
    const metres = createTacticalQuantity(1852, 'M');
    const nauticalMiles = convertTacticalQuantity(metres, 'NM');
    const feet = convertTacticalQuantity(createTacticalQuantity(1, 'FT'), 'M');

    expect(nauticalMiles.value).toBe(1);
    expect(nauticalMiles.unit).toBe('NM');
    expect(feet.value).toBeCloseTo(0.3048, 12);
    expect(feet.unit).toBe('M');
  });

  it('converts speed, time, and angle quantities using their base factors', () => {
    const speed = convertTacticalQuantity(createTacticalQuantity(100, 'KT'), 'KM/H');
    const time = convertTacticalQuantity(createTacticalQuantity(2, 'MIN'), 'H');
    const angle = convertTacticalQuantity(createTacticalQuantity(180, 'DEG'), '°');

    expect(speed.value).toBeCloseTo(185.2, 12);
    expect(speed.unit).toBe('KMH');
    expect(speed.dimension).toBe('SPEED');
    expect(time.value).toBeCloseTo(1 / 30, 12);
    expect(time.unit).toBe('H');
    expect(time.dimension).toBe('TIME');
    expect(angle.value).toBe(180);
    expect(angle.unit).toBe('DEG');
    expect(angle.dimension).toBe('ANGLE');
  });

  it('rejects conversions between incompatible dimensions', () => {
    try {
      convertTacticalQuantity(createTacticalQuantity(10, 'NM'), 'KT');
      throw new Error('expected incompatible conversion to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(TacticalUnitError);
      expect((error as TacticalUnitError).code).toBe('INCOMPATIBLE_UNITS');
    }
  });

  it('rejects non-finite values with a structured error code', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      try {
        createTacticalQuantity(value, 'NM');
        throw new Error('expected non-finite value to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(TacticalUnitError);
        expect((error as TacticalUnitError).code).toBe('NON_FINITE_VALUE');
      }
    }
  });

  it('rejects missing units unless implicit nautical miles are explicitly enabled', () => {
    try {
      createTacticalQuantity(10);
      throw new Error('expected a missing unit to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(TacticalUnitError);
      expect((error as TacticalUnitError).code).toBe('INVALID_VALUE');
    }

    const implicit = createTacticalQuantity(10, undefined, {
      allowImplicitNauticalMile: true,
    });
    const converted = convertTacticalQuantity(implicit, 'KM');

    expect(implicit).toEqual({
      originalValue: 10,
      originalUnit: null,
      value: 10,
      unit: 'NM',
      dimension: 'DISTANCE',
      assumed: true,
    });
    expect(converted.value).toBeCloseTo(18.52, 12);
    expect(converted.originalUnit).toBeNull();
    expect(converted.assumed).toBe(true);
  });

  it('rejects zero and negative values by default and accepts only explicit overrides', () => {
    for (const value of [0, -1]) {
      try {
        createTacticalQuantity(value, 'M');
        throw new Error('expected invalid value to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(TacticalUnitError);
        expect((error as TacticalUnitError).code).toBe('INVALID_VALUE');
      }
    }

    expect(createTacticalQuantity(0, 'M', { allowZero: true }).value).toBe(0);
    expect(createTacticalQuantity(-1, 'M', { allowNegative: true }).value).toBe(-1);

    expect(() => createTacticalQuantity(0, 'M', { allowNegative: true })).toThrow(TacticalUnitError);
    expect(() => createTacticalQuantity(-1, 'M', { allowZero: true })).toThrow(TacticalUnitError);
  });
});
