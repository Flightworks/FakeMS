import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OwnshipPanel, TargetPanel } from '../../components/InfoPanels';
import { Entity, PrototypeSettings } from '../../types';

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
    type: 'FRIENDLY',
    position: { lat: 35.0, lon: -120.0 },
    heading: 45,
    speed: 250,
    status: 'ACTIVE'
  };

  const mockTarget: Entity = {
    id: 'target1',
    label: 'HOSTILE-1',
    type: 'HOSTILE',
    position: { lat: 35.1, lon: -120.1 },
    heading: 180,
    speed: 400,
    status: 'ENGAGED'
  };

  const defaultSettings: PrototypeSettings = {
    physicsFriction: 0.9,
    physicsTension: 170,
    physicsMass: 1,
    indicatorDelay: 200,
    hapticStrength: 50,
    visualFeedbackColor: '#10b981',
    animationSpeed: 300,
    theme: 'dark',
    ownshipPanelPos: 'BL',
    ownshipPanelScale: 1,
    ownshipPanelOpacity: 1,
    ownshipShowCoords: true,
    ownshipShowDetails: true
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
  });
});
