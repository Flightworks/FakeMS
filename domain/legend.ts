import { EntityType } from '../types';

export type LegendEntryKind = 'SYMBOL' | 'LAYER';
export type LegendEntryId =
  | 'SYMBOL_OWNSHIP'
  | 'SYMBOL_HOSTILE'
  | 'SYMBOL_WAYPOINT'
  | 'SYMBOL_AIRPORT'
  | 'LAYER_TRACKS'
  | 'LAYER_VECTORS'
  | 'LAYER_ROUTE';

export interface LegendEntry {
  id: LegendEntryId;
  kind: LegendEntryKind;
  label: string;
  meaning: string;
  source: string;
  simulatedState: string;
}

const LEGEND_ENTRIES: readonly LegendEntry[] = [
  {
    id: 'SYMBOL_OWNSHIP',
    kind: 'SYMBOL',
    label: 'OWNSHIP',
    meaning: 'Simulated ownship helicopter symbol',
    source: 'LOCAL SIMULATION SYMBOLOGY',
    simulatedState: 'SIMULATED',
  },
  {
    id: 'SYMBOL_HOSTILE',
    kind: 'SYMBOL',
    label: 'HOSTILE',
    meaning: 'Simulated hostile track symbol',
    source: 'LOCAL SIMULATION SYMBOLOGY',
    simulatedState: 'SIMULATED',
  },
  {
    id: 'SYMBOL_WAYPOINT',
    kind: 'SYMBOL',
    label: 'WAYPOINT',
    meaning: 'Simulated waypoint/control measure symbol',
    source: 'LOCAL SIMULATION SYMBOLOGY',
    simulatedState: 'SIMULATED',
  },
  {
    id: 'SYMBOL_AIRPORT',
    kind: 'SYMBOL',
    label: 'AIRPORT',
    meaning: 'Simulated airport/installations symbol',
    source: 'LOCAL SIMULATION SYMBOLOGY',
    simulatedState: 'SIMULATED',
  },
  {
    id: 'LAYER_TRACKS',
    kind: 'LAYER',
    label: 'TRACKS',
    meaning: 'Rendered local scenario entities',
    source: 'LOCAL SIMULATION ENTITIES',
    simulatedState: 'LOCAL DISPLAY',
  },
  {
    id: 'LAYER_VECTORS',
    kind: 'LAYER',
    label: 'VECTORS',
    meaning: 'Rendered local kinematic vectors',
    source: 'LOCAL KINEMATICS',
    simulatedState: 'LOCAL DISPLAY',
  },
  {
    id: 'LAYER_ROUTE',
    kind: 'LAYER',
    label: 'ROUTE',
    meaning: 'Rendered local simulated route',
    source: 'LOCAL SIMULATED ROUTE',
    simulatedState: 'LOCAL DISPLAY',
  },
];

export const getLegendEntries = (): readonly LegendEntry[] => LEGEND_ENTRIES.map(entry => ({ ...entry }));

export const getLegendEntry = (id: LegendEntryId): LegendEntry | null => {
  const entry = LEGEND_ENTRIES.find(candidate => candidate.id === id);
  return entry ? { ...entry } : null;
};

export const getLegendSymbolId = (entityType: EntityType): LegendEntryId => {
  switch (entityType) {
    case EntityType.OWNSHIP: return 'SYMBOL_OWNSHIP';
    case EntityType.ENEMY: return 'SYMBOL_HOSTILE';
    case EntityType.AIRPORT: return 'SYMBOL_AIRPORT';
    case EntityType.WAYPOINT:
    case EntityType.FRIENDLY:
    default: return 'SYMBOL_WAYPOINT';
  }
};
