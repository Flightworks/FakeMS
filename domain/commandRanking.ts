import { parseCommand } from './commandParser';

export type CommandRankingCategory =
  | 'STRUCTURED_EXACT'
  | 'STRUCTURED_PARTIAL'
  | 'ENTITY_EXACT'
  | 'ENTITY_AMBIGUOUS'
  | 'FUZZY'
  | 'SAVE';

export type CommandRankingMatch = 'EXACT' | 'PREFIX' | 'FUZZY';

export interface CommandRankingMetadata {
  category: CommandRankingCategory;
  completeness: number;
  match: CommandRankingMatch;
  intent?: 'PROJECTION' | 'MEASUREMENT';
}

export interface CommandRankingItem {
  id: string;
  label: string;
  ranking?: CommandRankingMetadata;
}

const CATEGORY_PRIORITY: Record<CommandRankingCategory, number> = {
  STRUCTURED_EXACT: 0,
  STRUCTURED_PARTIAL: 1,
  ENTITY_EXACT: 2,
  ENTITY_AMBIGUOUS: 3,
  FUZZY: 4,
  SAVE: 5,
};

const MATCH_PRIORITY: Record<CommandRankingMatch, number> = {
  EXACT: 0,
  PREFIX: 1,
  FUZZY: 2,
};

const normalizeRankingText = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .replace(/\s+/g, ' ')
  .toUpperCase();

const defaultRanking: CommandRankingMetadata = {
  category: 'FUZZY',
  completeness: 0,
  match: 'FUZZY',
};

const compareText = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const compareCommands = <T extends CommandRankingItem>(left: T, right: T): number => {
  const leftRanking = left.ranking ?? defaultRanking;
  const rightRanking = right.ranking ?? defaultRanking;

  const categoryDifference = CATEGORY_PRIORITY[leftRanking.category]
    - CATEGORY_PRIORITY[rightRanking.category];
  if (categoryDifference !== 0) return categoryDifference;

  const completenessDifference = rightRanking.completeness - leftRanking.completeness;
  if (completenessDifference !== 0) return completenessDifference;

  const matchDifference = MATCH_PRIORITY[leftRanking.match] - MATCH_PRIORITY[rightRanking.match];
  if (matchDifference !== 0) return matchDifference;

  const labelDifference = compareText(
    normalizeRankingText(left.label),
    normalizeRankingText(right.label),
  );
  if (labelDifference !== 0) return labelDifference;

  return compareText(left.id, right.id);
};

export const rankCommandOptions = <T extends CommandRankingItem>(
  query: string,
  options: readonly T[],
): T[] => {
  const parsed = parseCommand(query);
  const isProjectionQuery = parsed.type === 'PROJECTION';
  const isTacticalMeasurementQuery = parsed.type === 'MEASUREMENT'
    && ['BRG', 'RNG', 'BRG/RNG'].includes(String(parsed.parameters.command));
  const eligibleOptions = isProjectionQuery
    ? options.filter(option => option.ranking?.intent === 'PROJECTION')
    : isTacticalMeasurementQuery
      ? options.filter(option => option.ranking?.intent === 'MEASUREMENT')
      : options;

  return [...eligibleOptions].sort(compareCommands);
};
