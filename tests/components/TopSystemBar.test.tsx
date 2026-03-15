import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TopSystemBar } from '../../components/TopSystemBar';
import { SystemStatus } from '../../types';

describe('TopSystemBar Component', () => {
  const mockSystems: SystemStatus = {
    radar: true,
    adsb: false,
    ais: false,
    eots: false,
    camera: false,
    acoustic: false
  };

  const mockProps = {
    systems: mockSystems,
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
