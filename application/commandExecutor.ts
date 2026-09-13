export interface CommandIntent {
  commandId: string;
  query: string;
}

export interface CommandExecutableOption {
  id: string;
  action?: () => void;
  disabled?: boolean;
  dragDropEligible?: boolean;
}

export interface CommandExecutionPolicy {
  requireDragDropEligible?: boolean;
}

export const resolveCommandIntent = <T extends { id: string }>(
  options: readonly T[],
  intent: CommandIntent,
): T | null => options.find(option => option.id === intent.commandId) ?? null;

/**
 * Resolve and invoke one semantic command effect. Every UI entry point uses
 * this boundary so stale, disabled, or read-only options cannot execute.
 */
export const executeCommandIntent = <T extends CommandExecutableOption>(
  options: readonly T[],
  intent: CommandIntent,
  policy: CommandExecutionPolicy = {},
): T | null => {
  const matched = resolveCommandIntent(options, intent);
  if (!matched
    || matched.disabled
    || !matched.action
    || (policy.requireDragDropEligible && !matched.dragDropEligible)) return null;
  matched.action();
  return matched;
};
