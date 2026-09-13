import type { Feature, FeatureCollection, LineString } from 'geojson';

export const COAST_PACK_SCHEMA = 'fakems.coastal-pack' as const;
export const COAST_PACK_SCHEMA_VERSION = 1 as const;

export type CoastBBox = readonly [west: number, south: number, east: number, north: number];

export interface CoastCenter {
  lat: number;
  lon: number;
}

export interface CoastView {
  center: CoastCenter;
  bbox?: CoastBBox;
  zoom: number;
}

export interface CoastAsset {
  id: string;
  path: string;
  sector: string;
  lod: string;
  bbox: CoastBBox;
  featureCount?: number;
  vertexCount?: number;
  byteCount?: number;
  minZoom?: number;
  maxZoom?: number;
}

export interface CoastManifest {
  schema: typeof COAST_PACK_SCHEMA;
  schemaVersion: typeof COAST_PACK_SCHEMA_VERSION;
  packVersion: string;
  generatedAt: string;
  crs: string;
  bbox: CoastBBox;
  assets: readonly CoastAsset[];
}

export interface CoastZoomPolicy {
  minZoom: number;
  maxZoom: number;
  lodMinZoom: Readonly<Record<string, number>>;
}

export const DEFAULT_COAST_PACK_ZOOM_POLICY: CoastZoomPolicy = Object.freeze({
  // Low/coarse assets may opt in below the full-detail threshold.
  minZoom: 4,
  maxZoom: 18,
  lodMinZoom: Object.freeze({
    low: 4,
    coarse: 5,
    medium: 6,
    detail: 7,
    full: 8,
  }),
});

// Alias kept short for callers that do not need the pack-prefixed name.
export const COAST_PACK_ZOOM_POLICY = DEFAULT_COAST_PACK_ZOOM_POLICY;

export interface CoastCachePolicy {
  maxEntries: number;
  maxFeatures: number;
  maxBytes: number;
  debounceMs: number;
}

export const DEFAULT_COAST_CACHE_POLICY: CoastCachePolicy = Object.freeze({
  maxEntries: 4,
  maxFeatures: 1_500,
  maxBytes: 4 * 1024 * 1024,
  debounceMs: 120,
});

export const COAST_PACK_CACHE_POLICY = DEFAULT_COAST_CACHE_POLICY;

export const normalizeCoastCachePolicy = (
  overrides: Partial<CoastCachePolicy> = {},
): CoastCachePolicy => Object.freeze({
  maxEntries: Number.isFinite(overrides.maxEntries) && (overrides.maxEntries ?? 0) >= 1
    ? Math.floor(overrides.maxEntries as number)
    : DEFAULT_COAST_CACHE_POLICY.maxEntries,
  maxFeatures: Number.isFinite(overrides.maxFeatures) && (overrides.maxFeatures ?? 0) >= 1
    ? Math.floor(overrides.maxFeatures as number)
    : DEFAULT_COAST_CACHE_POLICY.maxFeatures,
  maxBytes: Number.isFinite(overrides.maxBytes) && (overrides.maxBytes ?? 0) >= 1
    ? Math.floor(overrides.maxBytes as number)
    : DEFAULT_COAST_CACHE_POLICY.maxBytes,
  debounceMs: Number.isFinite(overrides.debounceMs)
    ? Math.max(0, Math.floor(overrides.debounceMs as number))
    : DEFAULT_COAST_CACHE_POLICY.debounceMs,
});

export type CoastLayerPhase = 'fallback' | 'pending' | 'loaded';

export interface CoastLayerState<T> {
  phase: CoastLayerPhase;
  active: readonly T[];
  requested: readonly CoastAsset[];
  error?: string;
}

