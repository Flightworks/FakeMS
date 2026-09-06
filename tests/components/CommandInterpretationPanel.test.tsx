import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CommandInterpretationPanel } from '../../components/CommandInterpretationPanel';
import { createProjectionPreview } from '../../domain/designations';
import { parseCommand } from '../../domain/commandParser';

const projection = createProjectionPreview(
  'BRAVO',
  { lat: 34.91682, lon: -120 },
  180,
  5,
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
});
