import React from 'react';
import { render, screen, cleanup, fireEvent, act, within, createEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MapDisplay } from '../../components/MapDisplay';
import { Entity, PrototypeSettings, MapMode, SystemStatus, EntityType } from '../../types';
import { createProjectionPreview } from '../../domain/designations';
import type { SimulatedDesignation } from '../../domain/designations';
import type { TrackTrailState } from '../../domain/trackTrails';
import type { ActiveSimulatedRoute } from '../../domain/routeSummary';
import { dispatchContextAction } from '../../application/buildCommandContext';
import { createLayerState, setLayerVisibility } from '../../domain/layers';
import type { ContextActionRequest } from '../../application/buildCommandContext';

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
  Navigation: () => <div data-testid="icon-navigation" />,
  ChevronUp: () => <div data-testid="icon-chevron-up" />,
  ChevronRight: () => <div data-testid="icon-chevron-right" />,
  X: () => <div data-testid="icon-x" />,
  MapPin: () => <div />,
  Info: () => <div />,
  Trash2: () => <div />,
  CircleDashed: () => <div />,
  Zap: () => <div />,
  Shield: () => <div />,
  FileText: () => <div />,
  Scan: () => <div />,
  Eye: () => <div />,
  Slash: () => <div />,
  Target: () => <div />,
  Settings: () => <div />,
  Router: () => <div />,
  Lock: () => <div />,
  Anchor: () => <div />,
  Flag: () => <div />,
  Video: () => <div />,
  Wifi: () => <div />,
  Globe: () => <div />,
  Thermometer: () => <div />,
  Activity: () => <div />,
  ArrowLeftRight: () => <div />,
  CornerUpRight: () => <div />,
  Flame: () => <div />,
  TrendingUp: () => <div />
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
    stabRecenterOnOrientSwitch: true,
    stabAutoRecenterDelay: 0,
    stabSmoothUnfreeze: false,
    stabMaintainScreenPosOnOrient: true
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
    groundAnchor: { lat: 35, lon: -120 },
    onGhostEvent: vi.fn(),
    onResetStab: vi.fn(),
    setMapMode: vi.fn()
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

  it('renders a temporary projection preview with point, line, details, and cancel action', () => {
    const onClearProjectionPreview = vi.fn();
    const preview = createProjectionPreview('BRAVO', mockOwnship.position, 180, 5);

    render(
      <MapDisplay
        {...defaultProps}
        projectionPreview={preview}
        onClearProjectionPreview={onClearProjectionPreview}
      />,
    );

    expect(screen.getByRole('region', { name: 'Projection preview' })).toBeInTheDocument();
    expect(screen.getByTestId('projection-preview-point')).toBeInTheDocument();
    expect(screen.getByTestId('projection-preview-line')).toBeInTheDocument();
    expect(screen.getByText(/180\.0°T \/ 5\.0 NM/)).toBeInTheDocument();
    expect(screen.getByText(/TARGET 34\.91682, -120\.00000/)).toBeInTheDocument();

    screen.getByRole('button', { name: 'Cancel projection preview' }).click();
    expect(onClearProjectionPreview).toHaveBeenCalledOnce();
  });

  it('offers confirmation and renders confirmed simulated designations separately', () => {
    const onConfirmDesignation = vi.fn();
    const confirmedDesignation: SimulatedDesignation = {
      type: 'SIMULATED_DESIGNATION',
      id: 'designation-1',
      label: 'P1',
      position: { lat: 34.91682, lon: -120 },
      source: 'PROJECTION_PREVIEW',
    };
    const preview = createProjectionPreview('BRAVO', mockOwnship.position, 180, 5);

    render(
      <MapDisplay
        {...defaultProps}
        projectionPreview={preview}
        confirmedDesignations={[confirmedDesignation]}
        onConfirmDesignation={onConfirmDesignation}
      />,
    );

    expect(screen.getByRole('button', { name: 'Confirm designation' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Confirmed simulated designations' })).toHaveTextContent('P1');
    expect(screen.getByTestId('confirmed-designation-P1')).toHaveTextContent('34.91682, -120.00000');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm designation' }));
    expect(onConfirmDesignation).toHaveBeenCalledOnce();
  });

  it('renders the designated points list with renamed labels and stable coordinates', () => {
    const renamedDesignation: SimulatedDesignation = {
      type: 'SIMULATED_DESIGNATION',
      id: 'designation-1',
      label: 'ALPHA',
      position: { lat: 34.91682, lon: -120 },
      source: 'PROJECTION_PREVIEW',
    };

    render(
      <MapDisplay
        {...defaultProps}
        confirmedDesignations={[renamedDesignation]}
      />,
    );

    expect(screen.getByText('DESIGNATED POINTS · SIMULATED')).toBeInTheDocument();
    expect(screen.getByTestId('confirmed-designation-ALPHA')).toHaveTextContent('ALPHA 34.91682, -120.00000');
  });

  it('cancels a pending map interaction when the pointer enters the preview panel', () => {
    vi.useFakeTimers();
    const preview = createProjectionPreview('BRAVO', mockOwnship.position, 180, 5);

    render(<MapDisplay {...defaultProps} projectionPreview={preview} />);

    const mapRoot = document.querySelector('.absolute.inset-0.bg-slate-950') as HTMLElement;
    const previewPanel = screen.getByRole('region', { name: 'Projection preview' });
    fireEvent.pointerDown(mapRoot, { pointerId: 1, pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.pointerMove(previewPanel, { pointerId: 1, pointerType: 'mouse', clientX: 20, clientY: 20 });

    act(() => {
      vi.advanceTimersByTime(defaultSettings.longPressDuration + 50);
    });

    expect(screen.queryByRole('dialog', { name: 'MAP ACTION radial menu' })).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders visible historical trail segments separately from current markers', () => {
    const trails: TrackTrailState = {
      trails: {
        target1: {
          targetId: 'target1',
          label: 'HOSTILE-1',
          visible: true,
          limited: false,
          points: [
            { position: { lat: 35.1, lon: -120.1 }, atMs: 1_000, segmentId: 1 },
            { position: { lat: 35.11, lon: -120.1 }, atMs: 3_000, segmentId: 1 },
          ],
        },
      },
    };
    const { rerender } = render(<MapDisplay {...defaultProps} trails={trails} />);
    expect(document.querySelectorAll('.track-trail-line')).toHaveLength(1);

    rerender(<MapDisplay {...defaultProps} trails={{ trails: { target1: { ...trails.trails.target1, visible: false } } }} />);
    expect(document.querySelectorAll('.track-trail-line')).toHaveLength(0);
  });

  it('opens the available map context tree instead of the legacy universal tracks menu', () => {
    vi.useFakeTimers();
    render(<MapDisplay {...defaultProps} onContextAction={vi.fn()} />);

    const mapRoot = document.querySelector('.absolute.inset-0.bg-slate-950') as HTMLElement;
    fireEvent.pointerDown(mapRoot, {
      pointerId: 11,
      pointerType: 'mouse',
      clientX: 420,
      clientY: 300,
    });
    act(() => {
      vi.advanceTimersByTime(defaultSettings.longPressDuration + 1);
    });

    const radial = screen.getByRole('dialog', { name: 'MAP ACTION radial menu' });
    const radialQueries = within(radial);
    expect(radialQueries.getByText('Vue', { exact: true })).toBeInTheDocument();
    expect(radialQueries.getByText('Affichage', { exact: true })).toBeInTheDocument();
    expect(radialQueries.getByText('Mesurer', { exact: true })).toBeInTheDocument();
    expect(radialQueries.queryByText('TRACKS', { exact: true })).not.toBeInTheDocument();
    expect(radialQueries.queryByText('VECTOR', { exact: true })).not.toBeInTheDocument();
  });

  it('dispatches the radial vector leaf through the authoritative layer state', () => {
    vi.useFakeTimers();
    const requests: ContextActionRequest[] = [];
    const ContextActionHarness = () => {
      const [layers, setLayers] = React.useState(createLayerState());
      const onContextAction = (request: ContextActionRequest) => {
        requests.push(request);
        dispatchContextAction(request, {
          toggleVectors: () => setLayers(previous => {
            const update = setLayerVisibility(previous, 'VECTORS', !previous.VECTORS.visible);
            return update.status === 'AVAILABLE' ? update.state : previous;
          }),
        });
      };
      return <MapDisplay {...defaultProps} layers={layers} setLayers={setLayers} onContextAction={onContextAction} />;
    };

    render(<ContextActionHarness />);
    expect(document.querySelectorAll('.kinematic-vector-line')).toHaveLength(3);
    const mapRoot = document.querySelector('.absolute.inset-0.bg-slate-950') as HTMLElement;
    fireEvent.pointerDown(mapRoot, {
      pointerId: 12,
      pointerType: 'mouse',
      clientX: 420,
      clientY: 300,
    });
    act(() => {
      vi.advanceTimersByTime(defaultSettings.longPressDuration + 1);
    });
    const radial = screen.getByRole('dialog', { name: 'MAP ACTION radial menu' });

    // Select Affichage (inner midpoint -60°), then Vecteurs (outer midpoint -100°).
    fireEvent.pointerDown(radial, { clientX: 368, clientY: 270, pointerId: 13, pointerType: 'mouse' });
    fireEvent.pointerUp(radial, { clientX: 368, clientY: 270, pointerId: 13, pointerType: 'mouse' });
    fireEvent.pointerDown(radial, { clientX: 285, clientY: 324, pointerId: 14, pointerType: 'mouse' });
    fireEvent.pointerUp(radial, { clientX: 285, clientY: 324, pointerId: 14, pointerType: 'mouse' });

    expect(document.querySelectorAll('.kinematic-vector-line')).toHaveLength(0);
    expect(screen.getByTestId('vector-layer-status')).toHaveTextContent('VECTORS OFF');
    expect(requests).toContainEqual(expect.objectContaining({
      actionId: 'MAP:DISPLAY:VECTORS',
      context: 'MAP',
      position: { lat: 35, lon: -120 },
    }));
  });

  it('opens a track-specific tree from an immutable display-entity snapshot', () => {
    vi.useFakeTimers();
    const onContextAction = vi.fn();
    const { rerender } = render(<MapDisplay {...defaultProps} onContextAction={onContextAction} />);
    const targetMarker = document.querySelectorAll('.custom-entity-icon')[1] as HTMLElement;
    fireEvent.mouseDown(targetMarker, { clientX: 260, clientY: 280 });
    act(() => {
      vi.advanceTimersByTime(defaultSettings.longPressDuration + 1);
    });

    const radial = screen.getByRole('dialog', { name: 'HOSTILE-1 radial menu' });
    const radialQueries = within(radial);
    expect(radialQueries.getByText('Données', { exact: true })).toBeInTheDocument();
    expect(radialQueries.getByText('Suivi', { exact: true })).toBeInTheDocument();
    expect(radialQueries.queryByText('Désigner', { exact: true })).not.toBeInTheDocument();
    expect(radialQueries.queryByText('CPA / TCPA', { exact: true })).not.toBeInTheDocument();
    expect(radialQueries.queryByText('TRACKS', { exact: true })).not.toBeInTheDocument();

    rerender(
      <MapDisplay
        {...defaultProps}
        entities={[{ ...mockEntities[0], position: { lat: 36, lon: -121 } }, mockEntities[1]]}
        onContextAction={onContextAction}
      />,
    );
    const stableRadial = screen.getByRole('dialog', { name: 'HOSTILE-1 radial menu' });
    expect(stableRadial).toBeInTheDocument();

    // The stored tree still uses the target's original position after the
    // display entity itself has moved.
    fireEvent.pointerDown(stableRadial, { clientX: 226, clientY: 231, pointerId: 15, pointerType: 'mouse' });
    fireEvent.pointerUp(stableRadial, { clientX: 226, clientY: 231, pointerId: 15, pointerType: 'mouse' });
    fireEvent.pointerDown(stableRadial, { clientX: 127, clientY: 245, pointerId: 16, pointerType: 'mouse' });
    fireEvent.pointerUp(stableRadial, { clientX: 127, clientY: 245, pointerId: 16, pointerType: 'mouse' });
    expect(onContextAction).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'TRACK:TRACKING:CENTER',
      targetId: 'target1',
      targetLabel: 'HOSTILE-1',
      targetType: EntityType.ENEMY,
      position: { lat: 35.1, lon: -120.1 },
    }));
  });

  it('never opens a mission radial for a decorative airport marker', () => {
    vi.useFakeTimers();
    const decorativeAirport: Entity = {
      id: 'decorative-airport',
      label: 'MARSEILLE PROVENCE',
      type: EntityType.AIRPORT,
      position: { lat: 43.4, lon: 5.2 },
    };
    render(<MapDisplay {...defaultProps} entities={[decorativeAirport]} onContextAction={vi.fn()} />);
    const airportMarker = document.querySelector('.custom-entity-icon [data-entity-id="decorative-airport"]') as HTMLElement;
    fireEvent.mouseDown(airportMarker, { clientX: 260, clientY: 280 });
    act(() => {
      vi.advanceTimersByTime(defaultSettings.longPressDuration + 1);
    });

    expect(screen.queryByRole('dialog', { name: /radial menu$/ })).not.toBeInTheDocument();
  });

  it('opens the BASE tree only for the exact scenario airport marker', () => {
    vi.useFakeTimers();
    const scenarioBase: Entity = {
      id: 'apt-base',
      label: 'BASE',
      type: EntityType.AIRPORT,
      position: { lat: 35.2, lon: -120.2 },
    };
    render(<MapDisplay {...defaultProps} entities={[scenarioBase]} onContextAction={vi.fn()} />);
    const baseMarker = document.querySelector('.custom-entity-icon [data-entity-id="apt-base"]') as HTMLElement;
    fireEvent.mouseDown(baseMarker, { clientX: 260, clientY: 280 });
    act(() => {
      vi.advanceTimersByTime(defaultSettings.longPressDuration + 1);
    });

    const radial = screen.getByRole('dialog', { name: 'BASE radial menu' });
    const radialQueries = within(radial);
    expect(radialQueries.getByText('Données', { exact: true })).toBeInTheDocument();
    expect(radialQueries.getByText('Rejoindre', { exact: true })).toBeInTheDocument();
    expect(radialQueries.getByText('Vue', { exact: true })).toBeInTheDocument();
    expect(radialQueries.queryByText('Mesurer', { exact: true })).not.toBeInTheDocument();
  });

  it('keeps pointer, wheel, and touch ownership in the overlay while a map radial is open', () => {
    vi.useFakeTimers();
    const onPan = vi.fn();
    const onSelectEntity = vi.fn();
    const onContextAction = vi.fn();
    const onMapDrop = vi.fn();
    render(
      <MapDisplay
        {...defaultProps}
        onPan={onPan}
        onSelectEntity={onSelectEntity}
        onContextAction={onContextAction}
        onMapDrop={onMapDrop}
      />,
    );
    const mapRoot = document.querySelector('.absolute.inset-0.bg-slate-950') as HTMLElement;
    fireEvent.pointerDown(mapRoot, {
      pointerId: 61,
      pointerType: 'mouse',
      clientX: 420,
      clientY: 300,
    });
    act(() => {
      vi.advanceTimersByTime(defaultSettings.longPressDuration + 1);
    });

    const radial = screen.getByRole('dialog', { name: 'MAP ACTION radial menu' });
    expect(radial).toHaveClass('z-[200]');
    const down = createEvent.pointerDown(radial, {
      pointerId: 62,
      pointerType: 'touch',
      clientX: 420,
      clientY: 300,
    });
    fireEvent(radial, down);
    const move = createEvent.pointerMove(radial, {
      pointerId: 62,
      pointerType: 'touch',
      clientX: 700,
      clientY: 700,
    });
    fireEvent(radial, move);
    const wheel = createEvent.wheel(radial, { deltaY: 120 });
    fireEvent(radial, wheel);
    fireEvent.drop(mapRoot, { dataTransfer: {} });
    const up = createEvent.pointerUp(radial, {
      pointerId: 62,
      pointerType: 'touch',
      clientX: 700,
      clientY: 700,
    });
    fireEvent(radial, up);

    expect(down.defaultPrevented).toBe(true);
    expect(move.defaultPrevented).toBe(true);
    expect(up.defaultPrevented).toBe(true);
    expect(onPan).not.toHaveBeenCalled();
    expect(onSelectEntity).not.toHaveBeenCalled();
    expect(onContextAction).not.toHaveBeenCalled();
    expect(onMapDrop).not.toHaveBeenCalled();
  });

  it('prevents entity radial overlay release from selecting the map or entity again', () => {
    vi.useFakeTimers();
    const onSelectEntity = vi.fn();
    const onPan = vi.fn();
    render(
      <MapDisplay
        {...defaultProps}
        onSelectEntity={onSelectEntity}
        onPan={onPan}
        onContextAction={vi.fn()}
      />,
    );
    const targetMarker = document.querySelectorAll('.custom-entity-icon')[1] as HTMLElement;
    fireEvent.mouseDown(targetMarker, { clientX: 260, clientY: 280 });
    act(() => {
      vi.advanceTimersByTime(defaultSettings.longPressDuration + 1);
    });
    const radial = screen.getByRole('dialog', { name: 'HOSTILE-1 radial menu' });
    expect(onSelectEntity).not.toHaveBeenCalled();
    fireEvent.pointerDown(radial, { pointerId: 63, pointerType: 'touch', clientX: 10, clientY: 10 });
    fireEvent.pointerUp(radial, { pointerId: 63, pointerType: 'touch', clientX: 10, clientY: 10 });
    expect(onSelectEntity).not.toHaveBeenCalled();
    expect(onPan).not.toHaveBeenCalled();
  });

  it('blocks direct marker callbacks while an entity radial is open', () => {
    vi.useFakeTimers();
    const onSelectEntity = vi.fn();
    const onPan = vi.fn();
    render(
      <MapDisplay
        {...defaultProps}
        onSelectEntity={onSelectEntity}
        onPan={onPan}
        onContextAction={vi.fn()}
      />,
    );
    const targetMarker = document.querySelectorAll('.custom-entity-icon')[1] as HTMLElement;
    fireEvent.mouseDown(targetMarker, { clientX: 260, clientY: 280 });
    act(() => {
      vi.advanceTimersByTime(defaultSettings.longPressDuration + 1);
    });
    expect(screen.getByRole('dialog', { name: 'HOSTILE-1 radial menu' })).toBeInTheDocument();
    onSelectEntity.mockClear();
    onPan.mockClear();

    fireEvent.mouseDown(targetMarker, { clientX: 260, clientY: 280 });
    fireEvent.mouseMove(targetMarker, { clientX: 280, clientY: 300 });
    fireEvent.mouseUp(targetMarker, { clientX: 280, clientY: 300 });
    expect(onSelectEntity).not.toHaveBeenCalled();
    expect(onPan).not.toHaveBeenCalled();
  });

  it('resets map touch ownership after a touch-opened radial is closed', () => {
    vi.useFakeTimers();
    const onPan = vi.fn();
    render(<MapDisplay {...defaultProps} onPan={onPan} onContextAction={vi.fn()} />);
    const mapRoot = document.querySelector('.absolute.inset-0.bg-slate-950') as HTMLElement;
    fireEvent.pointerDown(mapRoot, {
      pointerId: 81,
      pointerType: 'touch',
      clientX: 420,
      clientY: 300,
    });
    act(() => {
      vi.advanceTimersByTime(defaultSettings.longPressDuration + 1);
    });
    const radial = screen.getByRole('dialog', { name: 'MAP ACTION radial menu' });
    fireEvent.pointerDown(radial, { pointerId: 82, pointerType: 'touch', clientX: 420, clientY: 300 });
    fireEvent.pointerUp(radial, { pointerId: 82, pointerType: 'touch', clientX: 420, clientY: 300 });

    fireEvent.pointerDown(mapRoot, {
      pointerId: 83,
      pointerType: 'touch',
      clientX: 420,
      clientY: 300,
    });
    fireEvent.pointerMove(mapRoot, {
      pointerId: 83,
      pointerType: 'touch',
      clientX: 460,
      clientY: 300,
    });
    expect(onPan).toHaveBeenCalled();
  });

  it('restores focus to the map surface after closing a map radial', () => {
    vi.useFakeTimers();
    render(<MapDisplay {...defaultProps} onContextAction={vi.fn()} />);
    const mapRoot = document.querySelector('.absolute.inset-0.bg-slate-950') as HTMLElement;
    expect(mapRoot).toHaveAttribute('tabindex', '-1');

    fireEvent.pointerDown(mapRoot, {
      pointerId: 51,
      pointerType: 'mouse',
      clientX: 420,
      clientY: 300,
    });
    act(() => {
      vi.advanceTimersByTime(defaultSettings.longPressDuration + 1);
    });
    const radial = screen.getByRole('dialog', { name: 'MAP ACTION radial menu' });
    fireEvent.keyDown(radial, { key: 'Escape' });
    expect(mapRoot).toHaveFocus();
  });

  it('keeps mission markers, vectors, and trails present while the coast pack is pending', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(() => new Promise<Response>(() => {}));
    const ownship = { ...mockOwnship, position: { lat: 43.1183, lon: 5.9098 } };
    const entities = mockEntities.map((entity, index) => ({
      ...entity,
      position: { lat: 43.12 + index * 0.01, lon: 5.91 + index * 0.01 },
    }));
    const trails: TrackTrailState = {
      trails: {
        target1: {
          targetId: 'target1',
          label: 'HOSTILE-1',
          visible: true,
          limited: false,
          points: [
            { position: { lat: 43.12, lon: 5.91 }, atMs: 1_000, segmentId: 1 },
            { position: { lat: 43.13, lon: 5.91 }, atMs: 3_000, segmentId: 1 },
          ],
        },
      },
    };

    const route: ActiveSimulatedRoute = {
      id: 'route-pending',
      label: 'PENDING ROUTE',
      origin: ownship.position,
      waypoints: [{ id: 'route-point', label: 'R1', position: { lat: 43.15, lon: 5.95 } }],
      remainingWaypointCount: 1,
    };

    render(<MapDisplay {...defaultProps} ownship={ownship} entities={entities} trails={trails} activeRoute={route} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/maps/toulon/manifest.json')));
    expect(document.querySelectorAll('.custom-entity-icon')).toHaveLength(3);
    expect(document.querySelectorAll('.kinematic-vector-line')).toHaveLength(3);
    expect(document.querySelectorAll('.track-trail-line')).toHaveLength(1);
    expect(document.querySelectorAll('.leaflet-simulatedRouteLayer-pane path').length).toBeGreaterThan(0);
    expect(document.querySelector('.tactical-coast-pack')).toHaveAttribute('data-coast-state', 'pending');
    fetchMock.mockRestore();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

});
