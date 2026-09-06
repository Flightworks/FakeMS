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

  it('parses nearest queries with a category, optional limit, and optional reference', () => {
    const waypoint = parseCommand('NEAREST WAYPOINT');
    expect(waypoint.type).toBe('SEARCH');
    expect(waypoint.parameters).toMatchObject({
      command: 'NEAREST',
      category: 'WAYPOINT',
      limit: 1,
      reference: 'OWNSHIP',
    });
    expect(waypoint.errors).toEqual([]);

    const tracks = parseCommand('nearest 3 tracks');
    expect(tracks.parameters).toMatchObject({
      command: 'NEAREST',
      category: 'TRACK',
      limit: 3,
      reference: 'OWNSHIP',
    });
    expect(tracks.errors).toEqual([]);

    const fromReference = parseCommand('NEAREST BRAVO WAYPOINT');
    expect(fromReference.parameters).toMatchObject({
      command: 'NEAREST',
      category: 'WAYPOINT',
      limit: 1,
      reference: 'BRAVO',
    });
    expect(fromReference.errors).toEqual([]);
  });

  it('rejects unknown coordinate formats and COPY POS prefixes', () => {
    for (const input of ['COPY POS BRAVO MGRS', 'COPY POSITIVE BRAVO DD']) {
      const parsed = parseCommand(input);

      expect(parsed.type).toBe('COORDINATE');
      expect(parsed.errors.length).toBeGreaterThan(0);
      expect(parsed.warnings).toContain('EXECUTION_NOT_ATTEMPTED');
    }
  });

  it('rejects an unknown nearest category and invalid result limits', () => {
    for (const input of ['NEAREST PARK', 'NEAREST 0 TRACKS', 'NEAREST 1.5 TRACKS']) {
      const parsed = parseCommand(input);
      expect(parsed.type, input).toBe('SEARCH');
      expect(parsed.errors, input).toEqual([
        expect.objectContaining({ code: expect.any(String) }),
      ]);
      expect(parsed.warnings, input).toContain('EXECUTION_NOT_ATTEMPTED');
    }
  });

  it('parses coordinate display formats and local coordinate copy commands', () => {
    for (const format of ['DD', 'DDM', 'DMS']) {
      const parsed = parseCommand(`COORD BRAVO ${format}`);
      expect(parsed.type, format).toBe('COORDINATE');
      expect(parsed.parameters, format).toMatchObject({
        command: 'COORD',
        reference: 'BRAVO',
        format,
      });
      expect(parsed.errors, format).toEqual([]);
    }

    const literal = parseCommand('COORD 34.08,-118.15 DDM');
    expect(literal.parameters).toMatchObject({
      command: 'COORD',
      latitude: 34.08,
      longitude: -118.15,
      format: 'DDM',
    });
    expect(literal.errors).toEqual([]);

    const copy = parseCommand('COPY POS BRAVO');
    expect(copy.type).toBe('COORDINATE');
    expect(copy.parameters).toMatchObject({ command: 'COPY POS', reference: 'BRAVO', format: 'DD' });
    expect(copy.errors).toEqual([]);
  });

  it('rejects unsupported coordinate output formats before execution', () => {
    const parsed = parseCommand('COORD BRAVO MGRS');
    expect(parsed.type).toBe('COORDINATE');
    expect(parsed.errors).toEqual([
      expect.objectContaining({ code: 'UNEXPECTED_ARGUMENT' }),
    ]);
    expect(parsed.warnings).toContain('EXECUTION_NOT_ATTEMPTED');
  });

  it('parses two explicit bearing lines without executing an intersection', () => {
    const parsed = parseCommand('INT BRAVO/090 G01/180');

    expect(parsed.type).toBe('INTERSECTION');
    expect(parsed.parameters).toMatchObject({
      command: 'INT',
      firstReference: 'BRAVO',
      firstBearing: 90,
      secondReference: 'G01',
      secondBearing: 180,
    });
    expect(parsed.errors).toEqual([]);
  });

  it('rejects incomplete or out-of-range bearing intersections', () => {
    for (const input of ['INT BRAVO/090', 'INT BRAVO/360 G01/180', 'INT BRAVO/090 G01/-1']) {
      const parsed = parseCommand(input);

      expect(parsed.type, input).toBe('INTERSECTION');
      expect(parsed.errors.length, input).toBeGreaterThan(0);
      expect(parsed.warnings, input).toContain('EXECUTION_NOT_ATTEMPTED');
    }
  });

  it('parses explicit Bullseye set, measurement, projection, and clear commands', () => {
    const set = parseCommand('SET BULL BRAVO');
    expect(set.type).toBe('BULLSEYE');
    expect(set.parameters).toMatchObject({ command: 'SET BULL', reference: 'BRAVO' });
    expect(set.errors).toEqual([]);

    const measurement = parseCommand('BULL HOSTILE 1');
    expect(measurement.type).toBe('BULLSEYE');
    expect(measurement.parameters).toMatchObject({ command: 'BULL', targetReference: 'HOSTILE 1' });
    expect(measurement.errors).toEqual([]);

    const projection = parseCommand('BULL 270/15');
    expect(projection.type).toBe('BULLSEYE');
    expect(projection.parameters).toMatchObject({ command: 'BULL', bearing: 270, range: 15, unit: 'NM' });
    expect(projection.assumptions).toContain('ASSUMED NM');
    expect(projection.errors).toEqual([]);

    const clear = parseCommand('CLEAR BULL');
    expect(clear.type).toBe('BULLSEYE');
    expect(clear.parameters).toMatchObject({ command: 'CLEAR BULL' });
    expect(clear.errors).toEqual([]);
  });

  it('rejects incomplete Bullseye mutations and projections without execution', () => {
    for (const input of ['SET BULL', 'CLEAR BULL NOW', 'BULL 360/15', 'BULL 270']) {
      const parsed = parseCommand(input);

      expect(parsed.type, input).toBe('BULLSEYE');
      expect(parsed.errors.length, input).toBeGreaterThan(0);
      expect(parsed.warnings, input).toContain('EXECUTION_NOT_ATTEMPTED');
    }
  });

  it('parses reciprocal and delta angular calculations without executing them', () => {
    const reciprocal = parseCommand('RECIP 273');
    expect(reciprocal.type).toBe('CALCULATION');
    expect(reciprocal.parameters).toMatchObject({ command: 'RECIP', angle: 273, angleKind: 'HEADING' });
    expect(reciprocal.errors).toEqual([]);

    const delta = parseCommand('DELTA 350 010');
    expect(delta.type).toBe('CALCULATION');
    expect(delta.parameters).toMatchObject({ command: 'DELTA', fromAngle: 350, toAngle: 10, angleKind: 'HEADING' });
    expect(delta.errors).toEqual([]);
  });

  it('parses relative bearing forms with an explicit observer', () => {
    const ownship = parseCommand('REL BRAVO');
    expect(ownship.type).toBe('CALCULATION');
    expect(ownship.parameters).toMatchObject({
      command: 'REL',
      fromReference: 'OWNSHIP',
      toReference: 'BRAVO',
    });
    expect(ownship.errors).toEqual([]);

    const explicit = parseCommand('REL G01 BRAVO');
    expect(explicit.parameters).toMatchObject({
      command: 'REL',
      fromReference: 'G01',
      toReference: 'BRAVO',
    });
    expect(explicit.errors).toEqual([]);
  });

  it('rejects invalid angular values and unexpected angular arguments', () => {
    for (const input of ['RECIP 360', 'DELTA 350 010 EXTRA', 'REL']) {
      const parsed = parseCommand(input);
      expect(parsed.type, input).toBe('CALCULATION');
      expect(parsed.errors.length, input).toBeGreaterThan(0);
      expect(parsed.warnings, input).toContain('EXECUTION_NOT_ATTEMPTED');
    }
  });
});
