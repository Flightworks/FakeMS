import { TruthEntity } from '../../domain/classification';
import { SensorReport } from '../../domain/sensors';
import { observeTruthEntity, SensorObservationConfig } from './common';

export const observeWithAis = (
  truth: TruthEntity,
  config: SensorObservationConfig,
): SensorReport | undefined => observeTruthEntity(truth, 'AIS', config, 15);
