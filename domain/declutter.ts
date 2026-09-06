export type DeclutterPreset = 'MINIMAL' | 'NORMAL' | 'FULL';
export type DeclutterCategory = 'TRACK_LABELS' | 'WAYPOINT_LABELS' | 'AIRPORT_LABELS' | 'VECTORS';

export interface DeclutterState {
  preset: DeclutterPreset;
  hiddenCategories: readonly DeclutterCategory[];
}

export const DECLUTTER_PRESETS: Readonly<Record<DeclutterPreset, readonly DeclutterCategory[]>> = {
  MINIMAL: ['TRACK_LABELS', 'WAYPOINT_LABELS', 'AIRPORT_LABELS', 'VECTORS'],
  NORMAL: ['WAYPOINT_LABELS', 'AIRPORT_LABELS'],
  FULL: [],
};

export const createDeclutterState = (preset: DeclutterPreset = 'FULL'): DeclutterState => ({
  preset,
  hiddenCategories: DECLUTTER_PRESETS[preset],
});

export const setDeclutterPreset = (preset: DeclutterPreset): DeclutterState => createDeclutterState(preset);

export const isDeclutterCategoryHidden = (
  state: DeclutterState,
  category: DeclutterCategory,
): boolean => state.hiddenCategories.includes(category);
