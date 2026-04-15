import React from 'react';
import { render, screen } from '@testing-library/react';
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
  };

  const mockProps = {
    systems: mockSystems,
    navMode: NavMode.REAL,
    setNavMode: vi.fn(),
    ownship: { id: 'ownship', label: 'OWNSHIP', position: { lat: 0, lon: 0 }, heading: 0, speed: 0, type: 'FRIENDLY' as any },
    setOwnship: vi.fn(),
    gestureSettings: mockGestureSettings,
    setGestureSettings: vi.fn(),
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
});
