import React, { useEffect, useMemo, useState, useRef } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { clampRadialAnchor, RADIAL_LAYOUT_DIMENSIONS } from '../domain/radialLayout';
import { HMI_CLASSES } from './hmiTokens';

export interface PieMenuOption {
  label: string;
  icon: React.ElementType;
  action?: () => void;
  color?: 'danger' | 'primary' | 'default';
  subOptions?: PieMenuOption[];
}

interface PieMenuProps {
  x: number;
  y: number;
  options: PieMenuOption[];
  onClose: () => void;
  title?: string;
  glowIntensity?: number;
  hapticEnabled?: boolean;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

// --- Geometry Helpers ---
const toRad = (deg: number) => (deg * Math.PI) / 180;

// Generate SVG Path for a ring sector
const getSectorPath = (
  outerR: number,
  innerR: number,
  startAngleDeg: number,
  endAngleDeg: number,
  gap: number = 2
) => {
  const start = startAngleDeg + gap / 2;
  const end = endAngleDeg - gap / 2;

  // Prevent inverse arcs
  if (start >= end) return '';

  const startRad = toRad(start - 90);
  const endRad = toRad(end - 90);

  const p1x = outerR * Math.cos(startRad);
  const p1y = outerR * Math.sin(startRad);
  const p2x = outerR * Math.cos(endRad);
  const p2y = outerR * Math.sin(endRad);

  const p3x = innerR * Math.cos(endRad);
  const p3y = innerR * Math.sin(endRad);
  const p4x = innerR * Math.cos(startRad);
  const p4y = innerR * Math.sin(startRad);

  const largeArc = (end - start) > 180 ? 1 : 0;

  return `
    M ${p1x} ${p1y}
    A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2x} ${p2y}
    L ${p3x} ${p3y}
    A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4x} ${p4y}
    Z
  `;
};

const INNER_R_IN = RADIAL_LAYOUT_DIMENSIONS.innerRing.inner;
const INNER_R_OUT = RADIAL_LAYOUT_DIMENSIONS.innerRing.outer;
const OUTER_R_IN = RADIAL_LAYOUT_DIMENSIONS.outerRing.inner;
const OUTER_R_OUT = RADIAL_LAYOUT_DIMENSIONS.outerRing.outer;
const SECTOR_ANGLE = RADIAL_LAYOUT_DIMENSIONS.sectorAngle;

type FocusLevel = 'inner' | 'outer';

type MenuPointerState = {
  pointerType: string;
  startX: number;
  startY: number;
  startedInside: boolean;
  moved: boolean;
  cancelled: boolean;
  verticalGesture: boolean;
};

const isTextEntry = (element: Element | null): boolean => {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
};

export const PieMenu: React.FC<PieMenuProps> = ({
  x,
  y,
  options,
  onClose,
  title,
  glowIntensity = 1,
  hapticEnabled = true,
  returnFocusRef,
}) => {
  const [activeInnerIndex, setActiveInnerIndex] = useState<number | null>(null);
  const [activeOuterIndex, setActiveOuterIndex] = useState<number | null>(null);
  const [focusLevel, setFocusLevel] = useState<FocusLevel>('inner');
  const [focusIndex, setFocusIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const innerButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const outerButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const centerButtonRef = useRef<HTMLButtonElement | null>(null);
  const activeInnerRef = useRef<number | null>(null);
  const activeOuterRef = useRef<number | null>(null);
  const focusLevelRef = useRef<FocusLevel>('inner');
  const focusIndexRef = useRef(0);
  const pointerStatesRef = useRef(new Map<number, MenuPointerState>());
  const multiPointerRef = useRef(false);
  const lastPointerUpAtRef = useRef<number | null>(null);
  const lastPointerUpButtonRef = useRef<HTMLButtonElement | null>(null);
  const closedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const setInner = (index: number | null) => {
    activeInnerRef.current = index;
    setActiveInnerIndex(index);
    if (index === null) setOuter(null);
  };

  const setOuter = (index: number | null) => {
    activeOuterRef.current = index;
    setActiveOuterIndex(index);
  };

  const setFocus = (level: FocusLevel, index: number) => {
    focusLevelRef.current = level;
    focusIndexRef.current = index;
    setFocusLevel(level);
    setFocusIndex(index);
  };

  const closeOnce = (beforeClose?: () => void) => {
    if (closedRef.current) return;
    closedRef.current = true;
    beforeClose?.();
    onCloseRef.current();
  };

  useEffect(() => {
    const activeElement = document.activeElement;
    const returnTarget = returnFocusRef?.current ?? null;
    previousFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;

    return () => {
      if (isTextEntry(document.activeElement)) return;
      const previous = previousFocusRef.current;
      const target = isTextEntry(previous)
        ? previous
        : returnTarget ?? previous;
      if (target && target.isConnected) target.focus();
    };
  }, [returnFocusRef]);

  const focusCurrentButton = () => {
    const target = focusLevelRef.current === 'outer'
      ? outerButtonRefs.current[focusIndexRef.current]
      : innerButtonRefs.current[focusIndexRef.current];
    (target ?? menuRef.current)?.focus();
  };

  useEffect(() => {
    if (isTextEntry(document.activeElement)) return;
    focusCurrentButton();
  }, [focusLevel, focusIndex, activeInnerIndex]);

  useEffect(() => {
    const handleGlobalEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || closedRef.current) return;
      event.preventDefault();
      closedRef.current = true;
      onCloseRef.current();
    };
    document.addEventListener('keydown', handleGlobalEscape);
    return () => document.removeEventListener('keydown', handleGlobalEscape);
  }, []);

