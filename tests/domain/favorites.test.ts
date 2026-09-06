import { describe, expect, it } from 'vitest';
import {
  addFavorite,
  createFavoriteState,
  loadFavoriteState,
  removeFavorite,
} from '../../domain/favorites';

describe('command favorites', () => {
  it('adds a command favorite with stable order and no execution metadata', () => {
    const result = addFavorite(createFavoriteState(), {
      kind: 'COMMAND',
      label: 'ETA BRAVO',
      command: 'ETA BRAVO',
    });

    expect(result.status).toBe('AVAILABLE');
    expect(result.state).toMatchObject({ version: 1, nextId: 2 });
    expect(result.state.items).toEqual([
      expect.objectContaining({ id: 1, kind: 'COMMAND', label: 'ETA BRAVO', command: 'ETA BRAVO' }),
    ]);
    expect(result.state.items[0]).not.toHaveProperty('result');
    expect(result.state.items[0]).not.toHaveProperty('position');
  });

  it('rejects duplicates and keeps insertion order stable', () => {
    const first = addFavorite(createFavoriteState(), {
      kind: 'COMMAND', label: 'ETA BRAVO', command: 'eta bravo',
    }).state;
    const duplicate = addFavorite(first, {
      kind: 'COMMAND', label: 'ETA BRAVO', command: 'ETA BRAVO',
    });

    expect(duplicate.status).toBe('UNAVAILABLE');
    if (duplicate.status === 'UNAVAILABLE') expect(duplicate.reason).toBe('DUPLICATE');
    expect(duplicate.state.items).toHaveLength(1);
  });

  it('rejects position, secret, empty, and invalid favorite content', () => {
    for (const command of ['', 'LAT 34 LON -118', 'USE PASSWORD hunter2']) {
      const result = addFavorite(createFavoriteState(), {
        kind: 'COMMAND', label: command, command,
      });
      expect(result.status, command).toBe('UNAVAILABLE');
    }
  });

  it('removes only the requested favorite', () => {
    let state = createFavoriteState();
    state = addFavorite(state, { kind: 'COMMAND', label: 'ETA BRAVO', command: 'ETA BRAVO' }).state;
    state = addFavorite(state, { kind: 'TEMPLATE', label: 'BRG/RNG', command: 'G01 BRG/RNGNM' }).state;

    const removed = removeFavorite(state, 1);
    expect(removed.items.map(item => item.id)).toEqual([2]);
    expect(state.items).toHaveLength(2);
  });

  it('migrates invalid storage to an empty versioned state', () => {
    expect(loadFavoriteState('{"version":99,"items":[]}')).toEqual(createFavoriteState());
    expect(loadFavoriteState('{"version":1,"items":[{"id":1,"command":"ETA BRAVO"}]}')).toEqual(createFavoriteState());
    expect(loadFavoriteState('not-json')).toEqual(createFavoriteState());
  });
});
