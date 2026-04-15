import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { LeftSidebar } from '../../components/LeftSidebar';
import { MapMode, StabMode, EntityType } from '../../types';

// Mock package.json since it's imported in the component
vi.mock('../../package.json', () => ({
  default: { version: '1.3.3' }
}));

// Mock CHANGELOG.md?raw since it's imported in the component
vi.mock('../../CHANGELOG.md?raw', () => ({
  default: '# Changelog\n\n## [1.3.3]\n- Fixes'
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Menu: () => <div data-testid="icon-menu" />,
  ArrowUp: () => <div data-testid="icon-arrow-up" />,
  Search: () => <div data-testid="icon-search" />,
  X: () => <div data-testid="icon-x" />,
  Info: () => <div data-testid="icon-info" />,
  BookOpen: () => <div data-testid="icon-book-open" />,
  Crosshair: () => <div data-testid="icon-crosshair" />
}));

describe('LeftSidebar Component', () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  const mockProps = {
    mapMode: MapMode.NORTH_UP,
    setMapMode: vi.fn(),
    toggleLayer: vi.fn(),
    systems: { radar: true, adsb: true, ais: true, eots: true },
    toggleSystem: vi.fn(),
    isOpen: true,
    onToggle: vi.fn(),
    gestureSettings: {
      tapThreshold: 300,
      indicatorDelay: 250,
      longPressDuration: 1000,
      jitterTolerance: 20,
      uiScale: 1.0,
      glowIntensity: 1.0,
      animationSpeed: 300,
      mapDim: 1.0,
      hapticEnabled: true,
      ownshipPanelPos: 'BL' as const,
      ownshipPanelScale: 1.0,
      ownshipPanelOpacity: 0.95,
      ownshipShowCoords: true,
      ownshipShowDetails: true,
      showSpeedVectors: true,
      stabAutoGndOnPan: false,
      stabFreezeHeadingDrop: true,
      stabSnapRecenter: false,
      stabRecenterOnOrientSwitch: true
    },
    setGestureSettings: vi.fn(),
    onOpenCommandPalette: vi.fn(),
    ownship: {
      id: 'ownship',
      label: 'OWNSHIP',
      type: EntityType.OWNSHIP,
      position: { lat: 0, lon: 0 },
      heading: 0,
      speed: 0
    },
    stabMode: StabMode.HELICO,
    setStabMode: vi.fn(),
    onResetStab: vi.fn()
  };

  it('toggles to GND mode when STAB button is clicked in HELICO mode', () => {
    render(<LeftSidebar {...mockProps} />);
    
    // Find the STAB button (it has the label "STAB")
    const stabButton = screen.getByText('STAB').closest('button');
    expect(stabButton).toBeInTheDocument();
    
    // Sublabel should be H/C initially
    expect(screen.getByText('H/C')).toBeInTheDocument();
    
    fireEvent.click(stabButton!);
    
    // Should call setStabMode with GND
    expect(mockProps.setStabMode).toHaveBeenCalledWith(StabMode.GND);
    expect(mockProps.onResetStab).not.toHaveBeenCalled();
  });

  it('calls onResetStab when STAB button is clicked in GND mode', () => {
    const propsInGnd = {
      ...mockProps,
      stabMode: StabMode.GND
    };
    
    render(<LeftSidebar {...propsInGnd} />);
    
    // Sublabel should be GND initially
    expect(screen.getByText('GND')).toBeInTheDocument();
    
    const stabButton = screen.getByText('STAB').closest('button');
    fireEvent.click(stabButton!);
    
    // Should call onResetStab (which handles the centering and state change)
    expect(propsInGnd.onResetStab).toHaveBeenCalled();
    expect(propsInGnd.setStabMode).not.toHaveBeenCalled();
  });
});
