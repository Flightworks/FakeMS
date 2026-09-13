import { EntityType, type Position } from '../types';

export type ContextActionContextKind = 'MAP' | 'OWNSHIP' | 'WAYPOINT' | 'TRACK' | 'BASE';
export type ContextActionContext = ContextActionContextKind;
export type ContextActionTargetType = EntityType | 'TRACK';

/** The small, immutable snapshot captured when a contextual menu opens. */
export interface ContextActionTarget {
  id: string;
  label: string;
  position: Position;
  type?: ContextActionTargetType;
  metadata?: Readonly<Record<string, string | number>>;
}

/**
 * Input accepted by the catalogue. `target` is preferred for object contexts;
 * `entity` and the scalar fields keep the boundary convenient for callers that
 * already have a map event payload.
 */
export interface ContextActionInput {
  context: ContextActionContextKind;
  position?: Position;
  target?: ContextActionTarget;
  entity?: ContextActionTarget;
  targetId?: string;
  targetLabel?: string;
  targetType?: ContextActionTargetType;
  activeActionIds?: readonly string[];
  disabledActionIds?: readonly string[];
}

export type ContextActionCategory =
  | 'VIEW'
  | 'DISPLAY'
  | 'MEASURE'
  | 'CREATE'
  | 'NAV_SIM'
  | 'STABILIZE'
  | 'TRAIL'
  | 'DATA'
  | 'DIRECT_SIM'
  | 'POINT'
  | 'ROUTE'
  | 'TRACKING'
  | 'DESIGNATE'
  | 'JOIN';

export type ContextActionCapability =
  | 'VIEW'
  | 'RECENTER'
  | 'ORIENTATION'
  | 'LAYER'
  | 'GRID'
  | 'DECLUTTER'
  | 'MEASURE'
  | 'COORDINATES'
  | 'NAVIGATION'
  | 'STABILIZE'
  | 'TRAIL'
  | 'FUTURE_POSITION'
  | 'DATA'
  | 'DIRECT_TO'
  | 'ROUTE_DRAFT'
  | 'INFO'
  | 'AGE'
  | 'QUALITY'
  | 'CPA'
  | 'DESIGNATION'
  | 'BULLSEYE'
  | 'NOT_IMPLEMENTED';

export type ContextActionEffectKind =
  | 'GROUP'
  | 'READ_ONLY'
  | 'MAP_VIEW'
  | 'MAP_PREVIEW'
  | 'LOCAL_ACTION'
  | 'EDITOR'
  | 'NOT_IMPLEMENTED';

export type ContextActionConfirmationPolicy = 'NONE' | 'REQUIRED';
export type ContextActionAvailability = 'AVAILABLE' | 'UNAVAILABLE';
export type ContextActionImplementation = 'SUPPORTED' | 'NOT_IMPLEMENTED';
export type ContextActionNodeKind = 'FAMILY' | 'ACTION';
export type ContextActionDepth = 0 | 1;

export type ContextActionUnavailableReason =
  | 'NOT_IMPLEMENTED'
  | 'DISABLED_BY_CONTEXT'
  | 'NO_AVAILABLE_ACTIONS'
  | 'MISSING_CONTEXT_TARGET'
  | 'INVALID_CONTEXT_POSITION'
  | 'CONTEXT_TYPE_MISMATCH'
  | 'DECORATIVE_AIRPORT'
  | 'INVALID_CONTEXT';

