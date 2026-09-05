import { describe, expect, it } from 'vitest';
import { createProjectionPreview } from '../../domain/designations';
import {
  createDesignationState,
  designationReducer,
  type DesignationAction,
} from '../../application/designationReducer';

const preview = createProjectionPreview('BRAVO', { lat: 48, lon: 2 }, 180, 5);

const reduce = (state: ReturnType<typeof createDesignationState>, action: DesignationAction) =>
  designationReducer(state, action);

describe('designation reducer', () => {
  it('confirms one simulated designation and ignores a duplicate confirmation', () => {
    const previewed = reduce(createDesignationState(), {
      type: 'PREVIEW_DESIGNATION',
      preview,
    });

    expect(previewed.phase).toBe('PREVIEWED');
    expect(previewed.activePreview).toBe(preview);

    const confirmed = reduce(previewed, { type: 'CONFIRM_DESIGNATION' });
    expect(confirmed.phase).toBe('CONFIRMED_SIM');
    expect(confirmed.activePreview).toBeNull();
    expect(confirmed.confirmedDesignations).toHaveLength(1);
    expect(confirmed.confirmedDesignations[0]).toMatchObject({
      type: 'SIMULATED_DESIGNATION',
      id: 'designation-1',
      label: 'P1',
      position: preview.targetPosition,
      source: 'PROJECTION_PREVIEW',
    });

    const duplicate = reduce(confirmed, { type: 'CONFIRM_DESIGNATION' });
    expect(duplicate).toBe(confirmed);
    expect(duplicate.confirmedDesignations).toHaveLength(1);
    expect(duplicate.events.filter(event => event.type === 'CONFIRMED_SIM')).toHaveLength(1);
  });

  it('cancels a preview cycle when a new preview replaces it', () => {
    const firstPreview = reduce(createDesignationState(), {
      type: 'PREVIEW_DESIGNATION',
      preview,
    });
    const secondPreview = reduce(firstPreview, {
      type: 'PREVIEW_DESIGNATION',
      preview: createProjectionPreview('G01', { lat: 48.1, lon: 2.1 }, 90, 3),
    });

    expect(secondPreview.phase).toBe('PREVIEWED');
    expect(secondPreview.activePreview?.referenceLabel).toBe('G01');
    expect(secondPreview.events).toContainEqual({ type: 'CANCELLED', cycleId: 1 });
    expect(secondPreview.events.filter(event => event.type === 'CANCELLED')).toHaveLength(1);

    const confirmed = reduce(secondPreview, { type: 'CONFIRM_DESIGNATION' });
    expect(confirmed.confirmedDesignations).toHaveLength(1);
    expect(confirmed.events.filter(event => event.type === 'CONFIRMED_SIM')).toHaveLength(1);
    expect(confirmed.events.filter(event => event.type === 'CANCELLED')).toHaveLength(1);
  });

  it('cancels a preview without creating a simulated designation', () => {
    const previewed = reduce(createDesignationState(), {
      type: 'PREVIEW_DESIGNATION',
      preview,
    });

    const cancelled = reduce(previewed, { type: 'CANCEL_DESIGNATION' });
    expect(cancelled.phase).toBe('CANCELLED');
    expect(cancelled.activePreview).toBeNull();
    expect(cancelled.confirmedDesignations).toEqual([]);
    expect(cancelled.events.filter(event => event.type === 'CANCELLED')).toHaveLength(1);

    const duplicate = reduce(cancelled, { type: 'CANCEL_DESIGNATION' });
    expect(duplicate).toBe(cancelled);
    expect(duplicate.events.filter(event => event.type === 'CANCELLED')).toHaveLength(1);
  });

  it('renames a designation immutably without changing its id or coordinates', () => {
    const confirmed = reduce(
      reduce(createDesignationState(), { type: 'PREVIEW_DESIGNATION', preview }),
      { type: 'CONFIRM_DESIGNATION' },
    );
    const original = confirmed.confirmedDesignations[0];

    const renamed = reduce(confirmed, {
      type: 'RENAME_DESIGNATION',
      designationId: original.id,
      label: 'ALPHA',
    });

    expect(renamed).not.toBe(confirmed);
    expect(confirmed.confirmedDesignations[0]).toEqual(original);
    expect(renamed.confirmedDesignations[0]).toMatchObject({
      id: original.id,
      label: 'ALPHA',
      position: original.position,
    });
    expect(renamed.confirmedDesignations[0].position).toBe(original.position);
  });

  it('rejects a rename that would duplicate another point name regardless of case', () => {
    const firstConfirmed = reduce(
      reduce(createDesignationState(), { type: 'PREVIEW_DESIGNATION', preview }),
      { type: 'CONFIRM_DESIGNATION' },
    );
    const secondConfirmed = reduce(
      reduce(firstConfirmed, {
        type: 'PREVIEW_DESIGNATION',
        preview: createProjectionPreview('G01', { lat: 48.1, lon: 2.1 }, 90, 3),
      }),
      { type: 'CONFIRM_DESIGNATION' },
    );

    const duplicate = reduce(secondConfirmed, {
      type: 'RENAME_DESIGNATION',
      designationId: 'designation-2',
      label: 'p1',
    });

    expect(duplicate).toBe(secondConfirmed);
    expect(duplicate.confirmedDesignations.map(designation => designation.label)).toEqual(['P1', 'P2']);
  });

  it('deletes only the requested designation and keeps the sequence monotonic', () => {
    const firstConfirmed = reduce(
      reduce(createDesignationState(), { type: 'PREVIEW_DESIGNATION', preview }),
      { type: 'CONFIRM_DESIGNATION' },
    );
    const secondConfirmed = reduce(
      reduce(firstConfirmed, {
        type: 'PREVIEW_DESIGNATION',
        preview: createProjectionPreview('G01', { lat: 48.1, lon: 2.1 }, 90, 3),
      }),
      { type: 'CONFIRM_DESIGNATION' },
    );

    const deleted = reduce(secondConfirmed, {
      type: 'DELETE_DESIGNATION',
      designationId: 'designation-1',
    });

    expect(deleted.confirmedDesignations).toHaveLength(1);
    expect(deleted.confirmedDesignations[0]).toMatchObject({ id: 'designation-2', label: 'P2' });
    expect(deleted.nextDesignationSequence).toBe(3);
    expect(secondConfirmed.confirmedDesignations).toHaveLength(2);
  });

  it('proposes, cancels, and confirms clear points without mutating unrelated state', () => {
    const confirmed = reduce(
      reduce(createDesignationState(), { type: 'PREVIEW_DESIGNATION', preview }),
      { type: 'CONFIRM_DESIGNATION' },
    );
    const originalPoints = confirmed.confirmedDesignations;

    const proposed = reduce(confirmed, { type: 'PROPOSE_CLEAR_DESIGNATIONS' });
    expect(proposed).not.toBe(confirmed);
    expect(proposed.clearProposal).toMatchObject({
      designationIds: ['designation-1'],
    });
    expect(proposed.confirmedDesignations).toBe(originalPoints);

    const cancelled = reduce(proposed, { type: 'CANCEL_CLEAR_DESIGNATIONS' });
    expect(cancelled.clearProposal).toBeNull();
    expect(cancelled.confirmedDesignations).toBe(originalPoints);

    const proposedAgain = reduce(cancelled, { type: 'PROPOSE_CLEAR_DESIGNATIONS' });
    const cleared = reduce(proposedAgain, { type: 'CONFIRM_CLEAR_DESIGNATIONS' });
    expect(cleared.clearProposal).toBeNull();
    expect(cleared.confirmedDesignations).toEqual([]);
    expect(cleared.nextDesignationSequence).toBe(2);
  });
});
