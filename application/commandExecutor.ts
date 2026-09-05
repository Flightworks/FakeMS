export interface CommandIntent {
  commandId: string;
  query: string;
}

export const resolveCommandIntent = <T extends { id: string }>(
  options: readonly T[],
  intent: CommandIntent,
): T | null => options.find(option => option.id === intent.commandId) ?? null;
