import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { UpdateAvailableBanner } from '../../components/UpdateAvailableBanner';

describe('UpdateAvailableBanner', () => {
  it('shows an available update and activates the waiting worker', () => {
    const postMessage = vi.fn();
    const reload = vi.fn();
    const registration = {
      waiting: { postMessage },
    } as unknown as ServiceWorkerRegistration;

    render(<UpdateAvailableBanner registration={registration} onReload={reload} />);

    expect(screen.getByText('UPDATE AVAILABLE')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply update and reload' }));

    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reload).toHaveBeenCalledOnce();
  });

  it('stays hidden without a waiting worker', () => {
    const { container } = render(<UpdateAvailableBanner registration={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
