import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SimulationBanner } from '../../components/SimulationBanner';

describe('SimulationBanner', () => {
  it('keeps the non-operational simulation identity visible', () => {
    render(<SimulationBanner buildId="dev-build" />);

    expect(screen.getByText('SIMULATION')).toBeInTheDocument();
    expect(screen.getByText('NOT FOR OPERATIONAL USE')).toBeInTheDocument();
    expect(screen.getByText('BUILD dev-build')).toBeInTheDocument();
  });
});