  const viewportWidth = typeof window !== 'undefined' && window.innerWidth > 0 ? window.innerWidth : 1024;
  const viewportHeight = typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : 768;
  const layout = useMemo(() => clampRadialAnchor({
    x,
    y,
    viewportWidth,
    viewportHeight,
    dimensions: RADIAL_LAYOUT_DIMENSIONS,
  }), [x, y, viewportWidth, viewportHeight]);
  const anchorX = layout.x;
  const anchorY = layout.y;
  const titleMaxWidth = Math.max(0, (2 * Math.min(anchorX, viewportWidth - anchorX)) - 16);

  const vib = (pattern: number | number[]) => { if (hapticEnabled && navigator.vibrate) navigator.vibrate(pattern); };

  // --- Smart Orientation Logic ---
  const startAngle = useMemo(() => {
    // Fixed Orientation: 10 o'clock position
    const fanCenterDeg = -60;
    const totalFanAngle = options.length * SECTOR_ANGLE;
    return fanCenterDeg - (totalFanAngle / 2);
  }, [options.length]);


  // --- Helper: Logic to determine indices from coordinates ---
  const calculateIndices = (clientX: number, clientY: number) => {
    const dx = clientX - anchorX;
    const dy = clientY - anchorY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let nextInner: number | null = null;
    let nextOuter: number | null = null;

    // Strict distance gating
    if (dist < INNER_R_IN || dist > OUTER_R_OUT + 20) {
      return { nextInner: null, nextOuter: null, dist };
    }

    // Angle (0 = Up/North, 90 = Right, 180 = Down)
    const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;

    // Check Inner Ring Bounds
    if (dist >= INNER_R_IN && dist <= INNER_R_OUT + 5) {
      for (let i = 0; i < options.length; i++) {
        const s = startAngle + (i * SECTOR_ANGLE);
        const e = s + SECTOR_ANGLE;

        let testAngle = angle;
        while (testAngle < s - 180) testAngle += 360;
        while (testAngle > s + 180) testAngle -= 360;

        if (testAngle >= s && testAngle < e) {
          nextInner = i;
          break;
        }
      }
    }

    // Check Outer Ring (only if a parent is selected or active)
    if (dist >= OUTER_R_IN - 5 && dist <= OUTER_R_OUT + 15) {
      // Check against active parent index first for stability
      const parentIdx = nextInner !== null ? nextInner : activeInnerRef.current;
      if (parentIdx !== null) {
        const parent = options[parentIdx];
        if (parent?.subOptions && parent.subOptions.length > 0) {
          const subCount = parent.subOptions.length;
          const parentMid = startAngle + (parentIdx * SECTOR_ANGLE) + (SECTOR_ANGLE / 2);
          const subStep = Math.min(45, 120 / subCount);
          const totalSubArc = subCount * subStep;
          const subStart = parentMid - (totalSubArc / 2);

          for (let j = 0; j < subCount; j++) {
            const s = subStart + (j * subStep);
            const e = s + subStep;

            let testAngle = angle;
            while (testAngle < s - 180) testAngle += 360;
            while (testAngle > s + 180) testAngle -= 360;

            if (testAngle >= s && testAngle < e) {
              nextOuter = j;
              nextInner = parentIdx;
              break;
            }
          }
        }
      }
    }

    return { nextInner, nextOuter, dist };
  };

