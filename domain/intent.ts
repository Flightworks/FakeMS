import type { Position } from '../types';

export type MissionObjective = 'THREAT_PRIORITY' | 'COVERAGE' | 'ENDURANCE';

export interface MissionIntent {
  id: string;
  objective: MissionObjective;
  target: Position;
  createdAt: number;
}
