import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ActionStatusPanel } from '../../components/ActionStatusPanel';

describe('ActionStatusPanel', () => {
  it('shows a proposed route and exposes separate accept and reject actions', () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();

    render(
      <ActionStatusPanel
        proposal={{
          id: 'dct:track-1:100',
          targetId: 'track-1',
          targetLabel: 'G01',
          position: { lat: 34.1, lon: -118.2 },
          issuedAt: 100,
          status: 'PROPOSED',
        }}
        onAccept={onAccept}
        onReject={onReject}
      />,
    );

    expect(screen.getByText('DCT PROPOSAL')).toBeInTheDocument();
    expect(screen.getByText('G01')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept route proposal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reject route proposal' }));

    expect(onAccept).toHaveBeenCalledOnce();
    expect(onReject).toHaveBeenCalledOnce();
  });
});
