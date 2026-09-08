import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CommandInterpretationPanel } from '../../components/CommandInterpretationPanel';
import { parseCommand } from '../../domain/commandParser';
import {
  calculateFromBullseye,
  createBullseye,
  createBullseyeProjectionPreview,
  type BullseyeEntity,
} from '../../domain/bullseye';

const bravo: BullseyeEntity = {
  id: 'wp-2',
  label: 'BRAVO',
  position: { lat: 48, lon: 2.25 },
};

const hostile: BullseyeEntity = {
  id: 'en-1',
  label: 'HOSTILE 1',
  position: { lat: 48, lon: 1.75 },
};

describe('Bullseye command interpretation', () => {
  it('displays a Bullseye BRG/RNG measurement as a local simulated result', () => {
    const parsed = parseCommand('BULL HOSTILE 1');
    const measurement = calculateFromBullseye(createBullseye(bravo), hostile);

    render(
      <CommandInterpretationPanel
        parsed={parsed}
        bullseyeMeasurement={measurement}
        effect="LOCAL READ ONLY"
      />,
    );

    const panel = screen.getByTestId('command-interpretation');
    expect(panel).toHaveTextContent('BRG:');
    expect(panel).toHaveTextContent('RNG:');
    expect(panel).toHaveTextContent('QUALIFICATION: CALCULATED');
    expect(panel).not.toHaveTextContent('STATUS: SIMULATED');
  });

  it('displays a Bullseye projection target and method without implying navigation', () => {
    const parsed = parseCommand('BULL 270/15');
    const projection = createBullseyeProjectionPreview(createBullseye(bravo), 270, 15);

    render(
      <CommandInterpretationPanel
        parsed={parsed}
        bullseyeProjection={projection}
        effect="MAP PREVIEW ONLY"
      />,
    );

    const panel = screen.getByTestId('command-interpretation');
    expect(panel).toHaveTextContent('BEARING: 270° TRUE');
    expect(panel).toHaveTextContent('RANGE: 15.0 NM');
    expect(panel).toHaveTextContent('METHOD: SPHERICAL DIRECT');
    expect(panel).not.toHaveTextContent('DCT');
  });
});