export interface CoastCacheRecord {
  key: string;
  featureCount: number;
  byteCount: number;
  lastUsed: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

const isFiniteInteger = (value: unknown): value is number => (
  isFiniteNumber(value) && Number.isInteger(value)
);

const isWgs84 = (value: unknown): boolean => {
  if (typeof value === 'string') {
    return new Set([
      'wgs84',
      'crs84',
      'epsg:4326',
      'urn:ogc:def:crs:ogc:1.3:crs84',
      'urn:ogc:def:crs:epsg::4326',
    ]).has(value.trim().toLowerCase());
  }
  if (!isRecord(value) || !isRecord(value.properties)) return false;
  return isWgs84(value.properties.name);
};

export const isCoastBBox = (value: unknown): value is CoastBBox => (
  Array.isArray(value)
  && value.length === 4
  && value.every(isFiniteNumber)
  && value[0] >= -180
  && value[0] < value[2]
  && value[2] <= 180
  && value[1] >= -90
  && value[1] < value[3]
  && value[3] <= 90
);

const isViewBBox = (value: unknown): value is CoastBBox => (
  Array.isArray(value)
  && value.length === 4
  && value.every(isFiniteNumber)
  && value[0] >= -180
  && value[0] <= value[2]
  && value[2] <= 180
  && value[1] >= -90
  && value[1] <= value[3]
  && value[3] <= 90
);

export const bboxContains = (outer: CoastBBox, inner: CoastBBox): boolean => (
  outer[0] <= inner[0]
  && outer[1] <= inner[1]
  && outer[2] >= inner[2]
  && outer[3] >= inner[3]
);

export const bboxIntersects = (first: CoastBBox, second: CoastBBox): boolean => (
  first[0] <= second[2]
  && first[2] >= second[0]
  && first[1] <= second[3]
  && first[3] >= second[1]
);

const pathIsLocalRelative = (value: string): boolean => {
  if (!value || value.includes('\\') || value.startsWith('/') || value.startsWith('//')) return false;
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return false;
  const parts = value.split('/');
  return parts.every(part => part !== '' && part !== '.' && part !== '..');
};

const optionalCountError = (value: unknown, label: string): string | null => (
  value === undefined
    ? null
    : isFiniteInteger(value) && value >= 0
      ? null
      : `${label} must be a non-negative integer`
);

const optionalZoomError = (value: unknown, label: string): string | null => (
  value === undefined
    ? null
    : isFiniteNumber(value) && value >= 0 && value <= 30
      ? null
      : `${label} must be a finite zoom between 0 and 30`
);

const assetMinimumZoom = (asset: CoastAsset, policy: CoastZoomPolicy): number => (
  asset.minZoom ?? policy.lodMinZoom[asset.lod.toLowerCase()] ?? policy.minZoom
);

const compareText = (first: string, second: string): number => (
  first < second ? -1 : first > second ? 1 : 0
);

export const compareCoastAssets = (first: CoastAsset, second: CoastAsset): number => (
  first.bbox[0] - second.bbox[0]
  || first.bbox[1] - second.bbox[1]
  || first.bbox[2] - second.bbox[2]
  || first.bbox[3] - second.bbox[3]
  || compareText(first.sector, second.sector)
  || compareText(first.id, second.id)
  || compareText(first.path, second.path)
);

export const validateCoastManifest = (value: unknown): string[] => {
  const errors: string[] = [];
  if (!isRecord(value)) return ['manifest must be a JSON object'];

  if (value.schema !== COAST_PACK_SCHEMA) errors.push(`manifest schema must be ${COAST_PACK_SCHEMA}`);
  if (value.schema_version !== COAST_PACK_SCHEMA_VERSION && value.schemaVersion !== COAST_PACK_SCHEMA_VERSION) {
    errors.push(`manifest schema_version must be ${COAST_PACK_SCHEMA_VERSION}`);
  }
  if (typeof value.pack_version !== 'string' || !value.pack_version.trim()) {
    errors.push('manifest pack_version must be a non-empty string');
  }
  if (typeof value.generated_at !== 'string' || !value.generated_at.trim()) {
    errors.push('manifest generated_at must be a non-empty string');
  }
  if (!isWgs84(value.crs)) errors.push('manifest crs must be WGS84');
  if (!isCoastBBox(value.bbox)) errors.push('manifest bbox must be an ordered WGS84 bbox');

  const assets = value.assets;
  if (!Array.isArray(assets) || assets.length === 0) {
    errors.push('manifest assets must be a non-empty array');
    return errors;
  }

  const manifestBBox = isCoastBBox(value.bbox) ? value.bbox : null;
  const ids = new Set<string>();
  const paths = new Set<string>();
  assets.forEach((rawAsset, index) => {
    const label = `asset ${index}`;
    if (!isRecord(rawAsset)) {
      errors.push(`${label} must be an object`);
      return;
    }

    for (const field of ['id', 'path', 'sector', 'lod']) {
      if (typeof rawAsset[field] !== 'string' || !rawAsset[field].trim()) {
        errors.push(`${label} ${field} must be a non-empty string`);
      }
    }

    const id = typeof rawAsset.id === 'string' ? rawAsset.id : null;
    const path = typeof rawAsset.path === 'string' ? rawAsset.path : null;
    if (id && ids.has(id)) errors.push(`${label} id is duplicated: ${id}`);
    if (id) ids.add(id);
    if (path && !pathIsLocalRelative(path)) errors.push(`${label} path must be a local relative path`);
    if (path && paths.has(path)) errors.push(`${label} path is duplicated: ${path}`);
    if (path) paths.add(path);

    if (!isCoastBBox(rawAsset.bbox)) {
      errors.push(`${label} bbox must be an ordered WGS84 bbox`);
    } else if (manifestBBox && !bboxContains(manifestBBox, rawAsset.bbox)) {
      errors.push(`${label} bbox must be contained by the manifest bbox`);
    }

    const featureCountError = optionalCountError(rawAsset.features ?? rawAsset.feature_count, `${label} feature count`);
    const vertexCountError = optionalCountError(rawAsset.vertices ?? rawAsset.vertex_count, `${label} vertex count`);
    const byteCountError = optionalCountError(rawAsset.bytes ?? rawAsset.byte_count, `${label} byte count`);
    if (featureCountError) errors.push(featureCountError);
    if (vertexCountError) errors.push(vertexCountError);
    if (byteCountError) errors.push(byteCountError);
    for (const [plural, singular] of [['features', 'feature_count'], ['vertices', 'vertex_count'], ['bytes', 'byte_count']] as const) {
      if (rawAsset[plural] !== undefined && rawAsset[singular] !== undefined && rawAsset[plural] !== rawAsset[singular]) {
        errors.push(`${label} ${plural} and ${singular} must match`);
      }
    }

    const minZoomError = optionalZoomError(rawAsset.min_zoom ?? rawAsset.minZoom, `${label} min_zoom`);
    const maxZoomError = optionalZoomError(rawAsset.max_zoom ?? rawAsset.maxZoom, `${label} max_zoom`);
    if (minZoomError) errors.push(minZoomError);
    if (maxZoomError) errors.push(maxZoomError);

    const minZoom = rawAsset.min_zoom ?? rawAsset.minZoom;
    const maxZoom = rawAsset.max_zoom ?? rawAsset.maxZoom;
    if (isFiniteNumber(minZoom) && isFiniteNumber(maxZoom) && minZoom > maxZoom) {
      errors.push(`${label} min_zoom must not exceed max_zoom`);
    }
  });

  return errors;
};

export class CoastManifestValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid coastal pack manifest: ${issues.join('; ')}`);
    this.name = 'CoastManifestValidationError';
    this.issues = [...issues];
  }
}

export const normalizeCoastManifest = (value: unknown): CoastManifest => {
  const errors = validateCoastManifest(value);
  if (errors.length > 0 || !isRecord(value) || !Array.isArray(value.assets) || !isCoastBBox(value.bbox)) {
    throw new CoastManifestValidationError(errors.length > 0 ? errors : ['manifest is malformed']);
  }

  const assets = value.assets.map(rawAsset => {
    const record = rawAsset as Record<string, unknown>;
    const featureCount = record.features ?? record.feature_count;
    const vertexCount = record.vertices ?? record.vertex_count;
    const byteCount = record.bytes ?? record.byte_count;
    const minZoom = record.min_zoom ?? record.minZoom;
    const maxZoom = record.max_zoom ?? record.maxZoom;
    return Object.freeze({
      id: record.id as string,
      path: record.path as string,
      sector: record.sector as string,
      lod: record.lod as string,
      bbox: Object.freeze([...(record.bbox as CoastBBox)]) as CoastBBox,
      ...(isFiniteInteger(featureCount) ? { featureCount } : {}),
      ...(isFiniteInteger(vertexCount) ? { vertexCount } : {}),
      ...(isFiniteInteger(byteCount) ? { byteCount } : {}),
      ...(isFiniteNumber(minZoom) ? { minZoom } : {}),
      ...(isFiniteNumber(maxZoom) ? { maxZoom } : {}),
    }) as CoastAsset;
  }).sort(compareCoastAssets);

  return Object.freeze({
    schema: COAST_PACK_SCHEMA,
    schemaVersion: COAST_PACK_SCHEMA_VERSION,
    packVersion: value.pack_version as string,
    generatedAt: value.generated_at as string,
    crs: typeof value.crs === 'string' ? value.crs : 'WGS84',
    bbox: Object.freeze([...value.bbox]) as CoastBBox,
    assets: Object.freeze(assets),
  });
};

export const parseCoastManifest = normalizeCoastManifest;

export const isValidCoastManifest = (value: unknown): boolean => {
  return validateCoastManifest(value).length === 0;
};

const geoJsonCrsIsValid = (value: Record<string, unknown>): boolean => (
  value.crs === undefined || isWgs84(value.crs)
);

export const validateCoastGeoJson = (value: unknown, expectedBBox?: CoastBBox): string[] => {
  const errors: string[] = [];
  if (!isRecord(value) || value.type !== 'FeatureCollection') {
    return ['coast asset must be a GeoJSON FeatureCollection'];
  }
  if (!geoJsonCrsIsValid(value)) errors.push('coast asset crs must be WGS84');
  if (value.bbox !== undefined && !isCoastBBox(value.bbox)) errors.push('coast asset bbox must be an ordered WGS84 bbox');
  if (expectedBBox && isCoastBBox(value.bbox) && !bboxContains(expectedBBox, value.bbox)) {
    errors.push('coast asset bbox must be contained by its manifest asset bbox');
  }

  const features = value.features;
  if (!Array.isArray(features) || features.length === 0) {
    errors.push('coast asset must contain at least one feature');
    return errors;
  }
  features.forEach((rawFeature, featureIndex) => {
    const label = `coast feature ${featureIndex}`;
    if (!isRecord(rawFeature) || rawFeature.type !== 'Feature') {
      errors.push(`${label} must be a GeoJSON Feature`);
      return;
    }
    if (!('properties' in rawFeature)) errors.push(`${label} must include properties`);
    const geometry = rawFeature.geometry;
    if (!isRecord(geometry) || geometry.type !== 'LineString') {
      errors.push(`${label} geometry must be a LineString`);
      return;
    }
    const coordinates = geometry.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      errors.push(`${label} LineString must contain at least two coordinates`);
      return;
    }
    coordinates.forEach((coordinate, coordinateIndex) => {
      if (!Array.isArray(coordinate) || coordinate.length !== 2 || !coordinate.every(isFiniteNumber)) {
        errors.push(`${label} coordinate ${coordinateIndex} must be [longitude, latitude]`);
        return;
      }
      const [longitude, latitude] = coordinate;
      if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        errors.push(`${label} coordinate ${coordinateIndex} is outside WGS84 ranges`);
      }
      if (expectedBBox && (
        longitude < expectedBBox[0]
        || longitude > expectedBBox[2]
        || latitude < expectedBBox[1]
        || latitude > expectedBBox[3]
      )) {
        errors.push(`${label} coordinate ${coordinateIndex} is outside its asset bbox`);
      }
    });
  });
  return errors;
};

export class CoastGeoJsonValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid coastal GeoJSON: ${issues.join('; ')}`);
    this.name = 'CoastGeoJsonValidationError';
    this.issues = [...issues];
  }
}

