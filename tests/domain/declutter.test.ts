import { describe, expect, it } from 'vitest';
import {
  DECLUTTER_PRESETS,
  createDeclutterState,
  isDeclutterCategoryHidden,
  setDeclutterPreset,
} from '../../domain/declutter';

describe('declutter presets', () => {
  it('keeps one explicit tested table for minimal, normal, and full', () => {
    expect(DECLUTTER_PRESETS.MINIMAL).toEqual(['TRACK_LABELS', 'WAYPOINT_LABELS', 'AIRPORT_LABELS', 'VECTORS']);
    expect(DECLUTTER_PRESETS.NORMAL).toEqual(['WAYPOINT_LABELS', 'AIRPORT_LABELS']);
    expect(DECLUTTER_PRESETS.FULL).toEqual([]);
  });

  it('reports hidden categories without removing scenario objects', () => {
    const minimal = createDeclutterState('MINIMAL');
    expect(minimal.preset).toBe('MINIMAL');
    expect(isDeclutterCategoryHidden(minimal, 'TRACK_LABELS')).toBe(true);
    expect(isDeclutterCategoryHidden(minimal, 'VECTORS')).toBe(true);
    expect(isDeclutterCategoryHidden(setDeclutterPreset('FULL'), 'TRACK_LABELS')).toBe(false);
  });
});
