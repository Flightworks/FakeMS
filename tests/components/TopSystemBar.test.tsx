import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TopSystemBar } from '../../components/TopSystemBar';
import { SystemStatus, NavMode, PrototypeSettings } from '../../types';

describe('TopSystemBar Component', () => {
  const mockSystems: SystemStatus = {
    radar: true,
    adsb: false,
    ais: false,
    eots: false
  };

  const mockGestureSettings: PrototypeSettings = {
    tapThreshold: 300,
    indicatorDelay: 250,
    longPressDuration: 1000,
    jitterTolerance: 20,
    uiScale: 1.0,
    glowIntensity: 1.0,
    animationSpeed: 300,
    mapDim: 1.0,
    hapticEnabled: false,
    ownshipPanelPos: 'BL',
    ownshipPanelScale: 1.0,
    ownshipPanelOpacity: 0.95,
    ownshipShowCoords: true,
    ownshipShowDetails: true,
    showSpeedVectors: true,
    stabAutoGndOnPan: false,
    stabFreezeHeadingDrop: true,
    stabSnapRecenter: false,
    stabRecenterOnOrientSwitch: false,
    stabAutoRecenterDelay: 0,
    stabSmoothUnfreeze: false,
    stabMaintainScreenPosOnOrient: true,
  };

  const mockProps = {
    systems: mockSystems,
    navMode: NavMode.REAL,
    navigationState: {
      source: 'GPS' as const,
      validity: 'VALID' as const,
      position: { lat: 0, lon: 0 },
      updatedAt: 0,
    },
    setNavMode: vi.fn(),
    ownship: { id: 'ownship', label: 'OWNSHIP', position: { lat: 0, lon: 0 }, heading: 0, speed: 0, type: 'FRIENDLY' as any },
    setOwnship: vi.fn(),
    gestureSettings: mockGestureSettings,
    setGestureSettings: vi.fn(),
    simulationControls: {
      isRunning: true,
      status: 'RUNNING' as const,
      pause: vi.fn(),
      resume: vi.fn(),
      reset: vi.fn(),
      replay: vi.fn(),
      simTimeMs: 0,
    },
  };


  it('displays correct time format', () => {
    render(<TopSystemBar {...mockProps} />);
    const zuluText = screen.getByText('Z');
    expect(zuluText).toBeInTheDocument();

    // Check if the time is displayed, we can't test exact time due to setInterval,
    // but we can check if the span with 'Z' is there which represents the clock
    expect(zuluText.parentElement).toHaveClass('text-xl');
  });

  it('renders STABLN and HMI CFG buttons', () => {
    render(<TopSystemBar {...mockProps} />);
    expect(screen.getByText('STABLN')).toBeInTheDocument();
    expect(screen.getByText('HMI')).toBeInTheDocument();
  });

  it('keeps permanent widget labels while shortening toolbox headings', () => {
    render(<TopSystemBar {...mockProps} />);

    expect(screen.getByRole('button', { name: /NAV/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'STABLN CFG' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'HMI CFG' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'STABLN CFG' }));
    expect(screen.getByText('STAB CFG')).toBeInTheDocument();
    expect(screen.queryByText('Stab Options')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'HMI CFG' }));
    expect(screen.getByText('HMI CFG')).toBeInTheDocument();
    expect(screen.queryByText('HMI Config')).not.toBeInTheDocument();
  });

  it('shortens simulation actions without removing the simulation toolbox', () => {
    render(<TopSystemBar {...mockProps} />);

    fireEvent.click(screen.getByRole('button', { name: /NAV/ }));
    const toolbox = screen.getByRole('region', { name: 'Simulation toolbox' });

    expect(toolbox).toBeInTheDocument();
    expect(toolbox).toHaveTextContent('SIM');
    expect(toolbox).not.toHaveTextContent('Sim Toolbox');
    expect(toolbox).toHaveTextContent('LOCK HDG');
    expect(toolbox).not.toHaveTextContent('LOCK HDG (Stop Rotation)');
    expect(toolbox).toHaveTextContent('APPLY');
    expect(toolbox).not.toHaveTextContent('Apply All');
  });
});
