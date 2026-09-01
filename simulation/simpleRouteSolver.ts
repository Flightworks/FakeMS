import { distanceBetween } from '../utils/geo';
import type { RouteConstraints } from '../domain/constraints';
import type { MissionIntent, MissionObjective } from '../domain/intent';
import type {
  ProposalReason,
  RouteProposal,
  RouteProposalSet,
  RouteProposalStatus,
  RouteProposalVariant,
} from '../domain/proposals';
import type { Position } from '../types';

export interface SimpleRouteSolveRequest {
  ownshipPosition: Position;
  intent: MissionIntent;
  constraints: RouteConstraints;
  speedKnots: number;
  altitudeFt: number;
}

const METERS_PER_NAUTICAL_MILE = 1852;
const EPSILON = 1e-9;

const copyPosition = (position: Position): Position => ({ ...position });

const isFiniteNumber = (value: number): boolean => Number.isFinite(value);

const validateRequest = (request: SimpleRouteSolveRequest): void => {
  const { constraints } = request;
  const numericValues = [
    request.ownshipPosition.lat,
    request.ownshipPosition.lon,
    request.intent.target.lat,
    request.intent.target.lon,
    request.speedKnots,
    request.altitudeFt,
    constraints.fuelAvailableUnits,
    constraints.fuelReserveUnits,
    constraints.fuelBurnUnitsPerNm,
  ];

  if (numericValues.some(value => !isFiniteNumber(value))) {
    throw new Error('Invalid route solve request: all numeric values must be finite');
  }
  if (constraints.fuelAvailableUnits < 0
    || constraints.fuelReserveUnits < 0
    || constraints.fuelBurnUnitsPerNm < 0) {
    throw new Error('Invalid route solve request: fuel constraints must be non-negative');
  }
  if (constraints.fuelReserveUnits > constraints.fuelAvailableUnits) {
    throw new Error('Invalid route solve request: reserve cannot exceed available fuel');
  }
  if (constraints.returnTo && (!isFiniteNumber(constraints.returnTo.lat) || !isFiniteNumber(constraints.returnTo.lon))) {
    throw new Error('Invalid route solve request: return position must be finite');
  }
  if (constraints.allowedArea && (
    constraints.allowedArea.minLat > constraints.allowedArea.maxLat
    || constraints.allowedArea.minLon > constraints.allowedArea.maxLon
  )) {
    throw new Error('Invalid route solve request: geographic bounds are inverted');
  }
};

const routeDistanceNm = (origin: Position, waypoints: Position[]): number => {
  let distanceMeters = 0;
  let previous = origin;
  for (const waypoint of waypoints) {
    distanceMeters += distanceBetween(
      previous.lat,
      previous.lon,
      waypoint.lat,
      waypoint.lon,
    );
    previous = waypoint;
  }
  return distanceMeters / METERS_PER_NAUTICAL_MILE;
};

const isInsideAllowedArea = (
  position: Position,
  bounds: NonNullable<RouteConstraints['allowedArea']>,
): boolean => (
  position.lat >= bounds.minLat - EPSILON
  && position.lat <= bounds.maxLat + EPSILON
  && position.lon >= bounds.minLon - EPSILON
  && position.lon <= bounds.maxLon + EPSILON
);

const objectiveReason = (objective: MissionObjective): ProposalReason => ({
  code: `OBJECTIVE_${objective.replace('THREAT_PRIORITY', 'THREAT')}`,
  category: 'OBJECTIVE',
  message: objective === 'THREAT_PRIORITY'
    ? 'Prioritizes reaching the declared target quickly'
    : objective === 'COVERAGE'
      ? 'Prioritizes a route that preserves observation coverage'
      : 'Prioritizes fuel endurance and margin',
});