export const CONTEXT_ACTION_IDS = {
  MAP: {
    VIEW: 'MAP:VIEW',
    CENTER_HERE: 'MAP:VIEW:CENTER_HERE',
    RECENTER_OWNSHIP: 'MAP:VIEW:RECENTER_OWNSHIP',
    NORTH_UP: 'MAP:VIEW:NORTH_UP',
    HEADING_UP: 'MAP:VIEW:HEADING_UP',
    DISPLAY: 'MAP:DISPLAY',
    VECTORS: 'MAP:DISPLAY:VECTORS',
    LABELS: 'MAP:DISPLAY:LABELS',
    GRID: 'MAP:DISPLAY:GRID',
    DECLUTTER: 'MAP:DISPLAY:DECLUTTER',
    MEASURE: 'MAP:MEASURE',
    FROM_OWNSHIP: 'MAP:MEASURE:FROM_OWNSHIP',
    CHOOSE_ORIGIN: 'MAP:MEASURE:CHOOSE_ORIGIN',
    COORDINATES: 'MAP:MEASURE:COORDINATES',
    CREATE: 'MAP:CREATE',
    LOCAL_REFERENCE: 'MAP:CREATE:LOCAL_REFERENCE',
    LOCAL_WAYPOINT: 'MAP:CREATE:LOCAL_WAYPOINT',
  },
  OWNSHIP: {
    NAV_SIM: 'OWNSHIP:NAV_SIM',
    HEADING_SPEED: 'OWNSHIP:NAV_SIM:HEADING_SPEED',
    PAUSE_RESUME: 'OWNSHIP:NAV_SIM:PAUSE_RESUME',
    ACTIVE_ROUTE: 'OWNSHIP:NAV_SIM:ACTIVE_ROUTE',
    STABILIZE: 'OWNSHIP:STABILIZE',
    FOLLOW: 'OWNSHIP:STABILIZE:FOLLOW',
    GROUND_ANCHOR: 'OWNSHIP:STABILIZE:GROUND_ANCHOR',
    RECENTER: 'OWNSHIP:STABILIZE:RECENTER',
    TRAIL: 'OWNSHIP:TRAIL',
    TRAIL_VISIBILITY: 'OWNSHIP:TRAIL:VISIBILITY',
    FUTURE_POSITION: 'OWNSHIP:TRAIL:FUTURE_POSITION',
    CLEAR_TRAIL: 'OWNSHIP:TRAIL:CLEAR',
    DATA: 'OWNSHIP:DATA',
    NAVIGATION_SOURCE: 'OWNSHIP:DATA:NAVIGATION_SOURCE',
    KINEMATICS: 'OWNSHIP:DATA:KINEMATICS',
  },
  WAYPOINT: {
    DIRECT_SIM: 'WAYPOINT:DIRECT_SIM:DCT',
    MEASURE: 'WAYPOINT:MEASURE',
    BRG_RNG: 'WAYPOINT:MEASURE:BRG_RNG',
    ETA_ETE: 'WAYPOINT:MEASURE:ETA_ETE',
    PROJECTION: 'WAYPOINT:MEASURE:PROJECTION',
    POINT: 'WAYPOINT:POINT',
    CENTER: 'WAYPOINT:POINT:CENTER',
    COORDINATES: 'WAYPOINT:POINT:COORDINATES',
    ROUTE: 'WAYPOINT:ROUTE',
    ADD_TO_DRAFT: 'WAYPOINT:ROUTE:ADD_TO_DRAFT',
    PLAN_POSITION: 'WAYPOINT:ROUTE:PLAN_POSITION',
  },
  TRACK: {
    DATA: 'TRACK:DATA',
    INFO: 'TRACK:DATA:INFO',
    AGE: 'TRACK:DATA:AGE',
    QUALITY: 'TRACK:DATA:QUALITY',
    MEASURE: 'TRACK:MEASURE',
    BRG_RNG: 'TRACK:MEASURE:BRG_RNG',
    CPA: 'TRACK:MEASURE:CPA',
    CLOSURE: 'TRACK:MEASURE:CLOSURE',
    TRACKING: 'TRACK:TRACKING',
    CENTER: 'TRACK:TRACKING:CENTER',
    TRAIL: 'TRACK:TRACKING:TRAIL',
    FUTURE_POSITION: 'TRACK:TRACKING:FUTURE_POSITION',
    DESIGNATE: 'TRACK:DESIGNATE',
    LOCAL_REFERENCE: 'TRACK:DESIGNATE:LOCAL_REFERENCE',
    BULLSEYE: 'TRACK:DESIGNATE:BULLSEYE',
  },
  BASE: {
    DATA: 'BASE:DATA',
    IDENTITY_COORDINATES: 'BASE:DATA:IDENTITY_COORDINATES',
    SCENARIO_DATA: 'BASE:DATA:SCENARIO_DATA',
    JOIN: 'BASE:JOIN',
    DIRECT_SIM: 'BASE:JOIN:DIRECT_SIM',
    ETA_ETE: 'BASE:JOIN:ETA_ETE',
    MEASURE: 'BASE:MEASURE',
    BRG_RNG: 'BASE:MEASURE:BRG_RNG',
    PROJECTION: 'BASE:MEASURE:PROJECTION',
    VIEW: 'BASE:VIEW',
    CENTER: 'BASE:VIEW:CENTER',
    BULLSEYE: 'BASE:VIEW:BULLSEYE',
  },
} as const;

