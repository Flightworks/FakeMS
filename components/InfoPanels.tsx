import React from 'react';
import { Entity, EntityType, PrototypeSettings } from '../types';
import type { OwnshipNavigationState } from '../domain/navigation';
import { navigationPositionLabel, navigationQualificationLabel } from '../domain/navigation';
import { Target, Navigation, Check } from 'lucide-react';
import { distanceBetween, bearingBetween } from '../utils/geo';
import { deriveHeightAboveTerrain } from '../domain/measurements';
import { HMI_CLASSES } from './hmiTokens';

const DataField = ({ label, value, unit }: { label: string; value: string | number; unit?: string }) => (
  <div className="flex min-w-0 max-w-full flex-col">
    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{label}</span>
    <span className={`${HMI_CLASSES.primaryValue} inline-flex min-w-0 max-w-full flex-wrap items-baseline gap-x-1 font-mono font-bold leading-tight text-white`}>
      <span className="min-w-0 max-w-full break-words [overflow-wrap:anywhere]">{value}</span>
      {unit && <span className={`${HMI_CLASSES.unit} shrink-0 text-slate-400 font-normal`}>{unit}</span>}
    </span>
  </div>
);

const MeasurementMeta = ({ source, qualification }: { source: string; qualification: string }) => (
  <span className={`${HMI_CLASSES.qualification} block font-mono uppercase`} title={`Source: ${source}; qualification: ${qualification}`}>
    {source} · {qualification}
  </span>
);

const stopProp = (e: React.SyntheticEvent) => e.stopPropagation();

type EntityMetadata = NonNullable<Entity['metadata']>;

type SpeedPresentation = {
  label: 'GS' | 'TAS';
  value: number | 'UNAVAILABLE' | 'STALE';
  source?: string;
  qualification?: string;
  status?: string;
  reason?: string;
};

