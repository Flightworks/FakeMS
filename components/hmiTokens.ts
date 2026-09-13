export type HmiResultState = 'AVAILABLE' | 'PARTIAL' | 'INCOMPLETE' | 'AMBIGUOUS' | 'UNAVAILABLE';

export const HMI_TOKENS = {
  typography: {
    primaryValue: '18px',
    action: '14px',
    qualification: '14px',
    unit: '14px',
    label: '12px',
  },
  target: {
    minWidth: '48px',
    minHeight: '48px',
    minSize: '48px',
  },
  focus: {
    ring: '3px solid #67e8f9',
    ringColor: '#67e8f9',
    ringOffset: '2px',
  },
  colors: {
    surface: {
      canvas: '#090d12',
      panel: '#0f1720',
      raised: '#17212b',
      inset: '#111a24',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#cbd5e1',
      muted: '#94a3b8',
      qualification: '#a5f3fc',
    },
    state: {
      available: { foreground: '#a7f3d0', background: '#064e3b', indicator: '#34d399' },
      partial: { foreground: '#fef3c7', background: '#713f12', indicator: '#fbbf24' },
      incomplete: { foreground: '#e2e8f0', background: '#1e293b', indicator: '#cbd5e1' },
      ambiguous: { foreground: '#fed7aa', background: '#7c2d12', indicator: '#fb923c' },
      unavailable: { foreground: '#ffe4e6', background: '#881337', indicator: '#fb7185' },
      disabled: { foreground: '#cbd5e1', background: '#1e293b', indicator: '#64748b' },
      unknown: { foreground: '#cbd5e1', background: '#1e293b', indicator: '#94a3b8' },
    },
  },
  spacing: {
    inline: '0.5rem',
    row: '0.75rem',
    panel: '1rem',
    section: '1.5rem',
  },
  motion: {
    transition: '150ms',
    animation: '200ms',
    reducedTransition: '0ms',
    reducedAnimation: '0ms',
    reducedFallback: 'none',
  },
} as const;

export const HMI_CSS_VARS = {
  surfaceCanvas: '--hmi-surface-canvas',
  surfacePanel: '--hmi-surface-panel',
  surfaceRaised: '--hmi-surface-raised',
  surfaceInset: '--hmi-surface-inset',
  textPrimary: '--hmi-text-primary',
  textSecondary: '--hmi-text-secondary',
  textMuted: '--hmi-text-muted',
  textQualification: '--hmi-text-qualification',
  focusRing: '--hmi-focus-ring',
  focusRingOffset: '--hmi-focus-ring-offset',
  primaryValueSize: '--hmi-font-primary-value',
  actionTextSize: '--hmi-font-action',
  qualificationSize: '--hmi-font-qualification',
  unitSize: '--hmi-font-unit',
  targetMinSize: '--hmi-target-min-size',
  spacingInline: '--hmi-spacing-inline',
  spacingRow: '--hmi-spacing-row',
  spacingPanel: '--hmi-spacing-panel',
  spacingSection: '--hmi-spacing-section',
  motionReducedTransition: '--hmi-motion-reduced-transition',
  motionReducedAnimation: '--hmi-motion-reduced-animation',
  stateAvailableForeground: '--hmi-state-available-foreground',
  stateAvailableBackground: '--hmi-state-available-background',
  stateAvailableIndicator: '--hmi-state-available-indicator',
  statePartialForeground: '--hmi-state-partial-foreground',
  statePartialBackground: '--hmi-state-partial-background',
  statePartialIndicator: '--hmi-state-partial-indicator',
  stateIncompleteForeground: '--hmi-state-incomplete-foreground',
  stateIncompleteBackground: '--hmi-state-incomplete-background',
  stateIncompleteIndicator: '--hmi-state-incomplete-indicator',
  stateAmbiguousForeground: '--hmi-state-ambiguous-foreground',
  stateAmbiguousBackground: '--hmi-state-ambiguous-background',
  stateAmbiguousIndicator: '--hmi-state-ambiguous-indicator',
  stateUnavailableForeground: '--hmi-state-unavailable-foreground',
  stateUnavailableBackground: '--hmi-state-unavailable-background',
  stateUnavailableIndicator: '--hmi-state-unavailable-indicator',
  stateDisabledForeground: '--hmi-state-disabled-foreground',
  stateDisabledBackground: '--hmi-state-disabled-background',
  stateDisabledIndicator: '--hmi-state-disabled-indicator',
  stateUnknownForeground: '--hmi-state-unknown-foreground',
  stateUnknownBackground: '--hmi-state-unknown-background',
  stateUnknownIndicator: '--hmi-state-unknown-indicator',
} as const;

export const HMI_CLASSES = {
  palette: 'hmi-palette',
  primaryValue: 'hmi-primary-value',
  actionText: 'hmi-action-text',
  qualification: 'hmi-qualification',
  unit: 'hmi-unit',
  activeTarget: 'hmi-active-target',
  focusRing: 'hmi-focus-ring',
  surfacePanel: 'hmi-surface-panel',
  surfaceRaised: 'hmi-surface-raised',
  valueRow: 'hmi-value-row',
  resultSummary: 'hmi-result-summary',
  resultDetails: 'hmi-result-details',
  wrap: 'hmi-wrap',
  dataGrid: 'hmi-data-grid',
  stateAvailable: 'hmi-state-available',
  statePartial: 'hmi-state-partial',
  stateIncomplete: 'hmi-state-incomplete',
  stateAmbiguous: 'hmi-state-ambiguous',
  stateUnavailable: 'hmi-state-unavailable',
  stateDisabled: 'hmi-state-disabled',
  stateUnknown: 'hmi-state-unknown',
  motionOptional: 'hmi-motion-optional',
} as const;

export type HmiTokens = typeof HMI_TOKENS;
export type HmiCssVars = typeof HMI_CSS_VARS;
export type HmiClasses = typeof HMI_CLASSES;

// Lower-case aliases make the contract convenient for component imports while
// keeping the exported constants explicit for tests and other presentation code.
export const hmiTokens = HMI_TOKENS;
export const hmiClasses = HMI_CLASSES;
