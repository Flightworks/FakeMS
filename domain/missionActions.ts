export type MissionActionStatus =
  | 'PROPOSED'
  | 'PREVIEWED'
  | 'AUTHORIZED'
  | 'REJECTED'
  | 'EXECUTING_SIM'
  | 'COMPLETED_SIM'
  | 'FAILED_SIM'
  | 'NOT_IMPLEMENTED';

export type MissionActionImplementation = 'SIMULATED_EFFECT' | 'NOT_IMPLEMENTED';

export type MissionActionCategory = 'NAV' | 'ENGAGE' | 'COMMS' | 'SENSORS' | 'ADMIN' | 'DROP' | 'TOOLS' | 'VIEW';

export interface MissionActionRequest {
  id: string;
  label: string;
  category: MissionActionCategory;
  targetId?: string;
  issuedAt: number;
  implementation: MissionActionImplementation;
  requiresAuthorization: boolean;
}

export interface MissionActionJournalEntry {
  actionId: string;
  status: MissionActionStatus;
  at: number;
  label: string;
  targetId?: string;
  reason?: string;
}

export interface MissionActionRecord extends MissionActionRequest {
  status: MissionActionStatus;
  authorizedAt?: number;
  completedAt?: number;
  failureReason?: string;
}

export const isSensitiveMissionAction = (request: MissionActionRequest): boolean =>
  request.requiresAuthorization;
