import { describe, expect, it } from 'vitest';
import {
  appendCommandHistory,
  type CommandHistoryEntry,
} from '../../domain/commandHistory';

describe('command history', () => {
  it('preserves original and canonical forms while trimming whitespace', () => {
    const history = appendCommandHistory([], {
      original: '  dct   bravo  ',
      canonical: 'DCT BRAVO',
      timestamp: 1,
    });

    expect(history).toEqual([{
      original: 'dct   bravo',
      canonical: 'DCT BRAVO',
      timestamp: 1,
    }]);
  });

  it('keeps at most 100 current-tab entries and moves duplicates to the front', () => {
    let history: CommandHistoryEntry[] = [];
    for (let index = 0; index < 101; index += 1) {
      history = appendCommandHistory(history, {
        original: `command ${index}`,
        canonical: `COMMAND ${index}`,
        timestamp: index,
      });
    }

    expect(history).toHaveLength(100);
    expect(history[0]?.canonical).toBe('COMMAND 100');
    expect(history.at(-1)?.canonical).toBe('COMMAND 1');

    const updated = appendCommandHistory(history, {
      original: ' command 50 ',
      canonical: 'COMMAND 50',
      timestamp: 200,
    });
    expect(updated).toHaveLength(100);
    expect(updated[0]).toEqual({
      original: 'command 50',
      canonical: 'COMMAND 50',
      timestamp: 200,
    });
    expect(updated.filter(entry => entry.canonical === 'COMMAND 50')).toHaveLength(1);
  });
});
