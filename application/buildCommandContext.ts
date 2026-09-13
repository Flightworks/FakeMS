import type { CommandContext } from '../utils/CommandRegistry';
import { MapMode, StabMode, type Entity, type Position } from '../types';
import {
  CONTEXT_ACTION_IDS,
  type ContextActionContextKind,
  type ContextActionTargetType,
} from '../domain/contextActions';

/** Immutable payload emitted by the contextual radial menu. */
export interface ContextActionRequest {
  readonly actionId: string;
  readonly context: ContextActionContextKind;
  readonly targetId?: string;
  readonly targetLabel?: string;
  readonly targetType?: ContextActionTargetType;
  readonly position: Position;
}

export interface ContextActionHandlers {
  focusMapAt?: (position: Position) => void;
  onResetStab?: () => void;
  setMapMode?: (mode: MapMode) => void;
  toggleVectors?: () => void;
  toggleGrid?: () => void;
  toggleDeclutter?: () => void;
  consult?: (request: ContextActionRequest) => void;
  toggleSimulation?: () => void;
  setStabMode?: (mode: StabMode) => void;
  toggleTrailVisibility?: (targetId: string, label: string) => void;
  requestClearTrail?: (targetId: string, label: string) => void;
  previewFuturePosition?: (request: ContextActionRequest) => void;
  selectEntity?: (targetId: string) => void;
  proposeDirectTo?: (target: Pick<Entity, 'id' | 'label' | 'position'>) => void;
  proposeSetBullseye?: (target: Pick<Entity, 'id' | 'label' | 'position'>) => void;
}

export type ContextActionDispatchResult =
  | { status: 'HANDLED'; actionId: string }
  | {
      status: 'UNAVAILABLE';
      actionId: string;
      reason: ContextActionUnavailableReason;
    };

type ContextActionUnavailableReason =
  | 'MISSING_HANDLER'
  | 'MISSING_TARGET'
  | 'INVALID_CONTEXT'
  | 'UNSUPPORTED_ACTION';

const copyPosition = (position: Position): Position => ({
  lat: position.lat,
  lon: position.lon,
});

const copyRequest = (request: ContextActionRequest): ContextActionRequest => ({
  ...request,
  position: copyPosition(request.position),
});

const handled = (actionId: string): ContextActionDispatchResult => ({
  status: 'HANDLED',
  actionId,
});

const unavailable = (
  actionId: string,
  reason: ContextActionUnavailableReason,
): ContextActionDispatchResult => ({ status: 'UNAVAILABLE', actionId, reason });

const hasContext = (
  request: ContextActionRequest,
  expected: ContextActionContextKind,
): boolean => request.context === expected;

const targetFromRequest = (
  request: ContextActionRequest,
): Pick<Entity, 'id' | 'label' | 'position'> | undefined => {
  if (!request.targetId || !request.targetLabel) return undefined;
  return {
    id: request.targetId,
    label: request.targetLabel,
    position: copyPosition(request.position),
  };
};

const dispatchWith = (
  request: ContextActionRequest,
  callback: (() => void) | undefined,
): ContextActionDispatchResult => {
  if (!callback) return unavailable(request.actionId, 'MISSING_HANDLER');
  callback();
  return handled(request.actionId);
};

/**
 * Dispatch one stable catalogue id to the application's typed effects.
 *
 * The request is copied at this boundary. A radial action therefore cannot
 * observe a later React entity mutation or hand a mutable position to an
 * application callback. Unsupported ids deliberately return UNAVAILABLE
 * rather than becoming silent no-ops.
 */
