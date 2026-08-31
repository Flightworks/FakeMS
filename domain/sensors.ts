import { Position } from '../types';

export type SensorType = 'RADAR' | 'AIS' | 'ADSB' | 'EOTS';
export type SensorQuality = 'GOOD' | 'DEGRADED' | 'LOST';

export interface SensorReport {
  id: string;
  trackId: string;
  sensor: SensorType;
  position: Position;
  observedAt: number;
  accuracyMeters: number;
  quality: SensorQuality;
  heading?: number;
  speed?: number;
}
