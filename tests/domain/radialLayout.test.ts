import { describe, expect, it } from 'vitest';
import {
  clampRadialAnchor,
  getRadialSafeMargin,
  RADIAL_LAYOUT_DIMENSIONS,
} from '../../domain/radialLayout';

describe('radial layout anchor', () => {
  it('clamps corner and side requests inside the safe area without changing orientation', () => {
    const viewport = { viewportWidth: 1440, viewportHeight: 900 };
    const margin = getRadialSafeMargin(RADIAL_LAYOUT_DIMENSIONS);
    expect(margin.horizontal).toBeGreaterThanOrEqual(
      RADIAL_LAYOUT_DIMENSIONS.outerRing.outer + (RADIAL_LAYOUT_DIMENSIONS.labelHitArea / 2),
    );
    expect(margin.vertical).toBeGreaterThanOrEqual(
      RADIAL_LAYOUT_DIMENSIONS.title.offset + (RADIAL_LAYOUT_DIMENSIONS.title.height / 2),
    );

    const topLeft = clampRadialAnchor({ x: 0, y: 0, ...viewport });
    const topRight = clampRadialAnchor({ x: viewport.viewportWidth, y: 0, ...viewport });
    const bottomLeft = clampRadialAnchor({ x: 0, y: viewport.viewportHeight, ...viewport });
    const bottomRight = clampRadialAnchor({
      x: viewport.viewportWidth,
      y: viewport.viewportHeight,
      ...viewport,
    });
    const leftSide = clampRadialAnchor({ x: 0, y: viewport.viewportHeight / 2, ...viewport });
    const rightSide = clampRadialAnchor({
      x: viewport.viewportWidth,
      y: viewport.viewportHeight / 2,
      ...viewport,
    });

    expect(topLeft).toMatchObject({ x: margin.horizontal, y: margin.vertical });
    expect(topRight).toMatchObject({
      x: viewport.viewportWidth - margin.horizontal,
      y: margin.vertical,
    });
    expect(bottomLeft).toMatchObject({
      x: margin.horizontal,
      y: viewport.viewportHeight - margin.vertical,
    });
    expect(bottomRight).toMatchObject({
      x: viewport.viewportWidth - margin.horizontal,
      y: viewport.viewportHeight - margin.vertical,
    });
    expect(leftSide.x).toBe(margin.horizontal);
    expect(leftSide.y).toBe(viewport.viewportHeight / 2);
    expect(rightSide.x).toBe(viewport.viewportWidth - margin.horizontal);
    expect(rightSide.y).toBe(viewport.viewportHeight / 2);

    for (const anchor of [topLeft, topRight, bottomLeft, bottomRight, leftSide, rightSide]) {
      expect(anchor.x).toBeGreaterThanOrEqual(anchor.safeArea.minX);
      expect(anchor.x).toBeLessThanOrEqual(anchor.safeArea.maxX);
      expect(anchor.y).toBeGreaterThanOrEqual(anchor.safeArea.minY);
      expect(anchor.y).toBeLessThanOrEqual(anchor.safeArea.maxY);
      expect(anchor.x).toBeGreaterThanOrEqual(0);
      expect(anchor.x).toBeLessThanOrEqual(viewport.viewportWidth);
      expect(anchor.y).toBeGreaterThanOrEqual(0);
      expect(anchor.y).toBeLessThanOrEqual(viewport.viewportHeight);
    }
  });

  it('derives the safe margin from supplied ring and title dimensions', () => {
    const dimensions = {
      ...RADIAL_LAYOUT_DIMENSIONS,
      outerRing: { inner: 140, outer: 260 },
      labelHitArea: 64,
      title: { offset: 300, height: 40 },
      visualPadding: 10,
    };

    expect(getRadialSafeMargin(dimensions)).toEqual({ horizontal: 330, vertical: 330 });
    expect(() => getRadialSafeMargin({
      ...dimensions,
      innerRing: { inner: 100, outer: 95 },
    })).toThrow(/ordered/i);
  });

  it('keeps a finite center anchor when a viewport is smaller than the requested safe area', () => {
    const anchor = clampRadialAnchor({
      x: Number.MAX_VALUE,
      y: Number.MIN_VALUE,
      viewportWidth: 320,
      viewportHeight: 200,
    });

    expect(anchor.x).toBe(160);
    expect(anchor.y).toBe(100);
    expect(anchor.fitsViewport).toBe(false);
    expect(Number.isFinite(anchor.x)).toBe(true);
    expect(Number.isFinite(anchor.y)).toBe(true);
    expect(anchor.safeArea).toEqual({ minX: 160, maxX: 160, minY: 100, maxY: 100 });
  });

  it('rejects non-finite coordinates and invalid viewport dimensions', () => {
    expect(() => clampRadialAnchor({ x: Number.NaN, y: 10, viewportWidth: 800, viewportHeight: 600 })).toThrow(
      /finite/i,
    );
    expect(() => clampRadialAnchor({ x: 10, y: Number.POSITIVE_INFINITY, viewportWidth: 800, viewportHeight: 600 })).toThrow(
      /finite/i,
    );
    expect(() => clampRadialAnchor({ x: 10, y: 10, viewportWidth: 0, viewportHeight: 600 })).toThrow(
      /positive/i,
    );
    expect(() => clampRadialAnchor({ x: 10, y: 10, viewportWidth: 800, viewportHeight: -1 })).toThrow(
      /positive/i,
    );
  });
});
