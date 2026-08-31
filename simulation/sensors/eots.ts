import { TruthEntity } from '../../domain/classification';
import { SensorReport } from '../../domain/sensors';
import { observeTruthEntity, SensorObservationConfig } from './common';

export const observeWithEots = (
  truth: TruthEntity,
  config: SensorObservationConfig,
): SensorReport | undefined => observeTruthEntity(truth, 'EOTS', config, 3);
