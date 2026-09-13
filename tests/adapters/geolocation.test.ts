import { describe, expect, it, vi } from 'vitest';
import {
  createBrowserGeolocationAdapter,
  createGeolocationAdapter,
  GeoError,
  GeoUpdate,
} from '../../adapters/geolocation';

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

  it('maps optional browser speed and heading into a GPS update', () => {
    let success: PositionCallback | undefined;
    const geolocation = {
      watchPosition: vi.fn((onSuccess: PositionCallback) => {
        success = onSuccess;
        return 9;
      }),
      clearWatch: vi.fn(),
    };
    vi.stubGlobal('navigator', { geolocation });
    const onUpdate = vi.fn();
    const stop = createBrowserGeolocationAdapter().start(onUpdate, vi.fn());

    success?.({
      coords: {
        latitude: 48.1,
        longitude: 2.2,
        accuracy: 8,
        altitude: null,
        altitudeAccuracy: null,
        heading: 90,
        speed: 12,
      },
      timestamp: 2000,
    } as GeolocationPosition);
    stop();
    vi.unstubAllGlobals();

    expect(onUpdate).toHaveBeenCalledWith({
      position: { lat: 48.1, lon: 2.2 },
      accuracyMeters: 8,
      timestamp: 2000,
      speedMetersPerSecond: 12,
      headingDegrees: 90,
    });
  });
});
