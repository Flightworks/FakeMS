import { Track, TrackFreshness } from './mission';

export const clampConfidence = (value: number): number => Math.min(1, Math.max(0, value));

export const ageSeconds = (track: Track, now: number): number =>
  Math.max(0, (now - track.lastSeenAt) / 1000);

export const classifyTrackAge = (
  track: Track,
  now: number,
  staleAfterSeconds: number,
): TrackFreshness => ageSeconds(track, now) > staleAfterSeconds ? 'STALE' : 'FRESH';
