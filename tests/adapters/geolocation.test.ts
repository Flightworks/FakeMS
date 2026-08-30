import { describe, expect, it, vi } from 'vitest';
import { createGeolocationAdapter, GeoError, GeoUpdate } from '../../adapters/geolocation';

describe('geolocation adapter', () => {
  it('subscribes to browser updates and can be stopped', () => {
    let success: ((value: GeoUpdate) => void) | undefined;
    const provider = {
      watchPosition: vi.fn((onSuccess: (value: GeoUpdate) => void) => {
        success = onSuccess;
        return 42;
      }),
      clearWatch: vi.fn(),
    };
    const onUpdate = vi.fn();
    const onError = vi.fn();
    const adapter = createGeolocationAdapter(provider);

    const stop = adapter.start(onUpdate, onError);
    success?.({ position: { lat: 48.1, lon: 2.2 }, accuracyMeters: 8, timestamp: 2000 });
    stop();

    expect(provider.watchPosition).toHaveBeenCalledOnce();
    expect(onUpdate).toHaveBeenCalledWith({
      position: { lat: 48.1, lon: 2.2 },
      accuracyMeters: 8,
      timestamp: 2000,
    });
    expect(provider.clearWatch).toHaveBeenCalledWith(42);
  });

  it('forwards provider errors without inventing a position', () => {
    let error: ((value: GeoError) => void) | undefined;
    const provider = {
      watchPosition: vi.fn((_success: unknown, onError: (value: GeoError) => void) => {
        error = onError;
        return 7;
      }),
      clearWatch: vi.fn(),
    };
    const onUpdate = vi.fn();
    const onError = vi.fn();
    const stop = createGeolocationAdapter(provider).start(onUpdate, onError);

    error?.({ code: 1, message: 'permission denied' });
    stop();

    expect(onUpdate).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith({ code: 1, message: 'permission denied' });
    expect(provider.clearWatch).toHaveBeenCalledWith(7);
  });
});
