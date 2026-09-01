import type { Position } from '../types';
import type { MissionObjective } from './intent';

export type RouteProposalVariant = 'DIRECT' | 'RETURN_AWARE';
export type RouteProposalStatus = 'FEASIBLE' | 'CONSTRAINED' | 'PROHIBITED';
export type ProposalReasonCategory = 'OBJECTIVE' | 'CONSTRAINT' | 'TRADEOFF';

export interface ProposalReason {
  code: string;
  category: ProposalReasonCategory;
  message: string;
}

export interface ProposalMargins {
  fuelUnits: number;
  fuelRatio: number | null;
  returnIncluded: boolean;
}

export interface RouteProposal {
  id: string;
  label: string;
  variant: RouteProposalVariant;
  objective: MissionObjective;
  waypoints: Position[];
  distanceNm: number;
  estimatedFuelUnits: number;
  estimatedTimeMinutes: number | null;
  status: RouteProposalStatus;
  margins: ProposalMargins;
  reasons: ProposalReason[];
  tradeoffs: string[];
}

export interface RouteProposalSet {
  intentId: string;
  proposals: [RouteProposal, RouteProposal];
}
