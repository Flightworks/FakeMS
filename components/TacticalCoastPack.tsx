import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, Pane } from 'react-leaflet';
import type { FeatureCollection, LineString } from 'geojson';
import { loadTacticalGeoJson, loadTacticalJson } from './tacticalMapData';
import {
  beginCoastLayerLoad,
  coastSelectionKey,
  commitCoastLayerLoad,
  createCoastLayerState,
  DEFAULT_COAST_CACHE_POLICY,
  DEFAULT_COAST_PACK_ZOOM_POLICY,
  normalizeCoastGeoJson,
  normalizeCoastManifest,
  normalizeCoastCachePolicy,
  rejectCoastLayerLoad,
  selectCoastAssets,
  type CoastAsset,
  type CoastBBox,
  type CoastCachePolicy,
  type CoastCenter,
  type CoastLayerState,
  type CoastManifest,
  type CoastZoomPolicy,
  type CoastView,
} from '../domain/coastPack';

export const TOULON_COAST_PACK_MANIFEST_URL = `${import.meta.env.BASE_URL}maps/toulon/manifest.json`;

export const TACTICAL_COAST_PACK_STYLE = {
  color: '#64748b',
  opacity: 0.72,
  weight: 1.15,
  fill: false,
  fillOpacity: 0,
} as const;

export interface CoastLoadTiming {
  kind: 'manifest' | 'selection';
  durationMs: number;
  assetIds: readonly string[];
}

export interface TacticalCoastPackProps {
  manifestUrl?: string;
  center: CoastCenter;
  viewport?: CoastBBox;
  zoom: number;
  debounceMs?: number;
  zoomPolicy?: CoastZoomPolicy;
  cachePolicy?: Partial<CoastCachePolicy>;
  onLoadTiming?: (timing: CoastLoadTiming) => void;
}

interface LoadedCoastAsset {
  asset: CoastAsset;
  data: FeatureCollection<LineString>;
}

type ManifestState =
  | { status: 'pending' }
  | { status: 'ready'; manifest: CoastManifest }
  | { status: 'error'; error: unknown };

const isLocalResourceUrl = (url: string): boolean => (
  Boolean(url)
  && !url.startsWith('//')
  && url !== '..'
  && !url.startsWith('../')
  && !url.includes('\\')
  && !/^[a-z][a-z\d+.-]*:/i.test(url)
);

const resolveLocalAssetUrl = (manifestUrl: string, assetPath: string): string => {
  const slash = manifestUrl.lastIndexOf('/');
  return `${slash >= 0 ? manifestUrl.slice(0, slash + 1) : ''}${assetPath}`;
};

const normalizeCenter = (center: CoastCenter): CoastCenter => ({
  lat: center.lat,
  lon: center.lon,
});

const countFeatures = (assets: readonly LoadedCoastAsset[]): number => (
  assets.reduce((total, loaded) => total + loaded.data.features.length, 0)
);

const cacheEntryKey = (asset: CoastAsset, manifestUrl: string): string => (
  `${manifestUrl}::${asset.path}`
);

const loadedAssetByteCount = (loaded: LoadedCoastAsset): number => (
  loaded.asset.byteCount ?? JSON.stringify(loaded.data).length
);

const rememberLoadedAsset = (
  cache: Map<string, LoadedCoastAsset>,
  key: string,
  loaded: LoadedCoastAsset,
  policy: CoastCachePolicy,
): void => {
  if (loaded.data.features.length > policy.maxFeatures || loadedAssetByteCount(loaded) > policy.maxBytes) return;
  cache.delete(key);
  cache.set(key, loaded);
  const totalSize = (): { features: number; bytes: number } => [...cache.values()].reduce(
    (totals, entry) => ({
      features: totals.features + entry.data.features.length,
      bytes: totals.bytes + loadedAssetByteCount(entry),
    }),
    { features: 0, bytes: 0 },
  );
  while (cache.size > policy.maxEntries || totalSize().features > policy.maxFeatures || totalSize().bytes > policy.maxBytes) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    cache.delete(oldest);
  }
};

