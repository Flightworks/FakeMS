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
import type { RelativeMotionPreview, RelativeMotionResult } from '../domain/relativeMotion';
import type { TrackDisplayDetails } from '../domain/trackDetails';
import type { TacticalQuantity } from '../domain/tacticalUnits';
import type {
  CommandResult,
  DisplayReason,
  InputQualification,
} from '../domain/commandResults';
import { presentCommandResult } from '../application/presentCommandResult';
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
  trackDetails?: TrackDisplayDetails;
  staleTrackDetails?: TrackDisplayDetails[];
  unitConversionResult?: TacticalQuantity;
  unitConversionError?: string;
  projection?: ProjectionPreview;
  intersection?: BearingIntersectionResult;
  bullseyeMeasurement?: BullseyeMeasurement;
  bullseyeProjection?: BullseyeProjectionPreview;
  /** Typed result calculated by the command registry. */
  result?: CommandResult;
  /** Backward-compatible alias for callers migrating to `result`. */
  commandResult?: CommandResult;
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

const formatResultValue = (value: { value: string; unit?: string }): string => (
  value.unit ? `${value.value} ${value.unit}` : value.value
);

const formatResultOrigin = (origin: InputQualification['origin']): string => {
  if (origin === 'SCENARIO') return 'SCÉNARIO';
  if (origin === 'RETAINED_FIX') return 'RETENU/PÉRIMÉ';
  return origin;
};

const formatResultQualification = (qualification: InputQualification): string => {
  if (qualification.input === 'SPEED'
    && (qualification.origin === 'USER_INPUT'
      || qualification.assumption?.toUpperCase().includes('HYPOTHESIS'))) {
    return 'GS HYPOTHÈSE';
  }
  if (qualification.status === 'NOT_APPLICABLE') return `${qualification.input}: NON APPLICABLE`;
  if (qualification.status === 'STALE' || qualification.origin === 'RETAINED_FIX') {
    return `${qualification.input}: RETENU/PÉRIMÉ`;
  }
  return `${qualification.input}: ${formatResultOrigin(qualification.origin)}`;
};

const formatResultReason = (reason: DisplayReason): string => {
  if (reason.code === 'SPEED_MISSING' || reason.code === 'SPEED_UNAVAILABLE' || reason.rawCode === 'SPEED_UNAVAILABLE') {
    return 'Vitesse sol absente.';
  }
  if (reason.code === 'CLOCK_MISSING' || reason.code === 'SCENARIO_TIME_UNAVAILABLE' || reason.rawCode === 'SCENARIO_TIME_UNAVAILABLE') {
    return 'Heure de scénario absente ; ETE reste disponible.';
  }
  if (reason.code === 'REFERENCE_AMBIGUOUS') return 'Référence ambiguë.';
  if (reason.code === 'REFERENCE_UNKNOWN') return 'Référence inconnue.';
  if (reason.code === 'QUALITY_NOT_APPLICABLE') return 'Qualité non applicable à ce point fixe.';
  return reason.message;
};

const isTechnicalResultLine = (line: string): boolean => (
  /^(?:REASON CODE|RAW CODE|TECHNICAL REASON):/i.test(line)
);

const hasResultCapability = (result: CommandResult, capability: 'DETAILS'): boolean => (
  result.capabilities.includes(capability)
);