export const normalizeCoastGeoJson = (
  value: unknown,
  expectedBBox?: CoastBBox,
): FeatureCollection<LineString> => {
  const errors = validateCoastGeoJson(value, expectedBBox);
  if (errors.length > 0) throw new CoastGeoJsonValidationError(errors);
  return value as FeatureCollection<LineString>;
};

export const validateCoastAssetGeoJson = normalizeCoastGeoJson;

export const isCoastZoomQualified = (
  zoom: number,
  policy: CoastZoomPolicy = DEFAULT_COAST_PACK_ZOOM_POLICY,
): boolean => (
  isFiniteNumber(zoom) && zoom >= policy.minZoom && zoom <= policy.maxZoom
);

const isCoastView = (value: CoastView | CoastBBox): value is CoastView => !Array.isArray(value);

const viewBounds = (view: CoastView | CoastBBox, center?: CoastCenter): CoastBBox | null => {
  if (!isCoastView(view)) return isViewBBox(view) ? view : null;
  if (isViewBBox(view.bbox)) return view.bbox;
  if (center && isFiniteNumber(center.lat) && isFiniteNumber(center.lon)) {
    return [center.lon, center.lat, center.lon, center.lat];
  }
  if (isFiniteNumber(view.center?.lat) && isFiniteNumber(view.center?.lon)) {
    return [view.center.lon, view.center.lat, view.center.lon, view.center.lat];
  }
  return null;
};

