import type { SystemStatus } from '../../types';
import type { TruthEntity } from '../../domain/classification';
import type { SensorReport } from '../../domain/sensors';
import { observeWithAdsb } from './adsb';
import { observeWithAis } from './ais';
import { observeWithEots } from './eots';
import { observeWithRadar } from './radar';

export const collectSensorReports = (
  truthEntities: TruthEntity[],
  systems: SystemStatus,
  observedAt: number,
): SensorReport[] => truthEntities.flatMap(truth => [
  observeWithRadar(truth, { enabled: systems.radar, observedAt }),
  observeWithAis(truth, { enabled: systems.ais, observedAt }),
  observeWithAdsb(truth, { enabled: systems.adsb, observedAt }),
  observeWithEots(truth, { enabled: systems.eots, observedAt }),
].filter((report): report is SensorReport => report !== undefined));
