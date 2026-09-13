import { describe, expect, it } from 'vitest';
import {
  createAmbiguousCommandResult,
  createAvailableCommandResult,
  createIncompleteCommandResult,
  createPartialCommandResult,
  createUnavailableCommandResult,
  displayValue,
  mapCommandReason,
  type InputQualification,
} from '../../domain/commandResults';

describe('command result envelope', () => {
  it('creates an immutable available result with unit-bearing values and provenance', () => {
    const qualification: InputQualification = {
      input: 'SPEED',
      origin: 'SCENARIO',
      objectId: 'ownship',
      qualification: 'SIMULATED',
    };

    const result = createAvailableCommandResult({
      id: 'ete-ownship-bravo',
      kind: 'READ_ONLY',
      references: ['ownship', 'bravo'],
      qualifications: [qualification],
      capabilities: ['COPY', 'DETAILS'],
      primary: displayValue('ETE', '10', 'MIN'),
      secondary: [displayValue('Distance', '20', 'NM')],
    });

    expect(result.state).toBe('AVAILABLE');
    expect(result.primary).toEqual({ label: 'ETE', value: '10', unit: 'MIN' });
    expect(result.secondary[0]).toEqual({ label: 'Distance', value: '20', unit: 'NM' });
    expect(result.qualifications).toEqual([qualification]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.primary)).toBe(true);
    expect(Object.isFrozen(result.secondary)).toBe(true);
  });

  it('represents a partial result when ETE is available but ETA is not', () => {
    const result = createPartialCommandResult({
      id: 'eta-ownship-bravo',
      kind: 'READ_ONLY',
      references: ['ownship', 'bravo'],
      capabilities: ['COPY', 'DETAILS'],
      primary: displayValue('ETE', '10', 'MIN'),
      secondary: [displayValue('Distance', '20', 'NM')],
      reason: mapCommandReason('SCENARIO_TIME_UNAVAILABLE'),
    });

    expect(result.state).toBe('PARTIAL');
    expect(result.reason.code).toBe('CLOCK_MISSING');
    expect(result.reason.rawCode).toBe('SCENARIO_TIME_UNAVAILABLE');
    expect(result.primary.unit).toBe('MIN');
    expect(result.details).toContainEqual({
      label: 'TECHNICAL REASON',
      value: 'SCENARIO_TIME_UNAVAILABLE',
    });
  });

  it('keeps incomplete and unavailable results distinct', () => {
    const incomplete = createIncompleteCommandResult({
      id: 'eta-incomplete',
      kind: 'READ_ONLY',
      references: [],
      capabilities: ['DETAILS'],
      reason: mapCommandReason('INCOMPLETE'),
    });
    const unavailable = createUnavailableCommandResult({
      id: 'ete-no-speed',
      kind: 'READ_ONLY',
      references: ['ownship', 'bravo'],
      capabilities: ['DETAILS'],
      reason: mapCommandReason('SPEED_UNAVAILABLE'),
    });

    expect(incomplete.state).toBe('INCOMPLETE');
    expect(incomplete.reason.code).toBe('INPUT_INCOMPLETE');
    expect(unavailable.state).toBe('UNAVAILABLE');
    expect(unavailable.reason.code).toBe('SPEED_MISSING');
    expect(unavailable.reason.rawCode).toBe('SPEED_UNAVAILABLE');
    expect('primary' in unavailable).toBe(false);
  });

  it('retains exact ambiguity candidates without selecting one', () => {
    const result = createAmbiguousCommandResult({
      id: 'cpa-ambiguous-hostile',
      kind: 'READ_ONLY',
      references: ['HOSTILE'],
      capabilities: ['DETAILS'],
      candidates: [
        { id: 'hostile-1', label: 'HOSTILE 1' },
        { id: 'hostile-2', label: 'HOSTILE 2' },
      ],
      reason: mapCommandReason('AMBIGUOUS_REFERENCE'),
    });

    expect(result.state).toBe('AMBIGUOUS');
    expect(result.candidates).toEqual([
      { id: 'hostile-1', label: 'HOSTILE 1' },
      { id: 'hostile-2', label: 'HOSTILE 2' },
    ]);
    expect(result.reason.code).toBe('REFERENCE_AMBIGUOUS');
    expect(Object.isFrozen(result.candidates)).toBe(true);
  });

  it('maps technical reasons to user-facing reasons while retaining raw codes', () => {
    const cases = [
      ['SPEED_STALE', 'GROUND_SPEED_STALE'],
      ['MISSING_GROUND_TRACK', 'VECTOR_MISSING'],
      ['UNKNOWN_FRESHNESS', 'FRESHNESS_UNKNOWN'],
      ['WAYPOINT_QUALITY_NON_APPLICABLE', 'QUALITY_NOT_APPLICABLE'],
    ] as const;

    cases.forEach(([rawCode, code]) => {
      const reason = mapCommandReason(rawCode);
      expect(reason.code).toBe(code);
      expect(reason.rawCode).toBe(rawCode);
      expect(reason.message.length).toBeGreaterThan(0);
    });
  });

  it('remains JSON serializable and freezes nested envelope data', () => {
    const result = createPartialCommandResult({
      id: 'future-bravo',
      kind: 'MAP_PREVIEW',
      references: ['bravo'],
      qualifications: [{
        input: 'VECTOR',
        origin: 'RETAINED_FIX',
        objectId: 'bravo',
        ageSeconds: 42,
        status: 'STALE',
        assumption: 'CONSTANT VELOCITY',
      }],
      capabilities: ['DETAILS', 'MAP_PREVIEW'],
      primary: displayValue('GHOST', 'UNAVAILABLE', 'LAT/LON'),
      secondary: [],
      reason: mapCommandReason('STALE_TRACK'),
    });

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(Object.isFrozen(result.qualifications[0])).toBe(true);
    expect(Object.isFrozen(result.reason)).toBe(true);
    expect(Object.isFrozen(result.reason.rawCodes)).toBe(true);
  });
});