interface ContextActionNodeBase {
  id: string;
  label: string;
  family: ContextActionCategory;
  category: ContextActionCategory;
  targetId?: string;
  /** A copied lat/lon snapshot, never the caller's Position object. */
  position?: Position;
  depth: ContextActionDepth;
  kind: ContextActionNodeKind;
  available: boolean;
  availability: ContextActionAvailability;
  status: ContextActionAvailability;
  disabledReason?: ContextActionUnavailableReason;
  /** Alias kept explicit for consumers that model disabled state as `reason`. */
  reason?: ContextActionUnavailableReason;
  active: boolean;
  confirmation: ContextActionConfirmationPolicy;
  requiresConfirmation: boolean;
  capability: ContextActionCapability;
  effectKind: ContextActionEffectKind;
  implementation: ContextActionImplementation;
}

export interface ContextActionLeaf extends ContextActionNodeBase {
  kind: 'ACTION';
}

export interface ContextActionFamily extends ContextActionNodeBase {
  kind: 'FAMILY';
  depth: 0;
  children: readonly ContextActionLeaf[];
}

export type ContextActionRoot = ContextActionFamily | ContextActionLeaf;
export type ContextActionNode = ContextActionRoot;
export type ContextAction = ContextActionLeaf;

export interface ContextActionTree {
  context: ContextActionContextKind;
  contextLabel: string;
  accepted: boolean;
  available: boolean;
  rejectionReason?: ContextActionUnavailableReason;
  targetId?: string;
  /** A copied context position, never the caller's Position object. */
  position?: Position;
  /** Canonical root list. A root is a family or a direct leaf. */
  roots: readonly ContextActionRoot[];
  /** Alias for `roots`, convenient for tree consumers. */
  children: readonly ContextActionRoot[];
  /** Alias for `roots`, convenient for radial consumers. */
  nodes: readonly ContextActionRoot[];
  families: readonly ContextActionFamily[];
  /** All leaves, including disabled leaves in the complete catalogue. */
  actions: readonly ContextActionLeaf[];
  leaves: readonly ContextActionLeaf[];
  directActions: readonly ContextActionLeaf[];
}

interface LeafDefinition {
  id: string;
  label: string;
  family: ContextActionCategory;
  capability: ContextActionCapability;
  effectKind: ContextActionEffectKind;
  confirmation?: ContextActionConfirmationPolicy;
  implementation?: ContextActionImplementation;
}

interface FamilyDefinition {
  id: string;
  label: string;
  category: ContextActionCategory;
  capability: ContextActionCapability;
  leaves: readonly LeafDefinition[];
}

interface ContextDefinition {
  label: string;
  families: readonly FamilyDefinition[];
  directActions?: readonly LeafDefinition[];
}

const supported = (
  id: string,
  label: string,
  family: ContextActionCategory,
  capability: ContextActionCapability,
  effectKind: ContextActionEffectKind,
  confirmation: ContextActionConfirmationPolicy = 'NONE',
): LeafDefinition => ({ id, label, family, capability, effectKind, confirmation });

const planned = (
  id: string,
  label: string,
  family: ContextActionCategory,
  capability: ContextActionCapability,
  confirmation: ContextActionConfirmationPolicy = 'NONE',
): LeafDefinition => ({
  id,
  label,
  family,
  capability,
  effectKind: 'NOT_IMPLEMENTED',
  confirmation,
  implementation: 'NOT_IMPLEMENTED',
});

const family = (
  id: string,
  label: string,
  category: ContextActionCategory,
  capability: ContextActionCapability,
  leaves: readonly LeafDefinition[],
): FamilyDefinition => ({ id, label, category, capability, leaves });

