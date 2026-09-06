import type { Position } from '../types';
import { distanceBetween } from '../utils/geo';
import { METERS_PER_NAUTICAL_MILE } from './tacticalUnits';

export type GroundSpeedSource = 'SIMULATION' | 'GPS' | 'USER_INPUT';
export type GroundSpeedQualification = 'SIMULATED' | 'MEASURED' | 'USER_ASSUMPTION';

export interface GroundSpeedInput {
  speedKnots: number;
  source: GroundSpeedSource;
  qualification: GroundSpeedQualification;
  updatedAt?: number;
  staleAfterMs?: number;
}

export type EtaEteUnavailableReason =
  | 'INVALID_POSITION'
  | 'SCENARIO_TIME_UNAVAILABLE'
  | 'SPEED_UNAVAILABLE'
  | 'SPEED_STALE';

export interface EtaEteResult {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  distanceNauticalMiles: number | null;
  eteSeconds: number | null;
  etaUtcMs: number | null;
  speedKnots: number | null;
  speedSource: GroundSpeedSource | 'UNAVAILABLE';
  speedQualification: GroundSpeedQualification | 'UNAVAILABLE';
  reason?: EtaEteUnavailableReason;
}

export interface FormattedEtaEte {
  distance: string;
  ete: string;
  etaUtc: string;
  etaLocal: string;
  speed: string;
}

const isValidPosition = (position: Position): boolean => (
  Number.isFinite(position.lat)
  && Number.isFinite(position.lon)
  && position.lat >= -90
  && position.lat <= 90
  && position.lon >= -180
  && position.lon <= 180
);

const unavailable = (
  reason: EtaEteUnavailableReason,
  distanceNauticalMiles: number | null,
  speed: GroundSpeedInput | undefined,
): EtaEteResult => ({
  status: 'UNAVAILABLE',
  distanceNauticalMiles,
  eteSeconds: null,
  etaUtcMs: null,
  speedKnots: null,
  speedSource: speed?.source ?? 'UNAVAILABLE',
  speedQualification: speed?.qualification ?? 'UNAVAILABLE',
  reason,
});

export const calculateEtaEte = (
  origin: Position,
  destination: Position,
  speed: GroundSpeedInput | undefined,
  scenarioTimeMs: number,
): EtaEteResult => {
  if (!isValidPosition(origin) || !isValidPosition(destination)) {
    return unavailable('INVALID_POSITION', null, speed);
  }

  const distanceNauticalMiles = distanceBetween(
    origin.lat,
    origin.lon,
    destination.lat,
    destination.lon,
  ) / METERS_PER_NAUTICAL_MILE;

  if (!Number.isFinite(scenarioTimeMs)) {
    return unavailable('SCENARIO_TIME_UNAVAILABLE', distanceNauticalMiles, speed);
  }

  if (!speed || !Number.isFinite(speed.speedKnots) || speed.speedKnots <= 0) {
    return unavailable('SPEED_UNAVAILABLE', distanceNauticalMiles, speed);
  }

  if (Number.isFinite(speed.updatedAt)
    && Number.isFinite(speed.staleAfterMs)
    && (scenarioTimeMs - (speed.updatedAt as number)) > (speed.staleAfterMs as number)) {
    return unavailable('SPEED_STALE', distanceNauticalMiles, speed);
  }

  const eteSeconds = distanceNauticalMiles / speed.speedKnots * 3600;
  return {
    status: 'AVAILABLE',
    distanceNauticalMiles,
    eteSeconds,
    etaUtcMs: scenarioTimeMs + eteSeconds * 1000,
    speedKnots: speed.speedKnots,
    speedSource: speed.source,
    speedQualification: speed.qualification,
  };
};

const formatDuration = (seconds: number | null): string => {
  if (seconds === null || !Number.isFinite(seconds)) return 'UNAVAILABLE';

  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  if (hours > 0) return `${hours} h ${minutes} min ${remainingSeconds} s`;
  return `${minutes} min ${remainingSeconds} s`;
};

const formatDateTime = (timestampMs: number | null, timeZone: string): string => {
  if (timestampMs === null || !Number.isFinite(timestampMs)) return 'UNAVAILABLE';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(timestampMs));
};

export const formatEtaEte = (
  result: EtaEteResult,
  localTimeZone = 'UTC',
): FormattedEtaEte => {
  const distance = result.distanceNauticalMiles === null
    ? 'N/A'
    : `${result.distanceNauticalMiles.toFixed(1)} NM`;
  const speed = result.speedKnots === null
    ? 'GS: UNAVAILABLE'
    : `GS: ${result.speedKnots.toFixed(1)} KT · ${result.speedQualification}`;

  if (result.status === 'UNAVAILABLE') {
    return {
      distance,
      ete: `ETE: UNAVAILABLE · ${result.reason ?? 'UNKNOWN'}`,
      etaUtc: 'ETA UTC: UNAVAILABLE',
      etaLocal: `ETA LOCAL (${localTimeZone}): UNAVAILABLE`,
      speed,
    };
  }

  return {
    distance,
    ete: `ETE: ${formatDuration(result.eteSeconds)}`,
    etaUtc: `ETA UTC: ${formatDateTime(result.etaUtcMs, 'UTC')} UTC`,
    etaLocal: `ETA LOCAL (${localTimeZone}): ${formatDateTime(result.etaUtcMs, localTimeZone)} ${localTimeZone}`,
    speed,
  };
};
