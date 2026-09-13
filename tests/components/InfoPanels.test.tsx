import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OwnshipPanel, TargetPanel } from '../../components/InfoPanels';
import { HMI_CLASSES } from '../../components/hmiTokens';
import { Entity, PrototypeSettings, EntityType } from '../../types';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Crosshair: () => <div data-testid="icon-crosshair" />,
  Navigation: () => <div data-testid="icon-navigation" />,
  Target: () => <div data-testid="icon-target" />,
  Activity: () => <div data-testid="icon-activity" />,
  Check: () => <div data-testid="icon-check" />,
  Compass: () => <div data-testid="icon-compass" />
}));

describe('InfoPanels Components', () => {
  const mockOwnship: Entity = {
    id: 'ownship1',
    label: 'OWNSHIP',
    type: EntityType.FRIENDLY,
    position: { lat: 35.0, lon: -120.0 },
    heading: 45,
    speed: 250
  };

  const mockTarget: Entity = {
    id: 'target1',
    label: 'HOSTILE-1',
    type: EntityType.ENEMY,
    position: { lat: 35.1, lon: -120.1 },
    heading: 180,
    speed: 400
  };

  const defaultSettings: PrototypeSettings = {
    tapThreshold: 300,
    indicatorDelay: 200,
    longPressDuration: 1000,
    jitterTolerance: 20,
    uiScale: 1.0,
    glowIntensity: 1.0,
    animationSpeed: 300,
    mapDim: 1.0,
    hapticEnabled: true,
    showSpeedVectors: true,
    ownshipPanelPos: 'BL',
    ownshipPanelScale: 1,
    ownshipPanelOpacity: 1,
    ownshipShowCoords: true,
    ownshipShowDetails: true,
    stabAutoGndOnPan: false,
    stabFreezeHeadingDrop: true,
    stabSnapRecenter: false,
    stabRecenterOnOrientSwitch: true,
    stabAutoRecenterDelay: 0,
    stabSmoothUnfreeze: false,
    stabMaintainScreenPosOnOrient: true
  };

  describe('OwnshipPanel', () => {
    it('renders ownship panel correctly', () => {
      render(
        <OwnshipPanel
          ownship={mockOwnship}
          origin={{ lat: 35.0, lon: -120.0 }}
          prototypeSettings={defaultSettings}
        />
      );

      expect(screen.getByText('OWNSHIP')).toBeInTheDocument();
      expect(screen.getByText('HDG')).toBeInTheDocument();
      expect(screen.getByText('045')).toBeInTheDocument();

      expect(screen.getByText('TAS')).toBeInTheDocument();
      expect(screen.getByText('250')).toBeInTheDocument();
      expect(screen.queryByText('HGT')).not.toBeInTheDocument();
      expect(screen.queryByText('N/A')).not.toBeInTheDocument();
      expect(screen.queryByText('UNAVAILABLE · UNAVAILABLE')).not.toBeInTheDocument();
    });

    it('labels a qualified simulation ground speed as GS instead of TAS', () => {
      render(
        <OwnshipPanel
          ownship={mockOwnship}
          origin={{ lat: 35.0, lon: -120.0 }}
          prototypeSettings={defaultSettings}
          navigationState={{
            source: 'SIM',
            validity: 'SIMULATED',
            position: mockOwnship.position,
            updatedAt: 1000,
            positionSource: 'SIM',
            positionStatus: 'CURRENT',
            positionQualification: 'SIMULATED',
            groundSpeed: {
              speedKnots: 250,
              source: 'SIMULATION',
              qualification: 'SIMULATED',
              status: 'AVAILABLE',
            },
          }}
        />
      );

      expect(screen.getByText('GS')).toBeInTheDocument();
      expect(screen.getByText('250')).toBeInTheDocument();
      expect(screen.getByText('SIMULATION · SIMULATED')).toBeInTheDocument();
      expect(screen.queryByText('TAS')).not.toBeInTheDocument();
    });

    it('shows simulation position qualification and separates elapsed T+ from scenario UTC', () => {
      render(
        <OwnshipPanel
          ownship={mockOwnship}
          origin={{ lat: 35.0, lon: -120.0 }}
          prototypeSettings={defaultSettings}
          navigationState={{
            source: 'SIM',
            validity: 'SIMULATED',
            position: mockOwnship.position,
            updatedAt: 1000,
            positionSource: 'SIM',
            positionStatus: 'CURRENT',
            positionQualification: 'SIMULATED',
            groundSpeed: {
              speedKnots: 250,
              source: 'SIMULATION',
              qualification: 'SIMULATED',
              status: 'AVAILABLE',
            },
          }}
          scenarioTimeMs={Date.UTC(2026, 8, 13, 12, 34, 56)}
          simTimeMs={1789236156}
        />
      );

      expect(screen.getByTestId('ownship-position-status')).toHaveTextContent('SIMULATION POSITION');
      expect(screen.getByTestId('ownship-position-status')).toHaveTextContent('SIMULATED MOVEMENT');
      const clock = screen.getByTestId('scenario-clock');
      expect(clock).toHaveTextContent(/T\+\d{2,}:\d{2}:\d{2}/);
      expect(clock).toHaveTextContent('SCENARIO UTC 2026-09-13 12:34:56Z');
      expect(clock).not.toHaveTextContent('T+1789236156');
    });

    it('keeps a lost GPS fix position-only and labels its speed stale', () => {
      render(
        <OwnshipPanel
          ownship={mockOwnship}
          origin={{ lat: 35.0, lon: -120.0 }}
          prototypeSettings={defaultSettings}
          navigationState={{
            source: 'GPS',
            validity: 'LOST',
            position: { lat: 48.1, lon: 2.2 },
            updatedAt: 3000,
            positionSource: 'GPS',
            positionStatus: 'RETAINED',
            positionQualification: 'RETAINED',
            positionUpdatedAt: 2500,
            groundSpeed: {
              speedKnots: 120,
              source: 'GPS',
              qualification: 'MEASURED',
              status: 'STALE',
            },
          }}
        />
      );

      expect(screen.getByTestId('ownship-position-status')).toHaveTextContent('GPS POSITION RETAINED');
      expect(screen.getByTestId('ownship-position-status')).toHaveTextContent('RETAINED GPS POSITION');
      expect(screen.getByText('GS')).toBeInTheDocument();
      expect(screen.getByText('STALE')).toBeInTheDocument();
      expect(screen.queryByText('TAS')).not.toBeInTheDocument();
    });

    it('reports an absent GPS speed without fabricating a value', () => {
      render(
        <OwnshipPanel
          ownship={mockOwnship}
          origin={{ lat: 35.0, lon: -120.0 }}
          prototypeSettings={defaultSettings}
          navigationState={{
            source: 'GPS',
            validity: 'VALID',
            position: mockOwnship.position,
            updatedAt: 1000,
            positionSource: 'GPS',
            positionStatus: 'CURRENT',
            positionQualification: 'MEASURED',
          }}
        />
      );

      expect(screen.getByText('GS')).toBeInTheDocument();
      expect(screen.getByText('UNAVAILABLE')).toBeInTheDocument();
      expect(screen.getByText('GPS · UNAVAILABLE · SPEED ABSENT')).toBeInTheDocument();
      expect(screen.queryByText('TAS')).not.toBeInTheDocument();
    });

    it('shows TAS only when an explicit true-air-speed field and source exist', () => {
      const withAirData = {
        ...mockOwnship,
        metadata: {
          tasKnots: 210,
          tasSource: 'AIR DATA',
          tasQualification: 'MEASURED',
        },
      };
      render(
        <OwnshipPanel
          ownship={withAirData}
          origin={{ lat: 35.0, lon: -120.0 }}
          prototypeSettings={defaultSettings}
          navigationState={{
            source: 'SIM',
            validity: 'SIMULATED',
            position: withAirData.position,
            updatedAt: 1000,
            positionSource: 'SIM',
            positionStatus: 'CURRENT',
            positionQualification: 'SIMULATED',
            groundSpeed: {
              speedKnots: 250,
              source: 'SIMULATION',
              qualification: 'SIMULATED',
              status: 'AVAILABLE',
            },
          }}
        />
      );

      expect(screen.getByText('GS')).toBeInTheDocument();
      expect(screen.getByText('TAS')).toBeInTheDocument();
      expect(screen.getByText('AIR DATA · MEASURED')).toBeInTheDocument();
    });

    it('renders the HGT source and qualification beside the unit-bearing value', () => {
      const qualifiedOwnship = { ...mockOwnship, metadata: { hgtFt: 1_200 } };
      render(
        <OwnshipPanel
          ownship={qualifiedOwnship}
          origin={{ lat: 35.0, lon: -120.0 }}
          prototypeSettings={defaultSettings}
        />
      );

      const valueRow = screen.getByText('1200').parentElement as HTMLElement;
      expect(valueRow).toHaveClass(HMI_CLASSES.primaryValue);
      expect(within(valueRow).getByText('ft')).toHaveClass(HMI_CLASSES.unit);
      expect(screen.getByText('SIMULATED_TERRAIN · SIMULATED')).toHaveClass(HMI_CLASSES.qualification);
    });

    it('omits unavailable height metadata instead of duplicating its status', () => {
      render(
        <OwnshipPanel
          ownship={mockOwnship}
          origin={{ lat: 35.0, lon: -120.0 }}
          prototypeSettings={defaultSettings}
        />
      );

      expect(screen.queryByText('HGT')).not.toBeInTheDocument();
      expect(screen.queryByText('N/A')).not.toBeInTheDocument();
      expect(screen.queryByText('UNAVAILABLE · UNAVAILABLE')).not.toBeInTheDocument();
    });

    it('respects declutter settings', () => {
      const declutteredSettings = { ...defaultSettings, ownshipShowDetails: false };
      render(
        <OwnshipPanel
          ownship={mockOwnship}
          origin={{ lat: 35.0, lon: -120.0 }}
          prototypeSettings={declutteredSettings}
        />
      );

      expect(screen.queryByText('HDG')).not.toBeInTheDocument();
      expect(screen.getByText('TELEMETRY_MINIMIZED')).toBeInTheDocument();
    });
  });

  describe('TargetPanel', () => {
    it('renders target panel with calculated distance and bearing', () => {
      render(
        <TargetPanel
          ownship={mockOwnship}
          entity={mockTarget}
        />
      );

      expect(screen.getByText('FROM H/C')).toBeInTheDocument();
      expect(screen.getByText('BRG')).toBeInTheDocument();
      expect(screen.getByText('DIST')).toBeInTheDocument();
    });

    it('returns null if entity or ownship is missing', () => {
      const { container } = render(
        <TargetPanel
          ownship={mockOwnship}
          entity={null}
        />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('shows track metadata only when supplied and marks stale tracks with age', () => {
      const staleTarget = {
        ...mockTarget,
        metadata: {
          source: 'RADAR',
          freshness: 'STALE',
          ageSeconds: 90,
          quality: 'DEGRADED',
          uncertaintyMeters: 250,
          classification: 'HOSTILE',
          confidence: 0.8,
        },
      };
      render(
        <TargetPanel
          ownship={mockOwnship}
          entity={staleTarget}
        />
      );

      const details = screen.getByTestId('target-track-details');
      expect(details).toHaveTextContent('TRACK SOURCE: RADAR');
      expect(details).toHaveTextContent('FRESHNESS: STALE · AGE: 90 S');
      expect(details).toHaveTextContent('QUALITY: DEGRADED');
      expect(details).toHaveTextContent('UNCERTAINTY: 250 M');
      expect(details).toHaveTextContent('CLASSIFICATION: HOSTILE');
      expect(details).toHaveTextContent('CONFIDENCE: 80%');
    });

    it('labels waypoint observation quality as non-applicable without generic metadata', () => {
      const waypoint = {
        ...mockTarget,
        type: EntityType.WAYPOINT,
        metadata: undefined,
      };
      render(
        <TargetPanel
          ownship={mockOwnship}
          entity={waypoint}
        />
      );

      const details = screen.getByTestId('target-track-details');
      expect(details).toHaveTextContent('OBSERVATION QUALITY: N/A · NON-APPLICABLE');
      expect(details).not.toHaveTextContent('FRESHNESS');
      expect(details).not.toHaveTextContent('UNKNOWN');
    });

    it('does not open target details for a decorative airport', () => {
      const { container } = render(
        <TargetPanel
          ownship={mockOwnship}
          entity={{ ...mockTarget, type: EntityType.AIRPORT }}
        />
      );

      expect(container).toBeEmptyDOMElement();
    });
  });
});
