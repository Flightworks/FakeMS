import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { useSimulation } from '../../utils/useSimulation';
import { Entity, EntityType, NavMode } from '../../types';

const ownship: Entity = {
  id: 'ownship',
  label: 'OWNSHIP',
  type: EntityType.FRIENDLY,
  position: { lat: 0, lon: 0 },
  heading: 0,
  speed: 120,
};

const ClockProbe = () => {
  const [currentOwnship, setCurrentOwnship] = useState(ownship);
  const { simulationControls } = useSimulation([], currentOwnship, setCurrentOwnship, NavMode.REAL);
  return <output data-testid="sim-time">{simulationControls.simTimeMs}</output>;
};

describe('useSimulation scenario clock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('advances scenario time while the simulation is running', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
    render(<ClockProbe />);

    const initial = Number(screen.getByTestId('sim-time').textContent);
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(Number(screen.getByTestId('sim-time').textContent)).toBeGreaterThan(initial);
  });
});
