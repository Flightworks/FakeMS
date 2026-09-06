import type { Position } from '../types';
import { bearingBetween, distanceBetween } from '../utils/geo';
import type { GroundSpeedInput } from './etaEte';
import { METERS_PER_NAUTICAL_MILE } from './tacticalUnits';

export interface RouteSummaryWaypoint {
  id: string;
  label: string;
  position: Position;
}

export interface ActiveSimulatedRoute {
  id: string;
  label: string;
  origin: Position;
  waypoints: readonly RouteSummaryWaypoint[];
  /** Number of route waypoints still ahead of the simulated ownship. */
  remainingWaypointCount: number;
  /** Visibility is deliberately separate from route activity. */
  hidden?: boolean;
}

export interface RouteSummaryInput {
  currentPosition: Position;
  speed?: GroundSpeedInput;
  scenarioTimeMs?: number;
}

export type RouteSummaryStatus = 'NO_ACTIVE_ROUTE' | 'ACTIVE' | 'COMPLETED';
export type RouteTimingReason = 'SPEED_UNAVAILABLE' | 'SCENARIO_TIME_UNAVAILABLE';

export interface RouteSummary {
  status: RouteSummaryStatus;
  message: 'NO ACTIVE SIM ROUTE' | 'ROUTE COMPLETE' | null;
  routeId: string | null;
  routeLabel: string | null;
  hidden: boolean;
  activeBranch: number | null;
  totalBranches: number;
  nextPoint: RouteSummaryWaypoint | null;
  desiredHeadingDegrees: number | null;
  branchDistanceNauticalMiles: number | null;
  cumulativeDistanceNauticalMiles: number;
  remainingDistanceNauticalMiles: number;
  eteSeconds: number | null;
  etaUtcMs: number | null;
  speedKnots: number | null;
  speedSource: GroundSpeedInput['source'] | 'UNAVAILABLE';
  speedQualification: GroundSpeedInput['qualification'] | 'UNAVAILABLE';
  timingReason?: RouteTimingReason;
}

const distanceNm = (from: Position, to: Position): number => (
  distanceBetween(from.lat, from.lon, to.lat, to.lon) / METERS_PER_NAUTICAL_MILE
);

const pathDistanceNm = (origin: Position, points: readonly RouteSummaryWaypoint[]): number => {
  let total = 0;
  let previous = origin;
  for (const point of points) {
    total += distanceNm(previous, point.position);
    previous = point.position;
  }
  return total;
};

const clampRemainingCount = (route: ActiveSimulatedRoute): number => Math.min(
  route.waypoints.length,
  Math.max(0, Math.trunc(route.remainingWaypointCount)),
);

const unavailableTiming = (
  reason: RouteTimingReason,
  speed: GroundSpeedInput | undefined,
): Pick<RouteSummary, 'eteSeconds' | 'etaUtcMs' | 'speedKnots' | 'speedSource' | 'speedQualification' | 'timingReason'> => ({
  eteSeconds: null,
  etaUtcMs: null,
  speedKnots: Number.isFinite(speed?.speedKnots) && (speed?.speedKnots ?? 0) > 0
    ? speed?.speedKnots ?? null
    : null,
  speedSource: speed?.source ?? 'UNAVAILABLE',
  speedQualification: speed?.qualification ?? 'UNAVAILABLE',
  timingReason: reason,
});

const availableTiming = (
  remainingDistanceNauticalMiles: number,
  speed: GroundSpeedInput,
  scenarioTimeMs: number,
): Pick<RouteSummary, 'eteSeconds' | 'etaUtcMs' | 'speedKnots' | 'speedSource' | 'speedQualification'> => {
  const eteSeconds = remainingDistanceNauticalMiles / speed.speedKnots * 3600;
  return {
    eteSeconds,
    etaUtcMs: scenarioTimeMs + eteSeconds * 1000,
    speedKnots: speed.speedKnots,
    speedSource: speed.source,
    speedQualification: speed.qualification,
  };
};

const noRouteSummary = (): RouteSummary => ({
  status: 'NO_ACTIVE_ROUTE',
  message: 'NO ACTIVE SIM ROUTE',
  routeId: null,
  routeLabel: null,
  hidden: false,
  activeBranch: null,
  totalBranches: 0,
  nextPoint: null,
  desiredHeadingDegrees: null,
  branchDistanceNauticalMiles: null,
  cumulativeDistanceNauticalMiles: 0,
  remainingDistanceNauticalMiles: 0,
  eteSeconds: null,
  etaUtcMs: null,
  speedKnots: null,
  speedSource: 'UNAVAILABLE',
  speedQualification: 'UNAVAILABLE',
});

