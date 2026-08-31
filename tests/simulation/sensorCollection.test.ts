import { describe, expect, it } from 'vitest';
import { EntityType, SystemStatus } from '../../types';
import { createTruthEntity } from '../../domain/classification';
import { collectSensorReports } from '../../simulation/sensors';

describe('sensor report collection', () => {
  it('collects only reports from enabled sensor systems', () => {
    const truth = [createTruthEntity({
      id: 'air-1',
      type: EntityType.ENEMY,
      label: 'CONTACT',
      position: { lat: 34, lon: -118 },
    })];
    const systems: SystemStatus = { radar: true, adsb: true, ais: false, eots: false };

    const reports = collectSensorReports(truth, systems, 2_000);

    expect(reports.map(report => report.sensor)).toEqual(['RADAR', 'ADSB']);
    expect(reports.every(report => report.observedAt === 2_000)).toBe(true);
  });
});
