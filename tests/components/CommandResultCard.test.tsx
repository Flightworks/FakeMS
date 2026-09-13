import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandResultCard } from '../../components/CommandResultCard';
import {
  createAmbiguousCommandResult,
  createAvailableCommandResult,
  createPartialCommandResult,
  displayValue,
  mapCommandReason,
} from '../../domain/commandResults';

describe('CommandResultCard', () => {
  it('shows a unit-bearing primary badge and an honest unavailable-speed reason', () => {
    const result = createPartialCommandResult({
      id: 'eta-bravo',
      kind: 'READ_ONLY',
      references: ['ownship', 'bravo'],
      qualifications: [
        { input: 'SPEED', origin: 'GPS', status: 'MISSING' },
      ],
      capabilities: ['DETAILS'],
      primary: displayValue('ETE', '10', 'MIN'),
      secondary: [displayValue('DISTANCE', '20', 'NM')],
      details: [displayValue('TECHNICAL REASON', 'SPEED_UNAVAILABLE')],
      reason: mapCommandReason('SPEED_UNAVAILABLE'),
    });

    render(<CommandResultCard result={result} />);

    expect(screen.getByTestId('command-result-primary')).toHaveTextContent('10 MIN');
    expect(screen.getByTestId('command-result-state')).toHaveTextContent('PARTIAL');
    expect(screen.getByTestId('command-result-primary')).toHaveClass('rounded');
    expect(screen.getByTestId('command-result-qualification')).toHaveTextContent('GPS');
    expect(screen.getByTestId('command-result-reason')).toHaveTextContent('Vitesse sol absente.');
    expect(screen.getByTestId('command-result-reason')).not.toHaveTextContent('SPEED_UNAVAILABLE');
    expect(screen.queryByText('SPEED_UNAVAILABLE')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copier le résultat' })).not.toBeInTheDocument();
  });

  it('keeps ETE visible when absolute ETA is unavailable and qualifies the source', () => {
    const result = createPartialCommandResult({
      id: 'ete-bravo',
      kind: 'READ_ONLY',
      references: ['ownship', 'bravo'],
      qualifications: [
        { input: 'POSITION', origin: 'GPS', status: 'AVAILABLE' },
        { input: 'CLOCK', origin: 'SCENARIO', status: 'MISSING' },
      ],
      capabilities: ['DETAILS'],
      primary: displayValue('ETE', '10', 'MIN'),
      secondary: [displayValue('ETA', 'UNAVAILABLE', 'UTC')],
      reason: mapCommandReason('SCENARIO_TIME_UNAVAILABLE'),
    });

    render(<CommandResultCard result={result} />);

    expect(screen.getByTestId('command-result-primary')).toHaveTextContent('10 MIN');
    expect(screen.getByTestId('command-result-qualification')).toHaveTextContent('SCÉNARIO');
    expect(screen.getByTestId('command-result-reason')).toHaveTextContent(/Heure de scénario absente|scenario clock is unavailable/i);
    const details = screen.getByText('Détails').closest('details');
    expect(details).not.toHaveAttribute('open');
    expect(screen.getByTestId('command-result-details')).toHaveTextContent('ETA: UNAVAILABLE UTC');
    expect(screen.getByRole('button', { name: 'Détails' })).toBeInTheDocument();
  });

  it('labels an explicit ground-speed input as a hypothesis', () => {
    const result = createAvailableCommandResult({
      id: 'eta-hypothesis',
      kind: 'READ_ONLY',
      references: ['bravo'],
      qualifications: [
        {
          input: 'SPEED',
          origin: 'USER_INPUT',
          status: 'AVAILABLE',
          assumption: 'SPEED HYPOTHESIS',
        },
      ],
      capabilities: ['DETAILS'],
      primary: displayValue('ETA', '12:00', 'UTC'),
    });

    render(<CommandResultCard result={result} />);

    expect(screen.getByTestId('command-result-qualification')).toHaveTextContent('GS HYPOTHÈSE');
  });

  it('lists every ambiguous candidate and does not offer execution', () => {
    const result = createAmbiguousCommandResult({
      id: 'info-hostile',
      kind: 'READ_ONLY',
      references: ['HOSTILE'],
      capabilities: ['DETAILS'],
      candidates: [
        { id: 'hostile-1', label: 'HOSTILE 1' },
        { id: 'hostile-2', label: 'HOSTILE 2' },
      ],
      reason: mapCommandReason('AMBIGUOUS_REFERENCE'),
    });

    render(<CommandResultCard result={result} onExecute={vi.fn()} />);

    const candidates = screen.getByTestId('command-result-candidates');
    expect(candidates).toHaveTextContent('HOSTILE 1 (hostile-1)');
    expect(candidates).toHaveTextContent('HOSTILE 2 (hostile-2)');
    expect(screen.queryByRole('button', { name: /Exécuter|Execute/i })).not.toBeInTheDocument();
  });

  it('exposes copy only for COPY-capable results and reports a missing secure clipboard honestly', async () => {
    const result = createAvailableCommandResult({
      id: 'copyable-result',
      kind: 'READ_ONLY',
      references: ['bravo'],
      capabilities: ['COPY'],
      primary: displayValue('RNG', '5.0', 'NM'),
    });

    render(<CommandResultCard result={result} />);

    const copy = screen.getByRole('button', { name: 'Copier le résultat' });
    fireEvent.click(copy);
    expect(await screen.findByText(/Copie impossible/)).toBeInTheDocument();
  });

  it('keeps long values and details in shrinkable, non-overflowing containers', () => {
    const result = createAvailableCommandResult({
      id: 'long-result',
      kind: 'READ_ONLY',
      references: ['a-very-long-target-reference'],
      capabilities: ['DETAILS'],
      primary: displayValue('POSITION', '43.12345678901234567890, -120.98765432109876543210', 'LAT/LON'),
      details: [displayValue('METHOD', 'A very long method description that must wrap instead of widening the card')],
    });

    render(<CommandResultCard result={result} />);

    const card = screen.getByTestId('command-result-card');
    expect(card).toHaveClass('min-w-0', 'max-w-full', 'overflow-hidden');
    expect(screen.getByTestId('command-result-primary')).toHaveClass('min-w-0', 'max-w-full');
    expect(screen.getByTestId('command-result-primary')).not.toHaveClass('truncate');
    expect(screen.getByTestId('command-result-details')).toHaveClass('overflow-y-auto', 'overflow-x-hidden');
  });

  it('does not render an execute button for an available read-only result', () => {
    const result = createAvailableCommandResult({
      id: 'read-only-result',
      kind: 'READ_ONLY',
      references: ['bravo'],
      capabilities: ['CONFIRM'],
      primary: displayValue('RNG', '5.0', 'NM'),
    });

    render(<CommandResultCard result={result} onExecute={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /Exécuter|Execute/i })).not.toBeInTheDocument();
  });
});