const CONTEXT_DEFINITIONS: Readonly<Record<ContextActionContextKind, ContextDefinition>> = {
  MAP: {
    label: 'Fond',
    families: [
      family(CONTEXT_ACTION_IDS.MAP.VIEW, 'Vue', 'VIEW', 'VIEW', [
        supported(CONTEXT_ACTION_IDS.MAP.CENTER_HERE, 'Centrer ici', 'VIEW', 'VIEW', 'MAP_VIEW'),
        supported(CONTEXT_ACTION_IDS.MAP.RECENTER_OWNSHIP, 'Recentrer l’ownship', 'VIEW', 'RECENTER', 'MAP_VIEW'),
        supported(CONTEXT_ACTION_IDS.MAP.NORTH_UP, 'Nord en haut', 'VIEW', 'ORIENTATION', 'MAP_VIEW'),
        supported(CONTEXT_ACTION_IDS.MAP.HEADING_UP, 'Cap en haut', 'VIEW', 'ORIENTATION', 'MAP_VIEW'),
      ]),
      family(CONTEXT_ACTION_IDS.MAP.DISPLAY, 'Affichage', 'DISPLAY', 'VIEW', [
        supported(CONTEXT_ACTION_IDS.MAP.VECTORS, 'Vecteurs', 'DISPLAY', 'LAYER', 'LOCAL_ACTION'),
        supported(CONTEXT_ACTION_IDS.MAP.LABELS, 'Étiquettes', 'DISPLAY', 'DECLUTTER', 'LOCAL_ACTION'),
        supported(CONTEXT_ACTION_IDS.MAP.GRID, 'Grille', 'DISPLAY', 'GRID', 'LOCAL_ACTION'),
        supported(CONTEXT_ACTION_IDS.MAP.DECLUTTER, 'Allègement', 'DISPLAY', 'DECLUTTER', 'LOCAL_ACTION'),
      ]),
      family(CONTEXT_ACTION_IDS.MAP.MEASURE, 'Mesurer', 'MEASURE', 'MEASURE', [
        supported(CONTEXT_ACTION_IDS.MAP.FROM_OWNSHIP, 'Depuis l’ownship', 'MEASURE', 'MEASURE', 'READ_ONLY'),
        planned(CONTEXT_ACTION_IDS.MAP.CHOOSE_ORIGIN, 'Choisir l’origine', 'MEASURE', 'MEASURE'),
        supported(CONTEXT_ACTION_IDS.MAP.COORDINATES, 'Coordonnées', 'MEASURE', 'COORDINATES', 'READ_ONLY'),
      ]),
      family(CONTEXT_ACTION_IDS.MAP.CREATE, 'Créer', 'CREATE', 'NOT_IMPLEMENTED', [
        planned(CONTEXT_ACTION_IDS.MAP.LOCAL_REFERENCE, 'Repère local', 'CREATE', 'DESIGNATION'),
        planned(CONTEXT_ACTION_IDS.MAP.LOCAL_WAYPOINT, 'Waypoint local', 'CREATE', 'ROUTE_DRAFT'),
      ]),
    ],
  },
  OWNSHIP: {
    label: 'Ownship',
    families: [
      family(CONTEXT_ACTION_IDS.OWNSHIP.NAV_SIM, 'Navigation simulée', 'NAV_SIM', 'NAVIGATION', [
        supported(CONTEXT_ACTION_IDS.OWNSHIP.HEADING_SPEED, 'Cap et vitesse', 'NAV_SIM', 'NAVIGATION', 'READ_ONLY'),
        supported(CONTEXT_ACTION_IDS.OWNSHIP.PAUSE_RESUME, 'Pause / reprise', 'NAV_SIM', 'NAVIGATION', 'LOCAL_ACTION'),
        supported(CONTEXT_ACTION_IDS.OWNSHIP.ACTIVE_ROUTE, 'Route active', 'NAV_SIM', 'NAVIGATION', 'READ_ONLY'),
      ]),
      family(CONTEXT_ACTION_IDS.OWNSHIP.STABILIZE, 'Stabiliser', 'STABILIZE', 'STABILIZE', [
        supported(CONTEXT_ACTION_IDS.OWNSHIP.FOLLOW, 'Suivre l’ownship', 'STABILIZE', 'RECENTER', 'MAP_VIEW'),
        supported(CONTEXT_ACTION_IDS.OWNSHIP.GROUND_ANCHOR, 'Ancrer au sol', 'STABILIZE', 'STABILIZE', 'LOCAL_ACTION'),
        supported(CONTEXT_ACTION_IDS.OWNSHIP.RECENTER, 'Recentrer', 'STABILIZE', 'RECENTER', 'MAP_VIEW'),
      ]),
      family(CONTEXT_ACTION_IDS.OWNSHIP.TRAIL, 'Trajectoire', 'TRAIL', 'TRAIL', [
        supported(CONTEXT_ACTION_IDS.OWNSHIP.TRAIL_VISIBILITY, 'Afficher / masquer', 'TRAIL', 'TRAIL', 'LOCAL_ACTION'),
        supported(CONTEXT_ACTION_IDS.OWNSHIP.FUTURE_POSITION, 'Position future', 'TRAIL', 'FUTURE_POSITION', 'MAP_PREVIEW'),
        supported(CONTEXT_ACTION_IDS.OWNSHIP.CLEAR_TRAIL, 'Effacer la trajectoire', 'TRAIL', 'TRAIL', 'LOCAL_ACTION', 'REQUIRED'),
      ]),
      family(CONTEXT_ACTION_IDS.OWNSHIP.DATA, 'Données', 'DATA', 'DATA', [
        supported(CONTEXT_ACTION_IDS.OWNSHIP.NAVIGATION_SOURCE, 'Navigation et source', 'DATA', 'DATA', 'READ_ONLY'),
        supported(CONTEXT_ACTION_IDS.OWNSHIP.KINEMATICS, 'Cinématique', 'DATA', 'DATA', 'READ_ONLY'),
      ]),
    ],
  },
  WAYPOINT: {
    label: 'Waypoint',
    directActions: [
      supported(CONTEXT_ACTION_IDS.WAYPOINT.DIRECT_SIM, 'Direct simulé', 'DIRECT_SIM', 'DIRECT_TO', 'LOCAL_ACTION', 'REQUIRED'),
    ],
    families: [
      family(CONTEXT_ACTION_IDS.WAYPOINT.MEASURE, 'Mesurer', 'MEASURE', 'MEASURE', [
        supported(CONTEXT_ACTION_IDS.WAYPOINT.BRG_RNG, 'Distance / relèvement', 'MEASURE', 'MEASURE', 'READ_ONLY'),
        supported(CONTEXT_ACTION_IDS.WAYPOINT.ETA_ETE, 'ETA / ETE', 'MEASURE', 'MEASURE', 'READ_ONLY'),
        supported(CONTEXT_ACTION_IDS.WAYPOINT.PROJECTION, 'Projection paramétrée', 'MEASURE', 'FUTURE_POSITION', 'MAP_PREVIEW'),
      ]),
      family(CONTEXT_ACTION_IDS.WAYPOINT.POINT, 'Point', 'POINT', 'VIEW', [
        supported(CONTEXT_ACTION_IDS.WAYPOINT.CENTER, 'Centrer', 'POINT', 'RECENTER', 'MAP_VIEW'),
        supported(CONTEXT_ACTION_IDS.WAYPOINT.COORDINATES, 'Coordonnées', 'POINT', 'COORDINATES', 'READ_ONLY'),
      ]),
      family(CONTEXT_ACTION_IDS.WAYPOINT.ROUTE, 'Route', 'ROUTE', 'ROUTE_DRAFT', [
        planned(CONTEXT_ACTION_IDS.WAYPOINT.ADD_TO_DRAFT, 'Ajouter au brouillon', 'ROUTE', 'ROUTE_DRAFT', 'REQUIRED'),
        planned(CONTEXT_ACTION_IDS.WAYPOINT.PLAN_POSITION, 'Position dans le plan', 'ROUTE', 'ROUTE_DRAFT'),
      ]),
    ],
  },
  TRACK: {
    label: 'Piste',
    families: [
      family(CONTEXT_ACTION_IDS.TRACK.DATA, 'Données', 'DATA', 'DATA', [
        supported(CONTEXT_ACTION_IDS.TRACK.INFO, 'Informations', 'DATA', 'INFO', 'READ_ONLY'),
        supported(CONTEXT_ACTION_IDS.TRACK.AGE, 'Âge', 'DATA', 'AGE', 'READ_ONLY'),
        supported(CONTEXT_ACTION_IDS.TRACK.QUALITY, 'Qualité', 'DATA', 'QUALITY', 'READ_ONLY'),
      ]),
      family(CONTEXT_ACTION_IDS.TRACK.MEASURE, 'Mesurer', 'MEASURE', 'MEASURE', [
        supported(CONTEXT_ACTION_IDS.TRACK.BRG_RNG, 'Distance / relèvement', 'MEASURE', 'MEASURE', 'READ_ONLY'),
        supported(CONTEXT_ACTION_IDS.TRACK.CPA, 'CPA / TCPA', 'MEASURE', 'CPA', 'READ_ONLY'),
        supported(CONTEXT_ACTION_IDS.TRACK.CLOSURE, 'Rapprochement', 'MEASURE', 'CPA', 'READ_ONLY'),
      ]),
      family(CONTEXT_ACTION_IDS.TRACK.TRACKING, 'Suivi', 'TRACKING', 'VIEW', [
        supported(CONTEXT_ACTION_IDS.TRACK.CENTER, 'Centrer', 'TRACKING', 'RECENTER', 'MAP_VIEW'),
        supported(CONTEXT_ACTION_IDS.TRACK.TRAIL, 'Trajectoire', 'TRACKING', 'TRAIL', 'LOCAL_ACTION'),
        supported(CONTEXT_ACTION_IDS.TRACK.FUTURE_POSITION, 'Position future', 'TRACKING', 'FUTURE_POSITION', 'MAP_PREVIEW'),
      ]),
      family(CONTEXT_ACTION_IDS.TRACK.DESIGNATE, 'Désigner', 'DESIGNATE', 'DESIGNATION', [
        supported(CONTEXT_ACTION_IDS.TRACK.LOCAL_REFERENCE, 'Repère à la position', 'DESIGNATE', 'DESIGNATION', 'MAP_PREVIEW'),
        supported(CONTEXT_ACTION_IDS.TRACK.BULLSEYE, 'Bullseye à la position', 'DESIGNATE', 'BULLSEYE', 'LOCAL_ACTION', 'REQUIRED'),
      ]),
    ],
  },
  BASE: {
    label: 'Base',
    families: [
      family(CONTEXT_ACTION_IDS.BASE.DATA, 'Données', 'DATA', 'DATA', [
        supported(CONTEXT_ACTION_IDS.BASE.IDENTITY_COORDINATES, 'Identité et coordonnées', 'DATA', 'INFO', 'READ_ONLY'),
        supported(CONTEXT_ACTION_IDS.BASE.SCENARIO_DATA, 'Données du scénario', 'DATA', 'DATA', 'READ_ONLY'),
      ]),
      family(CONTEXT_ACTION_IDS.BASE.JOIN, 'Rejoindre', 'JOIN', 'DIRECT_TO', [
        supported(CONTEXT_ACTION_IDS.BASE.DIRECT_SIM, 'Direct simulé', 'JOIN', 'DIRECT_TO', 'LOCAL_ACTION', 'REQUIRED'),
        supported(CONTEXT_ACTION_IDS.BASE.ETA_ETE, 'ETA / ETE', 'JOIN', 'MEASURE', 'READ_ONLY'),
      ]),
      family(CONTEXT_ACTION_IDS.BASE.MEASURE, 'Mesurer', 'MEASURE', 'MEASURE', [
        supported(CONTEXT_ACTION_IDS.BASE.BRG_RNG, 'Distance / relèvement', 'MEASURE', 'MEASURE', 'READ_ONLY'),
        supported(CONTEXT_ACTION_IDS.BASE.PROJECTION, 'Projection', 'MEASURE', 'FUTURE_POSITION', 'MAP_PREVIEW'),
      ]),
      family(CONTEXT_ACTION_IDS.BASE.VIEW, 'Vue', 'VIEW', 'VIEW', [
        supported(CONTEXT_ACTION_IDS.BASE.CENTER, 'Centrer', 'VIEW', 'RECENTER', 'MAP_VIEW'),
        supported(CONTEXT_ACTION_IDS.BASE.BULLSEYE, 'Référence bullseye', 'VIEW', 'BULLSEYE', 'LOCAL_ACTION', 'REQUIRED'),
      ]),
    ],
  },
};