export const summarizeRoute = (
  route: ActiveSimulatedRoute | undefined,
  input: RouteSummaryInput,
): RouteSummary => {
  if (!route || route.waypoints.length === 0) return noRouteSummary();

  const totalBranches = route.waypoints.length;
  const remainingWaypointCount = clampRemainingCount(route);
  const completedWaypointCount = totalBranches - remainingWaypointCount;
  const completedPoints = route.waypoints.slice(0, completedWaypointCount);
  const cumulativeBeforeActive = pathDistanceNm(route.origin, completedPoints);
  const routeTotalDistance = pathDistanceNm(route.origin, route.waypoints);

  if (remainingWaypointCount === 0) {
    return {
      status: 'COMPLETED',
      message: 'ROUTE COMPLETE',
      routeId: route.id,
      routeLabel: route.label,
      hidden: route.hidden === true,
      activeBranch: null,
      totalBranches,
      nextPoint: null,
      desiredHeadingDegrees: null,
      branchDistanceNauticalMiles: null,
      cumulativeDistanceNauticalMiles: routeTotalDistance,
      remainingDistanceNauticalMiles: 0,
      eteSeconds: Number.isFinite(input.scenarioTimeMs) ? 0 : null,
      etaUtcMs: Number.isFinite(input.scenarioTimeMs) ? input.scenarioTimeMs ?? null : null,
      speedKnots: Number.isFinite(input.speed?.speedKnots) ? input.speed?.speedKnots ?? null : null,
      speedSource: input.speed?.source ?? 'UNAVAILABLE',
      speedQualification: input.speed?.qualification ?? 'UNAVAILABLE',
      ...(Number.isFinite(input.scenarioTimeMs) ? {} : { timingReason: 'SCENARIO_TIME_UNAVAILABLE' as const }),
    };
  }

  const nextPoint = route.waypoints[completedWaypointCount];
  const branchDistanceNauticalMiles = distanceNm(input.currentPosition, nextPoint.position);
  const remainingAfterNext = pathDistanceNm(
    nextPoint.position,
    route.waypoints.slice(completedWaypointCount + 1),
  );
  const remainingDistanceNauticalMiles = branchDistanceNauticalMiles + remainingAfterNext;
  const timing = input.speed && Number.isFinite(input.speed.speedKnots) && input.speed.speedKnots > 0
    ? Number.isFinite(input.scenarioTimeMs)
      ? availableTiming(remainingDistanceNauticalMiles, input.speed, input.scenarioTimeMs as number)
      : unavailableTiming('SCENARIO_TIME_UNAVAILABLE', input.speed)
    : unavailableTiming('SPEED_UNAVAILABLE', input.speed);

  return {
    status: 'ACTIVE',
    message: null,
    routeId: route.id,
    routeLabel: route.label,
    hidden: route.hidden === true,
    activeBranch: completedWaypointCount + 1,
    totalBranches,
    nextPoint: {
      ...nextPoint,
      position: { ...nextPoint.position },
    },
    desiredHeadingDegrees: bearingBetween(
      input.currentPosition.lat,
      input.currentPosition.lon,
      nextPoint.position.lat,
      nextPoint.position.lon,
    ),
    branchDistanceNauticalMiles,
    cumulativeDistanceNauticalMiles: cumulativeBeforeActive + branchDistanceNauticalMiles,
    remainingDistanceNauticalMiles,
    ...timing,
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

const formatEtaUtc = (etaUtcMs: number | null): string => (
  etaUtcMs === null || !Number.isFinite(etaUtcMs)
    ? 'UNAVAILABLE'
    : new Date(etaUtcMs).toISOString()
);

export interface FormattedRouteSummary {
  label: string;
  subLabel: string;
}

export type RouteSummaryCommand = 'STATUS' | 'LEG' | 'NEXT' | 'ETE';

export const formatRouteSummary = (
  command: RouteSummaryCommand,
  summary: RouteSummary,
): FormattedRouteSummary => {
  if (summary.status === 'NO_ACTIVE_ROUTE') {
    const prefix = command === 'STATUS' ? 'ROUTE STATUS' : command === 'ETE' ? 'ROUTE ETE' : command;
    return {
      label: `${prefix}: NO ACTIVE SIM ROUTE`,
      subLabel: 'READ-ONLY SIMULATION STATE',
    };
  }

  if (summary.status === 'COMPLETED') {
    const prefix = command === 'STATUS' ? 'ROUTE STATUS' : command === 'ETE' ? 'ROUTE ETE' : command;
    return {
      label: `${prefix}: ROUTE COMPLETE`,
      subLabel: `ROUTE: ${summary.routeLabel ?? summary.routeId ?? 'SIM ROUTE'} · CUM: ${summary.cumulativeDistanceNauticalMiles.toFixed(1)} NM`,
    };
  }

  const nextPoint = summary.nextPoint?.label ?? 'N/A';
  const common = `BRANCH ${summary.activeBranch}/${summary.totalBranches} · NEXT: ${nextPoint} · HDG: ${summary.desiredHeadingDegrees?.toFixed(1) ?? 'N/A'}°T · LEG: ${summary.branchDistanceNauticalMiles?.toFixed(1) ?? 'N/A'} NM · CUM: ${summary.cumulativeDistanceNauticalMiles.toFixed(1)} NM · ETE: ${formatDuration(summary.eteSeconds)} · ETA UTC: ${formatEtaUtc(summary.etaUtcMs)}`;
  const routePrefix = summary.hidden ? 'HIDDEN · ' : '';

  switch (command) {
    case 'LEG':
      return { label: `LEG ${summary.activeBranch}/${summary.totalBranches}`, subLabel: `${routePrefix}${common}` };
    case 'NEXT':
      return { label: `NEXT: ${nextPoint}`, subLabel: `${routePrefix}${common}` };
    case 'ETE':
      return { label: `ROUTE ETE: ${formatDuration(summary.eteSeconds)}`, subLabel: `${routePrefix}${common}` };
    case 'STATUS':
    default:
      return { label: `ROUTE STATUS: ${summary.routeLabel ?? summary.routeId ?? 'SIM ROUTE'}`, subLabel: `${routePrefix}${common}` };
  }
};
