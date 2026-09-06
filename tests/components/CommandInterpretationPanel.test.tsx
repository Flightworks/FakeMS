import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CommandInterpretationPanel } from '../../components/CommandInterpretationPanel';
import { createProjectionPreview } from '../../domain/designations';
import { intersectBearings } from '../../domain/bearingIntersection';
import { calculateDelta, calculateReciprocal, calculateRelativeBearing } from '../../domain/angularCalculations';
import { projectFuturePosition, type FuturePositionPreview } from '../../domain/futurePosition';
import { calculateRelativeMotion, type RelativeMotionPreview } from '../../domain/relativeMotion';
import type { TrackDisplayDetails } from '../../domain/trackDetails';
import { convertTacticalQuantity, createTacticalQuantity, type TacticalQuantity } from '../../domain/tacticalUnits';
import { parseCommand } from '../../domain/commandParser';

const projection = createProjectionPreview(
  'BRAVO',
  { lat: 34.91682, lon: -120 },
  180,
  5,
);

const intersection = intersectBearings(
  {
    reference: 'BRAVO',
    position: { lat: 0, lon: 0 },
    bearingDegrees: 90,
  },
  {
    reference: 'G01',
    position: { lat: 1, lon: 1 },
    bearingDegrees: 180,
  },
);

describe('CommandInterpretationPanel', () => {
  it('shows normalized projection values, target, assumptions, source, and effect', () => {
    render(
      <CommandInterpretationPanel
        parsed={parseCommand('BRAVO 180/5')}
        projection={projection}
        effect="MAP PREVIEW ONLY"
      />,
    );

    const panel = screen.getByRole('region', { name: 'Command interpretation' });
    expect(panel).toHaveTextContent('TYPE: PROJECTION');
    expect(panel).toHaveTextContent('REFERENCE: BRAVO');
    expect(panel).toHaveTextContent('BEARING: 180° TRUE');
    expect(panel).toHaveTextContent('RANGE: 5.0 NM / 9 260 m');
    expect(panel).toHaveTextContent('TARGET: 34.83364, -120.00000');
    expect(panel).toHaveTextContent('ASSUMPTIONS: ASSUMED NM');
    expect(panel).toHaveTextContent('SOURCE: LOCAL SCENARIO');
    expect(panel).toHaveTextContent('EFFECT: MAP PREVIEW ONLY');
    expect(panel).toHaveTextContent('STATUS: SIMULATED');
  });

  it('explains a non-projection structured result without inventing a target position', () => {
    render(
      <CommandInterpretationPanel
        parsed={parseCommand('BRG BRAVO')}
        effect="CALCULATION ONLY"
      />,
    );

    const panel = screen.getByRole('region', { name: 'Command interpretation' });
    expect(panel).toHaveTextContent('TYPE: MEASUREMENT');
    expect(panel).toHaveTextContent('REFERENCE: OWNSHIP → BRAVO');
    expect(panel).toHaveTextContent('TARGET: N/A');
    expect(panel).toHaveTextContent('ASSUMPTIONS: NONE');
    expect(panel).toHaveTextContent('SOURCE: LOCAL SCENARIO');
    expect(panel).toHaveTextContent('EFFECT: CALCULATION ONLY');
    expect(panel).toHaveTextContent('STATUS: SIMULATED');
  });

  it('explains normalized time-distance-speed quantities before execution', () => {
    render(
      <CommandInterpretationPanel
        parsed={parseCommand('TIME 45NM @ 120KT')}
        effect="CALCULATION ONLY"
      />,
    );

    const panel = screen.getByRole('region', { name: 'Command interpretation' });
    expect(panel).toHaveTextContent('TYPE: CALCULATION');
    expect(panel).toHaveTextContent('COMMAND: TIME');
    expect(panel).toHaveTextContent('DISTANCE: 45.0 NM');
    expect(panel).toHaveTextContent('SPEED: 120.0 KT');
    expect(panel).toHaveTextContent('TARGET: N/A');
  });

  it('explains a route summary command as a read-only local display', () => {
    render(
      <CommandInterpretationPanel
        parsed={parseCommand('ROUTE STATUS')}
        effect="LOCAL DISPLAY ONLY"
      />,
    );

    const panel = screen.getByRole('region', { name: 'Command interpretation' });
    expect(panel).toHaveTextContent('TYPE: ROUTE');
    expect(panel).toHaveTextContent('COMMAND: STATUS');
    expect(panel).toHaveTextContent('EFFECT: LOCAL DISPLAY ONLY');
    expect(panel).toHaveTextContent('STATUS: SIMULATED');
  });

  it('explains a nearest search without inventing a target position', () => {
    render(
      <CommandInterpretationPanel
        parsed={parseCommand('NEAREST 3 TRACKS')}
        effect="LOCAL DISPLAY ONLY"
      />,
    );

    const panel = screen.getByRole('region', { name: 'Command interpretation' });
    expect(panel).toHaveTextContent('TYPE: SEARCH');
    expect(panel).toHaveTextContent('COMMAND: NEAREST');
    expect(panel).toHaveTextContent('CATEGORY: TRACK');
    expect(panel).toHaveTextContent('LIMIT: 3');
    expect(panel).toHaveTextContent('REFERENCE: OWNSHIP');
    expect(panel).toHaveTextContent('TARGET: N/A');
    expect(panel).toHaveTextContent('EFFECT: LOCAL DISPLAY ONLY');
  });

  it('explains a coordinate conversion format before any copy action', () => {
    render(
      <CommandInterpretationPanel
        parsed={parseCommand('COORD BRAVO DDM')}
        effect="LOCAL DISPLAY ONLY"
      />,
    );

    const panel = screen.getByRole('region', { name: 'Command interpretation' });
    expect(panel).toHaveTextContent('TYPE: COORDINATE');
    expect(panel).toHaveTextContent('REFERENCE: BRAVO');
    expect(panel).toHaveTextContent('COMMAND: COORD');
    expect(panel).toHaveTextContent('FORMAT: DDM');
    expect(panel).toHaveTextContent('TARGET: N/A');
  });

  it('explains a bearing intersection without implying navigation or confirmation', () => {
    render(
      <CommandInterpretationPanel
        parsed={parseCommand('INT BRAVO/090 G01/180')}
        intersection={intersection}
        effect="MAP PREVIEW ONLY"
      />,
    );

    const panel = screen.getByRole('region', { name: 'Command interpretation' });
    expect(panel).toHaveTextContent('TYPE: INTERSECTION');
    expect(panel).toHaveTextContent('REFERENCE: BRAVO ↔ G01');
    expect(panel).toHaveTextContent('BRAVO BRG: 090° TRUE / RNG: 60.1 NM');
    expect(panel).toHaveTextContent('G01 BRG: 180° TRUE / RNG: 60.1 NM');
    expect(panel).toHaveTextContent('TARGET: 0.00000, 1.00000');
    expect(panel).toHaveTextContent('CROSSING ANGLE: 90.00°');
    expect(panel).toHaveTextContent('QUALITY: GOOD');
    expect(panel).toHaveTextContent('METHOD: SPHERICAL GREAT CIRCLE');
    expect(panel).toHaveTextContent('EFFECT: MAP PREVIEW ONLY');
    expect(panel).toHaveTextContent('STATUS: SIMULATED');
  });

  it('explains reciprocal, delta, and relative angular calculations', () => {
    const reciprocal = calculateReciprocal(273, 'HEADING');
    const delta = calculateDelta(350, 10, 'HEADING');
    const relative = calculateRelativeBearing(90, 0);

    const { rerender } = render(
      <CommandInterpretationPanel
        parsed={parseCommand('RECIP 273')}
        angularCalculation={reciprocal}
        effect="CALCULATION ONLY"
      />,
    );
    let angularPanel = screen.getByRole('region', { name: 'Command interpretation' });
    expect(angularPanel).toHaveTextContent('COMMAND: RECIP');
    expect(angularPanel).toHaveTextContent('INPUT: HEADING');
    expect(angularPanel).toHaveTextContent('OUTPUT: HEADING');
    expect(angularPanel).toHaveTextContent('RESULT: 093°');

    rerender(
      <CommandInterpretationPanel
        parsed={parseCommand('DELTA 350 010')}
        angularCalculation={delta}
        effect="CALCULATION ONLY"
      />,
    );
    angularPanel = screen.getByRole('region', { name: 'Command interpretation' });
    expect(angularPanel).toHaveTextContent('COMMAND: DELTA');
    expect(angularPanel).toHaveTextContent('DIRECTION: RIGHT');
    expect(angularPanel).toHaveTextContent('DELTA: 20°');

    rerender(
      <CommandInterpretationPanel
        parsed={parseCommand('REL BRAVO')}
        angularCalculation={relative}
        effect="CALCULATION ONLY"
      />,
    );
    angularPanel = screen.getByRole('region', { name: 'Command interpretation' });
    expect(angularPanel).toHaveTextContent('COMMAND: REL');
    expect(angularPanel).toHaveTextContent('OUTPUT: RELATIVE_BEARING');
    expect(angularPanel).toHaveTextContent('RESULT: 090°');
  });

  it('explains a future-position preview without implying a route change', () => {
    const result = projectFuturePosition({
      track: {
        id: 'track-bravo',
        label: 'BRAVO',
        position: { lat: 0, lon: 0 },
        groundTrackDegrees: 90,
        groundSpeedKnots: 120,
        freshness: 'FRESH',
        ageSeconds: 4,
      },
      horizon: { value: 2, unit: 'MIN' },
      nowMs: 10_000,
    });
    if (result.status !== 'AVAILABLE') throw new Error('Expected an available future preview');
    const futurePositionPreview: FuturePositionPreview = {
      type: 'FUTURE_POSITION_PREVIEW',
      trackId: 'track-bravo',
      trackLabel: 'BRAVO',
      groundTrackDegrees: 90,
      groundSpeedKnots: 120,
      result,
    };

    render(
      <CommandInterpretationPanel
        parsed={parseCommand('PREDICT BRAVO +2MIN')}
        futurePositionPreview={futurePositionPreview}
        effect="MAP PREVIEW ONLY"
      />,
    );

    const panel = screen.getByRole('region', { name: 'Command interpretation' });
    expect(panel).toHaveTextContent('TYPE: SEARCH');
    expect(panel).toHaveTextContent('COMMAND: PREDICT');
    expect(panel).toHaveTextContent('GHOST:');
    expect(panel).toHaveTextContent('VECTOR: 90.0°T @ 120.0 KT');
    expect(panel).toHaveTextContent('HORIZON: 2.0 MIN');
    expect(panel).toHaveTextContent('AGE: 4 S');
    expect(panel).toHaveTextContent('ASSUMPTION: CONSTANT GROUND TRACK / GROUND SPEED');
    expect(panel).toHaveTextContent('EFFECT: MAP PREVIEW ONLY');
  });

  it('explains closure and CPA as calculation-only relative motion', () => {
    const result = calculateRelativeMotion({
      reference: {
        id: 'ownship',
        label: 'OWNSHIP',
        position: { lat: 0, lon: 0 },
        groundTrackDegrees: 90,
        groundSpeedKnots: 60,
        freshness: 'FRESH',
      },
      target: {
        id: 'bravo',
        label: 'BRAVO',
        position: { lat: 0, lon: 0.1 },
        groundTrackDegrees: 270,
        groundSpeedKnots: 60,
        freshness: 'FRESH',
      },
    });
    if (result.status !== 'AVAILABLE') throw new Error('Expected an available relative-motion result');
    const relativeMotionPreview: RelativeMotionPreview = {
      type: 'RELATIVE_MOTION_PREVIEW',
      command: 'CPA',
      referenceId: 'ownship',
      referenceLabel: 'OWNSHIP',
      targetId: 'bravo',
      targetLabel: 'BRAVO',
      result,
    };

    render(
      <CommandInterpretationPanel
        parsed={parseCommand('CPA BRAVO')}
        relativeMotionPreview={relativeMotionPreview}
        effect="CALCULATION ONLY"
      />,
    );

    const panel = screen.getByRole('region', { name: 'Command interpretation' });
    expect(panel).toHaveTextContent('TYPE: CALCULATION');
    expect(panel).toHaveTextContent('COMMAND: CPA');
    expect(panel).toHaveTextContent('CLOSURE: 120.0 KT');
    expect(panel).toHaveTextContent('CPA: 0.0 NM');
    expect(panel).toHaveTextContent('TCPA: 3.0 MIN');
    expect(panel).toHaveTextContent('STATUS: FUTURE_CPA');
    expect(panel).toHaveTextContent('ASSUMPTION: CONSTANT VELOCITY');
    expect(panel).toHaveTextContent('EFFECT: CALCULATION ONLY');
  });

  it('shows qualified track details and stale track ordering without fabricating fields', () => {
    const details: TrackDisplayDetails = {
      trackId: 'track-bravo',
      label: 'BRAVO',
      sourceLabel: 'RADAR',
      ageSeconds: 4,
      freshness: 'FRESH',
      quality: 'GOOD',
      uncertaintyMeters: 40,
      classification: 'SUSPECT',
      confidence: 0.7,
    };
    const staleDetails: TrackDisplayDetails[] = [
      { ...details, trackId: 'older', label: 'OLDER', ageSeconds: 120, freshness: 'STALE' },
      { ...details, trackId: 'old', label: 'OLD', ageSeconds: 90, freshness: 'STALE' },
    ];

    const { rerender } = render(
      <CommandInterpretationPanel
        parsed={parseCommand('INFO BRAVO')}
        trackDetails={details}
        effect="LOCAL DISPLAY ONLY"
      />,
    );
    let panel = screen.getByRole('region', { name: 'Command interpretation' });
    expect(panel).toHaveTextContent('COMMAND: INFO');
    expect(panel).toHaveTextContent('SOURCE: RADAR');
    expect(panel).toHaveTextContent('AGE: 4 S');
    expect(panel).toHaveTextContent('FRESHNESS: FRESH');
    expect(panel).toHaveTextContent('QUALITY: GOOD');
    expect(panel).toHaveTextContent('UNCERTAINTY: 40 M');
    expect(panel).toHaveTextContent('CLASSIFICATION: SUSPECT');
    expect(panel).toHaveTextContent('CONFIDENCE: 70%');

    rerender(
      <CommandInterpretationPanel
        parsed={parseCommand('STALE')}
        staleTrackDetails={staleDetails}
        effect="LOCAL DISPLAY ONLY"
      />,
    );
    panel = screen.getByRole('region', { name: 'Command interpretation' });
    expect(panel).toHaveTextContent('COMMAND: STALE');
    expect(panel).toHaveTextContent('COUNT: 2');
    expect(panel).toHaveTextContent('OLDER AGE: 120 S');
    expect(panel).toHaveTextContent('OLD AGE: 90 S');
  });

  it('shows explicit unit conversion results as calculation-only', () => {
    const unitConversionResult: TacticalQuantity = convertTacticalQuantity(
      createTacticalQuantity(5, 'NM'),
      'KM',
    );

    render(
      <CommandInterpretationPanel
        parsed={parseCommand('5NM > KM')}
        unitConversionResult={unitConversionResult}
        effect="CALCULATION ONLY"
      />,
    );

    const panel = screen.getByRole('region', { name: 'Command interpretation' });
    expect(panel).toHaveTextContent('COMMAND: CONVERT');
    expect(panel).toHaveTextContent('VALUE: 9.260 KM');
    expect(panel).toHaveTextContent('DIMENSION: DISTANCE');
    expect(panel).toHaveTextContent('SOURCE VALUE: 5 NM');
    expect(panel).toHaveTextContent('EFFECT: CALCULATION ONLY');
  });
});