export const dispatchContextAction = (
  request: ContextActionRequest,
  handlers: ContextActionHandlers,
): ContextActionDispatchResult => {
  const captured = copyRequest(request);
  const target = targetFromRequest(captured);
  const needsTarget = (): ContextActionDispatchResult | undefined => (
    target ? undefined : unavailable(captured.actionId, 'MISSING_TARGET')
  );
  const consult = (): ContextActionDispatchResult => dispatchWith(
    captured,
    handlers.consult ? () => handlers.consult?.(captured) : undefined,
  );
  const select = (): ContextActionDispatchResult => {
    const missing = needsTarget();
    if (missing) return missing;
    return dispatchWith(
      captured,
      handlers.selectEntity && captured.targetId
        ? () => handlers.selectEntity?.(captured.targetId as string)
        : undefined,
    );
  };
  const directTo = (): ContextActionDispatchResult => {
    const missing = needsTarget();
    if (missing) return missing;
    return dispatchWith(
      captured,
      handlers.proposeDirectTo && target
        ? () => handlers.proposeDirectTo?.(target)
        : undefined,
    );
  };
  const setBullseye = (): ContextActionDispatchResult => {
    const missing = needsTarget();
    if (missing) return missing;
    return dispatchWith(
      captured,
      handlers.proposeSetBullseye && target
        ? () => handlers.proposeSetBullseye?.(target)
        : undefined,
    );
  };

  switch (captured.actionId) {
    case CONTEXT_ACTION_IDS.MAP.CENTER_HERE:
      return hasContext(captured, 'MAP')
        ? dispatchWith(captured, handlers.focusMapAt ? () => handlers.focusMapAt?.(copyPosition(captured.position)) : undefined)
        : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.MAP.RECENTER_OWNSHIP:
      return hasContext(captured, 'MAP')
        ? dispatchWith(captured, handlers.onResetStab)
        : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.MAP.NORTH_UP:
      return hasContext(captured, 'MAP')
        ? dispatchWith(captured, handlers.setMapMode ? () => handlers.setMapMode?.(MapMode.NORTH_UP) : undefined)
        : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.MAP.HEADING_UP:
      return hasContext(captured, 'MAP')
        ? dispatchWith(captured, handlers.setMapMode ? () => handlers.setMapMode?.(MapMode.HEADING_UP) : undefined)
        : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.MAP.VECTORS:
      return hasContext(captured, 'MAP')
        ? dispatchWith(captured, handlers.toggleVectors)
        : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.MAP.GRID:
      return hasContext(captured, 'MAP')
        ? dispatchWith(captured, handlers.toggleGrid)
        : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.MAP.DECLUTTER:
      return hasContext(captured, 'MAP')
        ? dispatchWith(captured, handlers.toggleDeclutter)
        : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.MAP.FROM_OWNSHIP:
    case CONTEXT_ACTION_IDS.MAP.COORDINATES:
      return hasContext(captured, 'MAP')
        ? consult()
        : unavailable(captured.actionId, 'INVALID_CONTEXT');

    case CONTEXT_ACTION_IDS.OWNSHIP.HEADING_SPEED:
    case CONTEXT_ACTION_IDS.OWNSHIP.ACTIVE_ROUTE:
    case CONTEXT_ACTION_IDS.OWNSHIP.NAVIGATION_SOURCE:
    case CONTEXT_ACTION_IDS.OWNSHIP.KINEMATICS:
      return hasContext(captured, 'OWNSHIP') ? select() : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.OWNSHIP.PAUSE_RESUME:
      return hasContext(captured, 'OWNSHIP')
        ? dispatchWith(captured, handlers.toggleSimulation)
        : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.OWNSHIP.FOLLOW:
    case CONTEXT_ACTION_IDS.OWNSHIP.RECENTER:
      return hasContext(captured, 'OWNSHIP')
        ? dispatchWith(captured, handlers.onResetStab)
        : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.OWNSHIP.GROUND_ANCHOR:
      return hasContext(captured, 'OWNSHIP')
        ? dispatchWith(captured, handlers.setStabMode ? () => handlers.setStabMode?.(StabMode.GND) : undefined)
        : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.OWNSHIP.TRAIL_VISIBILITY:
      return hasContext(captured, 'OWNSHIP') && target
        ? dispatchWith(captured, handlers.toggleTrailVisibility
          ? () => handlers.toggleTrailVisibility?.(target.id, target.label)
          : undefined)
        : unavailable(captured.actionId, hasContext(captured, 'OWNSHIP') ? 'MISSING_TARGET' : 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.OWNSHIP.CLEAR_TRAIL:
      return hasContext(captured, 'OWNSHIP') && target
        ? dispatchWith(captured, handlers.requestClearTrail
          ? () => handlers.requestClearTrail?.(target.id, target.label)
          : undefined)
        : unavailable(captured.actionId, hasContext(captured, 'OWNSHIP') ? 'MISSING_TARGET' : 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.OWNSHIP.FUTURE_POSITION:
      return hasContext(captured, 'OWNSHIP')
        ? dispatchWith(captured, handlers.previewFuturePosition
          ? () => handlers.previewFuturePosition?.(captured)
          : undefined)
        : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.OWNSHIP.DATA:
      return hasContext(captured, 'OWNSHIP') ? select() : unavailable(captured.actionId, 'INVALID_CONTEXT');

    case CONTEXT_ACTION_IDS.WAYPOINT.DIRECT_SIM:
      return hasContext(captured, 'WAYPOINT') ? directTo() : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.WAYPOINT.BRG_RNG:
    case CONTEXT_ACTION_IDS.WAYPOINT.ETA_ETE:
    case CONTEXT_ACTION_IDS.WAYPOINT.COORDINATES:
      return hasContext(captured, 'WAYPOINT') ? consult() : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.WAYPOINT.PROJECTION:
      return hasContext(captured, 'WAYPOINT')
        ? dispatchWith(captured, handlers.previewFuturePosition
          ? () => handlers.previewFuturePosition?.(captured)
          : undefined)
        : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.WAYPOINT.CENTER:
      return hasContext(captured, 'WAYPOINT')
        ? dispatchWith(captured, handlers.focusMapAt && target
          ? () => handlers.focusMapAt?.(target.position)
          : undefined)
        : unavailable(captured.actionId, 'INVALID_CONTEXT');

    case CONTEXT_ACTION_IDS.TRACK.INFO:
    case CONTEXT_ACTION_IDS.TRACK.AGE:
    case CONTEXT_ACTION_IDS.TRACK.QUALITY:
      return hasContext(captured, 'TRACK') ? select() : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.TRACK.BRG_RNG:
      return hasContext(captured, 'TRACK') ? consult() : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.TRACK.CENTER:
      return hasContext(captured, 'TRACK')
        ? dispatchWith(captured, handlers.focusMapAt && target
          ? () => handlers.focusMapAt?.(target.position)
          : undefined)
        : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.TRACK.TRAIL:
      return hasContext(captured, 'TRACK') && target
        ? dispatchWith(captured, handlers.toggleTrailVisibility
          ? () => handlers.toggleTrailVisibility?.(target.id, target.label)
          : undefined)
        : unavailable(captured.actionId, hasContext(captured, 'TRACK') ? 'MISSING_TARGET' : 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.TRACK.FUTURE_POSITION:
      return hasContext(captured, 'TRACK')
        ? dispatchWith(captured, handlers.previewFuturePosition
          ? () => handlers.previewFuturePosition?.(captured)
          : undefined)
        : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.TRACK.BULLSEYE:
      return hasContext(captured, 'TRACK') ? setBullseye() : unavailable(captured.actionId, 'INVALID_CONTEXT');

    case CONTEXT_ACTION_IDS.BASE.IDENTITY_COORDINATES:
    case CONTEXT_ACTION_IDS.BASE.SCENARIO_DATA:
      return hasContext(captured, 'BASE') ? select() : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.BASE.DIRECT_SIM:
      return hasContext(captured, 'BASE') ? directTo() : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.BASE.ETA_ETE:
    case CONTEXT_ACTION_IDS.BASE.BRG_RNG:
      return hasContext(captured, 'BASE') ? consult() : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.BASE.PROJECTION:
      return hasContext(captured, 'BASE')
        ? dispatchWith(captured, handlers.previewFuturePosition
          ? () => handlers.previewFuturePosition?.(captured)
          : undefined)
        : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.BASE.CENTER:
      return hasContext(captured, 'BASE')
        ? dispatchWith(captured, handlers.focusMapAt && target
          ? () => handlers.focusMapAt?.(target.position)
          : undefined)
        : unavailable(captured.actionId, 'INVALID_CONTEXT');
    case CONTEXT_ACTION_IDS.BASE.BULLSEYE:
      return hasContext(captured, 'BASE') ? setBullseye() : unavailable(captured.actionId, 'INVALID_CONTEXT');
    default:
      return unavailable(captured.actionId, 'UNSUPPORTED_ACTION');
  }
};

export const executeContextAction = dispatchContextAction;

/**
 * Values in a command context are plain scenario data or callbacks. Cloning
 * the data prevents a command option from observing a later React state
 * mutation while leaving callbacks bound to the owning application state.
 */
const cloneContextValue = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(item => cloneContextValue(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneContextValue(child)]),
    ) as T;
  }
  return value;
};

export type CommandContextOverrides = Partial<CommandContext>;
export type CommandContextFactory = (
  overrides?: CommandContextOverrides,
) => CommandContext;

/**
 * Build the one context contract consumed by command resolution.
 *
 * The input is deliberately the typed CommandContext rather than an
 * untyped setter bag. State is copied recursively so palette/drop consumers
 * receive an isolated snapshot, while callback identity is preserved. The
 * exported factory provides the typed entry-point boundary for callers that
 * need to overlay local state.
 */
export const buildCommandContext = (input: CommandContext): CommandContext => (
  cloneContextValue(input)
);

/**
 * Create a context factory for entry points that add local UI state (for
 * example palette history/favorites) to the same application snapshot.
 */
export const createCommandContextFactory = (
  input: CommandContext,
): CommandContextFactory => {
  const baseContext = buildCommandContext(input);
  return (overrides = {}) => buildCommandContext({
    ...baseContext,
    ...overrides,
  });
};
