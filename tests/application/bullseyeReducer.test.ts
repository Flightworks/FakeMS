import { describe, expect, it } from 'vitest';
import { createBullseye } from '../../domain/bullseye';
import {
  bullseyeReducer,
  createBullseyeState,
} from '../../application/bullseyeReducer';

const reference = createBullseye({
  id: 'wp-2',
  label: 'BRAVO',
  position: { lat: 48, lon: 2 },
});

const replacement = createBullseye({
  id: 'wp-1',
  label: 'G01',
  position: { lat: 48.1, lon: 2.1 },
});

describe('Bullseye simulated state', () => {
  it('starts without an implicit Bullseye and changes only on confirmed simulation', () => {
    const initial = createBullseyeState();
    expect(initial.bullseye).toBeNull();

    const proposedOnly = bullseyeReducer(initial, {
      type: 'SET_BULLSEYE_PROPOSED',
      bullseye: reference,
    });
    expect(proposedOnly).toBe(initial);

    const confirmed = bullseyeReducer(initial, {
      type: 'SET_BULLSEYE_CONFIRMED',
      bullseye: reference,
    });
    expect(confirmed.bullseye).toEqual(reference);
    expect(confirmed.bullseye).not.toBe(reference);
  });

  it('replaces the sole reference only after confirmed simulation and can clear it', () => {
    const initial = bullseyeReducer(createBullseyeState(), {
      type: 'SET_BULLSEYE_CONFIRMED',
      bullseye: reference,
    });
    const replaced = bullseyeReducer(initial, {
      type: 'SET_BULLSEYE_CONFIRMED',
      bullseye: replacement,
    });

    expect(replaced.bullseye).toMatchObject({ entityId: 'wp-1', label: 'G01' });
    expect(replaced.events.map(event => event.type)).toEqual([
      'SET_BULLSEYE_CONFIRMED',
      'SET_BULLSEYE_CONFIRMED',
    ]);

    const cleared = bullseyeReducer(replaced, { type: 'CLEAR_BULLSEYE_CONFIRMED' });
    expect(cleared.bullseye).toBeNull();
    expect(cleared.events.at(-1)).toMatchObject({ type: 'CLEAR_BULLSEYE_CONFIRMED' });
  });
});
