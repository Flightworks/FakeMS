import { TruthEntity } from '../../domain/classification';
import { SensorQuality, SensorReport, SensorType } from '../../domain/sensors';

export interface SensorObservationConfig {
  enabled: boolean;
  observedAt: number;
  accuracyMeters?: number;
  quality?: SensorQuality;
}

export const observeTruthEntity = (
  truth: TruthEntity,
  sensor: SensorType,
  config: SensorObservationConfig,
  defaultAccuracyMeters: number,
): SensorReport | undefined => {
  if (!config.enabled) return undefined;

  return {
    id: `${sensor.toLowerCase()}-${truth.id}-${config.observedAt}`,
    trackId: truth.id,
    sensor,
    position: { ...truth.position },
    observedAt: config.observedAt,
    accuracyMeters: config.accuracyMeters ?? defaultAccuracyMeters,
    quality: config.quality ?? 'GOOD',
    heading: truth.heading,
    speed: truth.speed,
  };
};
