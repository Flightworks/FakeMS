import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CommandInterpretationPanel } from '../../components/CommandInterpretationPanel';
import { createProjectionPreview } from '../../domain/designations';
import { intersectBearings } from '../../domain/bearingIntersection';
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
});
