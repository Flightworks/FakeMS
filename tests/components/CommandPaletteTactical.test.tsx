import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandPalette } from '../../components/CommandPalette';
import { EntityType, NavMode, type Entity } from '../../types';

const ownship: Entity = {
  id: 'ownship',
  label: 'OWNSHIP',
  type: EntityType.OWNSHIP,
  position: { lat: 0, lon: 0 },
};

const bravo: Entity = {
  id: 'wp-bravo',
  label: 'BRAVO',
  type: EntityType.WAYPOINT,
  position: { lat: 1, lon: 1 },
};

const createProps = () => ({
  isOpen: true,
  onClose: vi.fn(),
  focusMapAt: vi.fn(),
  proposeDirectTo: vi.fn(),
  proposeRoute: vi.fn(),
  requestMissionAction: vi.fn(),
  entities: [ownship, bravo],
  systems: { radar: false, adsb: false, ais: false, eots: false },
  toggleSystem: vi.fn(),
  setMapMode: vi.fn(),
  ownship,
  openDocument: vi.fn(),
  ownshipNavMode: NavMode.REAL,
  setOwnshipNavMode: vi.fn(),
});

describe('CommandPalette tactical errors', () => {
  it('shows a range hint while the projection is incomplete', () => {
    render(<CommandPalette {...createProps()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Command input' }), {
      target: { value: 'BRAVO 180/' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'PORTÉE MANQUANTE — exemple : BRAVO 180/5NM',
    );
  });

  it('shows the bearing limits for an invalid projection cap', () => {
    render(<CommandPalette {...createProps()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Command input' }), {
      target: { value: 'BRAVO 370/5' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'CAP HORS LIMITES — attendu : 000 à 359.999°',
    );
  });

  it('shows supported units for an unknown projection unit', () => {
    render(<CommandPalette {...createProps()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Command input' }), {
      target: { value: 'BRAVO 180/5XX' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'UNITÉ INCONNUE — NM, KM ou M',
    );
  });
});