const evaluateProposal = (
  request: SimpleRouteSolveRequest,
  variant: RouteProposalVariant,
  waypoints: Position[],
): RouteProposal => {
  const { constraints, intent } = request;
  const distanceNm = routeDistanceNm(request.ownshipPosition, waypoints);
  const estimatedFuelUnits = distanceNm * constraints.fuelBurnUnitsPerNm;
  const fuelMarginUnits = constraints.fuelAvailableUnits
    - estimatedFuelUnits
    - constraints.fuelReserveUnits;
  const fuelRatio = constraints.fuelAvailableUnits > 0
    ? fuelMarginUnits / constraints.fuelAvailableUnits
    : null;
  const estimatedTimeMinutes = request.speedKnots > 0
    ? distanceNm / request.speedKnots * 60
    : null;
  const returnIncluded = variant === 'RETURN_AWARE';
  const reasons: ProposalReason[] = [objectiveReason(intent.objective)];
  const tradeoffs: string[] = [];
  const hardReasons: ProposalReason[] = [];
  const softReasons: ProposalReason[] = [];

  if (fuelMarginUnits < 0) {
    hardReasons.push({
      code: 'FUEL_RESERVE_BREACH',
      category: 'CONSTRAINT',
      message: 'The route cannot preserve the declared fuel reserve',
    });
  }

  if (request.speedKnots <= 0) {
    hardReasons.push({
      code: 'SPEED_UNAVAILABLE',
      category: 'CONSTRAINT',
      message: 'ETA cannot be calculated without a positive speed',
    });
  }

  if (constraints.minSpeedKnots !== undefined && request.speedKnots < constraints.minSpeedKnots) {
    hardReasons.push({
      code: 'SPEED_BELOW_MINIMUM',
      category: 'CONSTRAINT',
      message: 'Requested speed is below the configured minimum',
    });
  }
  if (constraints.maxSpeedKnots !== undefined && request.speedKnots > constraints.maxSpeedKnots) {
    hardReasons.push({
      code: 'SPEED_ABOVE_MAXIMUM',
      category: 'CONSTRAINT',
      message: 'Requested speed is above the configured maximum',
    });
  }
  if (constraints.minAltitudeFt !== undefined && request.altitudeFt < constraints.minAltitudeFt) {
    hardReasons.push({
      code: 'ALTITUDE_BELOW_MINIMUM',
      category: 'CONSTRAINT',
      message: 'Requested altitude is below the configured minimum',
    });
  }
  if (constraints.maxAltitudeFt !== undefined && request.altitudeFt > constraints.maxAltitudeFt) {
    hardReasons.push({
      code: 'ALTITUDE_ABOVE_MAXIMUM',
      category: 'CONSTRAINT',
      message: 'Requested altitude is above the configured maximum',
    });
  }

  if (constraints.allowedArea) {
    const allPoints = [request.ownshipPosition, ...waypoints];
    if (allPoints.some(point => !isInsideAllowedArea(point, constraints.allowedArea!))) {
      hardReasons.push({
        code: 'OUTSIDE_ALLOWED_AREA',
        category: 'CONSTRAINT',
        message: 'At least one route point is outside the allowed area',
      });
    }
  }

  if (!returnIncluded && constraints.returnPolicy === 'REQUIRED') {
    hardReasons.push({
      code: 'RETURN_REQUIRED',
      category: 'CONSTRAINT',
      message: 'The route must include a return leg',
    });
  } else if (!returnIncluded && constraints.returnPolicy === 'PREFERRED') {
    softReasons.push({
      code: 'RETURN_PREFERRED_NOT_INCLUDED',
      category: 'CONSTRAINT',
      message: 'The direct route does not include the preferred return leg',
    });
    tradeoffs.push('Lower fuel use, but no return leg is planned');
  }

  if (returnIncluded && constraints.returnPolicy === 'NONE') {
    softReasons.push({
      code: 'RETURN_LEG_ADDED',
      category: 'TRADEOFF',
      message: 'The return-aware route spends additional fuel to include a return leg',
    });
    tradeoffs.push('Includes a return leg, but increases distance and fuel use');
  } else if (returnIncluded) {
    tradeoffs.push('Preserves a return leg, at the cost of additional distance and fuel');
  }

  reasons.push(...hardReasons, ...softReasons);

  let status: RouteProposalStatus = 'FEASIBLE';
  if (hardReasons.length > 0) status = 'PROHIBITED';
  else if (softReasons.length > 0) status = 'CONSTRAINED';

  return {
    id: `proposal:${intent.id}:${variant.toLowerCase()}`,
    label: variant === 'DIRECT' ? 'DIRECT · EFFICIENCY' : 'RETURN AWARE · MARGIN',
    variant,
    objective: intent.objective,
    waypoints: waypoints.map(copyPosition),
    distanceNm,
    estimatedFuelUnits,
    estimatedTimeMinutes,
    status,
    margins: {
      fuelUnits: fuelMarginUnits,
      fuelRatio,
      returnIncluded,
    },
    reasons,
    tradeoffs,
  };
};

/**
 * Produce two explainable local route alternatives. This is deliberately a
 * small deterministic heuristic, not an operational planner or an AI system.
 */
export const solveSimpleRouteProposals = (
  request: SimpleRouteSolveRequest,
): RouteProposalSet => {
  validateRequest(request);
  const returnPosition = request.constraints.returnTo ?? request.ownshipPosition;
  const directWaypoints = [copyPosition(request.intent.target)];
  const returnWaypoints = [copyPosition(request.intent.target), copyPosition(returnPosition)];

  return {
    intentId: request.intent.id,
    proposals: [
      evaluateProposal(request, 'DIRECT', directWaypoints),
      evaluateProposal(request, 'RETURN_AWARE', returnWaypoints),
    ],
  };
};
