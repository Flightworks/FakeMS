import { describe, expect, it } from 'vitest';
import {
  calculateDelta,
  calculateReciprocal,
  calculateRelativeBearing,
} from '../../domain/angularCalculations';

describe('angular tactical calculations', () => {
  it('calculates a reciprocal heading with explicit semantic kinds', () => {
    const result = calculateReciprocal(273, 'HEADING');

    expect(result).toMatchObject({
      operation: 'RECIPROCAL',
      inputKind: 'HEADING',
      outputKind: 'HEADING',
      status: 'AVAILABLE',
      valueDegrees: 93,
    });
    expect(result.source).toContain('HEADING');
  });

  it('preserves track and true-bearing semantics for reciprocal values', () => {
    expect(calculateReciprocal(12, 'TRACK')).toMatchObject({
      inputKind: 'TRACK',
      outputKind: 'TRACK',
      valueDegrees: 192,
    });
    expect(calculateReciprocal(180, 'TRUE_BEARING')).toMatchObject({
      inputKind: 'TRUE_BEARING',
      outputKind: 'TRUE_BEARING',
      valueDegrees: 0,
    });
  });

  it('reports the shortest right-hand delta across north', () => {
    const result = calculateDelta(350, 10, 'HEADING');

    expect(result).toMatchObject({
      operation: 'DELTA',
      inputKind: 'HEADING',
      outputKind: 'HEADING',
      status: 'AVAILABLE',
      direction: 'RIGHT',
      deltaDegrees: 20,
      signedDeltaDegrees: 20,
    });
  });

  it('reports a left-hand delta and keeps track semantics explicit', () => {
    const result = calculateDelta(10, 350, 'TRACK');

    expect(result).toMatchObject({
      inputKind: 'TRACK',
      outputKind: 'TRACK',
      direction: 'LEFT',
      deltaDegrees: 20,
      signedDeltaDegrees: -20,
    });
  });

  it('calculates a relative bearing from a true bearing and a heading', () => {
    const result = calculateRelativeBearing(10, 350);

    expect(result).toMatchObject({
      operation: 'RELATIVE',
      inputKind: 'TRUE_BEARING',
      outputKind: 'RELATIVE_BEARING',
      status: 'AVAILABLE',
      valueDegrees: 20,
      referenceKind: 'HEADING',
    });
    expect(result.source).toContain('TRUE_BEARING');
    expect(result.source).toContain('HEADING');
  });

  it('returns a structured unavailable result for non-finite input', () => {
    const result = calculateDelta(Number.NaN, 10, 'HEADING');

    expect(result).toMatchObject({
      operation: 'DELTA',
      status: 'UNAVAILABLE',
      valueDegrees: null,
      reason: 'INVALID_ANGLE',
    });
  });
});
