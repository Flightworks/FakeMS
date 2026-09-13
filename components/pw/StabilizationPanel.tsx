import React from 'react';
import { Crosshair, RotateCcw, X } from 'lucide-react';
import { MapMode, PrototypeSettings, StabMode } from '../../types';
import { HMI_CLASSES } from '../hmiTokens';

const hmiButtonClass = `${HMI_CLASSES.activeTarget} ${HMI_CLASSES.actionText} ${HMI_CLASSES.focusRing}`;

type SetStabMode = (mode: StabMode | ((previous: StabMode) => StabMode)) => void;
type SetMapMode = (mode: MapMode | ((previous: MapMode) => MapMode)) => void;
type StabilizationBooleanKey =
  | 'stabAutoGndOnPan'
  | 'stabFreezeHeadingDrop'
  | 'stabRecenterOnOrientSwitch'
  | 'stabSmoothUnfreeze'
  | 'stabMaintainScreenPosOnOrient';

export interface StabilizationPanelProps {
  stabMode: StabMode;
  setStabMode: SetStabMode;
  mapMode: MapMode;
  setMapMode: SetMapMode;
  groundAnchor: { lat: number; lon: number } | null;
  onResetStab: () => void;
  gestureSettings: PrototypeSettings;
  setGestureSettings: React.Dispatch<React.SetStateAction<PrototypeSettings>>;
  onClose: () => void;
  panelRef?: React.Ref<HTMLDivElement>;
}

const delayValues = [0, 5000, 10000, 15000] as const;

const delayLabel = (milliseconds: number): string => (
  milliseconds === 0 ? 'OFF' : `${milliseconds / 1000}s`
);

const stabilizationOptions: Array<{
  key: StabilizationBooleanKey;
  label: string;
  description: string;
}> = [
  {
    key: 'stabAutoGndOnPan',
    label: 'PAN · AUTO SWITCH TO GND',
    description: 'A pan that leaves ownship can enter GND and keep the captured ground anchor.',
  },
  {
    key: 'stabFreezeHeadingDrop',
    label: 'GND · FREEZE HEADING ON CAP',
    description: 'When GND changes to CAP UP, keep the heading captured at that orientation change.',
  },
  {
    key: 'stabRecenterOnOrientSwitch',
    label: 'ORIENTATION · RECENTER ON CHANGE',
    description: 'Changing NORTH UP or HEADING UP returns to ownship follow instead of preserving GND.',
  },
  {
    key: 'stabSmoothUnfreeze',
    label: 'RETURN · SMOOTH HEADING UNFREEZE',
    description: 'Animate the frozen heading back to the live ownship heading during return.',
  },
  {
    key: 'stabMaintainScreenPosOnOrient',
    label: 'HELICO · KEEP OWNSHIP SCREEN POSITION',
    description: 'In HELICO, compensate the pan when orientation changes so ownship stays on screen.',
  },
];

const anchorMeaning = (mode: StabMode): string => mode === StabMode.GND
  ? 'Fixed-ground anchor: ownship movement does not move the map reference.'
  : 'Ownship follow: the map reference follows the moving ownship.';

const anchorStatus = (mode: StabMode): string => mode === StabMode.GND
  ? 'GND · FIXED-GROUND ANCHOR'
  : 'HELICO · OWNSHIP FOLLOW';

