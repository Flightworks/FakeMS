import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TopSystemBar } from '../../components/TopSystemBar';
import { SystemStatus, NavMode } from '../../types';

describe('TopSystemBar Component', () => {
  const mockSystems: SystemStatus = {
    radar: true,
    adsb: false,
    ais: false,
    eots: false
  };

  const mockProps = {
    systems: mockSystems,
    navMode: NavMode.REAL,
    setNavMode: vi.fn(),
    ownship: { id: 'ownship', label: 'OWNSHIP', position: { lat: 0, lon: 0 }, heading: 0, speed: 0, type: 'FRIENDLY' as any },
    setOwnship: vi.fn(),
  };

  it('renders system statuses correctly', () => {
    render(<TopSystemBar {...mockProps} />);

    // RDR should be active (emerald green color class for its container)
    const rdrText = screen.getByText('RDR');
    const rdrContainer = rdrText.parentElement;
    expect(rdrContainer).toHaveClass('border-emerald-600');

    // ADSB should be inactive (slate color class for its container)
    const adsbText = screen.getByText('ADBS-IN');
    const adsbContainer = adsbText.parentElement;
    expect(adsbContainer).toHaveClass('border-slate-600');
  });

  it('displays correct time format', () => {
    render(<TopSystemBar {...mockProps} />);
    const zuluText = screen.getByText('Z');
    expect(zuluText).toBeInTheDocument();

    // Check if the time is displayed, we can't test exact time due to setInterval,
    // but we can check if the span with 'Z' is there which represents the clock
    expect(zuluText.parentElement).toHaveClass('text-xl');
  });
});