export const TacticalCoastPack: React.FC<TacticalCoastPackProps> = ({
  manifestUrl = TOULON_COAST_PACK_MANIFEST_URL,
  center,
  viewport,
  zoom,
  debounceMs = DEFAULT_COAST_CACHE_POLICY.debounceMs,
  zoomPolicy = DEFAULT_COAST_PACK_ZOOM_POLICY,
  cachePolicy,
  onLoadTiming,
}) => {
  const effectiveCachePolicy = normalizeCoastCachePolicy(cachePolicy);
  const onLoadTimingRef = useRef(onLoadTiming);
  onLoadTimingRef.current = onLoadTiming;
  const [manifestState, setManifestState] = useState<ManifestState>({ status: 'pending' });
  const [layerState, setLayerState] = useState<CoastLayerState<LoadedCoastAsset>>(
    () => createCoastLayerState<LoadedCoastAsset>(),
  );
  const [lastLoadDurationMs, setLastLoadDurationMs] = useState<number | null>(null);
  const requestGenerationRef = useRef(0);
  const lastSelectionKeyRef = useRef<string | null>(null);
  const loadedAssetCacheRef = useRef(new Map<string, LoadedCoastAsset>());
  const pendingAssetRequestsRef = useRef(new Map<string, Promise<LoadedCoastAsset>>());

  useEffect(() => {
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    lastSelectionKeyRef.current = null;
    let cancelled = false;
    setManifestState({ status: 'pending' });
    setLayerState(previous => beginCoastLayerLoad(previous, []));
    setLastLoadDurationMs(null);

    if (!isLocalResourceUrl(manifestUrl)) {
      setManifestState({ status: 'error', error: new Error('Coastal pack manifest must be local') });
      setLayerState(previous => rejectCoastLayerLoad(previous, new Error('Coastal pack manifest must be local')));
      return () => {
        cancelled = true;
      };
    }

    const startedAt = performance.now();
    loadTacticalJson(manifestUrl, normalizeCoastManifest, {
      maxEntries: effectiveCachePolicy.maxEntries,
    }).then(manifest => {
      if (cancelled || requestGenerationRef.current !== generation) return;
      setManifestState({ status: 'ready', manifest });
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
      setLastLoadDurationMs(durationMs);
      onLoadTimingRef.current?.({ kind: 'manifest', durationMs, assetIds: [] });
    }).catch(error => {
      if (cancelled || requestGenerationRef.current !== generation) return;
      setManifestState({ status: 'error', error });
      setLayerState(previous => rejectCoastLayerLoad(previous, error));
    });

    return () => {
      cancelled = true;
    };
  }, [effectiveCachePolicy.maxEntries, manifestUrl]);

  const currentCenter = useMemo(
    () => normalizeCenter({ lat: center.lat, lon: center.lon }),
    [center.lat, center.lon],
  );
  const view = useMemo<CoastView>(() => ({
    center: currentCenter,
    ...(viewport ? { bbox: [...viewport] as CoastBBox } : {}),
    zoom,
  }), [currentCenter, viewport, zoom]);

  const viewKey = useMemo(() => JSON.stringify({
    center: view.center,
    bbox: view.bbox,
    zoom: view.zoom,
  }), [view]);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [stableView, setStableView] = useState<CoastView | null>(null);

  useEffect(() => {
    const delay = Math.max(0, Math.floor(debounceMs));
    const timer = setTimeout(() => {
      const nextView = viewRef.current;
      setStableView({
        center: { ...nextView.center },
        ...(nextView.bbox ? { bbox: [...nextView.bbox] as CoastBBox } : {}),
        zoom: nextView.zoom,
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [debounceMs, viewKey]);

  const readyManifest = manifestState.status === 'ready' ? manifestState.manifest : null;
  const requestedAssets = useMemo(() => (
    readyManifest && stableView
      ? selectCoastAssets(readyManifest, stableView, zoomPolicy)
      : []
  ), [readyManifest, stableView, zoomPolicy]);
  const requestedSelectionKey = useMemo(() => (
    readyManifest ? `${readyManifest.packVersion}:${coastSelectionKey(requestedAssets)}` : null
  ), [readyManifest, requestedAssets]);

  useEffect(() => {
    if (!readyManifest || !stableView || requestedSelectionKey === null) return;
    if (lastSelectionKeyRef.current === requestedSelectionKey) return;
    lastSelectionKeyRef.current = requestedSelectionKey;
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    let cancelled = false;

    if (requestedAssets.length === 0) {
      setLayerState(previous => commitCoastLayerLoad(previous, [], []));
      return () => {
        cancelled = true;
      };
    }

    setLayerState(previous => beginCoastLayerLoad(previous, requestedAssets));
    const startedAt = performance.now();
    const loadAsset = (asset: CoastAsset): Promise<LoadedCoastAsset> => {
      const url = resolveLocalAssetUrl(manifestUrl, asset.path);
      const key = cacheEntryKey(asset, manifestUrl);
      const cached = loadedAssetCacheRef.current.get(key);
      if (cached) return Promise.resolve(cached);
      const pending = pendingAssetRequestsRef.current.get(key);
      if (pending) return pending;

      const request = loadTacticalGeoJson(url, {
        maxEntries: effectiveCachePolicy.maxEntries,
      }).then(data => {
        const loaded: LoadedCoastAsset = {
          asset,
          data: normalizeCoastGeoJson(data, asset.bbox),
        };
        rememberLoadedAsset(loadedAssetCacheRef.current, key, loaded, effectiveCachePolicy);
        return loaded;
      }).finally(() => {
        pendingAssetRequestsRef.current.delete(key);
      });
      pendingAssetRequestsRef.current.set(key, request);
      return request;
    };

    const loadInBoundedBatches = async (): Promise<LoadedCoastAsset[]> => {
      const results = new Array<LoadedCoastAsset>(requestedAssets.length);
      let nextIndex = 0;
      const workerCount = Math.min(2, requestedAssets.length);
      await Promise.all(Array.from({ length: workerCount }, async () => {
        while (nextIndex < requestedAssets.length) {
          const index = nextIndex;
          nextIndex += 1;
          results[index] = await loadAsset(requestedAssets[index]);
        }
      }));
      return results;
    };

    loadInBoundedBatches().then(loaded => {
      if (cancelled || requestGenerationRef.current !== generation) return;
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
      setLayerState(previous => commitCoastLayerLoad(previous, loaded, requestedAssets));
      setLastLoadDurationMs(durationMs);
      onLoadTimingRef.current?.({
        kind: 'selection',
        durationMs,
        assetIds: requestedAssets.map(asset => asset.id),
      });
    }).catch(error => {
      if (cancelled || requestGenerationRef.current !== generation) return;
      setLayerState(previous => rejectCoastLayerLoad(previous, error));
    });

    return () => {
      cancelled = true;
    };
  }, [
    effectiveCachePolicy.maxEntries,
    manifestUrl,
    readyManifest,
    requestedAssets,
    requestedSelectionKey,
    stableView,
    zoomPolicy,
  ]);

  const displayPhase = manifestState.status === 'pending' && layerState.phase !== 'loaded'
    ? 'pending'
    : layerState.phase;
  const activeAssets = layerState.active;
  const activeSectorIds = activeAssets.map(loaded => loaded.asset.id);
  const pendingSectorIds = layerState.requested.map(asset => asset.id);
  const featureCount = countFeatures(activeAssets);
  const activeSectorIdsAttribute = activeSectorIds.join(',');
  const pendingSectorIdsAttribute = pendingSectorIds.join(',');
  const viewportAttribute = viewport?.join(',');
  const centerAttribute = `${center.lat},${center.lon}`;
  const errorText = layerState.error
    ?? (manifestState.status === 'error' ? String(manifestState.error) : undefined);

  const writeCoastAttributes = (element: HTMLElement): void => {
    const attributes: Record<string, string | undefined> = {
      'data-coast-state': displayPhase,
      'data-coast-sector-ids': activeSectorIdsAttribute,
      'data-coast-pending-sector-ids': pendingSectorIdsAttribute,
      'data-coast-feature-count': String(featureCount),
      'data-coast-zoom': String(zoom),
      'data-coast-center': centerAttribute,
      'data-coast-viewport': viewportAttribute,
      'data-coast-load-ms': lastLoadDurationMs === null ? undefined : String(lastLoadDurationMs),
      'data-coast-error': errorText,
    };
    Object.entries(attributes).forEach(([name, value]) => {
      if (value === undefined) element.removeAttribute(name);
      else element.setAttribute(name, value);
    });
  };
  const stateElementRef = (element: HTMLDivElement | null): void => {
    if (!element) return;
    writeCoastAttributes(element);
    if (element.parentElement) writeCoastAttributes(element.parentElement);
  };

  return (
    <Pane
      name="tacticalCoastPackLayer"
      className="tactical-coast-pack-pane tactical-coast-pack"
      style={{ zIndex: 220, pointerEvents: 'none' }}
    >
      <div
        ref={stateElementRef}
        className={`tactical-coast-pack-state tactical-coast-pack-state--${displayPhase}`}
        style={{ pointerEvents: 'none' }}
        data-coast-state={displayPhase}
        data-coast-sector-ids={activeSectorIdsAttribute}
        data-coast-pending-sector-ids={pendingSectorIdsAttribute}
        data-coast-feature-count={String(featureCount)}
        data-coast-zoom={String(zoom)}
        data-coast-center={centerAttribute}
        data-coast-viewport={viewportAttribute}
        data-coast-load-ms={lastLoadDurationMs === null ? undefined : String(lastLoadDurationMs)}
        data-coast-error={errorText}
      >
        {activeAssets.map(loaded => (
          <div
            key={loaded.asset.id}
            className="tactical-coast-sector"
            data-coast-sector-id={loaded.asset.id}
            data-coast-sector={loaded.asset.sector}
            data-coast-sector-feature-count={String(loaded.data.features.length)}
          >
            <GeoJSON
              data={loaded.data}
              pane="tacticalCoastPackLayer"
              interactive={false}
              style={TACTICAL_COAST_PACK_STYLE}
            />
          </div>
        ))}
      </div>
    </Pane>
  );
};

export default TacticalCoastPack;
