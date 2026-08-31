import { TruthEntity } from '../../domain/classification';
import { SensorReport } from '../../domain/sensors';
import { observeTruthEntity, SensorObservationConfig } from './common';

export const observeWithRadar = (
  truth: TruthEntity,
  config: SensorObservationConfig,
): SensorReport | undefined => observeTruthEntity(truth, 'RADAR', config, 40);
