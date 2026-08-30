import { Position } from '../types';

export interface GeoUpdate {
  position: Position;
  accuracyMeters?: number;
  timestamp: number;
}

export interface GeoError {
  code: number;
  message: string;
}

export interface GeolocationProvider {
  watchPosition(
    onSuccess: (update: GeoUpdate) => void,
    onError: (error: GeoError) => void,
  ): number;
  clearWatch(id: number): void;
}

export interface GeolocationAdapter {
  start(onUpdate: (update: GeoUpdate) => void, onError: (error: GeoError) => void): () => void;
}

export const createGeolocationAdapter = (
  provider: GeolocationProvider,
): GeolocationAdapter => ({
  start(onUpdate, onError) {
    const watchId = provider.watchPosition(onUpdate, onError);
    return () => provider.clearWatch(watchId);
  },
});

export const createBrowserGeolocationAdapter = (): GeolocationAdapter => {
  const browserProvider: GeolocationProvider = {
    watchPosition(onSuccess, onError) {
      return navigator.geolocation.watchPosition(
        position => onSuccess({
          position: {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          },
          accuracyMeters: position.coords.accuracy,
          timestamp: position.timestamp,
        }),
        error => onError({ code: error.code, message: error.message }),
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 10000,
        },
      );
    },
    clearWatch(id) {
      navigator.geolocation.clearWatch(id);
    },
  };

  return createGeolocationAdapter(browserProvider);
};
