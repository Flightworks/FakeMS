import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { CommandPalette } from '../../components/CommandPalette';
import { Entity, EntityType, NavMode } from '../../types';

const originalVisualViewport = window.visualViewport;
const originalInnerWidth = window.innerWidth;
const originalInnerHeight = window.innerHeight;

class TestVisualViewport extends EventTarget {
  width = 1024;
  height = 768;
  offsetTop = 0;
  offsetLeft = 0;
}

const installVisualViewport = (visualViewport: TestVisualViewport | undefined) => {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: visualViewport,
  });
};

afterEach(() => {
  vi.restoreAllMocks();
  installVisualViewport(originalVisualViewport as unknown as TestVisualViewport | undefined);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
});

describe('CommandPalette Component', () => {
  const mockOwnship: Entity = {
    id: 'ownship',
    label: 'OWNSHIP',
    type: EntityType.FRIENDLY,
    position: { lat: 0, lon: 0 },
    heading: 0,
    speed: 0
  };

  const mockEntities: Entity[] = [
    mockOwnship,
    {
      id: 'target1',
      label: 'TARGET1',
      type: EntityType.ENEMY,
      position: { lat: 10, lon: 10 },
      heading: 90,
      speed: 300
    }
  ];

  const mockContext = {
    entities: mockEntities,
    ownship: mockOwnship,
    systems: {
      radar: false,
      adsb: false,
      ais: false,
      eots: false
    },
    setMapMode: vi.fn(),
    toggleSystem: vi.fn(),
    history: [],
    openDocument: vi.fn()
  };

  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    focusMapAt: vi.fn(),
    proposeDirectTo: vi.fn(),
    proposeRoute: vi.fn(),
    requestMissionAction: vi.fn(),
    entities: mockContext.entities,
    systems: mockContext.systems,
    toggleSystem: mockContext.toggleSystem,
    setMapMode: mockContext.setMapMode,
    ownship: mockContext.ownship,
    openDocument: mockContext.openDocument,
    ownshipNavMode: NavMode.REAL,
    toggleNavMode: vi.fn(),
    setOwnshipNavMode: vi.fn(),
  };

  it('renders input field when open', () => {
    render(<CommandPalette {...mockProps} />);
    expect(screen.getByRole('dialog', { name: 'Tactical command palette' })).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: 'Command results' })).toBeInTheDocument();
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

  it('follows a reduced visual viewport and keeps essential controls available', () => {
    const visualViewport = new TestVisualViewport();
    installVisualViewport(visualViewport);
    render(<CommandPalette {...mockProps} />);

    const dialog = screen.getByRole('dialog', { name: 'Tactical command palette' });
    const overlay = dialog.parentElement;
    const input = screen.getByRole('textbox', { name: 'Command input' });
    const closeButton = screen.getByRole('button', { name: 'Close command palette' });
    const results = screen.getByRole('listbox', { name: 'Command results' });

    act(() => {
      visualViewport.width = 1024;
      visualViewport.height = 360;
      visualViewport.offsetTop = 24;
      visualViewport.offsetLeft = 16;
      visualViewport.dispatchEvent(new Event('resize'));
    });

    expect(overlay).not.toBeNull();
    expect(overlay).toHaveStyle({
      top: '24px',
      left: '16px',
      width: '1024px',
      height: '360px',
    });
    expect(input).toBeVisible();
    expect(closeButton).toBeVisible();
    expect(results).toHaveClass('flex-1', 'min-h-0');

    act(() => {
      visualViewport.offsetTop = 32;
      visualViewport.dispatchEvent(new Event('scroll'));
    });

    expect(overlay).toHaveStyle({ top: '32px' });
  });

  it('falls back to the layout viewport when VisualViewport is unavailable', () => {
    installVisualViewport(undefined);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });

    render(<CommandPalette {...mockProps} />);

    const dialog = screen.getByRole('dialog', { name: 'Tactical command palette' });
    expect(dialog.parentElement).toHaveStyle({
      top: '0px',
      left: '0px',
      width: '800px',
      height: '600px',
    });
  });

  it('removes VisualViewport listeners when it closes or unmounts', () => {
    const visualViewport = new TestVisualViewport();
    installVisualViewport(visualViewport);
    const removeEventListener = vi.spyOn(visualViewport, 'removeEventListener');
    const { rerender, unmount } = render(<CommandPalette {...mockProps} />);

    rerender(<CommandPalette {...mockProps} isOpen={false} />);

    expect(removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));

    unmount();
  });

  it('completes a reference with Tab without executing or closing the palette', () => {
    vi.clearAllMocks();
    render(<CommandPalette {...mockProps} />);
    const input = screen.getByRole('textbox', { name: 'Command input' });

    fireEvent.change(input, { target: { value: 'TAR' } });
    fireEvent.keyDown(input, { key: 'Tab' });

    expect(input).toHaveValue('TARGET1 ');
    expect(mockProps.onClose).not.toHaveBeenCalled();
    expect(mockProps.proposeDirectTo).not.toHaveBeenCalled();
  });

  it('keeps unit choices as non-executing completions', () => {
    vi.clearAllMocks();
    render(<CommandPalette {...mockProps} />);
    const input = screen.getByRole('textbox', { name: 'Command input' });

    fireEvent.change(input, { target: { value: 'TARGET1 180/5' } });

    const completionList = screen.getByRole('listbox', { name: 'Tactical completions' });
    expect(within(completionList).getByRole('option', { name: /NM/ })).toBeInTheDocument();
    expect(within(completionList).getByRole('option', { name: /KM/ })).toBeInTheDocument();
    expect(within(completionList).getByRole('option', { name: /^M · UNITÉ DE PORTÉE · M$/ })).toBeInTheDocument();

    fireEvent.click(within(completionList).getByRole('option', { name: /UNITÉ DE PORTÉE · NM/ }));

    expect(input).toHaveValue('TARGET1 180/5NM');
    expect(mockProps.onClose).not.toHaveBeenCalled();
  });

});
