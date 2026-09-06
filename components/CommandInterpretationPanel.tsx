import type { ParsedCommand } from '../domain/commandLanguage';
import type { AngularCalculationResult } from '../domain/angularCalculations';
import type { BearingIntersectionResult } from '../domain/bearingIntersection';
import type {
  BullseyeMeasurement,
  BullseyeProjectionPreview,
} from '../domain/bullseye';
import type { ProjectionPreview } from '../domain/designations';
import type {
  FuturePositionPreview,
  FuturePositionResult,
} from '../domain/futurePosition';
import type {
  RelativeMotionPreview,
  RelativeMotionResult,
} from '../domain/relativeMotion';
import {
  convertTacticalQuantity,
  createTacticalQuantity,
  METERS_PER_NAUTICAL_MILE,
} from '../domain/tacticalUnits';

export interface CommandInterpretationPanelProps {
  parsed: ParsedCommand;
  angularCalculation?: AngularCalculationResult;
  futurePositionPreview?: FuturePositionPreview;
  futurePositionResult?: FuturePositionResult;
  relativeMotionPreview?: RelativeMotionPreview;
  relativeMotionResult?: RelativeMotionResult;
  projection?: ProjectionPreview;
  intersection?: BearingIntersectionResult;
  bullseyeMeasurement?: BullseyeMeasurement;
  bullseyeProjection?: BullseyeProjectionPreview;
  effect?: string;
  source?: string;
}

const formatBearing = (value: number): string => (
  Number.isInteger(value)
    ? value.toFixed(0)
    : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
);

const formatAngularValue = (value: number | null, padded: boolean): string => {
  if (value === null || !Number.isFinite(value)) return 'UNAVAILABLE';
  return padded
    ? (Number.isInteger(value) ? value.toFixed(0).padStart(3, '0') : value.toFixed(1))
    : (Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1));
};

const formatCoordinate = (value: number): string => value.toFixed(5);

const formatMeters = (value: number): string => (
  Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
);

const formatRange = (parsed: ParsedCommand, projection?: ProjectionPreview): string => {
  if (projection) {
    const meters = projection.rangeNauticalMiles * METERS_PER_NAUTICAL_MILE;
    return `${projection.rangeNauticalMiles.toFixed(1)} ${projection.unit} / ${formatMeters(meters)} m`;
  }

  const range = parsed.parameters.range;
  const unit = parsed.parameters.unit;
  if (typeof range !== 'number' || !Number.isFinite(range) || typeof unit !== 'string') {
    return 'N/A';
  }

  try {
    const quantity = createTacticalQuantity(range, unit, { allowImplicitNauticalMile: true });
    const nauticalMiles = convertTacticalQuantity(quantity, 'NM').value;
    const meters = convertTacticalQuantity(quantity, 'M').value;
    return `${nauticalMiles.toFixed(1)} NM / ${formatMeters(meters)} m`;
  } catch {
    return `${range} ${unit}`;
  }
};

const formatIntersectionBearing = (value: number): string => (
  Number.isInteger(value)
    ? value.toFixed(0).padStart(3, '0')
    : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
);

const getReference = (parsed: ParsedCommand): string => {
  const parameters = parsed.parameters;
  if (typeof parameters.firstReference === 'string' && typeof parameters.secondReference === 'string') {
    return `${parameters.firstReference} ↔ ${parameters.secondReference}`;
  }
  if (typeof parameters.reference === 'string') return parameters.reference;
  if (parsed.type === 'BULLSEYE' && typeof parameters.targetReference === 'string') {
    return `BULLSEYE → ${parameters.targetReference}`;
  }
  if (parsed.type === 'BULLSEYE' && typeof parameters.bearing === 'number') return 'BULLSEYE';
  if (typeof parameters.fromReference === 'string' && typeof parameters.toReference === 'string') {
    return `${parameters.fromReference} → ${parameters.toReference}`;
  }
  if (typeof parameters.target === 'string') return parameters.target;
  if (typeof parameters.query === 'string' && parameters.query) return parameters.query;
  if (typeof parameters.system === 'string') return parameters.system;
  return 'N/A';
};