const structuredPanelClasses: Record<CommandResult['state'], string> = {
  AVAILABLE: 'border-emerald-500/40 bg-emerald-950/15 text-emerald-100',
  PARTIAL: 'border-amber-500/50 bg-amber-950/20 text-amber-100',
  INCOMPLETE: 'border-slate-500/60 bg-slate-900/70 text-slate-200',
  AMBIGUOUS: 'border-orange-500/50 bg-orange-950/20 text-orange-100',
  UNAVAILABLE: 'border-rose-500/60 bg-rose-950/20 text-rose-100',
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
  trackDetails?: TrackDisplayDetails,
  staleTrackDetails?: TrackDisplayDetails[],
  unitConversionResult?: TacticalQuantity,
  unitConversionError?: string,
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
    if (command === 'CONVERT') {
      details.push('COMMAND: CONVERT');
      if (!unitConversionResult) {
        details.push('RESULT: UNAVAILABLE');
        details.push(`REASON: ${unitConversionError ?? 'CONVERSION NOT AVAILABLE'}`);
        details.push('STATUS: CALCULATION NOT EXECUTED');
      } else {
        details.push(`VALUE: ${unitConversionResult.value.toFixed(3)} ${unitConversionResult.unit}`);
        details.push(`DIMENSION: ${unitConversionResult.dimension}`);
        details.push(`SOURCE VALUE: ${unitConversionResult.originalValue} ${unitConversionResult.originalUnit ?? 'UNKNOWN'}`);
        details.push(`ASSUMED UNIT: ${unitConversionResult.assumed ? 'YES' : 'NO'}`);
      }
    } else if ((command === 'CLOSURE' || command === 'CPA')
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
  } else if (parsed.type === 'SEARCH'
    && (parameters.command === 'INFO' || parameters.command === 'AGE' || parameters.command === 'QUALITY' || parameters.command === 'STALE')) {
    const command = parameters.command;
    details.push(`COMMAND: ${command}`);
    if (command === 'STALE') {
      const stale = staleTrackDetails ?? [];
      details.push(`COUNT: ${stale.length}`);
      stale.forEach(item => {
        const age = item.ageSeconds === null
          ? 'UNKNOWN'
          : `${Number.isInteger(item.ageSeconds) ? item.ageSeconds.toFixed(0) : item.ageSeconds.toFixed(1)} S`;
        details.push(`${item.label} AGE: ${age} · FRESHNESS: ${item.freshness}`);
      });
    } else if (!trackDetails) {
      details.push('RESULT: UNAVAILABLE');
      details.push('REASON: TRACK DETAILS UNAVAILABLE');
    } else if (command === 'AGE') {
      const age = trackDetails.ageSeconds === null
        ? 'UNKNOWN'
        : `${Number.isInteger(trackDetails.ageSeconds) ? trackDetails.ageSeconds.toFixed(0) : trackDetails.ageSeconds.toFixed(1)} S`;
      details.push(`AGE: ${age}`);
      details.push(`FRESHNESS: ${trackDetails.freshness}`);
    } else if (command === 'QUALITY') {
      details.push(`QUALITY: ${trackDetails.quality}`);
      details.push(`CLASSIFICATION: ${trackDetails.classification}`);
      details.push(`CONFIDENCE: ${trackDetails.confidence === null ? 'N/A' : `${(trackDetails.confidence * 100).toFixed(0)}%`}`);
    } else {
      const age = trackDetails.ageSeconds === null
        ? 'UNKNOWN'
        : `${Number.isInteger(trackDetails.ageSeconds) ? trackDetails.ageSeconds.toFixed(0) : trackDetails.ageSeconds.toFixed(1)} S`;
      details.push(`SOURCE: ${trackDetails.sourceLabel ?? 'UNKNOWN'}`);
      details.push(`AGE: ${age}`);
      details.push(`FRESHNESS: ${trackDetails.freshness}`);
      details.push(`QUALITY: ${trackDetails.quality}`);
      details.push(`UNCERTAINTY: ${trackDetails.uncertaintyMeters === null ? 'N/A' : `${trackDetails.uncertaintyMeters.toFixed(0)} M`}`);
      details.push(`CLASSIFICATION: ${trackDetails.classification}`);
      details.push(`CONFIDENCE: ${trackDetails.confidence === null ? 'N/A' : `${(trackDetails.confidence * 100).toFixed(0)}%`}`);
    }
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
  trackDetails,
  staleTrackDetails,
  unitConversionResult,
  unitConversionError,
  projection,
  intersection,
  bullseyeMeasurement,
  bullseyeProjection,
  result,
  commandResult,
}: CommandInterpretationPanelProps) => {
  const structuredResult = result ?? commandResult;
  const allowConversionError = parsed.type === 'CALCULATION' && parsed.parameters.command === 'CONVERT';
  if (parsed.errors.length > 0 && !allowConversionError && !structuredResult) return null;

  const assumptions = parsed.assumptions.length > 0 ? parsed.assumptions.join(', ') : 'NONE';
  const target = getTarget(parsed, projection, intersection, bullseyeProjection, futurePositionPreview);
  const structuredPresentation = structuredResult
    ? presentCommandResult(structuredResult)
    : undefined;
  const legacyLines = structuredResult
    ? [
      ...getDetails(parsed, angularCalculation, futurePositionPreview, futurePositionResult, relativeMotionPreview, relativeMotionResult, trackDetails, staleTrackDetails, unitConversionResult, unitConversionError, projection, intersection, bullseyeMeasurement, bullseyeProjection),
      ...(target === 'N/A' ? [] : [`TARGET: ${target}`]),
      ...(assumptions === 'NONE' ? [] : [`ASSUMPTIONS: ${assumptions}`]),
    ]
    : [];
  const structuredDetailLines = structuredPresentation
    ? Array.from(new Set([
      ...structuredPresentation.lines,
      ...legacyLines,
    ].filter(line => !isTechnicalResultLine(line))))
    : [];
  const structuredSummaryLines: string[] = [];
  if (structuredPresentation) {
    structuredSummaryLines.push(`STATE: ${structuredPresentation.state}`);
    const commandLabel = typeof parsed.parameters.command === 'string'
      ? parsed.parameters.command
      : parsed.type;
    structuredSummaryLines.push(`COMMAND: ${commandLabel}`);
    if (structuredPresentation.references.length > 0) {
      structuredSummaryLines.push(`TARGET: ${structuredPresentation.references.join(', ')}`);
    }
    if (structuredPresentation.primary) {
      structuredSummaryLines.push(`${structuredPresentation.primary.label}: ${formatResultValue(structuredPresentation.primary)}`);
    }
    structuredPresentation.qualifications.forEach(qualification => {
      structuredSummaryLines.push(formatResultQualification(qualification));
    });
    if (structuredPresentation.reason) {
      structuredSummaryLines.push(`REASON: ${formatResultReason(structuredPresentation.reason)}`);
      if (structuredPresentation.reason.remedy) {
        structuredSummaryLines.push(`REMEDY: ${structuredPresentation.reason.remedy}`);
      }
    }
    if (structuredPresentation.candidates.length > 0) {
      structuredSummaryLines.push(`CANDIDATES: ${structuredPresentation.candidates.map(candidate => candidate.label).join(', ')}`);
    }
  }
  const lines = [
    ...getDetails(parsed, angularCalculation, futurePositionPreview, futurePositionResult, relativeMotionPreview, relativeMotionResult, trackDetails, staleTrackDetails, unitConversionResult, unitConversionError, projection, intersection, bullseyeMeasurement, bullseyeProjection),
    ...(target === 'N/A' ? [] : [`TARGET: ${target}`]),
    ...(assumptions === 'NONE' ? [] : [`ASSUMPTIONS: ${assumptions}`]),
  ];

  return (
    <section
      className={`shrink-0 min-w-0 max-w-full overflow-x-hidden border-b px-4 py-2 text-[10px] font-mono ${
        structuredResult
          ? structuredPanelClasses[structuredResult.state]
          : 'border-cyan-500/40 bg-cyan-950/20 text-cyan-100'
      }`}
      role="region"
      aria-label="Command interpretation"
      data-testid="command-interpretation"
      data-result-state={structuredResult?.state}
    >
      {structuredPresentation ? (
        <div className="min-w-0 max-w-full space-y-1">
          <div
            className="min-w-0 max-w-full space-y-0.5 break-words [overflow-wrap:anywhere]"
            data-testid="command-interpretation-summary"
          >
            {structuredSummaryLines.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)}
          </div>
          {hasResultCapability(structuredResult, 'DETAILS') && (
            <details className="min-w-0 max-w-full">
              <summary role="button" className="min-h-[32px] cursor-pointer list-none rounded border border-current/40 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-current [&::-webkit-details-marker]:hidden">
                Détails
              </summary>
              <div
                className="mt-1 max-h-44 min-w-0 max-w-full overflow-x-hidden overflow-y-auto rounded border border-current/20 bg-slate-950/30 p-2 leading-snug break-words [overflow-wrap:anywhere]"
                data-testid="command-interpretation-details"
                tabIndex={0}
              >
                {structuredDetailLines.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)}
              </div>
            </details>
          )}
        </div>
      ) : (
        <div className="grid min-w-0 max-w-full gap-0.5 break-words [overflow-wrap:anywhere]">
          {lines.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)}
        </div>
      )}
    </section>
  );
};
