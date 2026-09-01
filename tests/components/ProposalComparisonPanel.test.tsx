import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProposalComparisonPanel } from '../../components/ProposalComparisonPanel';
import { JustificationPanel } from '../../components/JustificationPanel';
import type { RouteProposalSet } from '../../domain/proposals';

const result: RouteProposalSet = {
  intentId: 'intent-1',
  proposals: [
    {
      id: 'proposal:intent-1:direct',
      label: 'DIRECT · EFFICIENCY',
      variant: 'DIRECT',
      objective: 'THREAT_PRIORITY',
      waypoints: [{ lat: 34.1, lon: -118 }],
      distanceNm: 6,
      estimatedFuelUnits: 6,
      estimatedTimeMinutes: 6,
      status: 'CONSTRAINED',
      margins: { fuelUnits: 74, fuelRatio: 0.74, returnIncluded: false },
      reasons: [{ code: 'RETURN_PREFERRED_NOT_INCLUDED', category: 'CONSTRAINT', message: 'No return leg' }],
      tradeoffs: ['Lower fuel use'],
    },
    {
      id: 'proposal:intent-1:return-aware',
      label: 'RETURN AWARE · MARGIN',
      variant: 'RETURN_AWARE',
      objective: 'THREAT_PRIORITY',
      waypoints: [{ lat: 34.1, lon: -118 }, { lat: 34, lon: -118 }],
      distanceNm: 12,
      estimatedFuelUnits: 12,
      estimatedTimeMinutes: 12,
      status: 'FEASIBLE',
      margins: { fuelUnits: 68, fuelRatio: 0.68, returnIncluded: true },
      reasons: [{ code: 'OBJECTIVE_THREAT', category: 'OBJECTIVE', message: 'Reaches the target quickly' }],
      tradeoffs: ['More fuel'],
    },
  ],
};

describe('proposal comparison and justification', () => {
  it('compares two proposals and exposes explain/select/reject actions', () => {
    const onWhy = vi.fn();
    const onAccept = vi.fn();
    const onReject = vi.fn();

    render(
      <ProposalComparisonPanel
        result={result}
        onWhy={onWhy}
        onAccept={onAccept}
        onReject={onReject}
      />,
    );

    expect(screen.getByText('DECISION SUPPORT · SIMULATION')).toBeInTheDocument();
    expect(screen.getByText('DIRECT · EFFICIENCY')).toBeInTheDocument();
    expect(screen.getByText('RETURN AWARE · MARGIN')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Explain proposal contrast' })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Explain proposal contrast' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Accept route proposal for simulation' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Reject all route proposals' }));

    expect(onWhy).toHaveBeenCalledWith(result.proposals[0], result.proposals[1]);
    expect(onAccept).toHaveBeenCalledWith(result.proposals[0]);
    expect(onReject).toHaveBeenCalledOnce();
  });

  it('does not offer acceptance for prohibited proposals', () => {
    render(
      <ProposalComparisonPanel
        result={{ ...result, proposals: [{ ...result.proposals[0], status: 'PROHIBITED' }, result.proposals[1]] }}
        onWhy={vi.fn()}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('button', { name: 'Accept route proposal for simulation' })).toHaveLength(1);
  });

  it('shows a contrastive explanation from structured reasons', () => {
    render(
      <JustificationPanel
        preferred={result.proposals[1]}
        alternative={result.proposals[0]}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('WHY RETURN AWARE · MARGIN?')).toBeInTheDocument();
    expect(screen.getByText('No return leg')).toBeInTheDocument();
    expect(screen.getByText('More fuel')).toBeInTheDocument();
  });
});
