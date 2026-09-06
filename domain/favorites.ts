import { canonicalizeCommandInput } from './commandHistory';

export const FAVORITES_SCHEMA_VERSION = 1;
export const MAX_FAVORITES = 50;

export type FavoriteKind = 'COMMAND' | 'TEMPLATE';

export interface Favorite {
  id: number;
  kind: FavoriteKind;
  label: string;
  command: string;
}

export interface FavoriteState {
  version: typeof FAVORITES_SCHEMA_VERSION;
  items: Favorite[];
  nextId: number;
}

export interface FavoriteRequest {
  kind: FavoriteKind;
  label: string;
  command: string;
}

export type FavoriteResult =
  | { status: 'AVAILABLE'; state: FavoriteState; favorite: Favorite }
  | { status: 'UNAVAILABLE'; state: FavoriteState; reason: 'EMPTY' | 'INVALID_CONTENT' | 'DUPLICATE' | 'LIMIT_REACHED' };

const unsafeFavoritePattern = /(?:PASSWORD|PASSWD|SECRET|TOKEN|API[_ -]?KEY|AUTHORIZATION|\b(?:LAT|LON|LATITUDE|LONGITUDE|GPS)\b)/i;

export const createFavoriteState = (): FavoriteState => ({
  version: FAVORITES_SCHEMA_VERSION,
  items: [],
  nextId: 1,
});

const cloneState = (state: FavoriteState): FavoriteState => ({
  version: FAVORITES_SCHEMA_VERSION,
  items: state.items.map(item => ({ ...item })),
  nextId: state.nextId,
});

const isFavoriteKind = (value: unknown): value is FavoriteKind => value === 'COMMAND' || value === 'TEMPLATE';

const isSafeFavoriteText = (value: string): boolean => (
  value.length > 0 && value.length <= 200 && !unsafeFavoritePattern.test(value)
);

export const addFavorite = (state: FavoriteState, request: FavoriteRequest): FavoriteResult => {
  const next = cloneState(state);
  const command = canonicalizeCommandInput(request.command);
  const label = request.label.trim().replace(/\s+/g, ' ');

  if (!isFavoriteKind(request.kind) || !isSafeFavoriteText(command) || !isSafeFavoriteText(label)) {
    return { status: 'UNAVAILABLE', state: next, reason: 'INVALID_CONTENT' };
  }
  if (next.items.length >= MAX_FAVORITES) {
    return { status: 'UNAVAILABLE', state: next, reason: 'LIMIT_REACHED' };
  }
  if (next.items.some(item => item.kind === request.kind && item.command === command)) {
    return { status: 'UNAVAILABLE', state: next, reason: 'DUPLICATE' };
  }

  const favorite: Favorite = {
    id: next.nextId,
    kind: request.kind,
    label,
    command,
  };
  next.nextId += 1;
  next.items.push(favorite);
  return { status: 'AVAILABLE', state: next, favorite: { ...favorite } };
};

export const removeFavorite = (state: FavoriteState, favoriteId: number): FavoriteState => {
  const next = cloneState(state);
  next.items = next.items.filter(item => item.id !== favoriteId);
  return next;
};

const isValidStoredFavorite = (value: unknown): value is Favorite => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return Number.isInteger(candidate.id)
    && (candidate.id as number) > 0
    && isFavoriteKind(candidate.kind)
    && typeof candidate.label === 'string'
    && typeof candidate.command === 'string'
    && isSafeFavoriteText(candidate.label)
    && isSafeFavoriteText(candidate.command)
    && candidate.command === canonicalizeCommandInput(candidate.command);
};

export const loadFavoriteState = (serialized: string | null | undefined): FavoriteState => {
  if (!serialized) return createFavoriteState();
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!parsed || typeof parsed !== 'object') return createFavoriteState();
    const candidate = parsed as Record<string, unknown>;
    if (candidate.version !== FAVORITES_SCHEMA_VERSION || !Array.isArray(candidate.items)) {
      return createFavoriteState();
    }
    const items = candidate.items.filter(isValidStoredFavorite);
    if (items.length !== candidate.items.length || items.length > MAX_FAVORITES) return createFavoriteState();
    const ids = new Set(items.map(item => item.id));
    if (ids.size !== items.length) return createFavoriteState();
    const nextId = Number.isInteger(candidate.nextId) && (candidate.nextId as number) > Math.max(0, ...items.map(item => item.id))
      ? candidate.nextId as number
      : Math.max(0, ...items.map(item => item.id)) + 1;
    return {
      version: FAVORITES_SCHEMA_VERSION,
      items: items.map(item => ({ ...item })),
      nextId,
    };
  } catch {
    return createFavoriteState();
  }
};
