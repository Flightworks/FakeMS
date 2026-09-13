import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TopSystemBar } from '../../components/TopSystemBar';
import { SystemStatus, MapMode, NavMode, PrototypeSettings, StabMode } from '../../types';
import { createLayerState } from '../../domain/layers';
import { createDeclutterState } from '../../domain/declutter';

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
    layers: createLayerState(),
    setLayers: vi.fn(),
    simulationControls: {
      isRunning: true,
      status: 'RUNNING' as const,
      pause: vi.fn(),
      resume: vi.fn(),
      reset: vi.fn(),
      replay: vi.fn(),
      simTimeMs: 0,
    },
    stabMode: StabMode.HELICO,
    setStabMode: vi.fn(),
    mapMode: MapMode.HEADING_UP,
    setMapMode: vi.fn(),
    groundAnchor: null,
    onResetStab: vi.fn(),
    requestSimulationReset: vi.fn(),
    requestSimulationReplay: vi.fn(),
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

  it('keeps GPS validity separate from the running scenario state', () => {
    render(
      <TopSystemBar
        {...mockProps}
        navigationState={{
          ...mockProps.navigationState,
          source: 'GPS',
          validity: 'DENIED',
          positionSource: 'SIM',
          positionStatus: 'CURRENT',
          positionQualification: 'SIMULATED',
        }}
      />,
    );

    const provenance = screen.getByTestId('nav-source-status');
    expect(screen.getByRole('button', { name: 'NAV GPS DENIED' })).toBeInTheDocument();
    expect(provenance).toHaveTextContent('POS SIMULATION');
    expect(provenance).toHaveTextContent('SIM RUNNING');
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

  it('routes PW HMI VEC through the authoritative layer state', () => {
    render(<TopSystemBar {...mockProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'HMI CFG' }));
    fireEvent.click(screen.getByRole('button', { name: /HUD/ }));
    fireEvent.click(screen.getByRole('button', { name: /^VECTORS ON/ }));

    expect(mockProps.setLayers).toHaveBeenCalledWith(expect.objectContaining({
      VECTORS: expect.objectContaining({ visible: false }),
    }));
    expect(mockProps.setGestureSettings).not.toHaveBeenCalled();
  });

  it('routes PW NAV reset and replay through the shared request callbacks', () => {
    vi.clearAllMocks();
    render(<TopSystemBar {...mockProps} />);

    fireEvent.click(screen.getByRole('button', { name: /NAV/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset simulation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replay simulation' }));

    expect(mockProps.requestSimulationReset).toHaveBeenCalledOnce();
    expect(mockProps.requestSimulationReplay).toHaveBeenCalledOnce();
    expect(mockProps.simulationControls.reset).not.toHaveBeenCalled();
    expect(mockProps.simulationControls.replay).not.toHaveBeenCalled();
  });

  it('labels vectors as effectively off when declutter hides the layer', () => {
    render(
      <TopSystemBar
        {...mockProps}
        declutter={createDeclutterState('MINIMAL')}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'HMI CFG' }));
    fireEvent.click(screen.getByRole('button', { name: /HUD/ }));

    expect(screen.getByRole('button', { name: 'VECTORS OFF · DECLUTTER' })).toBeInTheDocument();
  });

  it('explains stabilisation mode and map effect without hover', () => {
    render(<TopSystemBar {...mockProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'STABLN CFG' }));

    expect(screen.getByRole('region', { name: 'Stabilisation controls' })).toBeInTheDocument();
    expect(screen.getByTestId('stabilisation-state')).toHaveTextContent('HELICO · OWNSHIP FOLLOW');
    expect(screen.getByRole('button', { name: 'GND · FIXED-GROUND ANCHOR' })).toBeInTheDocument();
    expect(screen.getByText(/Orientation.*NORTH UP.*HEADING UP/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recenter.*ownship/i })).toBeInTheDocument();
  });

  it('presents HMI settings as labelled task choices with accessible descriptions', () => {
    render(<TopSystemBar {...mockProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'HMI CFG' }));
    for (const label of [
      'HUD position',
      'HUD scale',
      'HUD opacity',
      'Track vectors',
      'HUD details',
      'Tap activation threshold',
      'Pie indicator delay',
      'Long-press duration',
      'Interface scale',
      'Radial glow',
      'Map background dim',
      'Animation speed',
      'Haptic feedback',
    ]) {
      expect(screen.getByText(label)).toBeVisible();
    }

    const vectors = screen.getByRole('button', { name: /Track vectors.*ON/i });
    const descriptionId = vectors.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId!)).toHaveTextContent(/mission vector lines/i);
    expect(screen.getByRole('button', { name: 'Close panel' })).toHaveClass('hmi-active-target', 'hmi-focus-ring');
  });

  it('restores HMI trigger focus and keeps only one transient panel open', () => {
    render(<TopSystemBar {...mockProps} />);

    const hmiTrigger = screen.getByRole('button', { name: 'HMI CFG' });
    fireEvent.click(hmiTrigger);
    const hmiPanel = screen.getByRole('region', { name: 'HMI settings' });
    fireEvent.keyDown(hmiPanel, { key: 'Escape' });

    expect(screen.queryByRole('region', { name: 'HMI settings' })).not.toBeInTheDocument();
    expect(hmiTrigger).toHaveFocus();

    fireEvent.click(hmiTrigger);
    fireEvent.keyDown(hmiTrigger, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'HMI settings' })).not.toBeInTheDocument();
    expect(hmiTrigger).toHaveFocus();

    fireEvent.click(hmiTrigger);
    fireEvent.click(screen.getByRole('button', { name: /NAV/ }));
    expect(screen.queryByRole('region', { name: 'HMI settings' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Simulation toolbox' })).toBeInTheDocument();
  });

  it('routes labelled HMI choices through the existing setting callbacks', () => {
    vi.clearAllMocks();
    render(<TopSystemBar {...mockProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'HMI CFG' }));

    const cases = [
      ['hmi-setting-hud-position', 'ownshipPanelPos', 'TL'],
      ['hmi-setting-hud-scale', 'ownshipPanelScale', 1.25],
      ['hmi-setting-hud-opacity', 'ownshipPanelOpacity', 0.4],
      ['hmi-setting-tap-threshold', 'tapThreshold', 400],
      ['hmi-setting-indicator-delay', 'indicatorDelay', 400],
      ['hmi-setting-long-press-duration', 'longPressDuration', 1200],
      ['hmi-setting-interface-scale', 'uiScale', 1.1],
      ['hmi-setting-radial-glow', 'glowIntensity', 1.5],
      ['hmi-setting-map-background-dim', 'mapDim', 0.2],
      ['hmi-setting-animation-speed', 'animationSpeed', 600],
      ['hmi-setting-hud-details', 'ownshipShowDetails', false],
      ['hmi-setting-haptic-feedback', 'hapticEnabled', true],
    ] as const;

    for (const [testId, key, expected] of cases) {
      const button = screen.getByTestId(testId).querySelector('button');
      expect(button).not.toBeNull();
      fireEvent.click(button!);
      const lastCall = mockProps.setGestureSettings.mock.calls.at(-1);
      expect(lastCall).toBeDefined();
      const updater = lastCall?.[0];
      expect(typeof updater).toBe('function');
      const nextSettings = (updater as (previous: PrototypeSettings) => PrototypeSettings)(mockGestureSettings);
      expect(nextSettings[key]).toBe(expected);
    }
  });
});
