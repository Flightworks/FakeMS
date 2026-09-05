import { describe, expect, it } from 'vitest';
import { createProjectionPreview, createSimulatedDesignation } from '../../domain/designations';

describe('projection designation preview', () => {
  it('builds a temporary point and line without mutating the reference', () => {
    const reference = { lat: 48, lon: 2 };
    const preview = createProjectionPreview('BRAVO', reference, 180, 5);

    expect(preview).toMatchObject({
      type: 'PROJECTION_PREVIEW',
      referenceLabel: 'BRAVO',
      referencePosition: reference,
      bearingDegrees: 180,
      rangeNauticalMiles: 5,
      unit: 'NM',
      method: 'SPHERICAL DIRECT',
    });
    expect(preview.targetPosition.lat).toBeCloseTo(47.916816004691, 10);
    expect(preview.targetPosition.lon).toBeCloseTo(2, 10);
    expect(preview.targetPosition.lat).toBeLessThan(reference.lat);
    expect(preview.line).toEqual([reference, preview.targetPosition]);
    expect(reference).toEqual({ lat: 48, lon: 2 });
  });

  it('returns independent coordinate objects for the temporary preview', () => {
    const preview = createProjectionPreview('BRAVO', { lat: 48, lon: 2 }, 180, 5);

    expect(preview.referencePosition).not.toBe(preview.line[0]);
    expect(preview.targetPosition).not.toBe(preview.line[1]);
    expect(preview.referencePosition).not.toBe(preview.targetPosition);
  });

  it('creates a persistent simulated designation without aliasing the preview target', () => {
    const preview = createProjectionPreview('BRAVO', { lat: 48, lon: 2 }, 180, 5);
    const designation = createSimulatedDesignation(preview, 1);

    expect(designation).toMatchObject({
      type: 'SIMULATED_DESIGNATION',
      id: 'designation-1',
      label: 'P1',
      source: 'PROJECTION_PREVIEW',
      position: preview.targetPosition,
    });
    expect(designation.position).not.toBe(preview.targetPosition);
  });

  it('rejects a non-positive or non-integer designation sequence', () => {
    const preview = createProjectionPreview('BRAVO', { lat: 48, lon: 2 }, 180, 5);

    expect(() => createSimulatedDesignation(preview, 0)).toThrow('positive integer');
    expect(() => createSimulatedDesignation(preview, 1.5)).toThrow('positive integer');
  });
});
