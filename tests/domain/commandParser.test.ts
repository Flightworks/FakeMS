import { describe, expect, it } from 'vitest';
import { parseCommand } from '../../domain/commandParser';
import type { CommandIntentType } from '../../domain/commandLanguage';

describe('typed tactical command parser', () => {
  it('returns a deterministic NOTE for an empty command', () => {
    const parsed = parseCommand('   ');

    expect(parsed.type).toBe<CommandIntentType>('NOTE');
    expect(parsed.tokens).toEqual([]);
    expect(parsed.parameters).toEqual({ text: '' });
    expect(parsed.errors).toEqual([]);
    expect(parsed.warnings).toContain('EMPTY_INPUT');
  });

  it('normalizes case, accents, and repeated whitespace', () => {
    const parsed = parseCommand('  cÖördínaté   48.5,   2.3  ');

    expect(parsed.type).toBe('COORDINATE');
    expect(parsed.tokens.map(token => token.normalized)).toEqual([
      'COORDINATE',
      '48.5',
      '2.3',
    ]);
    expect(parsed.parameters).toEqual({ latitude: 48.5, longitude: 2.3 });
    expect(parsed.assumptions).toEqual([]);
    expect(parsed.errors).toEqual([]);
  });

  it('recognizes each supported intent family without executing it', () => {
    const examples: Array<[string, CommandIntentType]> = [
      ['PROJ G01 090/10NM', 'PROJECTION'],
      ['COORDINATE 48.5 2.3', 'COORDINATE'],
      ['ETA G01 NM', 'MEASUREMENT'],
      ['RADAR', 'SYSTEM'],
      ['2 + 2', 'CALCULATION'],
      ['SEARCH G01', 'SEARCH'],
      ['NOTE check fuel', 'NOTE'],
    ];

    for (const [input, type] of examples) {
      const parsed = parseCommand(input);
      expect(parsed.type, input).toBe(type);
      expect(parsed.errors, input).toEqual([]);
    }
  });

  it('reports a structured error for a partial projection', () => {
    const parsed = parseCommand('PROJ G01');

    expect(parsed.type).toBe('PROJECTION');
    expect(parsed.parameters).toEqual({ target: 'G01' });
    expect(parsed.errors).toEqual([
      expect.objectContaining({ code: 'INCOMPLETE_COMMAND' }),
    ]);
    expect(parsed.warnings).toContain('EXECUTION_NOT_ATTEMPTED');
  });

  it('does not invent projection units or execution details', () => {
    const parsed = parseCommand('PROJ G01 090 10');

    expect(parsed.type).toBe('PROJECTION');
    expect(parsed.parameters).toMatchObject({ target: 'G01', bearing: 90, range: 10 });
    expect(parsed.errors).toEqual([
      expect.objectContaining({ code: 'MISSING_UNIT' }),
    ]);
    expect(parsed.warnings).toContain('EXECUTION_NOT_ATTEMPTED');
  });

  it('rejects non-finite numbers as structured input errors', () => {
    for (const input of ['COORDINATE NaN 2', 'COORDINATE Infinity 2', 'CALC Infinity']) {
      const parsed = parseCommand(input);

      expect(parsed.errors, input).toEqual([
        expect.objectContaining({ code: 'NON_FINITE_NUMBER' }),
      ]);
      expect(JSON.stringify(parsed)).not.toMatch(/Infinity|NaN/);
    }
  });

  it('returns a canonical, stable object independent of parser call order', () => {
    const first = JSON.stringify(parseCommand('  sYsTèm   rAdAr  '));
    const second = JSON.stringify(parseCommand('  sYsTèm   rAdAr  '));

    expect(first).toBe(second);
    expect(JSON.parse(first)).toEqual({
      type: 'SYSTEM',
      tokens: [
        { kind: 'COMMAND', raw: 'sYsTèm', normalized: 'SYSTEM' },
        { kind: 'ARGUMENT', raw: 'rAdAr', normalized: 'RADAR' },
      ],
      parameters: { system: 'RADAR' },
      assumptions: [],
      warnings: [],
      errors: [],
    });
  });

  it('parses BRG/RNG measurement references without executing them', () => {
    const parsed = parseCommand('BRG/RNG G01 BRAVO');

    expect(parsed.type).toBe('MEASUREMENT');
    expect(parsed.parameters).toMatchObject({
      command: 'BRG/RNG',
      fromReference: 'G01',
      toReference: 'BRAVO',
    });
    expect(parsed.errors).toEqual([]);
  });

  it('defaults single-reference BRG and RNG measurements to the ownship', () => {
    for (const input of ['BRG BRAVO', 'RNG BRAVO']) {
      const parsed = parseCommand(input);

      expect(parsed.type, input).toBe('MEASUREMENT');
      expect(parsed.parameters, input).toMatchObject({
        fromReference: 'OWNSHIP',
        toReference: 'BRAVO',
      });
      expect(parsed.errors, input).toEqual([]);
    }
  });

  it('parses ETA and ETE references with an explicit ground-speed assumption', () => {
    const eta = parseCommand('ETA BRAVO @ 140KT');
    expect(eta.parameters).toMatchObject({
      command: 'ETA',
      fromReference: 'OWNSHIP',
      toReference: 'BRAVO',
      speed: 140,
      speedUnit: 'KT',
      speedAssumed: 'USER ASSUMPTION',
    });
    expect(eta.errors).toEqual([]);

    const ete = parseCommand('ETE G01 BRAVO @ 120KT');
    expect(ete.parameters).toMatchObject({
      command: 'ETE',
      fromReference: 'G01',
      toReference: 'BRAVO',
      speed: 120,
      speedUnit: 'KT',
      speedAssumed: 'USER ASSUMPTION',
    });
    expect(ete.errors).toEqual([]);
  });

  it('rejects a user ETA speed without an explicit speed unit', () => {
    const parsed = parseCommand('ETA BRAVO @ 140');

    expect(parsed.type).toBe('MEASUREMENT');
    expect(parsed.errors).toEqual([
      expect.objectContaining({ code: 'MISSING_UNIT' }),
    ]);
    expect(parsed.warnings).toContain('EXECUTION_NOT_ATTEMPTED');
  });

  it('parses TIME, DIST, and GS commands with normalized quantities', () => {
    const time = parseCommand('TIME 45NM @ 120KT');
    expect(time.type).toBe('CALCULATION');
    expect(time.parameters).toMatchObject({
      command: 'TIME',
      distance: 45,
      distanceUnit: 'NM',
      speed: 120,
      speedUnit: 'KT',
    });
    expect(time.errors).toEqual([]);

    const distance = parseCommand('DIST 15MIN @ 120KT');
    expect(distance.parameters).toMatchObject({
      command: 'DIST',
      time: 15,
      timeUnit: 'MIN',
      speed: 120,
      speedUnit: 'KT',
    });
    expect(distance.errors).toEqual([]);

    const speed = parseCommand('GS 40NM / 20MIN');
    expect(speed.parameters).toMatchObject({
      command: 'GS',
      distance: 40,
      distanceUnit: 'NM',
      time: 20,
      timeUnit: 'MIN',
    });
    expect(speed.errors).toEqual([]);
  });

  it('parses read-only route summary commands and rejects extra route arguments', () => {
    const status = parseCommand('ROUTE STATUS');
    expect(status.type).toBe('ROUTE');
    expect(status.parameters).toMatchObject({ command: 'STATUS' });
    expect(status.errors).toEqual([]);

    const leg = parseCommand('LEG');
    expect(leg.type).toBe('ROUTE');
    expect(leg.parameters).toMatchObject({ command: 'LEG' });
    expect(leg.errors).toEqual([]);

    const next = parseCommand('NEXT');
    expect(next.type).toBe('ROUTE');
    expect(next.parameters).toMatchObject({ command: 'NEXT' });
    expect(next.errors).toEqual([]);

    const ete = parseCommand('ROUTE ETE');
    expect(ete.type).toBe('ROUTE');
    expect(ete.parameters).toMatchObject({ command: 'ETE' });
    expect(ete.errors).toEqual([]);

    const invalid = parseCommand('ROUTE HIDDEN');
    expect(invalid.type).toBe('ROUTE');
    expect(invalid.errors).toEqual([
      expect.objectContaining({ code: 'UNEXPECTED_ARGUMENT' }),
    ]);
  });
});