export const StabilizationPanel: React.FC<StabilizationPanelProps> = ({
  stabMode,
  setStabMode,
  mapMode,
  setMapMode,
  groundAnchor,
  onResetStab,
  gestureSettings,
  setGestureSettings,
  onClose,
  panelRef,
}) => {
  const currentOrientation = mapMode === MapMode.NORTH_UP ? 'NORTH UP' : 'HEADING UP';
  const currentReturn = gestureSettings.stabSnapRecenter ? 'INSTANT' : 'ANIMATED';
  const autoRecenterDescription = gestureSettings.stabAutoRecenterDelay > 0
    ? `In GND, the map recenters on ownship only after ${delayLabel(gestureSettings.stabAutoRecenterDelay)} of pan inactivity; it never completes before that configured delay.`
    : 'Automatic recenter is OFF. In GND, the fixed-ground anchor remains until explicit RECENTER.';
  const anchorCoordinates = groundAnchor
    ? `${groundAnchor.lat.toFixed(5)}, ${groundAnchor.lon.toFixed(5)}`
    : 'NOT SET · SELECT GND';

  const setBooleanOption = (key: StabilizationBooleanKey) => {
    setGestureSettings(previous => ({ ...previous, [key]: !previous[key] }));
  };

  const setReturnMode = (instant: boolean) => {
    setGestureSettings(previous => ({ ...previous, stabSnapRecenter: instant }));
  };

  const cycleDelay = () => {
    const currentIndex = delayValues.indexOf(gestureSettings.stabAutoRecenterDelay as typeof delayValues[number]);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % delayValues.length : 0;
    setGestureSettings(previous => ({
      ...previous,
      stabAutoRecenterDelay: delayValues[nextIndex],
    }));
  };

  return (
    <div
      ref={panelRef}
      role="region"
      aria-label="Stabilisation controls"
      data-testid="stabilisation-panel"
      data-stab-mode={stabMode}
      data-map-mode={mapMode}
      data-ground-anchor={groundAnchor ? `${groundAnchor.lat},${groundAnchor.lon}` : 'none'}
      className={`w-[min(26rem,calc(100vw-2rem))] max-h-[calc(100vh-7rem)] overflow-y-auto p-4 ${HMI_CLASSES.surfacePanel} border border-slate-600 rounded-lg shadow-xl flex flex-col gap-4 pointer-events-auto`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-700 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-white font-bold text-sm uppercase">
            <Crosshair size={16} className="shrink-0 text-indigo-400" />
            <span>STABLN</span>
          </div>
          <h2 className="mt-1 text-base font-bold uppercase text-white">
            STABILISATION · {stabMode === StabMode.GND ? 'GND' : 'HELICO'}
          </h2>
          <span className="sr-only" aria-hidden="true">STAB CFG</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className={`${hmiButtonClass} shrink-0 rounded text-slate-300 hover:text-white transition-colors`}
        >
          <X size={18} />
        </button>
      </div>

      <section
        aria-label="Current stabilisation state"
        className="rounded border border-emerald-500/60 bg-emerald-950/30 p-3"
        aria-live="polite"
        data-testid="stabilisation-state"
      >
        <div className="hmi-primary-value font-bold text-emerald-200">{anchorStatus(stabMode)}</div>
        <div className="mt-1 hmi-action-text text-slate-200">{anchorMeaning(stabMode)}</div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 hmi-qualification font-mono uppercase">
          <span>ORIENTATION · {currentOrientation}</span>
          <span>RETURN · {currentReturn}</span>
        </div>
      </section>

      <section aria-labelledby="stabilisation-anchor-heading" className="flex flex-col gap-2">
        <h3 id="stabilisation-anchor-heading" className="hmi-action-text font-bold uppercase text-slate-100">
          Anchor · current {stabMode === StabMode.GND ? 'GND' : 'HELICO'}
        </h3>
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            aria-label="HELICO · OWNSHIP FOLLOW"
            aria-pressed={stabMode === StabMode.HELICO}
            data-testid="stabilisation-helico"
            onClick={() => setStabMode(StabMode.HELICO)}
            className={`${hmiButtonClass} min-h-[48px] rounded border px-3 py-2 text-left font-bold transition-colors ${stabMode === StabMode.HELICO ? 'border-emerald-400 bg-emerald-900/60 text-white' : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
          >
            HELICO · OWNSHIP FOLLOW
          </button>
          <button
            type="button"
            aria-label="GND · FIXED-GROUND ANCHOR"
            aria-pressed={stabMode === StabMode.GND}
            data-testid="stabilisation-gnd"
            onClick={() => setStabMode(StabMode.GND)}
            className={`${hmiButtonClass} min-h-[48px] rounded border px-3 py-2 text-left font-bold transition-colors ${stabMode === StabMode.GND ? 'border-emerald-400 bg-emerald-900/60 text-white' : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
          >
            GND · FIXED-GROUND ANCHOR
          </button>
        </div>
        <p className="hmi-action-text text-slate-300">
          GND anchor: {anchorCoordinates}. The anchor is captured when GND is selected and stays fixed while ownship moves or the map is panned.
        </p>
      </section>

      <section aria-labelledby="stabilisation-orientation-heading" className="flex flex-col gap-2">
        <h3 id="stabilisation-orientation-heading" className="hmi-action-text font-bold uppercase text-slate-100">
          Orientation · NORTH UP / HEADING UP
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-label="Select NORTH UP orientation"
            aria-pressed={mapMode === MapMode.NORTH_UP}
            onClick={() => setMapMode(MapMode.NORTH_UP)}
            className={`${hmiButtonClass} min-h-[48px] rounded border px-2 py-2 font-bold transition-colors ${mapMode === MapMode.NORTH_UP ? 'border-cyan-300 bg-cyan-900/60 text-white' : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
          >
            NORTH UP
          </button>
          <button
            type="button"
            aria-label="Select HEADING UP orientation"
            aria-pressed={mapMode === MapMode.HEADING_UP}
            onClick={() => setMapMode(MapMode.HEADING_UP)}
            className={`${hmiButtonClass} min-h-[48px] rounded border px-2 py-2 font-bold transition-colors ${mapMode === MapMode.HEADING_UP ? 'border-cyan-300 bg-cyan-900/60 text-white' : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
          >
            HEADING UP
          </button>
        </div>
        <p className="hmi-action-text text-slate-300">
          Orientation changes only the map rotation. The selected anchor remains {stabMode === StabMode.GND ? 'fixed on the ground' : 'the moving ownship'}.
        </p>
      </section>

      <section aria-labelledby="stabilisation-return-heading" className="flex flex-col gap-2">
        <h3 id="stabilisation-return-heading" className="hmi-action-text font-bold uppercase text-slate-100">
          Return / recenter · {currentReturn}
        </h3>
        <button
          type="button"
          aria-label="Recenter map on ownship"
          data-testid="stabilisation-recenter"
          onClick={onResetStab}
          className={`${hmiButtonClass} min-h-[48px] flex items-center justify-center gap-2 rounded border border-emerald-400/70 bg-emerald-900/50 px-3 py-2 font-bold text-emerald-100 hover:bg-emerald-800/70`}
        >
          <RotateCcw size={17} />
          RECENTER · OWNSHIP FOLLOW
        </button>
        <div className="grid grid-cols-2 gap-2" aria-label="Recenter return mode">
          <button
            type="button"
            aria-label="Animated recenter return"
            aria-pressed={!gestureSettings.stabSnapRecenter}
            onClick={() => setReturnMode(false)}
            className={`${hmiButtonClass} min-h-[48px] rounded border px-2 py-2 font-bold transition-colors ${!gestureSettings.stabSnapRecenter ? 'border-amber-300 bg-amber-900/60 text-white' : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
          >
            ANIMATED
          </button>
          <button
            type="button"
            aria-label="Instant recenter return"
            aria-pressed={gestureSettings.stabSnapRecenter}
            onClick={() => setReturnMode(true)}
            className={`${hmiButtonClass} min-h-[48px] rounded border px-2 py-2 font-bold transition-colors ${gestureSettings.stabSnapRecenter ? 'border-amber-300 bg-amber-900/60 text-white' : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
          >
            INSTANT
          </button>
        </div>
        <p className="hmi-action-text text-slate-300">
          Recenter clears GND and follows the moving ownship. Current return is {currentReturn.toLowerCase()}; it uses the configured map animation setting.
        </p>
      </section>

      <section aria-labelledby="stabilisation-delay-heading" className="flex flex-col gap-2 rounded border border-slate-700 bg-slate-900/60 p-3">
        <div className="flex items-center justify-between gap-3">
          <h3 id="stabilisation-delay-heading" className="hmi-action-text font-bold uppercase text-slate-100">
            Auto-recenter delay
          </h3>
          <button
            type="button"
            aria-label={`Cycle automatic recenter delay; current ${delayLabel(gestureSettings.stabAutoRecenterDelay)}`}
            onClick={cycleDelay}
            className={`${hmiButtonClass} min-h-[48px] shrink-0 rounded border border-emerald-400/70 bg-slate-800 px-3 py-2 font-mono font-bold text-emerald-200 hover:bg-slate-700`}
          >
            {delayLabel(gestureSettings.stabAutoRecenterDelay)}
          </button>
        </div>
        <p className="hmi-action-text text-slate-300">
          {autoRecenterDescription}{gestureSettings.stabAutoRecenterDelay > 0 ? ' Select OFF to disable automatic recenter.' : ''}
        </p>
      </section>

      <details open>
        <summary className={`${hmiButtonClass} flex min-h-[48px] cursor-pointer items-center rounded border border-slate-600 bg-slate-900 px-3 py-2 font-bold uppercase text-slate-100`}>
          Advanced stabilisation behavior
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          {stabilizationOptions.map(option => (
            <div key={option.key} className="rounded border border-slate-700 bg-slate-900/60 p-2">
              <div className="flex items-center justify-between gap-3">
                <span className="hmi-action-text min-w-0 font-bold uppercase text-slate-200">{option.label}</span>
                <button
                  type="button"
                  aria-label={`${option.label} ${gestureSettings[option.key] ? 'ON' : 'OFF'}`}
                  aria-pressed={gestureSettings[option.key]}
                  onClick={() => setBooleanOption(option.key)}
                  className={`${hmiButtonClass} min-h-[48px] min-w-[72px] shrink-0 rounded border px-3 py-2 font-bold ${gestureSettings[option.key] ? 'border-indigo-300 bg-indigo-700 text-white' : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {gestureSettings[option.key] ? 'ON' : 'OFF'}
                </button>
              </div>
              <p className="mt-1 hmi-action-text text-slate-300">{option.description}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
};
