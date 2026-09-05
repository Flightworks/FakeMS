export type CommandIntentType =
  | 'PROJECTION'
  | 'COORDINATE'
  | 'MEASUREMENT'
  | 'SYSTEM'
  | 'CALCULATION'
  | 'SEARCH'
  | 'NOTE';

export type CommandTokenKind = 'COMMAND' | 'ARGUMENT';

export interface CommandToken {
  kind: CommandTokenKind;
  raw: string;
  normalized: string;
}

export type CommandErrorCode =
  | 'INCOMPLETE_COMMAND'
  | 'MISSING_UNIT'
  | 'NON_FINITE_NUMBER'
  | 'INVALID_NUMBER';

export interface CommandParseError {
  code: CommandErrorCode;
  message: string;
}

export type CommandParameter = string | number | null;

export interface ParsedCommand {
  type: CommandIntentType;
  tokens: CommandToken[];
  parameters: Record<string, CommandParameter>;
  assumptions: string[];
  warnings: string[];
  errors: CommandParseError[];
}
