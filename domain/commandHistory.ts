import type { HistoryEntry } from '../types';

export const MAX_COMMAND_HISTORY_ENTRIES = 100;

export type CommandHistoryEntry = HistoryEntry;

export const canonicalizeCommandInput = (query: string): string => (
  query.trim().replace(/\s+/g, ' ').toUpperCase()
);

export const appendCommandHistory = (
  history: readonly CommandHistoryEntry[],
  entry: CommandHistoryEntry,
): CommandHistoryEntry[] => {
  const original = entry.original.trim();
  const canonical = entry.canonical.trim();
  if (!original || !canonical) return [...history];

  const withoutDuplicate = history.filter(previous => (
    previous.original !== original && previous.canonical !== canonical
  ));
  return [
    { original, canonical, timestamp: entry.timestamp },
    ...withoutDuplicate,
  ].slice(0, MAX_COMMAND_HISTORY_ENTRIES);
};
