import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PieMenu, type PieMenuOption } from '../../components/PieMenu';
import { HMI_CLASSES } from '../../components/hmiTokens';
import { getRadialSafeMargin, RADIAL_LAYOUT_DIMENSIONS } from '../../domain/radialLayout';

const TestIcon = () => <span aria-hidden="true" />;

const pointAt = (anchor: { x: number; y: number }, radius: number, angle: number) => ({
  clientX: anchor.x + radius * Math.cos(((angle - 90) * Math.PI) / 180),
  clientY: anchor.y + radius * Math.sin(((angle - 90) * Math.PI) / 180),
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PieMenu', () => {
  it('renders a safe clamped anchor, discoverable labels, and a non-clipped title', () => {
    const options: PieMenuOption[] = [
      { label: 'ALPHA', icon: TestIcon },
      { label: 'BRAVO', icon: TestIcon },
    ];
    const margin = getRadialSafeMargin(RADIAL_LAYOUT_DIMENSIONS);
    const titleMaxWidth = `${(2 * margin.horizontal) - 16}px`;

    render(
      <PieMenu
        x={0}
        y={0}
        options={options}
        title="MAP ACTION"
        onClose={vi.fn()}
        hapticEnabled={false}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'MAP ACTION radial menu' });
    const anchor = screen.getByTestId('radial-menu-anchor');
    expect(dialog).toHaveClass('pointer-events-auto');
    expect(anchor).toHaveClass('pointer-events-none');
    expect(anchor).toHaveStyle({
      left: `${margin.horizontal}px`,
      top: `${margin.vertical}px`,
    });
    expect(screen.getByText('MAP ACTION')).toHaveStyle({
      marginTop: `-${RADIAL_LAYOUT_DIMENSIONS.title.offset}px`,
      maxWidth: titleMaxWidth,
      whiteSpace: 'normal',
    });

    for (const label of ['ALPHA', 'BRAVO']) {
      const renderedLabel = screen.getByText(label);
      expect(renderedLabel).toHaveClass('text-[12px]');
      expect(renderedLabel).not.toHaveClass('text-[9px]', 'text-[8px]');
    }
  });

  it('applies shared action, target, and focus contracts to both radial levels', () => {
    const options: PieMenuOption[] = [
      { label: 'PARENT', icon: TestIcon, subOptions: [{ label: 'LEAF', icon: TestIcon }] },
    ];

    render(
      <PieMenu
        x={400}
        y={300}
        options={options}
        onClose={vi.fn()}
        hapticEnabled={false}
      />,
    );

    const parent = screen.getByRole('button', { name: 'PARENT' });
    expect(parent).toHaveClass(HMI_CLASSES.actionText, HMI_CLASSES.activeTarget, HMI_CLASSES.focusRing);

    fireEvent.keyDown(parent, { key: 'ArrowRight' });
    const leaf = screen.getByRole('button', { name: 'LEAF' });
    expect(leaf).toHaveClass(HMI_CLASSES.actionText, HMI_CLASSES.activeTarget, HMI_CLASSES.focusRing);

    const cancel = screen.getByRole('button', { name: 'Cancel radial menu' });
    expect(cancel).toHaveClass(HMI_CLASSES.activeTarget, HMI_CLASSES.focusRing);
  });

  it('preserves sector order and keeps a selected parent child ring mounted', () => {
    const onClose = vi.fn();
    const leafAction = vi.fn();
    const options: PieMenuOption[] = [
      {
        label: 'PARENT',
        icon: TestIcon,
        subOptions: [{ label: 'LEAF', icon: TestIcon, action: leafAction }],
      },
      { label: 'SECOND', icon: TestIcon },
    ];
    const anchor = { x: 400, y: 300 };

    render(
      <PieMenu
        {...anchor}
        options={options}
        onClose={onClose}
        hapticEnabled={false}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Tactical radial menu' });
    const parent = screen.getByText('PARENT');
    const second = screen.getByText('SECOND');
    expect(parent.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const parentPoint = pointAt(anchor, 60, -85);
    fireEvent.pointerDown(dialog, { ...parentPoint, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(dialog, { ...parentPoint, pointerId: 1, pointerType: 'mouse' });

    expect(screen.getByText('LEAF')).toBeInTheDocument();
    expect(screen.getByText('LEAF')).toHaveClass('text-[12px]');
    const menuSvg = dialog.querySelector('svg[viewBox="-300 -300 600 600"]');
    expect(menuSvg).not.toBeNull();
    expect(menuSvg?.querySelectorAll('path')).toHaveLength(3);
    expect(onClose).not.toHaveBeenCalled();

    const childPoint = pointAt(anchor, 137, -85);
    fireEvent.pointerDown(dialog, { ...childPoint, pointerId: 2, pointerType: 'mouse' });
    fireEvent.pointerUp(dialog, { ...childPoint, pointerId: 2, pointerType: 'mouse' });

    expect(leafAction).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not activate a command from the center or outside release', () => {
    vi.useFakeTimers();
    const action = vi.fn();
    const onClose = vi.fn();
    const anchor = { x: 400, y: 300 };

    render(
      <PieMenu
        {...anchor}
        options={[{ label: 'ACTION', icon: TestIcon, action }]}
        onClose={onClose}
        hapticEnabled={false}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Tactical radial menu' });
    vi.advanceTimersByTime(500);

    fireEvent.pointerDown(dialog, { ...anchor, pointerId: 3, pointerType: 'mouse' });
    fireEvent.pointerUp(dialog, { ...anchor, pointerId: 3, pointerType: 'mouse' });
    fireEvent.pointerDown(dialog, { clientX: 900, clientY: 700, pointerId: 4, pointerType: 'mouse' });
    fireEvent.pointerUp(dialog, { clientX: 900, clientY: 700, pointerId: 4, pointerType: 'mouse' });

    expect(action).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('gives the first leaf visible focus and activates it with Enter', () => {
    const action = vi.fn();
    render(
      <PieMenu
        x={400}
        y={300}
        options={[{ label: 'ACTION', icon: TestIcon, action }]}
        onClose={vi.fn()}
        hapticEnabled={false}
      />,
    );

    const actionButton = screen.getByRole('button', { name: 'ACTION' });
    expect(actionButton).toHaveFocus();
    fireEvent.keyDown(actionButton, { key: 'Enter' });
    expect(action).toHaveBeenCalledOnce();
  });

  it('uses the roving target when keyboard events are delivered to the dialog', () => {
    const action = vi.fn();
    render(
      <PieMenu
        x={400}
        y={300}
        options={[{ label: 'ACTION', icon: TestIcon, action }]}
        onClose={vi.fn()}
        hapticEnabled={false}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Tactical radial menu' });
    expect(screen.getByRole('button', { name: 'ACTION' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Enter' });
    expect(action).toHaveBeenCalledOnce();
  });

  it('cycles roving focus in stable option order with arrow keys', () => {
    render(
      <PieMenu
        x={400}
        y={300}
        options={[{ label: 'ALPHA', icon: TestIcon }, { label: 'BRAVO', icon: TestIcon }]}
        onClose={vi.fn()}
        hapticEnabled={false}
      />,
    );
    const alpha = screen.getByRole('button', { name: 'ALPHA' });
    const bravo = screen.getByRole('button', { name: 'BRAVO' });
    expect(alpha).toHaveFocus();
    expect(alpha).toHaveClass('min-h-[48px]', 'min-w-[48px]');
    expect(bravo).toHaveClass('min-h-[48px]', 'min-w-[48px]');
    fireEvent.keyDown(alpha, { key: 'ArrowDown' });
    expect(bravo).toHaveFocus();
    fireEvent.keyDown(bravo, { key: 'ArrowUp' });
    expect(alpha).toHaveFocus();
  });

  it('supports Escape and Space through a stable parent-child keyboard path', () => {
    const action = vi.fn();
    const onClose = vi.fn();
    render(
      <PieMenu
        x={400}
        y={300}
        options={[
          { label: 'PARENT', icon: TestIcon, subOptions: [{ label: 'LEAF', icon: TestIcon, action }] },
          { label: 'SECOND', icon: TestIcon },
        ]}
        onClose={onClose}
        hapticEnabled={false}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Tactical radial menu' });
    const parent = screen.getByRole('button', { name: 'PARENT' });
    expect(parent).toHaveFocus();
    fireEvent.keyDown(parent, { key: 'ArrowRight' });

    const leaf = screen.getByRole('button', { name: 'LEAF' });
    expect(leaf).toHaveFocus();
    fireEvent.keyDown(leaf, { key: ' ' });

    expect(action).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('dismisses only on outside release and never turns a cancel into a leaf action', () => {
    const action = vi.fn();
    const onClose = vi.fn();
    const anchor = { x: 400, y: 300 };
    render(
      <PieMenu
        {...anchor}
        options={[{ label: 'ACTION', icon: TestIcon, action }]}
        onClose={onClose}
        hapticEnabled={false}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Tactical radial menu' });
    fireEvent.pointerDown(dialog, { clientX: 900, clientY: 700, pointerId: 21, pointerType: 'touch' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerUp(dialog, { clientX: 900, clientY: 700, pointerId: 21, pointerType: 'touch' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(action).not.toHaveBeenCalled();
  });

  it('supports horizontal touch release while cancelling vertical and pinch gestures', () => {
    const horizontalAction = vi.fn();
    const horizontalClose = vi.fn();
    const anchor = { x: 400, y: 300 };
    render(
      <PieMenu
        {...anchor}
        options={[{ label: 'PARENT', icon: TestIcon, subOptions: [{ label: 'LEAF', icon: TestIcon, action: horizontalAction }] }]}
        onClose={horizontalClose}
        hapticEnabled={false}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Tactical radial menu' });
    const parentPoint = pointAt(anchor, 60, -60);
    const childPoint = pointAt(anchor, 137, -60);
    fireEvent.pointerDown(dialog, { ...parentPoint, pointerId: 31, pointerType: 'touch' });
    fireEvent.pointerMove(dialog, { ...childPoint, pointerId: 31, pointerType: 'touch' });
    fireEvent.pointerUp(dialog, { ...childPoint, pointerId: 31, pointerType: 'touch' });
    expect(horizontalAction).toHaveBeenCalledOnce();
    expect(horizontalClose).toHaveBeenCalledOnce();

    const verticalAction = vi.fn();
    const verticalClose = vi.fn();
    const { unmount } = render(
      <PieMenu
        {...anchor}
        options={[{ label: 'PARENT', icon: TestIcon, subOptions: [{ label: 'LEAF', icon: TestIcon, action: verticalAction }] }]}
        onClose={verticalClose}
        hapticEnabled={false}
      />,
    );
    const verticalDialog = screen.getAllByRole('dialog', { name: 'Tactical radial menu' }).at(-1)!;
    fireEvent.pointerDown(verticalDialog, { ...parentPoint, pointerId: 32, pointerType: 'touch' });
    fireEvent.pointerMove(verticalDialog, { clientX: parentPoint.clientX, clientY: parentPoint.clientY + 80, pointerId: 32, pointerType: 'touch' });
    fireEvent.pointerUp(verticalDialog, { clientX: parentPoint.clientX, clientY: parentPoint.clientY + 80, pointerId: 32, pointerType: 'touch' });
    expect(verticalAction).not.toHaveBeenCalled();
    expect(verticalClose).not.toHaveBeenCalled();

    fireEvent.pointerDown(verticalDialog, { ...parentPoint, pointerId: 33, pointerType: 'touch' });
    fireEvent.pointerDown(verticalDialog, { clientX: anchor.x, clientY: anchor.y, pointerId: 34, pointerType: 'touch' });
    fireEvent.pointerUp(verticalDialog, { ...parentPoint, pointerId: 33, pointerType: 'touch' });
    fireEvent.pointerUp(verticalDialog, { clientX: anchor.x, clientY: anchor.y, pointerId: 34, pointerType: 'touch' });
    expect(verticalAction).not.toHaveBeenCalled();
    expect(verticalClose).not.toHaveBeenCalled();
    unmount();
  });

  it('does not activate a leaf from the inter-ring gap', () => {
    const action = vi.fn();
    const onClose = vi.fn();
    const anchor = { x: 400, y: 300 };
    render(
      <PieMenu
        {...anchor}
        options={[{ label: 'PARENT', icon: TestIcon, subOptions: [{ label: 'LEAF', icon: TestIcon, action }] }]}
        onClose={onClose}
        hapticEnabled={false}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Tactical radial menu' });
    const parentPoint = pointAt(anchor, 60, -60);
    const gapPoint = pointAt(anchor, 97, -60);
    fireEvent.pointerDown(dialog, { ...parentPoint, pointerId: 91, pointerType: 'mouse' });
    fireEvent.pointerUp(dialog, { ...parentPoint, pointerId: 91, pointerType: 'mouse' });
    fireEvent.pointerDown(dialog, { ...gapPoint, pointerId: 92, pointerType: 'mouse' });
    fireEvent.pointerUp(dialog, { ...gapPoint, pointerId: 92, pointerType: 'mouse' });
    expect(action).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('allows a child fallback click immediately after a parent pointer release', () => {
    const action = vi.fn();
    const anchor = { x: 400, y: 300 };
    render(
      <PieMenu
        {...anchor}
        options={[{ label: 'PARENT', icon: TestIcon, subOptions: [{ label: 'LEAF', icon: TestIcon, action }] }]}
        onClose={vi.fn()}
        hapticEnabled={false}
      />,
    );
    const parent = screen.getByRole('button', { name: 'PARENT' });
    const parentPoint = pointAt(anchor, 60, -60);
    fireEvent.pointerDown(parent, { ...parentPoint, pointerId: 111, pointerType: 'touch' });
    fireEvent.pointerUp(parent, { ...parentPoint, pointerId: 111, pointerType: 'touch' });
    const leaf = screen.getByRole('button', { name: 'LEAF' });
    fireEvent.click(leaf, { detail: 1 });
    expect(action).toHaveBeenCalledOnce();
  });

  it('ignores unpressed mouse hover when assigning pointer ownership', () => {
    const action = vi.fn();
    const onClose = vi.fn();
    const anchor = { x: 400, y: 300 };
    render(
      <PieMenu
        {...anchor}
        options={[{ label: 'ACTION', icon: TestIcon, action }]}
        onClose={onClose}
        hapticEnabled={false}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Tactical radial menu' });
    const point = pointAt(anchor, 60, -60);
    fireEvent.pointerMove(dialog, { ...point, pointerId: 101, pointerType: 'mouse', buttons: 0 });
    fireEvent.pointerDown(dialog, { ...point, pointerId: 101, pointerType: 'mouse', buttons: 1 });
    fireEvent.pointerUp(dialog, { ...point, pointerId: 101, pointerType: 'mouse', buttons: 0 });
    expect(action).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not let a different pointer finish an owned gesture', () => {
    const action = vi.fn();
    const onClose = vi.fn();
    const anchor = { x: 400, y: 300 };
    render(
      <PieMenu
        {...anchor}
        options={[{ label: 'PARENT', icon: TestIcon, subOptions: [{ label: 'LEAF', icon: TestIcon, action }] }]}
        onClose={onClose}
        hapticEnabled={false}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Tactical radial menu' });
    const parentPoint = pointAt(anchor, 60, -60);
    const childPoint = pointAt(anchor, 137, -60);
    fireEvent.pointerDown(dialog, { ...parentPoint, pointerId: 71, pointerType: 'touch' });
    fireEvent.pointerUp(dialog, { ...childPoint, pointerId: 72, pointerType: 'touch' });
    expect(action).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerUp(dialog, { ...parentPoint, pointerId: 71, pointerType: 'touch' });
    expect(action).not.toHaveBeenCalled();
  });

  it('restores the supplied trigger focus and leaves a text field focused', () => {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    document.body.appendChild(trigger);
    trigger.focus();
    const returnFocusRef = { current: trigger };
    const { unmount } = render(
      <PieMenu
        x={400}
        y={300}
        options={[{ label: 'ACTION', icon: TestIcon }]}
        onClose={vi.fn()}
        returnFocusRef={returnFocusRef}
        hapticEnabled={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'ACTION' })).toHaveFocus();
    unmount();
    expect(trigger).toHaveFocus();

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const fieldClose = vi.fn();
    const fieldMenu = render(
      <PieMenu
        x={400}
        y={300}
        options={[{ label: 'FIELD ACTION', icon: TestIcon }]}
        onClose={fieldClose}
        hapticEnabled={false}
      />,
    );
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(fieldClose).toHaveBeenCalledOnce();
    fieldMenu.unmount();
    expect(input).toHaveFocus();
    trigger.remove();
    input.remove();
  });

  it('guards a pointer activation from its follow-up click', () => {
    const action = vi.fn();
    const onClose = vi.fn();
    const anchor = { x: 400, y: 300 };
    render(
      <PieMenu
        {...anchor}
        options={[{ label: 'ACTION', icon: TestIcon, action }]}
        onClose={onClose}
        hapticEnabled={false}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Tactical radial menu' });
    const point = pointAt(anchor, 60, -85);
    fireEvent.pointerDown(dialog, { ...point, pointerId: 41, pointerType: 'mouse' });
    fireEvent.pointerUp(dialog, { ...point, pointerId: 41, pointerType: 'mouse' });
    fireEvent.click(screen.getByRole('button', { name: 'ACTION' }), { detail: 1 });
    expect(action).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
