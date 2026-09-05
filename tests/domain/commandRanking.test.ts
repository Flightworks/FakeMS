import { describe, expect, it } from 'vitest';
import {
  rankCommandOptions,
  type CommandRankingMetadata,
} from '../../domain/commandRanking';

interface TestCommand {
  id: string;
  label: string;
  ranking: CommandRankingMetadata;
}

const command = (
  id: string,
  label: string,
  ranking: CommandRankingMetadata,
): TestCommand => ({ id, label, ranking });

describe('deterministic command ranking', () => {
  it('orders the six ranking categories independently of insertion order', () => {
    const options = [
      command('save', 'SAVE: BRAVO', {
        category: 'SAVE',
        completeness: 0,
        match: 'FUZZY',
      }),
      command('fuzzy', 'Open: README.md', {
        category: 'FUZZY',
        completeness: 1,
        match: 'FUZZY',
      }),
      command('ambiguous', 'BRAVO 1', {
        category: 'ENTITY_AMBIGUOUS',
        completeness: 2,
        match: 'PREFIX',
      }),
      command('entity', 'BRAVO', {
        category: 'ENTITY_EXACT',
        completeness: 3,
        match: 'EXACT',
      }),
      command('partial', 'COS(', {
        category: 'STRUCTURED_PARTIAL',
        completeness: 1,
        match: 'PREFIX',
      }),
      command('structured', 'COS(45) = 0.707', {
        category: 'STRUCTURED_EXACT',
        completeness: 3,
        match: 'EXACT',
      }),
    ];

    const expectedOrder = [
      'structured',
      'partial',
      'entity',
      'ambiguous',
      'fuzzy',
      'save',
    ];

    expect(rankCommandOptions('BRAVO', options).map(option => option.id)).toEqual(expectedOrder);
    expect(rankCommandOptions('BRAVO', [...options].reverse()).map(option => option.id))
      .toEqual(expectedOrder);
  });

  it('uses completeness, match quality, normalized label, then stable id as tie-breakers', () => {
    const options = [
      command('z-prefix', 'ALFA', {
        category: 'FUZZY',
        completeness: 2,
        match: 'PREFIX',
      }),
      command('b-exact', 'Zulu', {
        category: 'FUZZY',
        completeness: 2,
        match: 'EXACT',
      }),
      command('c-alfa', 'Alfa', {
        category: 'FUZZY',
        completeness: 2,
        match: 'EXACT',
      }),
      command('a-alfa', 'ALFA', {
        category: 'FUZZY',
        completeness: 2,
        match: 'EXACT',
      }),
      command('high', 'Zulu', {
        category: 'FUZZY',
        completeness: 3,
        match: 'FUZZY',
      }),
    ];

    expect(rankCommandOptions('anything', options).map(option => option.id)).toEqual([
      'high',
      'a-alfa',
      'c-alfa',
      'b-exact',
      'z-prefix',
    ]);
  });

  it('keeps system and save results out of a recognized projection ranking', () => {
    const options = [
      command('save', 'SAVE: BRAVO 180/5', {
        category: 'SAVE',
        completeness: 0,
        match: 'FUZZY',
      }),
      command('radar', 'RADAR', {
        category: 'FUZZY',
        completeness: 3,
        match: 'EXACT',
      }),
      command('projection', 'PROJ: BRAVO BRG 180°/RNG 5NM', {
        category: 'STRUCTURED_EXACT',
        completeness: 3,
        match: 'EXACT',
        intent: 'PROJECTION',
      }),
    ];

    expect(rankCommandOptions('BRAVO 180/5', options).map(option => option.id)).toEqual(['projection']);
  });
});