const isFinitePosition = (position: Position | undefined): position is Position => (
  position !== undefined
  && Number.isFinite(position.lat)
  && Number.isFinite(position.lon)
  && position.lat >= -90
  && position.lat <= 90
  && position.lon >= -180
  && position.lon <= 180
);

const copyPosition = (position: Position | undefined): Position | undefined => (
  position === undefined ? undefined : { lat: position.lat, lon: position.lon }
);

const contextLabelFor = (context: ContextActionContextKind): string => CONTEXT_DEFINITIONS[context].label;

const targetFromInput = (input: ContextActionInput): ContextActionTarget | undefined => {
  const suppliedTarget = input.target ?? input.entity;
  const position = input.position ?? suppliedTarget?.position;
  const id = input.targetId ?? suppliedTarget?.id;
  const label = input.targetLabel ?? suppliedTarget?.label;
  const type = input.targetType ?? suppliedTarget?.type;

  if (suppliedTarget !== undefined) {
    const resolvedId = id ?? '';
    const resolvedLabel = label ?? resolvedId;
    return {
      ...suppliedTarget,
      id: resolvedId,
      label: resolvedLabel,
      ...(position === undefined ? {} : { position: { ...position } }),
      ...(type === undefined ? {} : { type }),
    };
  }

  if (id === undefined && label === undefined && position === undefined && type === undefined) return undefined;
  if (id === undefined || position === undefined) return undefined;
  return { id, label: label ?? id, position: { ...position }, ...(type === undefined ? {} : { type }) };
};