const getTarget = (
  parsed: ParsedCommand,
  projection?: ProjectionPreview,
  intersection?: BearingIntersectionResult,
  bullseyeProjection?: BullseyeProjectionPreview,
  futurePositionPreview?: FuturePositionPreview,
): string => {
  if (projection) {
    return `${formatCoordinate(projection.targetPosition.lat)}, ${formatCoordinate(projection.targetPosition.lon)}`;
  }
  if (intersection) {
    return `${formatCoordinate(intersection.position.lat)}, ${formatCoordinate(intersection.position.lon)}`;
  }
  if (bullseyeProjection) {
    return `${formatCoordinate(bullseyeProjection.targetPosition.lat)}, ${formatCoordinate(bullseyeProjection.targetPosition.lon)}`;
  }
  if (futurePositionPreview) {
    return `${formatCoordinate(futurePositionPreview.result.targetPosition.lat)}, ${formatCoordinate(futurePositionPreview.result.targetPosition.lon)}`;
  }

  if (parsed.type === 'COORDINATE'
    && typeof parsed.parameters.latitude === 'number'
    && typeof parsed.parameters.longitude === 'number') {
    return `${formatCoordinate(parsed.parameters.latitude)}, ${formatCoordinate(parsed.parameters.longitude)}`;
  }

  return 'N/A';
};

