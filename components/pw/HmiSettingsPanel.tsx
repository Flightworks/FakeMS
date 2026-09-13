import React, { useMemo, useState } from 'react';
import { Layout, X } from 'lucide-react';
import { OwnshipPanelPos, PrototypeSettings } from '../../types';
import { isDeclutterCategoryHidden, type DeclutterState } from '../../domain/declutter';
import { isLayerEffectivelyVisible, setLayerVisibility, type TacticalLayerState } from '../../domain/layers';
import { HMI_CLASSES } from '../hmiTokens';

const hmiButtonClass = `${HMI_CLASSES.activeTarget} ${HMI_CLASSES.actionText} ${HMI_CLASSES.focusRing}`;

type HmiSection = 'all' | 'hud' | 'gestures' | 'visibility';
type BooleanSetting = 'ownshipShowDetails' | 'hapticEnabled';

export interface HmiSettingsPanelProps {
  gestureSettings: PrototypeSettings;
  setGestureSettings: React.Dispatch<React.SetStateAction<PrototypeSettings>>;
  layers: TacticalLayerState;
  setLayers: (state: TacticalLayerState) => void;
  declutter: DeclutterState;
  onClose: () => void;
  panelRef?: React.Ref<HTMLDivElement>;
}

const cycle = <T,>(values: readonly T[], current: T): T => {
  const index = values.indexOf(current);
  return values[(index + 1) % values.length] ?? values[0];
};

const formatScale = (value: number): string => (
  Number.isInteger(value) ? `${value.toFixed(1)}×` : `${value}×`
);

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

const positionLabel = (position: OwnshipPanelPos): string => {
  const labels: Record<OwnshipPanelPos, string> = {
    BL: 'Bottom-left',
    TL: 'Top-left',
    TR: 'Top-right',
    BR: 'Bottom-right',
  };
  return `${labels[position]} · ${position}`;
};

const sectionFor = (section: HmiSection, target: Exclude<HmiSection, 'all'>): boolean => (
  section === 'all' || section === target
);