const isScenarioBaseTarget = (target: ContextActionTarget | undefined): boolean => (
  target?.type === EntityType.AIRPORT && target.label === 'BASE'
);

/** Returns true only for the scenario airport represented by the BASE context. */
export const isScenarioBaseContext = (
  value: ContextActionTarget | ContextActionInput | undefined,
): boolean => {
  if (value === undefined) return false;
  const target = 'context' in value ? targetFromInput(value) : value;
  return isScenarioBaseTarget(target);
};

export const isDecorativeAirportContext = (input: ContextActionInput): boolean => {
  const target = targetFromInput(input);
  return target?.type === EntityType.AIRPORT && !isScenarioBaseTarget(target);
};

interface NormalizedContext {
  context: ContextActionContextKind;
  label: string;
  target?: ContextActionTarget;
  position?: Position;
  targetId?: string;
  accepted: boolean;
  rejectionReason?: ContextActionUnavailableReason;
}

const expectedTypeFor = (context: ContextActionContextKind): ContextActionTargetType | null => {
  if (context === 'OWNSHIP') return EntityType.OWNSHIP;
  if (context === 'WAYPOINT') return EntityType.WAYPOINT;
  if (context === 'BASE') return EntityType.AIRPORT;
  return null;
};

const normalizeContext = (input: ContextActionInput): NormalizedContext => {
  const target = targetFromInput(input);
  const position = input.position ?? target?.position;
  const common = {
    context: input.context,
    label: contextLabelFor(input.context),
    target,
    position: copyPosition(position),
    targetId: target?.id ?? input.targetId,
  } satisfies Omit<NormalizedContext, 'accepted' | 'rejectionReason'>;

  if (!isFinitePosition(position)) {
    return { ...common, accepted: false, rejectionReason: 'INVALID_CONTEXT_POSITION' };
  }

  if (input.context === 'MAP') {
    return { ...common, accepted: true };
  }

  if (target === undefined || target.id.trim() === '' || target.label.trim() === '') {
    return { ...common, accepted: false, rejectionReason: 'MISSING_CONTEXT_TARGET' };
  }

  if (target.type === EntityType.AIRPORT && input.context !== 'BASE') {
    return { ...common, accepted: false, rejectionReason: 'DECORATIVE_AIRPORT' };
  }

  if (input.context === 'BASE') {
    if (!isScenarioBaseTarget(target)) {
      return { ...common, accepted: false, rejectionReason: 'DECORATIVE_AIRPORT' };
    }
    return { ...common, accepted: true };
  }

  const expectedType = expectedTypeFor(input.context);
  if (expectedType !== null && target.type !== undefined && target.type !== expectedType) {
    return { ...common, accepted: false, rejectionReason: 'CONTEXT_TYPE_MISMATCH' };
  }

  if (input.context === 'TRACK'
    && target.type !== undefined
    && target.type !== EntityType.ENEMY
    && target.type !== EntityType.FRIENDLY
    && target.type !== 'TRACK') {
    return { ...common, accepted: false, rejectionReason: 'CONTEXT_TYPE_MISMATCH' };
  }

  return { ...common, accepted: true };
};

