export type CommandIntentType =
  | 'PROJECTION'
  | 'INTERSECTION'
  | 'COORDINATE'
  | 'MEASUREMENT'
  | 'SYSTEM'
  | 'CALCULATION'
  | 'ROUTE'
  | 'SEARCH'
  | 'BULLSEYE'
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
  | 'INVALID_NUMBER'
  | 'INVALID_BEARING'
  | 'INVALID_RANGE'
  | 'UNKNOWN_UNIT'
  | 'INCOMPATIBLE_UNIT'
  | 'INVALID_SYNTAX'
  | 'UNEXPECTED_ARGUMENT';

export interface CommandParseError {
  code: CommandErrorCode;
  message: string;
  hint?: string;
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
