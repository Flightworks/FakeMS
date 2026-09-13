import { act, fireEvent, render, screen } from '@testing-library/react';
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
  return (
    <>
      <output data-testid="sim-time">{simulationControls.simTimeMs}</output>
      <output data-testid="scenario-time">{simulationControls.scenarioTimeMs}</output>
      <output data-testid="sim-status">{simulationControls.status}</output>
      <button type="button" data-testid="pause" onClick={simulationControls.pause}>pause</button>
      <button type="button" data-testid="resume" onClick={simulationControls.resume}>resume</button>
      <button type="button" data-testid="reset" onClick={simulationControls.reset}>reset</button>
      <button type="button" data-testid="replay" onClick={simulationControls.replay}>replay</button>
    </>
  );
};

describe('useSimulation scenario clock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps elapsed simulation time separate from the absolute scenario clock', () => {
    vi.useFakeTimers();
    const startTime = new Date('2026-01-01T12:00:00.000Z');
    vi.setSystemTime(startTime);
    render(<ClockProbe />);

    expect(Number(screen.getByTestId('sim-time').textContent)).toBe(0);
    expect(Number(screen.getByTestId('scenario-time').textContent)).toBe(startTime.getTime());

    act(() => {
      vi.advanceTimersByTime(300);
    });

    const elapsed = Number(screen.getByTestId('sim-time').textContent);
    const scenarioTime = Number(screen.getByTestId('scenario-time').textContent);
    expect(elapsed).toBeGreaterThan(0);
    expect(scenarioTime).toBe(startTime.getTime() + elapsed);
  });

  it('pauses and resumes elapsed scenario time without advancing while paused', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
    render(<ClockProbe />);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.click(screen.getByTestId('pause'));
    const pausedTime = Number(screen.getByTestId('sim-time').textContent);
    expect(screen.getByTestId('sim-status').textContent).toBe('PAUSED');

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(Number(screen.getByTestId('sim-time').textContent)).toBe(pausedTime);

    fireEvent.click(screen.getByTestId('resume'));
    expect(screen.getByTestId('sim-status').textContent).toBe('RUNNING');
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(Number(screen.getByTestId('sim-time').textContent)).toBeGreaterThan(pausedTime);
  });

  it('resets and replays elapsed time from the same absolute scenario start', () => {
    vi.useFakeTimers();
    const startTime = new Date('2026-01-01T12:00:00.000Z');
    vi.setSystemTime(startTime);
    render(<ClockProbe />);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.click(screen.getByTestId('reset'));
    expect(Number(screen.getByTestId('sim-time').textContent)).toBe(0);
    expect(Number(screen.getByTestId('scenario-time').textContent)).toBe(startTime.getTime());
    expect(screen.getByTestId('sim-status').textContent).toBe('RESET · PAUSED');

    fireEvent.click(screen.getByTestId('replay'));
    expect(Number(screen.getByTestId('sim-time').textContent)).toBe(0);
    expect(Number(screen.getByTestId('scenario-time').textContent)).toBe(startTime.getTime());
    expect(screen.getByTestId('sim-status').textContent).toBe('REPLAY · RUNNING');
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(Number(screen.getByTestId('sim-time').textContent)).toBeGreaterThan(0);
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