const contextTargetFields = (context: NormalizedContext): Pick<ContextActionNodeBase, 'targetId' | 'position'> => ({
  ...(context.targetId === undefined ? {} : { targetId: context.targetId }),
  ...(context.position === undefined ? {} : { position: copyPosition(context.position) }),
});

const createLeaf = (
  definition: LeafDefinition,
  context: NormalizedContext,
  input: ContextActionInput,
  depth: ContextActionDepth,
): ContextActionLeaf => {
  const disabledByContext = input.disabledActionIds?.includes(definition.id) === true;
  const implementation = definition.implementation ?? 'SUPPORTED';
  const available = implementation === 'SUPPORTED' && !disabledByContext;
  const disabledReason: ContextActionUnavailableReason | undefined = !available
    ? disabledByContext ? 'DISABLED_BY_CONTEXT' : 'NOT_IMPLEMENTED'
    : undefined;
  const active = available && input.activeActionIds?.includes(definition.id) === true;
  const confirmation = definition.confirmation ?? 'NONE';

  return {
    id: definition.id,
    label: definition.label,
    family: definition.family,
    category: definition.family,
    ...contextTargetFields(context),
    depth,
    kind: 'ACTION',
    available,
    availability: available ? 'AVAILABLE' : 'UNAVAILABLE',
    status: available ? 'AVAILABLE' : 'UNAVAILABLE',
    ...(disabledReason === undefined ? {} : { disabledReason, reason: disabledReason }),
    active,
    confirmation,
    requiresConfirmation: confirmation === 'REQUIRED',
    capability: implementation === 'NOT_IMPLEMENTED' ? 'NOT_IMPLEMENTED' : definition.capability,
    effectKind: implementation === 'NOT_IMPLEMENTED' ? 'NOT_IMPLEMENTED' : definition.effectKind,
    implementation,
  };
};