const readMetadataNumber = (metadata: EntityMetadata | undefined, key: string): number | undefined => {
  const value = metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const readMetadataText = (metadata: EntityMetadata | undefined, key: string): string | undefined => {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const humanizeReason = (reason: string | undefined): string | undefined => {
  if (!reason) return undefined;
  return reason.replace(/^SPEED_/, '').replaceAll('_', ' ');
};

const formatElapsed = (milliseconds: number | undefined): string | undefined => {
  if (typeof milliseconds !== 'number' || !Number.isFinite(milliseconds) || milliseconds < 0) return undefined;
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `T+${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const formatScenarioUtc = (milliseconds: number | undefined): string | undefined => {
  if (typeof milliseconds !== 'number' || !Number.isFinite(milliseconds)) return undefined;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime())
    ? undefined
    : `${date.toISOString().replace('T', ' ').slice(0, 19)}Z`;
};

const formatAge = (ageSeconds: number): string => (
  Number.isInteger(ageSeconds) ? `${ageSeconds} S` : `${ageSeconds.toFixed(1)} S`
);

const formatConfidence = (confidence: number): string => (
  `${(confidence * 100).toFixed(0)}%`
);

const readTas = (metadata: EntityMetadata | undefined): SpeedPresentation | undefined => {
  const value = readMetadataNumber(metadata, 'tasKnots') ?? readMetadataNumber(metadata, 'trueAirSpeedKnots');
  if (value === undefined || value < 0) return undefined;
  const source = readMetadataText(metadata, 'tasSource')
    ?? readMetadataText(metadata, 'trueAirSpeedSource')
    ?? 'PROVIDED_FIELD';
  return {
    label: 'TAS',
    value,
    source,
    qualification: readMetadataText(metadata, 'tasQualification') ?? 'PROVIDED',
  };
};

const readGroundSpeed = (
  ownship: Entity,
  navigationState: OwnshipNavigationState | undefined,
): SpeedPresentation | undefined => {
  if (navigationState) {
    const qualified = navigationState.groundSpeed;
    if (qualified) {
      if ((qualified.status === 'AVAILABLE' || qualified.status === 'ZERO') && qualified.speedKnots !== null) {
        return {
          label: 'GS',
          value: qualified.speedKnots,
          source: qualified.source,
          qualification: qualified.qualification,
          status: qualified.status,
          reason: humanizeReason(qualified.reason),
        };
      }

      const noCurrentFix = navigationState.validity !== 'VALID' && navigationState.validity !== 'SIMULATED';
      return {
        label: 'GS',
        value: qualified.status === 'STALE' ? 'STALE' : 'UNAVAILABLE',
        source: qualified.source,
        qualification: 'UNAVAILABLE',
        status: qualified.status,
        reason: noCurrentFix ? 'NO CURRENT FIX' : humanizeReason(qualified.reason),
      };
    }

    if (navigationState.source === 'SIM'
      && typeof ownship.speed === 'number'
      && Number.isFinite(ownship.speed)
      && ownship.speed > 0) {
      return {
        label: 'GS',
        value: ownship.speed,
        source: 'SIMULATION',
        qualification: 'SIMULATED',
        status: 'AVAILABLE',
      };
    }

    return {
      label: 'GS',
      value: 'UNAVAILABLE',
      source: navigationState.source === 'SIM' ? 'SIMULATION' : 'GPS',
      qualification: 'UNAVAILABLE',
      reason: navigationState.validity !== 'VALID' && navigationState.validity !== 'SIMULATED'
        ? 'NO CURRENT FIX'
        : 'SPEED ABSENT',
    };
  }

  const metadataSpeed = readMetadataNumber(ownship.metadata, 'groundSpeedKnots');
  if (metadataSpeed !== undefined) {
    return {
      label: 'GS',
      value: metadataSpeed,
      source: readMetadataText(ownship.metadata, 'source'),
      qualification: readMetadataText(ownship.metadata, 'qualification'),
      status: 'AVAILABLE',
    };
  }

  // Direct component consumers predating the navigation-state contract have no
  // source with which to qualify `speed`; retain their legacy TAS presentation
  // until the caller supplies the typed navigation state.
  if (typeof ownship.speed === 'number' && Number.isFinite(ownship.speed)) {
    return { label: 'TAS', value: ownship.speed };
  }
  return undefined;
};

const SpeedMeta = ({ speed }: { speed: SpeedPresentation }) => {
  if (!speed.source || !speed.qualification) return null;
  const parts = [speed.source, speed.qualification];
  if (speed.status && speed.status !== 'AVAILABLE') parts.push(speed.status);
  if (speed.reason) parts.push(speed.reason);
  return (
    <span className={`${HMI_CLASSES.qualification} block font-mono uppercase`}>
      {parts.join(' · ')}
    </span>
  );
};

const ScenarioClock = ({ scenarioTimeMs, simTimeMs }: { scenarioTimeMs?: number; simTimeMs?: number }) => {
  const elapsed = formatElapsed(simTimeMs);
  const absolute = formatScenarioUtc(scenarioTimeMs);
  if (!elapsed && !absolute) return null;

  return (
    <div
      className="border-t border-slate-800 bg-slate-950/95 px-2 py-1 font-mono text-[9px] uppercase text-slate-400"
      data-testid="scenario-clock"
      aria-label="Scenario clock"
    >
      {elapsed && <div><span className="text-slate-500">SCENARIO </span><span className="text-amber-300">{elapsed}</span></div>}
      {absolute && <div><span className="text-slate-500">SCENARIO UTC </span><span className="text-cyan-300">{absolute}</span></div>}
    </div>
  );
};

export const OwnshipPanel = React.memo(({
  ownship,
  origin,
  prototypeSettings,
  navigationState,
  scenarioTimeMs,
  simTimeMs,
}: {
  ownship: Entity,
  origin: { lat: number, lon: number },
  prototypeSettings: PrototypeSettings,
  navigationState?: OwnshipNavigationState,
  scenarioTimeMs?: number,
  simTimeMs?: number,
}) => {
  const { animationSpeed, ownshipPanelPos, ownshipPanelScale, ownshipPanelOpacity, ownshipShowCoords, ownshipShowDetails } = prototypeSettings;
  const hgt = deriveHeightAboveTerrain(ownship);
  const position = navigationState?.position ?? origin;
  const speed = readGroundSpeed(ownship, navigationState);
  const tas = navigationState ? readTas(ownship.metadata) : undefined;
  const altitude = readMetadataNumber(ownship.metadata, 'altitudeFt');
  const altitudeSource = readMetadataText(ownship.metadata, 'altitudeSource');
  const heading = navigationState
    ? navigationState.headingDegrees ?? (navigationState.source === 'SIM' ? ownship.heading : undefined)
    : ownship.heading;

  const latDisplay = `N${Math.floor(position.lat)}°${(position.lat % 1 * 60).toFixed(2)}'`;
  const lonDisplay = `E${Math.floor(Math.abs(position.lon))}°${(Math.abs(position.lon) % 1 * 60).toFixed(2)}'`;
  const positionMeta = navigationState
    ? `${navigationPositionLabel(navigationState)} · ${navigationQualificationLabel(navigationState)}`
    : undefined;

  /**
   * HUD Safe Zones:
   * TopSystemBar: ~80px (5rem) height at top.
   * LeftSidebar: ~80px (5rem) top offset, 64px (4rem) width.
   * TargetPanel (Bottom Right): Bottom-most anchor.
   */
  const getPositionStyles = () => {
    switch (ownshipPanelPos) {
      case 'TL':
        // Must clear TopSystemBar and LeftSidebar Trigger
        return {
          top: 'calc(5.5rem + env(safe-area-inset-top))',
          left: 'calc(5.5rem + env(safe-area-inset-left))'
        };
      case 'TR':
        // Must clear TopSystemBar
        return {
          top: 'calc(5.5rem + env(safe-area-inset-top))',
          right: 'calc(1rem + env(safe-area-inset-right))'
        };
      case 'BR':
        // Stacked above TargetPanel if that panel were active (approx height 140px / 9rem)
        return {
          bottom: 'calc(10rem + env(safe-area-inset-bottom))',
          right: 'calc(1rem + env(safe-area-inset-right))'
        };
      case 'BL':
      default:
        // Bottom Left is clear, can be flush as requested
        return {
          bottom: 'calc(1rem + env(safe-area-inset-bottom))',
          left: 'calc(1rem + env(safe-area-inset-left))'
        };
    }
  };

  return (
    <div
      className={`absolute z-20 ${HMI_CLASSES.surfacePanel} w-[min(24rem,calc(100vw-2rem))] min-w-0 max-w-[calc(100vw-2rem)] border-2 border-slate-600 rounded shadow-xl flex flex-col pointer-events-auto overflow-hidden transition-all ease-out`}
      style={{
        ...getPositionStyles(),
        opacity: ownshipPanelOpacity,
        transform: `scale(${ownshipPanelScale})`,
        transformOrigin: ownshipPanelPos.includes('L') ? (ownshipPanelPos.includes('T') ? 'top left' : 'bottom left') : (ownshipPanelPos.includes('T') ? 'top right' : 'bottom right'),
        transitionDuration: `${animationSpeed}ms`
      }}
      onPointerDown={stopProp}
      onMouseDown={stopProp}
      onTouchStart={stopProp}
    >
      <div className="bg-slate-800 px-3 py-1 flex items-center justify-between border-b border-slate-600">
        <div className="flex min-w-0 items-center space-x-2">
          <Check size={14} className="text-white" />
          <span className="min-w-0 text-white font-mono font-bold text-xs uppercase tracking-tight">
            {ownship.label}
            {ownshipShowCoords && <span className="text-slate-400 ml-2 font-normal hidden sm:inline">{latDisplay} {lonDisplay}</span>}
          </span>
        </div>
        <Navigation size={12} className={navigationState && navigationState.validity !== 'VALID' && navigationState.validity !== 'SIMULATED' ? 'text-amber-400' : 'text-emerald-500'} />
      </div>

      {positionMeta && (
        <div className={`${HMI_CLASSES.qualification} border-b border-slate-800 bg-slate-950/95 px-3 py-1 font-mono uppercase`} data-testid="ownship-position-status">
          {positionMeta}
        </div>
      )}

      {ownshipShowDetails && (
        <div className={`p-2 grid min-w-0 max-w-full grid-cols-4 gap-4 ${HMI_CLASSES.dataGrid} bg-slate-950/90 animate-in fade-in slide-in-from-top-2 duration-300`}>
          {heading !== undefined && Number.isFinite(heading) && (
            <DataField label="HDG" value={Math.round(heading).toString().padStart(3, '0')} unit="°" />
          )}
          {hgt.value !== null && (
            <div>
              <DataField label="HGT" value={Math.round(hgt.value)} unit={hgt.unit} />
              <MeasurementMeta source={hgt.source} qualification={hgt.qualification} />
            </div>
          )}
          {speed && (
            <div>
              <DataField label={speed.label} value={typeof speed.value === 'number' ? Math.round(speed.value) : speed.value} unit={typeof speed.value === 'number' ? 'kt' : undefined} />
              <SpeedMeta speed={speed} />
            </div>
          )}
          {tas && (
            <div>
              <DataField label={tas.label} value={typeof tas.value === 'number' ? Math.round(tas.value) : tas.value} unit={typeof tas.value === 'number' ? 'kt' : undefined} />
              <SpeedMeta speed={tas} />
            </div>
          )}
          {altitude !== undefined && altitudeSource && (
            <div>
              <DataField label="ALT" value={Math.round(altitude)} unit="ft" />
              <MeasurementMeta source={altitudeSource} qualification="PROVIDED" />
            </div>
          )}
        </div>
      )}

      {!ownshipShowDetails && (
        <div className="px-3 py-1 bg-slate-950/90 text-[10px] text-slate-500 font-mono italic">
          TELEMETRY_MINIMIZED
        </div>
      )}

      <ScenarioClock scenarioTimeMs={scenarioTimeMs} simTimeMs={simTimeMs} />
    </div>
  );
});

export const TargetPanel = React.memo(({
  ownship,
  entity,
  animationSpeed = 300,
  trackMetadata,
}: {
  ownship: Entity | null,
  entity: Entity | null,
  animationSpeed?: number,
  /** Raw track metadata; projected simulation metadata is used only for mode qualification. */
  trackMetadata?: Entity['metadata'] | null,
}) => {
  if (!entity || !ownship || entity.type === EntityType.AIRPORT) return null;

  // Real-time calculations
  const distanceMeters = distanceBetween(
    ownship.position.lat, ownship.position.lon,
    entity.position.lat, entity.position.lon
  );

  const distanceNm = (distanceMeters / 1852).toFixed(1);
  const bearingStr = Math.round(bearingBetween(
    ownship.position.lat,
    ownship.position.lon,
    entity.position.lat,
    entity.position.lon
  )).toString().padStart(3, '0');

  const latDisplay = `N${Math.floor(Math.abs(entity.position.lat))}°${(Math.abs(entity.position.lat) % 1 * 60).toFixed(3)}'`;
  const lonDisplay = `E${Math.floor(Math.abs(entity.position.lon))}°${(Math.abs(entity.position.lon) % 1 * 60).toFixed(3)}'`;
  const metadata = trackMetadata === undefined ? entity.metadata : trackMetadata ?? {};
  const isWaypoint = entity.type === EntityType.WAYPOINT;
  const projectedQualification = readMetadataText(entity.metadata, 'qualification');
  const source = !isWaypoint
    ? readMetadataText(metadata, 'source')
      ?? (trackMetadata !== undefined && projectedQualification === 'SIMULATED' ? 'SCENARIO' : undefined)
    : undefined;
  const qualification = !isWaypoint
    ? projectedQualification && (source || trackMetadata !== undefined)
      ? projectedQualification
      : readMetadataText(metadata, 'qualification')
    : undefined;
  const freshness = !isWaypoint ? readMetadataText(metadata, 'freshness') : undefined;
  const ageSeconds = !isWaypoint ? readMetadataNumber(metadata, 'ageSeconds') : undefined;
  const quality = !isWaypoint ? readMetadataText(metadata, 'quality') : undefined;
  const uncertaintyMeters = !isWaypoint ? readMetadataNumber(metadata, 'uncertaintyMeters') : undefined;
  const classification = !isWaypoint ? readMetadataText(metadata, 'classification') : undefined;
  const confidence = !isWaypoint ? readMetadataNumber(metadata, 'confidence') : undefined;
  const altitude = !isWaypoint ? readMetadataNumber(metadata, 'altitudeFt') : undefined;
  const altitudeSource = !isWaypoint ? readMetadataText(metadata, 'altitudeSource') : undefined;
  const hasTrackDetails = Boolean(source || qualification || freshness || ageSeconds !== undefined || quality || uncertaintyMeters !== undefined || classification || confidence !== undefined || isWaypoint);

  return (
    <div
      className={`absolute z-20 ${HMI_CLASSES.surfacePanel} max-w-full border-2 border-slate-600 rounded shadow-xl flex flex-col w-auto min-w-[280px] animate-in slide-in-from-right fade-in pointer-events-auto`}
      style={{
        bottom: 'calc(1rem + env(safe-area-inset-bottom))',
        right: 'calc(1rem + env(safe-area-inset-right))',
        animationDuration: `${animationSpeed}ms`
      }}
      onPointerDown={stopProp}
      onMouseDown={stopProp}
      onTouchStart={stopProp}
    >
      <div className="bg-slate-800 px-3 py-1 flex items-center justify-between border-b border-slate-600">
        <span className="text-[10px] text-amber-500 font-bold tracking-widest uppercase">FROM H/C</span>
        <Target size={12} className="text-amber-500" />
      </div>

      <div className={`p-2 grid min-w-0 max-w-full grid-cols-3 gap-3 ${HMI_CLASSES.dataGrid} bg-slate-950/90`}>
        <DataField label="BRG" value={bearingStr} unit="°" />
        <DataField label="DIST" value={distanceNm} unit="NM" />
        {altitude !== undefined && altitudeSource && <DataField label="ALT" value={Math.round(altitude)} unit="ft" />}
      </div>
      <div className="px-2 pb-1 bg-slate-950/90">
        <div className="text-right break-words [overflow-wrap:anywhere] text-[10px] font-mono text-slate-400">
          {latDisplay} {lonDisplay}
        </div>
      </div>

      {hasTrackDetails && (
        <div className="border-t border-slate-800 bg-slate-950/95 px-2 py-1 font-mono text-[9px] uppercase text-slate-400" data-testid="target-track-details">
          {source && <div>TRACK SOURCE: <span className="text-cyan-300">{source}</span></div>}
          {qualification && <div>QUALIFICATION: <span className="text-cyan-300">{qualification}</span></div>}
          {freshness && (
            <div className={freshness === 'STALE' ? 'text-amber-300' : undefined}>
              FRESHNESS: {freshness}{ageSeconds !== undefined && ` · AGE: ${formatAge(ageSeconds)}`}
            </div>
          )}
          {!freshness && ageSeconds !== undefined && <div>AGE: {formatAge(ageSeconds)}</div>}
          {quality && <div>QUALITY: {quality}</div>}
          {uncertaintyMeters !== undefined && <div>UNCERTAINTY: {uncertaintyMeters.toFixed(0)} M</div>}
          {classification && <div>CLASSIFICATION: {classification}</div>}
          {confidence !== undefined && <div>CONFIDENCE: {formatConfidence(confidence)}</div>}
          {isWaypoint && <div>OBSERVATION QUALITY: N/A · NON-APPLICABLE</div>}
        </div>
      )}
    </div>
  );
});
