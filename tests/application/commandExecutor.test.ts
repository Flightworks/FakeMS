import { describe, expect, it } from 'vitest';
import { resolveCommandIntent, type CommandIntent } from '../../application/commandExecutor';

const options = [
  { id: 'focus-bravo', label: 'FOCUS BRAVO' },
  { id: 'proj-focus', label: 'PROJ BRAVO 180/5NM' },
];

describe('command execution intent', () => {
  it('resolves the exact command id selected by the user', () => {
    const intent: CommandIntent = {
      commandId: 'proj-focus',
      query: 'BRAVO 180/5NM',
    };

    expect(resolveCommandIntent(options, intent)).toEqual(options[1]);
  });

  it('does not execute another command when the selected id is absent', () => {
    const intent: CommandIntent = {
      commandId: 'stale-command-id',
      query: 'BRAVO 180/5NM',
    };

    expect(resolveCommandIntent(options, intent)).toBeNull();
  });
});
