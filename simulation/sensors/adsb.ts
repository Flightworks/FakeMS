import { TruthEntity } from '../../domain/classification';
import { SensorReport } from '../../domain/sensors';
import { observeTruthEntity, SensorObservationConfig } from './common';

export const observeWithAdsb = (
  truth: TruthEntity,
  config: SensorObservationConfig,
): SensorReport | undefined => observeTruthEntity(truth, 'ADSB', config, 8);
