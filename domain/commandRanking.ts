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
  intent?: 'PROJECTION' | 'INTERSECTION' | 'MEASUREMENT';
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

type StructuredRankingFamily =
  | 'ETA_ETE'
  | 'TACTICAL_MEASUREMENT'
  | 'RELATIVE_MOTION'
  | 'TRACK_INFO'
  | 'NEAREST'
  | 'FUTURE_POSITION';

const structuredRankingFamily = (
  parsed: ReturnType<typeof parseCommand>,
): StructuredRankingFamily | undefined => {
  const command = parsed.parameters.command;
  if (parsed.type === 'MEASUREMENT' && (command === 'ETA' || command === 'ETE')) return 'ETA_ETE';
  if (parsed.type === 'MEASUREMENT'
    && (command === 'BRG' || command === 'RNG' || command === 'BRG/RNG')) return 'TACTICAL_MEASUREMENT';
  if (parsed.type === 'CALCULATION' && (command === 'CPA' || command === 'CLOSURE')) return 'RELATIVE_MOTION';
  if (parsed.type === 'SEARCH'
    && (command === 'INFO' || command === 'AGE' || command === 'QUALITY' || command === 'STALE')) return 'TRACK_INFO';
  if (parsed.type === 'SEARCH' && command === 'NEAREST') return 'NEAREST';
  if (parsed.type === 'SEARCH' && command === 'PREDICT') return 'FUTURE_POSITION';
  return undefined;
};

const isStructuredRankingOption = (
  option: CommandRankingItem,
  family: StructuredRankingFamily,
): boolean => {
  const id = option.id.toLowerCase();
  const label = normalizeRankingText(option.label);
  if (family === 'ETA_ETE') return id.startsWith('eta-') || id.startsWith('ete-') || label.startsWith('ETA ') || label.startsWith('ETE ');
  if (family === 'TACTICAL_MEASUREMENT') {
    return id.startsWith('measurement-') || id.startsWith('brg-') || id.startsWith('rng-')
      || label.startsWith('BRG ') || label.startsWith('RNG ') || label.startsWith('BRG/RNG ');
  }
  if (family === 'RELATIVE_MOTION') return id.startsWith('relative-cpa-') || id.startsWith('relative-closure-') || label.startsWith('CPA ') || label.startsWith('CLOSURE ');
  if (family === 'TRACK_INFO') return id.startsWith('track-info-') || id.startsWith('track-age-') || id.startsWith('track-quality-') || id.startsWith('info-') || id.startsWith('age-') || id.startsWith('quality-') || id.startsWith('stale-') || id === 'track-stale' || label.startsWith('INFO ') || label.startsWith('AGE ') || label.startsWith('QUALITY ') || label === 'STALE';
  if (family === 'NEAREST') return id.startsWith('nearest-') || label.startsWith('NEAREST ');
  return id.startsWith('future-position-') || id.startsWith('predict-') || label.startsWith('PREDICT ');
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
  const structuredFamily = structuredRankingFamily(parsed);
  const isTacticalMeasurementQuery = parsed.type === 'MEASUREMENT'
    && ['BRG', 'RNG', 'BRG/RNG'].includes(String(parsed.parameters.command));
  const isBearingIntersectionQuery = parsed.type === 'INTERSECTION';
  const eligibleOptions = structuredFamily
    ? options.filter(option => isStructuredRankingOption(option, structuredFamily))
    : isProjectionQuery
    ? options.filter(option => option.ranking?.intent === 'PROJECTION')
    : isTacticalMeasurementQuery
      ? options.filter(option => option.ranking?.intent === 'MEASUREMENT')
      : isBearingIntersectionQuery
        ? options.filter(option => option.ranking?.intent === 'INTERSECTION')
        : options;

  return [...eligibleOptions].sort(compareCommands);
};