const getDetails = (
  parsed: ParsedCommand,
  angularCalculation?: AngularCalculationResult,
  futurePositionPreview?: FuturePositionPreview,
  futurePositionResult?: FuturePositionResult,
  relativeMotionPreview?: RelativeMotionPreview,
  relativeMotionResult?: RelativeMotionResult,
  projection?: ProjectionPreview,
  intersection?: BearingIntersectionResult,
  bullseyeMeasurement?: BullseyeMeasurement,
  bullseyeProjection?: BullseyeProjectionPreview,
): string[] => {
  const details: string[] = [];
  const parameters = parsed.parameters;

  if (parsed.type === 'PROJECTION') {
    if (typeof parameters.bearing === 'number' && Number.isFinite(parameters.bearing)) {
      details.push(`BEARING: ${formatBearing(parameters.bearing)}° TRUE`);
    } else {
      details.push('BEARING: N/A');
    }
    details.push(`RANGE: ${formatRange(parsed, projection)}`);
  } else if (parsed.type === 'INTERSECTION' && intersection) {
    intersection.legs.forEach(leg => {
      details.push(`${leg.reference} BRG: ${formatIntersectionBearing(leg.bearingDegrees)}° TRUE / RNG: ${leg.rangeNauticalMiles.toFixed(1)} NM`);
    });
    details.push(`CROSSING ANGLE: ${intersection.crossingAngleDegrees.toFixed(2)}°`);
    details.push(`QUALITY: ${intersection.quality}`);
    details.push(`METHOD: ${intersection.method}`);
  } else if (parsed.type === 'BULLSEYE') {
    const command = typeof parameters.command === 'string' ? parameters.command : undefined;
    if (command) details.push(`COMMAND: ${command}`);
    if (bullseyeMeasurement) {
      const bearing = bullseyeMeasurement.bearingTrueDegrees === null
        ? 'UNAVAILABLE'
        : `${bullseyeMeasurement.bearingTrueDegrees.toFixed(1)}° TRUE`;
      const range = bullseyeMeasurement.rangeNauticalMiles === null
        ? 'UNAVAILABLE'
        : `${bullseyeMeasurement.rangeNauticalMiles.toFixed(1)} NM`;
      details.push(`BRG: ${bearing}`);
      details.push(`RNG: ${range}`);
      details.push(`QUALIFICATION: ${bullseyeMeasurement.qualification}`);
      if (bullseyeMeasurement.reason) details.push(`REASON: ${bullseyeMeasurement.reason}`);
    } else if (bullseyeProjection) {
      details.push(`BEARING: ${formatBearing(bullseyeProjection.bearingDegrees)}° TRUE`);
      details.push(`RANGE: ${bullseyeProjection.rangeNauticalMiles.toFixed(1)} ${bullseyeProjection.unit}`);
      details.push(`METHOD: ${bullseyeProjection.method}`);
    } else if (command === 'SET BULL') {
      details.push('ACTION: EXPLICIT CONFIRMATION REQUIRED');
    } else if (command === 'CLEAR BULL') {
      details.push('ACTION: EXPLICIT CONFIRMATION REQUIRED');
    }
  } else if (parsed.type === 'MEASUREMENT' && typeof parameters.command === 'string') {
    details.push(`COMMAND: ${parameters.command}`);
  } else if (parsed.type === 'COORDINATE') {
    if (typeof parameters.command === 'string') details.push(`COMMAND: ${parameters.command}`);
    if (typeof parameters.format === 'string') details.push(`FORMAT: ${parameters.format}`);
    if (typeof parameters.latitude === 'number') details.push(`LATITUDE: ${formatCoordinate(parameters.latitude)}°`);
    if (typeof parameters.longitude === 'number') details.push(`LONGITUDE: ${formatCoordinate(parameters.longitude)}°`);
  } else if (parsed.type === 'CALCULATION') {
    const command = typeof parameters.command === 'string' ? parameters.command : undefined;
    if ((command === 'CLOSURE' || command === 'CPA')
      && (relativeMotionPreview || relativeMotionResult)) {
      details.push(`COMMAND: ${command}`);
      const result = relativeMotionPreview?.result ?? relativeMotionResult;
      if (!result || result.status === 'UNAVAILABLE') {
        details.push('RESULT: UNAVAILABLE');
        if (result?.status === 'UNAVAILABLE') details.push(`REASON: ${result.reason}`);
      } else {
        details.push(`CLOSURE: ${result.closureRateKnots.toFixed(1)} KT`);
        details.push(`CPA: ${result.cpaDistanceNauticalMiles.toFixed(1)} NM`);
        details.push(`TCPA: ${result.tcpaMinutes === null ? 'N/A' : `${result.tcpaMinutes.toFixed(1)} MIN`}`);
        details.push(`STATUS: ${result.cpaStatus}`);
        details.push(`ASSUMPTION: ${result.assumption}`);
      }
    } else if (angularCalculation && (command === 'RECIP' || command === 'DELTA' || command === 'REL')) {
      details.push(`COMMAND: ${command}`);
      details.push(`INPUT: ${angularCalculation.inputKind}`);
      details.push(`OUTPUT: ${angularCalculation.outputKind}`);
      const formattedResult = formatAngularValue(
        angularCalculation.valueDegrees,
        angularCalculation.operation !== 'DELTA',
      );
      details.push(`RESULT: ${formattedResult === 'UNAVAILABLE' ? formattedResult : `${formattedResult}°`}`);
      if (angularCalculation.operation === 'DELTA') {
        details.push(`DIRECTION: ${angularCalculation.direction ?? 'UNAVAILABLE'}`);
        const formattedDelta = formatAngularValue(angularCalculation.deltaDegrees, false);
        details.push(`DELTA: ${formattedDelta === 'UNAVAILABLE' ? formattedDelta : `${formattedDelta}°`}`);
        details.push(`SIGNED DELTA: ${angularCalculation.signedDeltaDegrees ?? 'UNAVAILABLE'}°`);
      }
      if (angularCalculation.operation === 'RELATIVE') {
        details.push(`REFERENCE AXIS: ${angularCalculation.referenceKind}`);
      }
      if (angularCalculation.reason) details.push(`REASON: ${angularCalculation.reason}`);
    } else if (command === 'TIME' || command === 'DIST' || command === 'GS') {
      details.push(`COMMAND: ${command}`);
      if (typeof parameters.distance === 'number' && typeof parameters.distanceUnit === 'string') {
        details.push(`DISTANCE: ${parameters.distance.toFixed(1)} ${parameters.distanceUnit}`);
      }
      if (typeof parameters.time === 'number' && typeof parameters.timeUnit === 'string') {
        details.push(`TIME: ${parameters.time.toFixed(1)} ${parameters.timeUnit}`);
      }
      if (typeof parameters.speed === 'number' && typeof parameters.speedUnit === 'string') {
        details.push(`SPEED: ${parameters.speed.toFixed(1)} ${parameters.speedUnit}`);
      }
    } else if (typeof parameters.expression === 'string') {
      details.push(`EXPRESSION: ${parameters.expression}`);
    }
  } else if (parsed.type === 'ROUTE' && typeof parameters.command === 'string') {
    details.push(`COMMAND: ${parameters.command}`);
  } else if (parsed.type === 'SEARCH' && parameters.command === 'PREDICT') {
    details.push('COMMAND: PREDICT');
    const futureResult = futurePositionPreview?.result ?? futurePositionResult;
    if (!futureResult || futureResult.status === 'UNAVAILABLE') {
      details.push('RESULT: UNAVAILABLE');
      if (futureResult?.reason) details.push(`REASON: ${futureResult.reason}`);
    } else {
      details.push(`GHOST: ${formatCoordinate(futureResult.targetPosition.lat)}, ${formatCoordinate(futureResult.targetPosition.lon)}`);
      if (futurePositionPreview) {
        details.push(`VECTOR: ${futurePositionPreview.groundTrackDegrees.toFixed(1)}°T @ ${futurePositionPreview.groundSpeedKnots.toFixed(1)} KT`);
      } else {
        details.push('VECTOR: N/A');
      }
      details.push(`RANGE: ${futureResult.projectedRangeNauticalMiles.toFixed(1)} NM`);
      details.push(`HORIZON: ${futureResult.effectiveHorizonMinutes.toFixed(1)} MIN`);
      details.push(`AGE: ${futureResult.ageSeconds === null
        ? 'UNKNOWN'
        : `${Number.isInteger(futureResult.ageSeconds) ? futureResult.ageSeconds.toFixed(0) : futureResult.ageSeconds.toFixed(1)} S`}`);
      details.push(`LIMIT: ${futureResult.horizonLimit}`);
      details.push(`ASSUMPTION: ${futureResult.assumption}`);
    }
  } else if (parsed.type === 'SEARCH' && parameters.command === 'NEAREST') {
    details.push('COMMAND: NEAREST');
    if (typeof parameters.category === 'string') details.push(`CATEGORY: ${parameters.category}`);
    if (typeof parameters.limit === 'number') details.push(`LIMIT: ${parameters.limit}`);
  } else if (parsed.type === 'SEARCH' && typeof parameters.query === 'string') {
    details.push(`QUERY: ${parameters.query}`);
  } else if (parsed.type === 'SYSTEM' && typeof parameters.system === 'string') {
    details.push(`COMMAND: ${parameters.system}`);
  }

  return details;
};

