import {
  CommandEvent,
  CommandIntent,
  CommandState,
  DirectToProposal,
} from '../domain/commands';
import { Position } from '../types';

const copyPosition = (position: Position): Position => ({ ...position });

export const createCommandState = (): CommandState => ({
  mapFocus: null,
  directToProposal: null,
  route: null,
  events: [],
});

const appendEvent = (state: CommandState, event: CommandEvent): CommandState => ({
  ...state,
  events: [...state.events, event],
});

export const dispatchCommand = (
  state: CommandState,
  intent: CommandIntent,
): CommandState => {
  switch (intent.type) {
    case 'CENTER_MAP':
      return appendEvent(
        {
          ...state,
          mapFocus: copyPosition(intent.position),
        },
        {
          kind: 'MAP_CENTERED',
          simTimeMs: intent.issuedAt,
          position: copyPosition(intent.position),
        },
      );

    case 'PROPOSE_DIRECT_TO': {
      const proposal: DirectToProposal = {
        id: `dct:${intent.targetId}:${intent.issuedAt}`,
        targetId: intent.targetId,
        targetLabel: intent.targetLabel,
        position: copyPosition(intent.position),
        issuedAt: intent.issuedAt,
        status: 'PROPOSED',
      };

      return appendEvent(
        {
          ...state,
          directToProposal: proposal,
        },
        {
          kind: 'ROUTE_PROPOSED',
          simTimeMs: intent.issuedAt,
          proposalId: proposal.id,
          targetId: proposal.targetId,
        },
      );
    }

    case 'ACCEPT_ROUTE_PROPOSAL': {
      const proposal = state.directToProposal;
      if (!proposal || proposal.id !== intent.proposalId || proposal.status !== 'PROPOSED') {
        return state;
      }

      return appendEvent(
        {
          ...state,
          directToProposal: { ...proposal, status: 'ACCEPTED' },
          route: {
            targetId: proposal.targetId,
            position: copyPosition(proposal.position),
          },
        },
        {
          kind: 'ROUTE_ACCEPTED',
          simTimeMs: intent.authorizedAt,
          proposalId: proposal.id,
          targetId: proposal.targetId,
        },
      );
    }

    case 'REJECT_ROUTE_PROPOSAL': {
      const proposal = state.directToProposal;
      if (!proposal || proposal.id !== intent.proposalId || proposal.status !== 'PROPOSED') {
        return state;
      }

      return appendEvent(
        {
          ...state,
          directToProposal: { ...proposal, status: 'REJECTED' },
        },
        {
          kind: 'ROUTE_REJECTED',
          simTimeMs: intent.rejectedAt,
          proposalId: proposal.id,
          targetId: proposal.targetId,
        },
      );
    }
  }
};