export function selectCoastAssets(
  manifest: CoastManifest,
  view: CoastView,
  policy?: CoastZoomPolicy,
): CoastAsset[];
export function selectCoastAssets(
  manifest: CoastManifest,
  bbox: CoastBBox,
  zoom: number,
  policy?: CoastZoomPolicy,
): CoastAsset[];
export function selectCoastAssets(
  manifest: CoastManifest,
  viewOrBbox: CoastView | CoastBBox,
  zoomOrPolicy?: number | CoastZoomPolicy,
  optionalPolicy?: CoastZoomPolicy,
): CoastAsset[] {
  const policy = typeof zoomOrPolicy === 'object' && zoomOrPolicy
    ? zoomOrPolicy
    : optionalPolicy ?? DEFAULT_COAST_PACK_ZOOM_POLICY;
  const zoom = isCoastView(viewOrBbox)
    ? viewOrBbox.zoom
    : (typeof zoomOrPolicy === 'number' ? zoomOrPolicy : Number.NaN);
  const bounds = viewBounds(viewOrBbox);
  if (!bounds || !isCoastZoomQualified(zoom, policy)) return [];

  return manifest.assets
    .filter(asset => {
      const minimumZoom = assetMinimumZoom(asset, policy);
      const maximumZoom = asset.maxZoom ?? policy.maxZoom;
      return zoom >= minimumZoom && zoom <= maximumZoom && bboxIntersects(asset.bbox, bounds);
    })
    .slice()
    .sort(compareCoastAssets);
}

