import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CommandPalette } from '../../components/CommandPalette';
import { Entity } from '../../types';

describe('CommandPalette Component', () => {
  const mockOwnship: Entity = {
    id: 'ownship',
    label: 'OWNSHIP',
    type: 'FRIENDLY',
    position: { lat: 0, lon: 0 },
    heading: 0,
    speed: 0,
    status: 'ACTIVE'
  };

  const mockEntities: Entity[] = [
    mockOwnship,
    {
      id: 'target1',
      label: 'TARGET1',
      type: 'HOSTILE',
      position: { lat: 10, lon: 10 },
      heading: 90,
      speed: 300,
      status: 'ACTIVE'
    }
  ];

  const mockContext = {
    entities: mockEntities,
    ownship: mockOwnship,
    systems: {
      radar: false,
      adsb: false,
      ais: false,
      eots: false,
      camera: false,
      acoustic: false
    },
    setMapMode: vi.fn(),
    toggleSystem: vi.fn(),
    panTo: vi.fn(),
    history: [],
    openDocument: vi.fn(),
    mapMode: 0
  };

  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    onPan: vi.fn(),
    entities: mockContext.entities,
    systems: mockContext.systems,
    toggleSystem: mockContext.toggleSystem,
    mapMode: mockContext.mapMode,
    setMapMode: mockContext.setMapMode,
    ownship: mockContext.ownship,
    origin: { lat: 0, lon: 0 },
    openDocument: mockContext.openDocument
  };

  it('renders input field when open', () => {
    render(<CommandPalette {...mockProps} />);
    expect(screen.getByPlaceholderText("Type a command (e.g., 'DCT', 'TK2 180 5')...")).toBeInTheDocument();
  });

  it('updates input value when typing', () => {
    render(<CommandPalette {...mockProps} />);
    const input = screen.getByPlaceholderText("Type a command (e.g., 'DCT', 'TK2 180 5')...");

    fireEvent.change(input, { target: { value: 'target' } });
    expect(input).toHaveValue('target');
  });

  it('calls onClose when Escape is pressed', () => {
    render(<CommandPalette {...mockProps} />);
    const input = screen.getByPlaceholderText("Type a command (e.g., 'DCT', 'TK2 180 5')...");

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(mockProps.onClose).toHaveBeenCalled();
  });
});
