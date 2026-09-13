import { describe, expect, it, vi } from 'vitest';
import { executeCommandIntent, resolveCommandIntent, type CommandIntent } from '../../application/commandExecutor';

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

  it('executes only the resolved enabled action once', () => {
    const focus = vi.fn();
    const other = vi.fn();
    const commands = [
      { id: 'focus-bravo', action: focus },
      { id: 'other', action: other },
    ];

    const executed = executeCommandIntent(commands, {
      commandId: 'focus-bravo',
      query: 'FOCUS BRAVO',
    });

    expect(executed).toBe(commands[0]);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });

  it('rejects a map drop unless the option explicitly opts in', () => {
    const readOnly = vi.fn();

    const executed = executeCommandIntent([{
      id: 'read-only',
      action: readOnly,
    }], {
      commandId: 'read-only',
      query: 'READ ONLY',
    }, { requireDragDropEligible: true });

    expect(executed).toBeNull();
    expect(readOnly).not.toHaveBeenCalled();
  });
});