const SectionButton = ({
  section,
  current,
  label,
  description,
  onClick,
}: {
  section: Exclude<HmiSection, 'all'>;
  current: HmiSection;
  label: string;
  description: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-label={section === 'hud' ? 'HUD' : section === 'gestures' ? 'GEST' : 'VIS'}
    aria-pressed={current === section}
    aria-describedby={`hmi-section-${section}-description`}
    onClick={onClick}
    className={`${hmiButtonClass} min-h-[48px] flex-1 rounded border px-3 py-2 text-left font-bold uppercase transition-colors ${current === section ? 'border-indigo-300 bg-indigo-700 text-white' : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
  >
    <span className="block">{label}</span>
    <span id={`hmi-section-${section}-description`} className="sr-only">{description}</span>
  </button>
);

const SettingRow = ({
  id,
  label,
  value,
  description,
  accessibleName,
  onClick,
  pressed,
}: {
  id: string;
  label: string;
  value: string;
  description: string;
  accessibleName: string;
  onClick: () => void;
  pressed?: boolean;
}) => (
  <div className="min-w-0 rounded border border-slate-700 bg-slate-900/70 p-2" data-testid={`hmi-setting-${id}`}>
    <button
      type="button"
      aria-label={accessibleName}
      aria-describedby={`hmi-setting-${id}-description`}
      aria-pressed={pressed}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`${hmiButtonClass} flex min-h-[48px] w-full min-w-0 items-center justify-between gap-3 rounded border border-slate-600 bg-slate-800 px-3 py-2 text-left font-bold transition-colors hover:bg-slate-700`}
    >
      <span className="hmi-action-text min-w-0 break-words text-slate-200">{label}</span>
      <span className="hmi-action-text shrink-0 whitespace-nowrap font-mono text-emerald-300">{value}</span>
    </button>
    <p id={`hmi-setting-${id}-description`} className="hmi-action-text mt-2 break-words text-slate-300">
      {description}
    </p>
  </div>
);

export const HmiSettingsPanel: React.FC<HmiSettingsPanelProps> = ({
  gestureSettings,
  setGestureSettings,
  layers,
  setLayers,
  declutter,
  onClose,
  panelRef,
}) => {
  const [section, setSection] = useState<HmiSection>('all');
  const vectorsHiddenByDeclutter = isDeclutterCategoryHidden(declutter, 'VECTORS');
  const vectorsEffectivelyVisible = isLayerEffectivelyVisible(layers, 'VECTORS', vectorsHiddenByDeclutter);
  const mapDimValue = `${Math.round((1 - gestureSettings.mapDim) * 100)}% dim · ${Math.round(gestureSettings.mapDim * 100)}% base`;

  const hmiSections = useMemo(() => [
    { id: 'hud' as const, label: 'HUD · ownship panel' },
    { id: 'gestures' as const, label: 'GEST · touch behavior' },
    { id: 'visibility' as const, label: 'VIS · readability' },
  ], []);

  const vibrate = (pattern: number | number[]) => {
    if (gestureSettings.hapticEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const updateSetting = <K extends keyof PrototypeSettings>(key: K, value: PrototypeSettings[K]) => {
    setGestureSettings(previous => ({ ...previous, [key]: value }));
  };

  const toggleBooleanSetting = (key: BooleanSetting) => {
    setGestureSettings(previous => ({ ...previous, [key]: !previous[key] }));
    vibrate(10);
  };

  const cycleTap = () => {
    updateSetting('tapThreshold', cycle([150, 250, 300, 400, 500], gestureSettings.tapThreshold));
    vibrate([10, 5, 10]);
  };

  const cycleIndicatorDelay = () => {
    updateSetting('indicatorDelay', cycle([250, 400, 600, 700, 800, 1000], gestureSettings.indicatorDelay));
    vibrate(10);
  };

  const cycleLongPress = () => {
    updateSetting('longPressDuration', cycle([800, 1000, 1200, 1500, 2000], gestureSettings.longPressDuration));
    vibrate(20);
  };

  const cycleInterfaceScale = () => {
    updateSetting('uiScale', cycle([0.8, 0.9, 1.0, 1.1, 1.25, 1.5], gestureSettings.uiScale));
    vibrate(5);
  };

  const cycleGlow = () => {
    updateSetting('glowIntensity', cycle([0, 0.3, 0.6, 1.0, 1.5], gestureSettings.glowIntensity));
    vibrate(5);
  };

  const cycleMapDim = () => {
    updateSetting('mapDim', cycle([0.2, 0.4, 0.6, 0.8, 1.0], gestureSettings.mapDim));
    vibrate(5);
  };

  const cycleAnimation = () => {
    updateSetting('animationSpeed', cycle([0, 150, 300, 600, 1000], gestureSettings.animationSpeed));
    vibrate(5);
  };

  const cycleHudPosition = () => {
    updateSetting('ownshipPanelPos', cycle<OwnshipPanelPos>(['BL', 'TL', 'TR', 'BR'], gestureSettings.ownshipPanelPos));
    vibrate(5);
  };

  const cycleHudScale = () => {
    updateSetting('ownshipPanelScale', cycle([0.75, 1.0, 1.25, 1.5], gestureSettings.ownshipPanelScale));
    vibrate(5);
  };

  const cycleHudOpacity = () => {
    updateSetting('ownshipPanelOpacity', cycle([0.4, 0.6, 0.8, 0.95], gestureSettings.ownshipPanelOpacity));
    vibrate(5);
  };

  const toggleVectors = () => {
    const result = setLayerVisibility(layers, 'VECTORS', !layers.VECTORS.visible);
    if (result.status === 'AVAILABLE') setLayers(result.state);
  };

  const vectorValue = vectorsEffectivelyVisible ? 'ON' : vectorsHiddenByDeclutter ? 'OFF · DECLUTTER' : 'OFF';
  const vectorAccessibleName = vectorsHiddenByDeclutter
    ? 'VECTORS OFF · DECLUTTER'
    : `VECTORS ${vectorValue} · Track vectors · ${vectorValue}`;

  return (
    <div
      ref={panelRef}
      role="region"
      aria-label="HMI settings"
      data-testid="hmi-settings-panel"
      className={`flex w-[min(32rem,calc(100vw-2rem))] max-w-full max-h-[calc(100vh-6rem)] flex-col overflow-hidden ${HMI_CLASSES.surfacePanel} rounded-lg border border-slate-600 shadow-xl pointer-events-auto`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-slate-700 bg-slate-900 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-white font-bold uppercase">
            <Layout aria-hidden="true" size={16} className="shrink-0 text-indigo-400" />
            <span>HMI CFG</span>
          </div>
          <h2 className="hmi-action-text mt-1 font-bold text-slate-100">HMI settings</h2>
          <p className="hmi-action-text mt-1 text-slate-300">Choose a setting, then read its current value and effect.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className={`${hmiButtonClass} min-h-[48px] min-w-[48px] shrink-0 rounded border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white`}
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        <nav aria-label="HMI setting groups" className="mb-3 flex flex-wrap gap-2">
          {hmiSections.map(item => (
            <SectionButton
              key={item.id}
              section={item.id}
              current={section}
              label={item.label}
              description={item.id === 'hud'
                ? 'Ownship panel position, size, opacity, vectors, and detail level.'
                : item.id === 'gestures'
                  ? 'Touch timing thresholds and optional haptic feedback.'
                  : 'Interface scale, radial glow, map background dim, and animation speed.'}
              onClick={() => setSection(item.id)}
            />
          ))}
        </nav>

        {sectionFor(section, 'hud') && (
          <section aria-labelledby="hmi-hud-heading" className="mb-4 flex min-w-0 flex-col gap-2">
            <h3 id="hmi-hud-heading" className="hmi-action-text font-bold uppercase text-slate-100">HUD · ownship panel</h3>
            <SettingRow
              id="hud-position"
              label="HUD position"
              value={positionLabel(gestureSettings.ownshipPanelPos)}
              accessibleName={`Position of ownship panel: ${positionLabel(gestureSettings.ownshipPanelPos)}`}
              description="Choose the corner where the ownship panel is anchored."
              onClick={cycleHudPosition}
            />
            <SettingRow
              id="hud-scale"
              label="HUD scale"
              value={formatScale(gestureSettings.ownshipPanelScale)}
              accessibleName={`Scale of ownship panel: ${formatScale(gestureSettings.ownshipPanelScale)}`}
              description="Changes the ownship panel size without changing map coordinates."
              onClick={cycleHudScale}
            />
            <SettingRow
              id="hud-opacity"
              label="HUD opacity"
              value={formatPercent(gestureSettings.ownshipPanelOpacity)}
              accessibleName={`Opacity of ownship panel: ${formatPercent(gestureSettings.ownshipPanelOpacity)}`}
              description="Sets the ownship panel opacity; the map and mission symbols are not changed."
              onClick={cycleHudOpacity}
            />
            <SettingRow
              id="vectors"
              label="Track vectors"
              value={vectorValue}
              accessibleName={vectorAccessibleName}
              description="Controls the authoritative VECTORS layer and its mission vector lines. Declutter can hide the layer without changing its requested state."
              onClick={toggleVectors}
              pressed={vectorsEffectivelyVisible}
            />
            <SettingRow
              id="hud-details"
              label="HUD details"
              value={gestureSettings.ownshipShowDetails ? 'FULL' : 'MINIMAL'}
              accessibleName={`Details in ownship panel: ${gestureSettings.ownshipShowDetails ? 'FULL' : 'MINIMAL'}`}
              description="Shows or hides the ownship speed, altitude, heading, and related detail fields."
              onClick={() => toggleBooleanSetting('ownshipShowDetails')}
              pressed={gestureSettings.ownshipShowDetails}
            />
          </section>
        )}

        {sectionFor(section, 'gestures') && (
          <section aria-labelledby="hmi-gestures-heading" className="mb-4 flex min-w-0 flex-col gap-2">
            <h3 id="hmi-gestures-heading" className="hmi-action-text font-bold uppercase text-slate-100">GEST · touch behavior</h3>
            <SettingRow
              id="tap-threshold"
              label="Tap activation threshold"
              value={`${gestureSettings.tapThreshold} ms`}
              accessibleName={`Tap threshold: ${gestureSettings.tapThreshold} ms`}
              description="Maximum touch duration treated as a tap rather than a hold."
              onClick={cycleTap}
            />
            <SettingRow
              id="indicator-delay"
              label="Pie indicator delay"
              value={`${gestureSettings.indicatorDelay} ms`}
              accessibleName={`Pie indicator delay: ${gestureSettings.indicatorDelay} ms`}
              description="Delay before the radial progress indicator is shown during a hold."
              onClick={cycleIndicatorDelay}
            />
            <SettingRow
              id="long-press-duration"
              label="Long-press duration"
              value={`${gestureSettings.longPressDuration} ms`}
              accessibleName={`Long-press duration: ${gestureSettings.longPressDuration} ms`}
              description="Hold duration that opens the radial menu."
              onClick={cycleLongPress}
            />
            <SettingRow
              id="haptic-feedback"
              label="Haptic feedback"
              value={gestureSettings.hapticEnabled ? 'ON' : 'OFF'}
              accessibleName={`Haptic feedback: ${gestureSettings.hapticEnabled ? 'ON' : 'OFF'}`}
              description="Optional vibration feedback for supported devices; it never represents mission success."
              onClick={() => toggleBooleanSetting('hapticEnabled')}
              pressed={gestureSettings.hapticEnabled}
            />
          </section>
        )}

        {sectionFor(section, 'visibility') && (
          <section aria-labelledby="hmi-visibility-heading" className="flex min-w-0 flex-col gap-2">
            <h3 id="hmi-visibility-heading" className="hmi-action-text font-bold uppercase text-slate-100">VIS · readability</h3>
            <SettingRow
              id="interface-scale"
              label="Interface scale"
              value={formatScale(gestureSettings.uiScale)}
              accessibleName={`Interface scale: ${formatScale(gestureSettings.uiScale)}`}
              description="Scales the PW, QAK, and existing target panel surface. The command palette and radial map geometry keep their own layout and hit-testing coordinates; no global transform is applied."
              onClick={cycleInterfaceScale}
            />
            <SettingRow
              id="radial-glow"
              label="Radial glow"
              value={formatPercent(gestureSettings.glowIntensity)}
              accessibleName={`Radial glow: ${formatPercent(gestureSettings.glowIntensity)}`}
              description="Sets the optional highlight glow used by the radial menu."
              onClick={cycleGlow}
            />
            <SettingRow
              id="map-background-dim"
              label="Map background dim"
              value={mapDimValue}
              accessibleName={`Map background dim: ${mapDimValue}`}
              description="Attenuates only the map background and base context. Mission symbols, vector lines, radial menus, PW, QAK, alerts, and result panels keep their opacity."
              onClick={cycleMapDim}
            />
            <SettingRow
              id="animation-speed"
              label="Animation speed"
              value={`${gestureSettings.animationSpeed} ms`}
              accessibleName={`Animation speed: ${gestureSettings.animationSpeed} ms`}
              description="Base duration for supported map and panel transitions; zero disables the configured transition."
              onClick={cycleAnimation}
            />
          </section>
        )}
      </div>
    </div>
  );
};
