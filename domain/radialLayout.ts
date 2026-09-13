export interface RadialRingRadii {
  inner: number;
  outer: number;
}

export interface RadialLayoutDimensions {
  innerRing: RadialRingRadii;
  outerRing: RadialRingRadii;
  sectorAngle: number;
  sectorGap: number;
  labelHitArea: number;
  title: {
    offset: number;
    height: number;
  };
  visualPadding: number;
}

/** Geometry shared by the visual rings, hit-area target, and safe anchor. */
export const RADIAL_LAYOUT_DIMENSIONS: RadialLayoutDimensions = {
  innerRing: { inner: 25, outer: 95 },
  outerRing: { inner: 100, outer: 175 },
  sectorAngle: 50,
  sectorGap: 2,
  labelHitArea: 48,
  title: { offset: 200, height: 24 },
  visualPadding: 12,
};

export interface RadialAnchorRequest {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
  dimensions?: RadialLayoutDimensions;
}

export interface RadialSafeMargin {
  horizontal: number;
  vertical: number;
}

export interface RadialSafeArea {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface RadialAnchor {
  x: number;
  y: number;
  requestedX: number;
  requestedY: number;
  safeMargin: RadialSafeMargin;
  requiredSafeMargin: RadialSafeMargin;
  safeArea: RadialSafeArea;
  clamped: boolean;
  fitsViewport: boolean;
}

const assertFinite = (value: number, name: string): void => {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`);
  }
};

const assertPositive = (value: number, name: string): void => {
  assertFinite(value, name);
  if (value <= 0) {
    throw new RangeError(`${name} must be positive`);
  }
};

const assertNonNegative = (value: number, name: string): void => {
  assertFinite(value, name);
  if (value < 0) {
    throw new RangeError(`${name} must be non-negative`);
  }
};

const validateDimensions = (dimensions: RadialLayoutDimensions): void => {
  assertPositive(dimensions.innerRing.inner, 'inner ring inner radius');
  assertPositive(dimensions.innerRing.outer, 'inner ring outer radius');
  assertPositive(dimensions.outerRing.inner, 'outer ring inner radius');
  assertPositive(dimensions.outerRing.outer, 'outer ring outer radius');
  if (dimensions.innerRing.inner > dimensions.innerRing.outer) {
    throw new RangeError('inner ring radii must be ordered');
  }
  if (dimensions.outerRing.inner > dimensions.outerRing.outer) {
    throw new RangeError('outer ring radii must be ordered');
  }
  assertPositive(dimensions.sectorAngle, 'sector angle');
  assertNonNegative(dimensions.sectorGap, 'sector gap');
  if (dimensions.sectorGap >= dimensions.sectorAngle) {
    throw new RangeError('sector gap must be smaller than the sector angle');
  }
  assertPositive(dimensions.labelHitArea, 'label hit area');
  assertNonNegative(dimensions.title.offset, 'title offset');
  assertPositive(dimensions.title.height, 'title height');
  assertNonNegative(dimensions.visualPadding, 'visual padding');
};

/**
 * Returns the requested margin needed to keep ring labels and the title
 * visible. The returned values are distances from each viewport edge.
 */
export const getRadialSafeMargin = (
  dimensions: RadialLayoutDimensions = RADIAL_LAYOUT_DIMENSIONS,
): RadialSafeMargin => {
  validateDimensions(dimensions);

  const ringExtent = dimensions.outerRing.outer
    + (dimensions.labelHitArea / 2)
    + dimensions.visualPadding;
  const titleExtent = dimensions.title.offset
    + (dimensions.title.height / 2)
    + dimensions.visualPadding;
  const margin = Math.max(ringExtent, titleExtent);

  return { horizontal: margin, vertical: margin };
};

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

/**
 * Clamps a requested client-coordinate anchor into a viewport-safe area.
 *
 * On a viewport smaller than twice the required margin, the safe area
 * collapses to its center. This keeps the anchor finite and in-bounds while
 * exposing `fitsViewport: false` because the requested geometry cannot fit
 * without scaling the menu.
 */
export const clampRadialAnchor = ({
  x,
  y,
  viewportWidth,
  viewportHeight,
  dimensions = RADIAL_LAYOUT_DIMENSIONS,
}: RadialAnchorRequest): RadialAnchor => {
  assertFinite(x, 'x');
  assertFinite(y, 'y');
  assertPositive(viewportWidth, 'viewport width');
  assertPositive(viewportHeight, 'viewport height');
  const requiredSafeMargin = getRadialSafeMargin(dimensions);

  const safeMargin = {
    horizontal: Math.min(requiredSafeMargin.horizontal, viewportWidth / 2),
    vertical: Math.min(requiredSafeMargin.vertical, viewportHeight / 2),
  };
  const safeArea: RadialSafeArea = {
    minX: safeMargin.horizontal,
    maxX: viewportWidth - safeMargin.horizontal,
    minY: safeMargin.vertical,
    maxY: viewportHeight - safeMargin.vertical,
  };
  const anchorX = clamp(x, safeArea.minX, safeArea.maxX);
  const anchorY = clamp(y, safeArea.minY, safeArea.maxY);

  return {
    x: anchorX,
    y: anchorY,
    requestedX: x,
    requestedY: y,
    safeMargin,
    requiredSafeMargin,
    safeArea,
    clamped: anchorX !== x || anchorY !== y,
    fitsViewport: viewportWidth >= requiredSafeMargin.horizontal * 2
      && viewportHeight >= requiredSafeMargin.vertical * 2,
  };
};
