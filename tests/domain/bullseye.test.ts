import { describe, expect, it } from 'vitest';
import {
  calculateFromBullseye,
  createBullseye,
  createBullseyeProjectionPreview,
  type BullseyeEntity,
} from '../../domain/bullseye';

const bravo: BullseyeEntity = {
  id: 'wp-2',
  label: 'BRAVO',
  position: { lat: 48, lon: 2 },
};

const hostile: BullseyeEntity = {
  id: 'en-1',
  label: 'HOSTILE 1',
  position: { lat: 48, lon: 1.75 },
};

describe('simulated Bullseye domain', () => {
  it('creates one explicit scenario reference with copied coordinates and visible source state', () => {
    const bullseye = createBullseye(bravo);

    expect(bullseye).toMatchObject({
      type: 'SIMULATED_BULLSEYE',
      entityId: 'wp-2',
      label: 'BRAVO',
      position: { lat: 48, lon: 2 },
      source: 'SCENARIO_ENTITY',
      state: 'SET',
    });
    expect(bullseye.position).not.toBe(bravo.position);
  });

  it('projects a temporary point from Bullseye with the qualified spherical calculation', () => {
    const bullseye = createBullseye(bravo);
    const preview = createBullseyeProjectionPreview(bullseye, 270, 15);

    expect(preview).toMatchObject({
      type: 'BULLSEYE_PROJECTION_PREVIEW',
      referenceLabel: 'BRAVO',
      referencePosition: { lat: 48, lon: 2 },
      bearingDegrees: 270,
      rangeNauticalMiles: 15,
      unit: 'NM',
      method: 'SPHERICAL DIRECT',
    });
    expect(preview.targetPosition.lat).toBeCloseTo(48, 2);
    expect(preview.targetPosition.lon).toBeLessThan(2);
    expect(preview.line).toEqual([preview.referencePosition, preview.targetPosition]);
  });

  it('calculates a pure BRG/RNG measurement from Bullseye without mutating the entity', () => {
    const bullseye = createBullseye(bravo);
    const result = calculateFromBullseye(bullseye, hostile);

    expect(result).toMatchObject({
      from: { id: 'bullseye', label: 'BULLSEYE' },
      to: { id: 'en-1', label: 'HOSTILE 1' },
      source: 'BULLSEYE',
      qualification: 'CALCULATED',
    });
    expect(result.bearingTrueDegrees).toBeCloseTo(270, 0);
    expect(result.rangeNauticalMiles).toBeGreaterThan(0);
    expect(hostile.position).toEqual({ lat: 48, lon: 1.75 });
  });

  it('reports NO_BULLSEYE instead of inventing an implicit reference', () => {
    const result = calculateFromBullseye(null, hostile);

    expect(result).toMatchObject({
      source: 'BULLSEYE',
      qualification: 'UNAVAILABLE',
      reason: 'NO_BULLSEYE',
    });
    expect(result.bearingTrueDegrees).toBeNull();
    expect(result.rangeNauticalMiles).toBeNull();
  });
});
