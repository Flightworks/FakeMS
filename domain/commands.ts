import { Position } from '../types';

export type CommandIntent =
  | {
      type: 'CENTER_MAP';
      position: Position;
      issuedAt: number;
    }
  | {
      type: 'PROPOSE_DIRECT_TO';
      targetId: string;
      targetLabel: string;
      position: Position;
      issuedAt: number;
    }
  | {
      type: 'ACCEPT_ROUTE_PROPOSAL';
      proposalId: string;
      authorizedAt: number;
    }
  | {
      type: 'REJECT_ROUTE_PROPOSAL';
      proposalId: string;
      rejectedAt: number;
    };

export type DirectToProposalStatus = 'PROPOSED' | 'ACCEPTED' | 'REJECTED';

export interface DirectToProposal {
  id: string;
  targetId: string;
  targetLabel: string;
  position: Position;
  issuedAt: number;
  status: DirectToProposalStatus;
}

export interface SimulatedRoute {
  targetId: string;
  position: Position;
}

export type CommandEvent =
  | { kind: 'MAP_CENTERED'; simTimeMs: number; position: Position }
  | { kind: 'ROUTE_PROPOSED'; simTimeMs: number; proposalId: string; targetId: string }
  | { kind: 'ROUTE_ACCEPTED'; simTimeMs: number; proposalId: string; targetId: string }
  | { kind: 'ROUTE_REJECTED'; simTimeMs: number; proposalId: string; targetId: string };

export interface CommandState {
  mapFocus: Position | null;
  directToProposal: DirectToProposal | null;
  route: SimulatedRoute | null;
  events: CommandEvent[];
}