export const CommandInterpretationPanel = ({
  parsed,
  angularCalculation,
  futurePositionPreview,
  futurePositionResult,
  relativeMotionPreview,
  relativeMotionResult,
  projection,
  intersection,
  bullseyeMeasurement,
  bullseyeProjection,
  effect = 'SIMULATED CALCULATION',
  source = 'LOCAL SCENARIO',
}: CommandInterpretationPanelProps) => {
  if (parsed.errors.length > 0) return null;

  const assumptions = parsed.assumptions.length > 0 ? parsed.assumptions.join(', ') : 'NONE';
  const lines = [
    `TYPE: ${parsed.type}`,
    `REFERENCE: ${getReference(parsed)}`,
    ...getDetails(parsed, angularCalculation, futurePositionPreview, futurePositionResult, relativeMotionPreview, relativeMotionResult, projection, intersection, bullseyeMeasurement, bullseyeProjection),
    `TARGET: ${getTarget(parsed, projection, intersection, bullseyeProjection, futurePositionPreview)}`,
    `ASSUMPTIONS: ${assumptions}`,
    `SOURCE: ${source}`,
    `EFFECT: ${effect}`,
    'STATUS: SIMULATED',
  ];

  return (
    <section
      className="shrink-0 border-b border-cyan-500/40 bg-cyan-950/20 px-4 py-2 text-[10px] font-mono text-cyan-100"
      role="region"
      aria-label="Command interpretation"
      data-testid="command-interpretation"
    >
      <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-cyan-300">INTERPRETATION</div>
      <div className="grid gap-0.5">
        {lines.map(line => <div key={line}>{line}</div>)}
      </div>
    </section>
  );
};