export const selectCoastSectors = selectCoastAssets;

export const coastSelectionKey = (assets: readonly CoastAsset[]): string => (
  assets.map(asset => `${asset.id}:${asset.path}`).join('|')
);

export const createCoastLayerState = <T>(active: readonly T[] = []): CoastLayerState<T> => ({
  phase: active.length > 0 ? 'loaded' : 'fallback',
  active: [...active],
  requested: [],
});

export const beginCoastLayerLoad = <T>(
  previous: CoastLayerState<T>,
  requested: readonly CoastAsset[],
): CoastLayerState<T> => ({
  phase: 'pending',
  // Retain the previously validated geometry while replacement data loads.
  active: previous.active,
  requested: [...requested],
  ...(previous.error ? { error: undefined } : {}),
});

export const commitCoastLayerLoad = <T>(
  _previous: CoastLayerState<T>,
  active: readonly T[],
  _requested: readonly CoastAsset[],
): CoastLayerState<T> => ({
  phase: active.length > 0 ? 'loaded' : 'fallback',
  active: [...active],
  requested: [],
});

export const rejectCoastLayerLoad = <T>(
  previous: CoastLayerState<T>,
  error: unknown,
): CoastLayerState<T> => ({
  phase: previous.active.length > 0 ? 'loaded' : 'fallback',
  active: previous.active,
  requested: [],
  error: error instanceof Error ? error.message : String(error),
});

export const boundCoastCache = <T extends CoastCacheRecord>(
  entries: readonly T[],
  policy: CoastCachePolicy = DEFAULT_COAST_CACHE_POLICY,
): T[] => {
  const deduplicated = new Map<string, T>();
  for (const entry of entries) {
    const existing = deduplicated.get(entry.key);
    if (!existing || entry.lastUsed >= existing.lastUsed) deduplicated.set(entry.key, entry);
  }
  const ordered = [...deduplicated.values()].sort((first, second) => (
    second.lastUsed - first.lastUsed || compareText(first.key, second.key)
  ));
  const kept: T[] = [];
  let featureCount = 0;
  let byteCount = 0;
  for (const entry of ordered) {
    if (kept.length >= policy.maxEntries) break;
    if (featureCount + entry.featureCount > policy.maxFeatures) continue;
    if (byteCount + entry.byteCount > policy.maxBytes) continue;
    kept.push(entry);
    featureCount += entry.featureCount;
    byteCount += entry.byteCount;
  }
  return kept;
};

export type CoastLineFeature = Feature<LineString>;
