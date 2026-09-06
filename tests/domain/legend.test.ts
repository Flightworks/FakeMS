import { describe, expect, it } from 'vitest';
import {
  getLegendEntries,
  getLegendEntry,
  getLegendSymbolId,
} from '../../domain/legend';
import { EntityType } from '../../types';

describe('contextual legend registry', () => {
  it('shares deterministic metadata for symbols and local layers', () => {
    const entries = getLegendEntries();
    expect(entries.map(entry => entry.id)).toEqual([
      'SYMBOL_OWNSHIP',
      'SYMBOL_HOSTILE',
      'SYMBOL_WAYPOINT',
      'SYMBOL_AIRPORT',
      'LAYER_TRACKS',
      'LAYER_VECTORS',
      'LAYER_ROUTE',
    ]);
    expect(getLegendEntry('SYMBOL_HOSTILE')).toMatchObject({
      label: 'HOSTILE',
      meaning: 'Simulated hostile track symbol',
      source: 'LOCAL SIMULATION SYMBOLOGY',
    });
  });

  it('maps rendered entity symbols to the same registry identifiers', () => {
    expect(getLegendSymbolId(EntityType.OWNSHIP)).toBe('SYMBOL_OWNSHIP');
    expect(getLegendSymbolId(EntityType.ENEMY)).toBe('SYMBOL_HOSTILE');
    expect(getLegendSymbolId(EntityType.WAYPOINT)).toBe('SYMBOL_WAYPOINT');
    expect(getLegendSymbolId(EntityType.AIRPORT)).toBe('SYMBOL_AIRPORT');
  });
});