  const getMenuButton = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return null;
    const button = target.closest('button[data-menu-level], button[data-menu-center]') as HTMLButtonElement | null;
    if (!button) return null;
    if (button.dataset.menuCenter === 'true') return { button, kind: 'center' as const };
    const level = button.dataset.menuLevel;
    const index = Number(button.dataset.menuIndex);
    if ((level !== 'inner' && level !== 'outer') || !Number.isInteger(index)) return null;
    return { button, kind: level, index } as const;
  };

  const moveFocus = (level: FocusLevel, currentIndex: number, direction: number) => {
    const length = level === 'inner'
      ? options.length
      : options[activeInnerRef.current ?? -1]?.subOptions?.length ?? 0;
    if (length === 0) return;
    const nextIndex = (currentIndex + direction + length) % length;
    setFocus(level, nextIndex);
  };

  const activateOption = (option: PieMenuOption, level: FocusLevel, index: number) => {
    if (closedRef.current) return;
    if (level === 'inner' && option.subOptions && option.subOptions.length > 0) {
      setInner(index);
      setOuter(null);
      setFocus('outer', 0);
      vib(5);
      return;
    }

    closeOnce(option.action);
  };

  const rememberPointerActivation = (target: EventTarget | null) => {
    const details = getMenuButton(target);
    lastPointerUpButtonRef.current = details && details.kind !== 'center'
      ? details.button
      : null;
    lastPointerUpAtRef.current = Date.now();
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (closedRef.current) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeOnce();
      return;
    }

    const details = getMenuButton(e.target);
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      e.stopPropagation();
      if (details?.kind === 'center') {
        closeOnce();
      } else if (details?.kind === 'inner') {
        const option = options[details.index];
        if (option) activateOption(option, 'inner', details.index);
      } else if (details?.kind === 'outer') {
        const parent = options[activeInnerRef.current ?? -1];
        const option = parent?.subOptions?.[details.index];
        if (option) activateOption(option, 'outer', details.index);
      } else if (focusLevelRef.current === 'inner') {
        const option = options[focusIndexRef.current];
        if (option) activateOption(option, 'inner', focusIndexRef.current);
      } else {
        const parent = options[activeInnerRef.current ?? -1];
        const option = parent?.subOptions?.[focusIndexRef.current];
        if (option) activateOption(option, 'outer', focusIndexRef.current);
      }
      return;
    }

    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();

    const level = details?.kind === 'outer' || (!details && focusLevelRef.current === 'outer')
      ? 'outer'
      : 'inner';
    const index = details && details.kind !== 'center' ? details.index : focusIndexRef.current;

    if (level === 'outer') {
      if (e.key === 'ArrowLeft') {
        setFocus('inner', activeInnerRef.current ?? 0);
      } else {
        moveFocus('outer', index, e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1);
      }
      return;
    }

    const option = options[index];
    if (e.key === 'ArrowRight' && option?.subOptions && option.subOptions.length > 0) {
      activateOption(option, 'inner', index);
      return;
    }
    moveFocus('inner', index, e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1);
  };

  const updatePointerSelection = (clientX: number, clientY: number) => {
    const { nextInner, nextOuter, dist } = calculateIndices(clientX, clientY);

    if (dist > INNER_R_OUT && dist < OUTER_R_IN) {
      setOuter(null);
      return;
    }

    if (dist < INNER_R_IN) {
      setOuter(null);
      return;
    }

    if (nextInner !== null && nextOuter === null && dist <= INNER_R_OUT + 5) {
      if (nextInner !== activeInnerRef.current) {
        setInner(nextInner);
        vib(10);
      }
      setOuter(null);
      return;
    }

    if (nextOuter !== null) {
      if (nextInner !== activeInnerRef.current) setInner(nextInner);
      if (nextOuter !== activeOuterRef.current) vib(15);
      setOuter(nextOuter);
    } else if (dist <= INNER_R_OUT + 5) {
      setOuter(null);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (closedRef.current) return;

    lastPointerUpAtRef.current = null;
    lastPointerUpButtonRef.current = null;
    const { nextInner, nextOuter, dist } = calculateIndices(e.clientX, e.clientY);
    const pointerStates = pointerStatesRef.current;
    if (pointerStates.size > 0) {
      multiPointerRef.current = true;
      pointerStates.forEach(pointer => { pointer.cancelled = true; });
    }
    pointerStates.set(e.pointerId, {
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      startedInside: dist <= OUTER_R_OUT + 10,
      moved: false,
      cancelled: multiPointerRef.current,
      verticalGesture: false,
    });

    const details = getMenuButton(e.target);
    if (details && details.kind !== 'center') {
      setFocus(details.kind, details.index);
      details.button.focus();
    }

    if (nextInner !== null) {
      setInner(nextInner);
      setOuter(nextOuter);
      vib(5);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (closedRef.current) return;

    let pointer = pointerStatesRef.current.get(e.pointerId);
    if (!pointer) {
      if (e.pointerType !== 'touch' && e.buttons === 0) return;
      // A long-press can mount the menu after the original pointerdown. Treat
      // the next move as the continuation of that same owned gesture.
      pointer = {
        pointerType: e.pointerType,
        startX: anchorX,
        startY: anchorY,
        startedInside: true,
        moved: false,
        cancelled: multiPointerRef.current,
        verticalGesture: false,
      };
      pointerStatesRef.current.set(e.pointerId, pointer);
    }

    const deltaX = e.clientX - pointer.startX;
    const deltaY = e.clientY - pointer.startY;
    pointer.moved = pointer.moved || Math.hypot(deltaX, deltaY) > 10;
    if (pointer.pointerType === 'touch'
      && Math.abs(deltaY) > 24
      && Math.abs(deltaY) > Math.abs(deltaX) * 1.25) {
      pointer.verticalGesture = true;
      pointer.cancelled = true;
      setOuter(null);
      return;
    }
    if (multiPointerRef.current || pointer.cancelled || !pointer.startedInside) return;
    updatePointerSelection(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (closedRef.current) return;

    const { nextInner, nextOuter, dist } = calculateIndices(e.clientX, e.clientY);
    const ownedPointer = pointerStatesRef.current.get(e.pointerId);
    if (!ownedPointer && pointerStatesRef.current.size > 0) return;
    const pointer = ownedPointer ?? {
      pointerType: e.pointerType,
      startX: anchorX,
      startY: anchorY,
      startedInside: true,
      moved: false,
      cancelled: false,
      verticalGesture: false,
    };
    const hadMultiPointer = multiPointerRef.current || pointerStatesRef.current.size > 1;
    pointerStatesRef.current.delete(e.pointerId);
    if (pointerStatesRef.current.size === 0) multiPointerRef.current = false;

    if (hadMultiPointer) return;
    if (!pointer.startedInside) {
      closeOnce();
      return;
    }
    if (pointer.cancelled) {
      if (dist > OUTER_R_OUT + 10) closeOnce();
      return;
    }
    if (dist > OUTER_R_OUT + 10 || dist < INNER_R_IN) {
      closeOnce();
      return;
    }
    if (dist > INNER_R_OUT && dist < OUTER_R_IN) return;

    let finalInner = nextInner;
    let finalOuter = nextOuter;
    if (finalInner === null && dist > INNER_R_IN && dist <= OUTER_R_OUT + 5) {
      finalInner = activeInnerRef.current;
      finalOuter = activeOuterRef.current;
    }

    if (finalInner === null) return;
    const parent = options[finalInner];
    if (finalOuter !== null && parent?.subOptions?.[finalOuter]) {
      rememberPointerActivation(e.target);
      activateOption(parent.subOptions[finalOuter], 'outer', finalOuter);
      return;
    }
    if (finalOuter === null && parent) {
      rememberPointerActivation(e.target);
      activateOption(parent, 'inner', finalInner);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    pointerStatesRef.current.delete(e.pointerId);
    if (pointerStatesRef.current.size === 0) multiPointerRef.current = false;
  };

  const handleMenuClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (closedRef.current) return;

    const details = getMenuButton(e.target);
    if (details?.kind === 'center') {
      closeOnce();
      return;
    }
    if (details?.kind === 'inner' || details?.kind === 'outer') {
      // Pointerup owns gesture activation. Ignore the browser's follow-up
      // click, while still allowing keyboard/programmatic clicks (detail 0).
      if (e.detail > 0
        && lastPointerUpButtonRef.current === details.button
        && lastPointerUpAtRef.current !== null
        && Date.now() - lastPointerUpAtRef.current < 500) {
        lastPointerUpButtonRef.current = null;
        return;
      }
      if (details.kind === 'inner') {
        const option = options[details.index];
        if (option) activateOption(option, 'inner', details.index);
      } else {
        const parent = options[activeInnerRef.current ?? -1];
        const option = parent?.subOptions?.[details.index];
        if (option) activateOption(option, 'outer', details.index);
      }
      return;
    }

    const { dist } = calculateIndices(e.clientX, e.clientY);
    if (dist > OUTER_R_OUT + 10 || dist < INNER_R_IN) closeOnce();
  };

  const innerSlices = useMemo(() => {
    return options.map((opt, i) => {
      const s = startAngle + (i * SECTOR_ANGLE);
      const e = s + SECTOR_ANGLE;
      const path = getSectorPath(INNER_R_OUT, INNER_R_IN, s, e, RADIAL_LAYOUT_DIMENSIONS.sectorGap);
      const mid = s + (SECTOR_ANGLE / 2);
      const r = (INNER_R_IN + INNER_R_OUT) / 2;
      const rad = toRad(mid - 90);
      return { ...opt, path, iconX: r * Math.cos(rad), iconY: r * Math.sin(rad), midAngle: mid };
    });
  }, [options, startAngle]);

  const activeSubSlices = useMemo(() => {
    if (activeInnerIndex === null) return [];
    const parent = activeInnerIndex === null ? undefined : options[activeInnerIndex];
    if (!parent?.subOptions || !innerSlices[activeInnerIndex ?? -1]) return [];

    const subCount = parent.subOptions.length;
    const parentMid = innerSlices[activeInnerIndex].midAngle;
    const subStep = Math.min(45, 120 / subCount);
    const totalSubArc = subCount * subStep;
    const subStart = parentMid - (totalSubArc / 2);

    return parent.subOptions.map((sub, j) => {
      const s = subStart + (j * subStep);
      const e = s + subStep;
      const path = getSectorPath(OUTER_R_OUT, OUTER_R_IN, s, e, RADIAL_LAYOUT_DIMENSIONS.sectorGap);
      const mid = s + (subStep / 2);
      const r = (OUTER_R_IN + OUTER_R_OUT) / 2;
      const rad = toRad(mid - 90);
      return { ...sub, path, iconX: r * Math.cos(rad), iconY: r * Math.sin(rad) };
    });
  }, [options, activeInnerIndex, innerSlices]);

  return (
    <div
      ref={menuRef}
      className="fixed inset-0 z-[200] overflow-hidden touch-none select-none pointer-events-auto"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={title ? `${title} radial menu` : 'Tactical radial menu'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleMenuKeyDown}
      onClick={handleMenuClick}
      onWheel={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="absolute inset-0 bg-black/20 animate-in fade-in duration-200" />
      <div
        className="absolute w-0 h-0 pointer-events-none"
        data-testid="radial-menu-anchor"
        style={{ left: anchorX, top: anchorY }}
      >
        <svg
          width="600"
          height="600"
          viewBox="-300 -300 600 600"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible drop-shadow-2xl pointer-events-none"
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation={2.5 * glowIntensity} result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {innerSlices.map((slice, i) => {
            const isActive = activeInnerIndex === i;
            return (
              <g key={i} className="transition-all duration-150">
                <path
                  d={slice.path}
                  className={`
                      stroke-[1px] transition-all duration-150
                      ${isActive
                      ? slice.color === 'danger' ? 'fill-red-900/90 stroke-red-400' : 'fill-emerald-900/90 stroke-emerald-400'
                      : 'fill-slate-900/80 stroke-slate-600'
                    }
                    `}
                  style={{ filter: isActive ? 'url(#glow)' : 'none' }}
                />
              </g>
            );
          })}

          {activeSubSlices.map((slice, i) => {
            const isActive = activeOuterIndex === i;
            return (
              <g key={`sub-${i}`} className="animate-in zoom-in-90 fade-in duration-150 origin-center">
                <path
                  d={slice.path}
                  className={`
                      stroke-[1px] transition-all duration-100
                      ${isActive
                      ? slice.color === 'danger' ? 'fill-red-800/90 stroke-red-300' : 'fill-emerald-800/90 stroke-emerald-300'
                      : 'fill-slate-800/90 stroke-slate-500'
                    }
                    `}
                />
              </g>
            );
          })}
        </svg>

        {innerSlices.map((slice, i) => {
          const isActive = activeInnerIndex === i;
          return (
            <button
              key={i}
              type="button"
              ref={(element) => { innerButtonRefs.current[i] = element; }}
              data-menu-level="inner"
              data-menu-index={i}
              aria-label={slice.label}
              aria-expanded={slice.subOptions && slice.subOptions.length > 0 ? isActive : undefined}
              tabIndex={focusLevel === 'inner' && focusIndex === i ? 0 : -1}
              onFocus={() => setFocus('inner', i)}
              className={`absolute w-20 h-20 min-h-[48px] min-w-[48px] -ml-10 -mt-10 top-0 left-0 flex flex-col items-center justify-center rounded-full border-0 bg-transparent p-0 pointer-events-auto ${HMI_CLASSES.actionText} ${HMI_CLASSES.activeTarget} ${HMI_CLASSES.focusRing} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300`}
              style={{ transform: `translate(${slice.iconX}px, ${slice.iconY}px)` }}
            >
              <slice.icon aria-hidden="true" size={22} className={`mb-1 drop-shadow-md ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className={`${HMI_CLASSES.actionText} text-[12px] font-bold uppercase tracking-wider leading-none drop-shadow-md ${isActive ? 'text-white' : 'text-slate-400'}`}>
                {slice.label}
              </span>
              {slice.subOptions && slice.subOptions.length > 0 && (
                <ChevronRight aria-hidden="true" size={10} className={`mt-1 opacity-60 ${isActive ? 'text-emerald-300' : 'text-slate-600'}`} />
              )}
            </button>
          );
        })}

        {activeSubSlices.map((slice, i) => {
          const isActive = activeOuterIndex === i;
          return (
            <button
              key={`lsub-${i}`}
              type="button"
              ref={(element) => { outerButtonRefs.current[i] = element; }}
              data-menu-level="outer"
              data-menu-index={i}
              aria-label={slice.label}
              tabIndex={focusLevel === 'outer' && focusIndex === i ? 0 : -1}
              onFocus={() => setFocus('outer', i)}
              className={`absolute w-20 h-20 min-h-[48px] min-w-[48px] -ml-10 -mt-10 top-0 left-0 flex flex-col items-center justify-center rounded-full border-0 bg-transparent p-0 pointer-events-auto ${HMI_CLASSES.actionText} ${HMI_CLASSES.activeTarget} ${HMI_CLASSES.focusRing} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 animate-in zoom-in-90 fade-in duration-150`}
              style={{ transform: `translate(${slice.iconX}px, ${slice.iconY}px)` }}
            >
              <slice.icon aria-hidden="true" size={18} className={`mb-1 drop-shadow-md ${isActive ? 'text-white' : 'text-slate-300'}`} />
              <span className={`${HMI_CLASSES.actionText} text-[12px] font-bold uppercase tracking-wider leading-none drop-shadow-md ${isActive ? 'text-white' : 'text-slate-300'}`}>
                {slice.label}
              </span>
            </button>
          );
        })}

        <button
          ref={centerButtonRef}
          type="button"
          data-menu-center="true"
          aria-label="Cancel radial menu"
          tabIndex={-1}
          className={`absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-12 h-12 min-h-[48px] min-w-[48px] rounded-full border border-slate-600 ${HMI_CLASSES.surfacePanel} flex items-center justify-center shadow-lg z-10 p-0 pointer-events-auto ${HMI_CLASSES.actionText} ${HMI_CLASSES.activeTarget} ${HMI_CLASSES.focusRing} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300`}
        >
          <X aria-hidden="true" size={16} className="text-slate-500" />
        </button>

        {title && (
          <div
            className="absolute top-0 left-0 -translate-x-1/2 pointer-events-none bg-slate-950/80 border border-slate-700 px-2 py-1 rounded text-[10px] text-emerald-500 font-mono font-bold tracking-widest text-center shadow-lg backdrop-blur-md"
            style={{
              marginTop: `-${RADIAL_LAYOUT_DIMENSIONS.title.offset}px`,
              maxWidth: `${titleMaxWidth}px`,
              whiteSpace: 'normal',
              overflowWrap: 'anywhere',
            }}
          >
            {title}
          </div>
        )}
      </div>
    </div >
  );
};