import { describe, expect, it } from 'vitest';
import { parseCommand } from '../../domain/commandParser';

describe('projection bearing/range grammar', () => {
  it.each([
    ['BRAVO 180/5', ['ASSUMED NM']],
    ['BRAVO 180/5 NM', []],
    ['BRAVO 180 5NM', []],
    ['FROM BRAVO 180/5NM', []],
  ])('normalizes %s as a projection from the named reference', (input, assumptions) => {
    const parsed = parseCommand(input);

    expect(parsed.type).toBe('PROJECTION');
    expect(parsed.errors).toEqual([]);
    expect(parsed.parameters).toMatchObject({
      reference: 'BRAVO',
      target: 'BRAVO',
      bearing: 180,
      range: 5,
      unit: 'NM',
      canonical: 'FROM BRAVO BRG 180°T RNG 5.0 NM',
    });
    expect(parsed.assumptions).toEqual(assumptions);
  });

  it('keeps a numeric suffix in a multi-word reference', () => {
    const parsed = parseCommand('HOSTILE 1 090/5');

    expect(parsed.type).toBe('PROJECTION');
    expect(parsed.errors).toEqual([]);
    expect(parsed.parameters).toMatchObject({
      reference: 'HOSTILE 1',
      target: 'HOSTILE 1',
      bearing: 90,
      range: 5,
      unit: 'NM',
      canonical: 'FROM HOSTILE 1 BRG 90°T RNG 5.0 NM',
    });
  });

  it('accepts labeled bearing and range clauses', () => {
    const parsed = parseCommand('BRAVO BRG 180 RNG 5 NM');

    expect(parsed.type).toBe('PROJECTION');
    expect(parsed.errors).toEqual([]);
    expect(parsed.parameters).toMatchObject({
      reference: 'BRAVO',
      bearing: 180,
      range: 5,
      unit: 'NM',
      canonical: 'FROM BRAVO BRG 180°T RNG 5.0 NM',
    });
  });

  it('keeps a numeric suffix in a labeled multi-word reference', () => {
    const parsed = parseCommand('HOSTILE 1 BRG 180 RNG 5 NM');

    expect(parsed.type).toBe('PROJECTION');
    expect(parsed.errors).toEqual([]);
    expect(parsed.parameters).toMatchObject({
      reference: 'HOSTILE 1',
      target: 'HOSTILE 1',
      bearing: 180,
      range: 5,
      unit: 'NM',
      canonical: 'FROM HOSTILE 1 BRG 180°T RNG 5.0 NM',
    });
  });

  it('uses the ownship as the reference when no reference is written', () => {
    const parsed = parseCommand('180/5');

    expect(parsed.type).toBe('PROJECTION');
    expect(parsed.errors).toEqual([]);
    expect(parsed.parameters).toMatchObject({
      reference: 'OWNSHIP',
      bearing: 180,
      range: 5,
      unit: 'NM',
      canonical: 'FROM OWNSHIP BRG 180°T RNG 5.0 NM',
    });
    expect(parsed.assumptions).toEqual(['ASSUMED NM']);
  });

  it('accepts explicit distance aliases and preserves normalized units', () => {
    const parsed = parseCommand('BRAVO 090/9.26KM');

    expect(parsed.type).toBe('PROJECTION');
    expect(parsed.errors).toEqual([]);
    expect(parsed.parameters).toMatchObject({
      reference: 'BRAVO',
      bearing: 90,
      range: 9.26,
      unit: 'KM',
      canonical: 'FROM BRAVO BRG 90°T RNG 9.3 KM',
    });
    expect(parsed.assumptions).toEqual([]);
  });

  it.each([
    ['BRAVO 360/5NM', 'INVALID_BEARING'],
    ['BRAVO -1/5NM', 'INVALID_BEARING'],
    ['BRAVO 180/0NM', 'INVALID_RANGE'],
    ['BRAVO 180/-5NM', 'INVALID_RANGE'],
    ['BRAVO 180/5XX', 'UNKNOWN_UNIT'],
  ])('rejects invalid projection input %s', (input, code) => {
    const parsed = parseCommand(input);

    expect(parsed.type).toBe('PROJECTION');
    expect(parsed.errors).toEqual([
      expect.objectContaining({ code }),
    ]);
    expect(parsed.warnings).toContain('EXECUTION_NOT_ATTEMPTED');
  });

  it('rejects trailing projection arguments instead of silently ignoring them', () => {
    const parsed = parseCommand('BRAVO 180/5 NM EXTRA');

    expect(parsed.type).toBe('PROJECTION');
    expect(parsed.errors).toContainEqual(
      expect.objectContaining({ code: 'UNEXPECTED_ARGUMENT' }),
    );
    expect(parsed.parameters).not.toHaveProperty('canonical');
    expect(parsed.warnings).toContain('EXECUTION_NOT_ATTEMPTED');
  });

  it.each([
    'BRAVO/180 5',
    'BRAVO 180//5',
  ])('rejects malformed compact projection separators in %s', input => {
    const parsed = parseCommand(input);

    expect(parsed.type).toBe('PROJECTION');
    expect(parsed.errors).toContainEqual(
      expect.objectContaining({ code: 'INVALID_SYNTAX' }),
    );
    expect(parsed.parameters).not.toHaveProperty('canonical');
    expect(parsed.assumptions).toEqual([]);
    expect(parsed.warnings).toContain('EXECUTION_NOT_ATTEMPTED');
  });

  it('rejects a missing range and keeps the completed reference and bearing', () => {
    const parsed = parseCommand('FROM BRAVO 180/');

    expect(parsed.type).toBe('PROJECTION');
    expect(parsed.parameters).toMatchObject({
      reference: 'BRAVO',
      bearing: 180,
    });
    expect(parsed.errors).toEqual([
      expect.objectContaining({ code: 'INCOMPLETE_COMMAND' }),
    ]);
    expect(parsed.warnings).toContain('EXECUTION_NOT_ATTEMPTED');
  });

  it('does not allow a speed unit in a projection range', () => {
    const parsed = parseCommand('BRAVO 180/5KT');

    expect(parsed.type).toBe('PROJECTION');
    expect(parsed.errors).toEqual([
      expect.objectContaining({ code: 'INCOMPATIBLE_UNIT' }),
    ]);
  });
});
