import type { ParsedCommand } from '../domain/commandLanguage';
import type { ProjectionPreview } from '../domain/designations';
import {
  convertTacticalQuantity,
  createTacticalQuantity,
  METERS_PER_NAUTICAL_MILE,
} from '../domain/tacticalUnits';

export interface CommandInterpretationPanelProps {
  parsed: ParsedCommand;
  projection?: ProjectionPreview;
  effect?: string;
  source?: string;
}

const formatBearing = (value: number): string => (
  Number.isInteger(value)
    ? value.toFixed(0)
    : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
);

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

const getReference = (parsed: ParsedCommand): string => {
  const parameters = parsed.parameters;
  if (typeof parameters.reference === 'string') return parameters.reference;
  if (typeof parameters.fromReference === 'string' && typeof parameters.toReference === 'string') {
    return `${parameters.fromReference} → ${parameters.toReference}`;
  }
  if (typeof parameters.target === 'string') return parameters.target;
  if (typeof parameters.query === 'string' && parameters.query) return parameters.query;
  if (typeof parameters.system === 'string') return parameters.system;
  return 'N/A';
};

const getTarget = (parsed: ParsedCommand, projection?: ProjectionPreview): string => {
  if (projection) {
    return `${formatCoordinate(projection.targetPosition.lat)}, ${formatCoordinate(projection.targetPosition.lon)}`;
  }

  if (parsed.type === 'COORDINATE'
    && typeof parsed.parameters.latitude === 'number'
    && typeof parsed.parameters.longitude === 'number') {
    return `${formatCoordinate(parsed.parameters.latitude)}, ${formatCoordinate(parsed.parameters.longitude)}`;
  }

  return 'N/A';
};

const getDetails = (parsed: ParsedCommand, projection?: ProjectionPreview): string[] => {
  const details: string[] = [];
  const parameters = parsed.parameters;

  if (parsed.type === 'PROJECTION') {
    if (typeof parameters.bearing === 'number' && Number.isFinite(parameters.bearing)) {
      details.push(`BEARING: ${formatBearing(parameters.bearing)}° TRUE`);
    } else {
      details.push('BEARING: N/A');
    }
    details.push(`RANGE: ${formatRange(parsed, projection)}`);
  } else if (parsed.type === 'MEASUREMENT' && typeof parameters.command === 'string') {
    details.push(`COMMAND: ${parameters.command}`);
  } else if (parsed.type === 'COORDINATE') {
    if (typeof parameters.command === 'string') details.push(`COMMAND: ${parameters.command}`);
    if (typeof parameters.format === 'string') details.push(`FORMAT: ${parameters.format}`);
    if (typeof parameters.latitude === 'number') details.push(`LATITUDE: ${formatCoordinate(parameters.latitude)}°`);
    if (typeof parameters.longitude === 'number') details.push(`LONGITUDE: ${formatCoordinate(parameters.longitude)}°`);
  } else if (parsed.type === 'CALCULATION') {
    const command = typeof parameters.command === 'string' ? parameters.command : undefined;
    if (command === 'TIME' || command === 'DIST' || command === 'GS') {
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
  projection,
  effect = 'SIMULATED CALCULATION',
  source = 'LOCAL SCENARIO',
}: CommandInterpretationPanelProps) => {
  if (parsed.errors.length > 0) return null;

  const assumptions = parsed.assumptions.length > 0 ? parsed.assumptions.join(', ') : 'NONE';
  const lines = [
    `TYPE: ${parsed.type}`,
    `REFERENCE: ${getReference(parsed)}`,
    ...getDetails(parsed, projection),
    `TARGET: ${getTarget(parsed, projection)}`,
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