const createFamily = (
  definition: FamilyDefinition,
  context: NormalizedContext,
  input: ContextActionInput,
): ContextActionFamily => {
  const children = definition.leaves.map(leaf => createLeaf(leaf, context, input, 1));
  const availableChildren = children.filter(child => child.available);
  const available = availableChildren.length >= 2;
  const disabledReason: ContextActionUnavailableReason | undefined = available
    ? undefined
    : 'NO_AVAILABLE_ACTIONS';
  const active = availableChildren.some(child => child.active);
  const implementation: ContextActionImplementation = children.some(child => child.implementation === 'SUPPORTED')
    ? 'SUPPORTED'
    : 'NOT_IMPLEMENTED';

  return {
    id: definition.id,
    label: definition.label,
    family: definition.category,
    category: definition.category,
    ...contextTargetFields(context),
    depth: 0,
    kind: 'FAMILY',
    available,
    availability: available ? 'AVAILABLE' : 'UNAVAILABLE',
    status: available ? 'AVAILABLE' : 'UNAVAILABLE',
    ...(disabledReason === undefined ? {} : { disabledReason, reason: disabledReason }),
    active,
    confirmation: 'NONE',
    requiresConfirmation: false,
    capability: available ? definition.capability : 'NOT_IMPLEMENTED',
    effectKind: 'GROUP',
    implementation,
    children,
  };
};

const leavesOf = (roots: readonly ContextActionRoot[]): ContextActionLeaf[] => roots.flatMap(root => (
  root.kind === 'FAMILY' ? [...root.children] : [root]
));

const treeFromRoots = (
  context: NormalizedContext,
  roots: readonly ContextActionRoot[],
): ContextActionTree => {
  const families = roots.filter((root): root is ContextActionFamily => root.kind === 'FAMILY');
  const directActions = roots.filter((root): root is ContextActionLeaf => root.kind === 'ACTION');
  const actions = leavesOf(roots);
  return {
    context: context.context,
    contextLabel: context.label,
    accepted: context.accepted,
    available: context.accepted && roots.length > 0,
    ...(context.rejectionReason === undefined ? {} : { rejectionReason: context.rejectionReason }),
    ...(context.targetId === undefined ? {} : { targetId: context.targetId }),
    ...(context.position === undefined ? {} : { position: copyPosition(context.position) }),
    roots,
    children: roots,
    nodes: roots,
    families,
    actions,
    leaves: actions,
    directActions,
  };
};

const emptyTree = (context: NormalizedContext): ContextActionTree => treeFromRoots(context, []);

/**
 * Builds the complete, deterministic catalogue for a captured context.
 * Unsupported planned leaves remain inspectable here, but have no action path.
 */
export const getContextActionTree = (input: ContextActionInput): ContextActionTree => {
  const context = normalizeContext(input);
  if (!context.accepted) return emptyTree(context);

  const definition = CONTEXT_DEFINITIONS[context.context];
  const families = definition.families.map(item => createFamily(item, context, input));
  const directActions = (definition.directActions ?? [])
    .map(item => createLeaf(item, context, input, 0));
  return treeFromRoots(context, [...directActions, ...families]);
};

/** Returns only executable/consultable leaves and removes empty or singleton families. */
export const getAvailableContextActionTree = (input: ContextActionInput): ContextActionTree => {
  const complete = getContextActionTree(input);
  if (!complete.accepted) return complete;

  const roots: ContextActionRoot[] = [];
  for (const root of complete.roots) {
    if (root.kind === 'ACTION') {
      if (root.available) roots.push(root);
      continue;
    }

    const children = root.children.filter(child => child.available);
    if (children.length < 2) continue;
    roots.push({
      ...root,
      available: true,
      availability: 'AVAILABLE',
      disabledReason: undefined,
      reason: undefined,
      capability: root.capability,
      children,
    });
  }
  return treeFromRoots({
    context: complete.context,
    label: complete.contextLabel,
    targetId: complete.targetId,
    position: complete.position,
    accepted: true,
  }, roots);
};

/** Flatten the complete tree so T13 can inspect stable ids and disabled leaves. */
export const getContextActionIds = (tree: ContextActionTree): string[] => (
  tree.actions.map(action => action.id)
);

/** Flatten only the available action path for a captured context. */
export const getAvailableContextActions = (input: ContextActionInput): ContextActionLeaf[] => (
  [...getAvailableContextActionTree(input).actions]
);

export const getAvailableContextActionIds = (input: ContextActionInput): string[] => (
  getAvailableContextActions(input).map(action => action.id)
);

export const isAcceptedContext = (input: ContextActionInput): boolean => (
  getContextActionTree(input).accepted
);

// Naming aliases keep the public boundary readable for the radial integration.
export const buildContextActionTree = getContextActionTree;
export const createContextActionTree = getContextActionTree;
export const listAvailableContextActionIds = getAvailableContextActionIds;
