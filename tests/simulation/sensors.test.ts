import { describe, expect, it } from 'vitest';
import { EntityType } from '../../types';
import { createTruthEntity } from '../../domain/classification';
import { observeWithRadar } from '../../simulation/sensors/radar';
import { observeWithAis } from '../../simulation/sensors/ais';
import { observeWithAdsb } from '../../simulation/sensors/adsb';
import { observeWithEots } from '../../simulation/sensors/eots';

describe('simulation sensors', () => {
  const truth = createTruthEntity({
    id: 'truth-air-1',
    type: EntityType.ENEMY,
    label: 'SCENARIO CONTACT',
    position: { lat: 34, lon: -118 },
    heading: 90,
    speed: 120,
  });

  it('produces a radar observation only when radar is enabled', () => {
    expect(observeWithRadar(truth, { enabled: false, observedAt: 1000 })).toBeUndefined();
    expect(observeWithRadar(truth, { enabled: true, observedAt: 1000 })).toMatchObject({
      trackId: 'truth-air-1',
      sensor: 'RADAR',
      observedAt: 1000,
      position: truth.position,
    });
  });

  it('keeps sensor reports observational and does not copy scenario affiliation', () => {
    const report = observeWithRadar(truth, { enabled: true, observedAt: 1000 });

    expect(report).toBeDefined();
    expect(report).not.toHaveProperty('type');
    expect(report).not.toHaveProperty('affiliation');
  });

  it('uses explicit sensor identities for AIS, ADS-B and EOTS', () => {
    expect(observeWithAis(truth, { enabled: true, observedAt: 1000 })?.sensor).toBe('AIS');
    expect(observeWithAdsb(truth, { enabled: true, observedAt: 1000 })?.sensor).toBe('ADSB');
    expect(observeWithEots(truth, { enabled: true, observedAt: 1000 })?.sensor).toBe('EOTS');
  });
});
