import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MissionActionStatusPanel } from '../../components/MissionActionStatusPanel';

const action = {
  id: 'sensor:stt:track-1',
  label: 'Radar single target track',
  category: 'SENSORS' as const,
  targetId: 'track-1',
  issuedAt: 100,
  implementation: 'SIMULATED_EFFECT' as const,
  requiresAuthorization: true,
  status: 'PREVIEWED' as const,
};

describe('MissionActionStatusPanel', () => {
  it('shows the current lifecycle stage and only the next safe action', () => {
    const onIntent = vi.fn();
    render(<MissionActionStatusPanel action={action} journal={[
      { actionId: 'old-action', status: 'COMPLETED_SIM', at: 90, label: 'Old action' },
      { actionId: action.id, status: 'PROPOSED', at: 100, label: action.label },
    ]} onIntent={onIntent} />);

    expect(screen.getByText('AWAITING AUTHORIZATION')).toBeInTheDocument();
    expect(screen.getByText('Radar single target track')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Mission action journal' })).toBeInTheDocument();
    expect(screen.getByText('PROPOSED · 100')).toBeInTheDocument();
    expect(screen.queryByText('COMPLETED_SIM · 90')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Authorize mission action' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Execute simulated action' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Authorize mission action' }));
    expect(onIntent).toHaveBeenCalledWith(expect.objectContaining({ type: 'AUTHORIZE' }));
  });

  it('shows an honest unavailable result without an execute button', () => {
    render(
      <MissionActionStatusPanel
        action={{ ...action, status: 'NOT_IMPLEMENTED', failureReason: 'No simulator effect is available for this action' }}
        onIntent={vi.fn()}
      />,
    );

    expect(screen.getByText('NOT IMPLEMENTED')).toBeInTheDocument();
    expect(screen.getByText('No simulator effect is available for this action')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Execute simulated action' })).not.toBeInTheDocument();
  });
});
