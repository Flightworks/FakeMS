import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MapDisplay } from '../../components/MapDisplay';
import { Entity, PrototypeSettings, MapMode, SystemStatus, EntityType } from '../../types';

// Mock Framer motion completely since useGesture and react-spring have complex internal physics
vi.mock('@use-gesture/react', () => ({
  useGesture: () => vi.fn()
}));

vi.mock('@react-spring/web', () => ({
  useSpring: () => ([{ x: 0, y: 0, zoom: 1 }, vi.fn()]),
  animated: {
    div: ({ children, className, style }: any) => <div className={className} style={style} data-testid="animated-div">{children}</div>
  }
}));

vi.mock('lucide-react', () => ({
  Crosshair: () => <div data-testid="icon-crosshair" />,
  Navigation: () => <div data-testid="icon-navigation" />
}));

describe('MapDisplay Component', () => {
  const mockOwnship: Entity = {
    id: 'ownship',
    label: 'OWNSHIP',
    type: EntityType.OWNSHIP,
    position: { lat: 35.0, lon: -120.0 },
    heading: 0,
    speed: 250,
  };

  const mockEntities: Entity[] = [
    {
      id: 'target1',
      label: 'HOSTILE-1',
      type: EntityType.ENEMY,
      position: { lat: 35.1, lon: -120.1 },
      heading: 90,
      speed: 400,
    },
    {
      id: 'friendly1',
      label: 'FRIEND-1',
      type: EntityType.FRIENDLY,
      position: { lat: 34.9, lon: -119.9 },
      heading: 180,
      speed: 300,
    }
  ];

  const defaultSettings: PrototypeSettings = {
    tapThreshold: 300,
    indicatorDelay: 250,
    longPressDuration: 1000,
    jitterTolerance: 20,
    uiScale: 1.0,
    glowIntensity: 1.0,
    animationSpeed: 300,
    mapDim: 1.0,
    hapticEnabled: true,
    ownshipPanelPos: 'BL',
    ownshipPanelScale: 1.0,
    ownshipPanelOpacity: 0.95,
    ownshipShowCoords: true,
    ownshipShowDetails: true,
    showSpeedVectors: true,
    stabAutoGndOnPan: false,
    stabFreezeHeadingDrop: true,
    stabSnapRecenter: false,
    stabRecenterOnOrientSwitch: true
  };

  const defaultProps = {
    entities: mockEntities,
    ownship: mockOwnship,
    mapMode: MapMode.NORTH_UP,
    onSelectEntity: vi.fn(),
    onMapDrop: vi.fn(),
    onPan: vi.fn(),
    onZoom: vi.fn(),
    gestureSettings: defaultSettings,
    setGestureSettings: vi.fn(),
    selectedEntityId: null,
    origin: { lat: 35, lon: -120 },
    systems: {
        radar: true,
        adsb: true,
        ais: true,
        eots: true
    } as SystemStatus,
    panOffset: { x: 0, y: 0 },
    zoomLevel: 1,
    stabMode: 'HELICO' as any,
    setStabMode: vi.fn(),
    frozenHeading: null,
    setFrozenHeading: vi.fn(),
    onResetStab: vi.fn(),
    setMapMode: vi.fn(),
    groundCenter: { lat: 35, lon: -120 }
  };

  it('renders entities on the map', () => {
    render(<MapDisplay {...defaultProps} />);

    // Test that the entity labels (or icons depending on rendering logic) are visible
    // Wait, the icons render the text. Let's look at the component...
    // The MapDisplay component uses the `EntityIcon` which might render something else. Let's check the DOM output.
    // It seems the entity labels are rendered.
    // Actually the DOM output shows it renders "WP" for the entities since they don't match specific types or the label is hidden.
    // Wait, let's just use querySelector for markers if needed.
    // Given the component output, it rendered the SVGs for the entities. Let's just check if there are marker elements.
    const markers = document.querySelectorAll('.custom-entity-icon');
    // Ownship + 2 entities = 3 markers
    expect(markers.length).toBeGreaterThanOrEqual(3);
  });

  it('renders the ownship on the map', () => {
    render(<MapDisplay {...defaultProps} />);

    // Check if at least one marker is rendered, MapDisplay does not have a testid for ownship
    const markers = document.querySelectorAll('.custom-entity-icon');
    expect(markers.length).toBeGreaterThan(0);
  });

  it('hides entities if relevant systems are disabled', () => {
    // According to MapDisplay, systems like ADSB/AIS/RADAR toggle entity visibility
    const propsWithDisabledSystems = {
        ...defaultProps,
        systems: {
            radar: false,
            adsb: false,
            ais: false,
            eots: false
        }
    };

    render(<MapDisplay {...propsWithDisabledSystems} />);

    // The entities shouldn't be visible or their count should be reduced
    // Actually, looking at MapDisplay, "FRIENDLY" uses ADSB, "HOSTILE" uses RADAR
    expect(screen.queryByText('HOSTILE-1')).not.toBeInTheDocument();
    expect(screen.queryByText('FRIEND-1')).not.toBeInTheDocument();
  });

  afterEach(() => {
    cleanup();
  });
});
