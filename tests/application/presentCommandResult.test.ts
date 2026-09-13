import { describe, expect, it } from 'vitest';
import {
  createAmbiguousCommandResult,
  createPartialCommandResult,
  displayValue,
  mapCommandReason,
} from '../../domain/commandResults';
import { presentCommandResult } from '../../application/presentCommandResult';

describe('presentCommandResult', () => {
  it('presents the primary value, units, and input qualifications without recalculating', () => {
    const result = createPartialCommandResult({
      id: 'eta-ownship-bravo',
      kind: 'READ_ONLY',
      references: ['ownship', 'bravo'],
      qualifications: [
        { input: 'POSITION', origin: 'GPS', objectId: 'ownship', status: 'AVAILABLE' },
        { input: 'SPEED', origin: 'USER_INPUT', status: 'AVAILABLE', assumption: 'SPEED HYPOTHESIS' },
        { input: 'CLOCK', origin: 'SCENARIO', status: 'MISSING' },
      ],
      capabilities: ['COPY', 'DETAILS'],
      primary: displayValue('ETE', '10', 'MIN'),
      secondary: [displayValue('Distance', '20', 'NM')],
      reason: mapCommandReason('SCENARIO_TIME_UNAVAILABLE'),
    });

    const presentation = presentCommandResult(result);

    expect(presentation.id).toBe('eta-ownship-bravo');
    expect(presentation.state).toBe('PARTIAL');
    expect(presentation.primary).toEqual({ label: 'ETE', value: '10', unit: 'MIN' });
    expect(presentation.lines).toContain('ETE: 10 MIN');
    expect(presentation.lines).toContain('Distance: 20 NM');
    expect(presentation.lines).toContain('POSITION: GPS');
    expect(presentation.lines).toContain('SPEED: USER_INPUT · SPEED HYPOTHESIS');
    expect(presentation.lines).toContain('REASON CODE: CLOCK_MISSING');
    expect(presentation.lines).toContain('REASON: The scenario clock is unavailable; elapsed time remains available.');
    expect(presentation.lines).toContain('RAW CODE: SCENARIO_TIME_UNAVAILABLE');
  });

  it('presents ambiguity candidates and the remedy without inventing a primary value', () => {
    const result = createAmbiguousCommandResult({
      id: 'cpa-hostile',
      kind: 'READ_ONLY',
      references: ['HOSTILE'],
      capabilities: ['DETAILS'],
      candidates: [
        { id: 'hostile-1', label: 'HOSTILE 1' },
        { id: 'hostile-2', label: 'HOSTILE 2' },
      ],
      reason: mapCommandReason('AMBIGUOUS_REFERENCE'),
    });

    const presentation = presentCommandResult(result);

    expect(presentation.primary).toBeUndefined();
    expect(presentation.lines).toContain('STATE: AMBIGUOUS');
    expect(presentation.lines).toContain('CANDIDATE: HOSTILE 1 (hostile-1)');
    expect(presentation.lines).toContain('CANDIDATE: HOSTILE 2 (hostile-2)');
    expect(presentation.lines).toContain('REASON: The reference matches multiple scenario entities.');
    expect(presentation.lines).toContain('REMEDY: Choose one listed candidate.');
  });
});
