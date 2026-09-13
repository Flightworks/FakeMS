import { describe, expect, it } from 'vitest';
import { EntityType } from '../../types';
import {
  CONTEXT_ACTION_IDS,
  getAvailableContextActionIds,
  getAvailableContextActionTree,
  getAvailableContextActions,
  getContextActionIds,
  getContextActionTree,
  isDecorativeAirportContext,
  isScenarioBaseContext,
  type ContextActionInput,
} from '../../domain/contextActions';

describe('contextual action catalogue', () => {
  it('captures a map context without aliasing its position', () => {
    const position = { lat: 43.1, lon: 5.9 };
    const input: ContextActionInput = { context: 'MAP', position };

    const tree = getContextActionTree(input);
    const viewFamily = tree.nodes.find(node => node.id === 'MAP:VIEW');
    const centerHere = viewFamily?.kind === 'FAMILY'
      ? viewFamily.children.find(action => action.id === 'MAP:VIEW:CENTER_HERE')
      : undefined;

    expect(tree.accepted).toBe(true);
    expect(tree.contextLabel).toBe('Fond');
    expect(tree.position).toEqual(position);
    expect(tree.position).not.toBe(position);
    expect(centerHere).toMatchObject({
      id: 'MAP:VIEW:CENTER_HERE',
      label: 'Centrer ici',
      family: 'VIEW',
      category: 'VIEW',
      depth: 1,
      available: true,
      availability: 'AVAILABLE',
      confirmation: 'NONE',
      capability: 'VIEW',
      effectKind: 'MAP_VIEW',
      position,
    });
    expect(centerHere?.position).not.toBe(position);
  });

  it('accepts an object context captured with only its stable id and position', () => {
    const input: ContextActionInput = {
      context: 'WAYPOINT',
      targetId: 'wp-bravo',
      position: { lat: 43.2, lon: 5.9 },
    };

    const tree = getContextActionTree(input);

    expect(tree.accepted).toBe(true);
    expect(tree.targetId).toBe('wp-bravo');
    expect(getAvailableContextActionIds(input)).toContain(CONTEXT_ACTION_IDS.WAYPOINT.DIRECT_SIM);
  });

  it('builds distinct accepted trees for all five supported contexts', () => {
    const contexts: Array<{ context: ContextActionInput['context']; input: ContextActionInput; rootIds: string[] }> = [
      {
        context: 'MAP',
        input: { context: 'MAP', position: { lat: 43.1, lon: 5.9 } },
        rootIds: [
          CONTEXT_ACTION_IDS.MAP.VIEW,
          CONTEXT_ACTION_IDS.MAP.DISPLAY,
          CONTEXT_ACTION_IDS.MAP.MEASURE,
          CONTEXT_ACTION_IDS.MAP.CREATE,
        ],
      },
      {
        context: 'OWNSHIP',
        input: {
          context: 'OWNSHIP',
          target: { id: 'ownship', label: 'VIPER 1-1', type: EntityType.OWNSHIP, position: { lat: 43.1, lon: 5.9 } },
        },
        rootIds: [
          CONTEXT_ACTION_IDS.OWNSHIP.NAV_SIM,
          CONTEXT_ACTION_IDS.OWNSHIP.STABILIZE,
          CONTEXT_ACTION_IDS.OWNSHIP.TRAIL,
          CONTEXT_ACTION_IDS.OWNSHIP.DATA,
        ],
      },
      {
        context: 'WAYPOINT',
        input: {
          context: 'WAYPOINT',
          target: { id: 'wp-bravo', label: 'BRAVO', type: EntityType.WAYPOINT, position: { lat: 43.2, lon: 5.9 } },
        },
        rootIds: [
          CONTEXT_ACTION_IDS.WAYPOINT.DIRECT_SIM,
          CONTEXT_ACTION_IDS.WAYPOINT.MEASURE,
          CONTEXT_ACTION_IDS.WAYPOINT.POINT,
          CONTEXT_ACTION_IDS.WAYPOINT.ROUTE,
        ],
      },
      {
        context: 'TRACK',
        input: {
          context: 'TRACK',
          target: { id: 'track-bravo', label: 'BRAVO', type: EntityType.ENEMY, position: { lat: 43.2, lon: 5.8 } },
        },
        rootIds: [
          CONTEXT_ACTION_IDS.TRACK.DATA,
          CONTEXT_ACTION_IDS.TRACK.MEASURE,
          CONTEXT_ACTION_IDS.TRACK.TRACKING,
          CONTEXT_ACTION_IDS.TRACK.DESIGNATE,
        ],
      },
      {
        context: 'BASE',
        input: {
          context: 'BASE',
          target: { id: 'apt-base', label: 'BASE', type: EntityType.AIRPORT, position: { lat: 43, lon: 5.9 } },
        },
        rootIds: [
          CONTEXT_ACTION_IDS.BASE.DATA,
          CONTEXT_ACTION_IDS.BASE.JOIN,
          CONTEXT_ACTION_IDS.BASE.MEASURE,
          CONTEXT_ACTION_IDS.BASE.VIEW,
        ],
      },
    ];

    for (const { context, input, rootIds } of contexts) {
      const tree = getContextActionTree(input);
      expect(tree.context, context).toBe(context);
      expect(tree.accepted, context).toBe(true);
      expect(tree.nodes.map(node => node.id), context).toEqual(rootIds);
      expect(getAvailableContextActionTree(input).accepted, context).toBe(true);
    }
  });

  it('keeps the tree to two levels and never leaves a singleton family', () => {
    const inputs: ContextActionInput[] = [
      { context: 'MAP', position: { lat: 43.1, lon: 5.9 } },
      { context: 'OWNSHIP', target: { id: 'ownship', label: 'VIPER 1-1', type: EntityType.OWNSHIP, position: { lat: 43.1, lon: 5.9 } } },
      { context: 'WAYPOINT', target: { id: 'wp', label: 'BRAVO', type: EntityType.WAYPOINT, position: { lat: 43.2, lon: 5.9 } } },
      { context: 'TRACK', target: { id: 'track', label: 'TRACK 1', type: EntityType.ENEMY, position: { lat: 43.2, lon: 5.8 } } },
      { context: 'BASE', target: { id: 'base', label: 'BASE', type: EntityType.AIRPORT, position: { lat: 43, lon: 5.9 } } },
    ];

    for (const input of inputs) {
      for (const tree of [getContextActionTree(input), getAvailableContextActionTree(input)]) {
        for (const root of tree.nodes) {
          expect(root.depth).toBe(0);
          if (root.kind === 'FAMILY') {
            expect(root.children.length).toBeGreaterThanOrEqual(2);
            for (const leaf of root.children) {
              expect(leaf.depth).toBe(1);
              expect(leaf.kind).toBe('ACTION');
              expect('children' in leaf).toBe(false);
            }
          }
        }
        expect(tree.nodes.some(root => root.kind === 'FAMILY' && root.children.length < 2)).toBe(false);
        expect(tree.nodes.flatMap(root => root.kind === 'FAMILY' ? root.children : [root])
          .every(leaf => leaf.depth <= 1)).toBe(true);
      }
    }
  });

  it('preserves a deterministic root and leaf order across calls', () => {
    const input: ContextActionInput = {
      context: 'WAYPOINT',
      target: { id: 'wp-bravo', label: 'BRAVO', type: EntityType.WAYPOINT, position: { lat: 43.2, lon: 5.9 } },
    };

    const first = getContextActionTree(input);
    const second = getContextActionTree(input);
    expect(first.nodes.map(node => node.id)).toEqual(second.nodes.map(node => node.id));
    expect(getContextActionIds(first)).toEqual(getContextActionIds(second));
    expect(getAvailableContextActionIds(input)).toEqual(getAvailableContextActionIds(input));
    expect(getAvailableContextActionIds(input)).toContain(CONTEXT_ACTION_IDS.WAYPOINT.DIRECT_SIM);
  });

  it('copies the captured target position onto every node without mutating input', () => {
    const targetPosition = { lat: 43.2, lon: 5.9 };
    const input: ContextActionInput = {
      context: 'TRACK',
      target: { id: 'track-bravo', label: 'BRAVO', type: EntityType.ENEMY, position: targetPosition },
    };
    const inputBefore = structuredClone(input);
    const tree = getContextActionTree(input);

    expect(tree.position).toEqual(targetPosition);
    expect(tree.position).not.toBe(targetPosition);
    for (const node of tree.nodes) {
      expect(node.position).toEqual(targetPosition);
      expect(node.position).not.toBe(targetPosition);
      if (node.kind === 'FAMILY') {
        for (const leaf of node.children) {
          expect(leaf.position).toEqual(targetPosition);
          expect(leaf.position).not.toBe(targetPosition);
        }
      }
    }

    const firstLeaf = tree.actions[0];
    if (firstLeaf.position) firstLeaf.position.lat = 99;
    expect(input).toEqual(inputBefore);
    expect(targetPosition).toEqual(inputBefore.target?.position);
  });

  it('rejects decorative airports while accepting the scenario BASE airport', () => {
    const decorative: ContextActionInput = {
      context: 'BASE',
      target: {
        id: 'decorative-airport',
        label: 'Marseille Provence Airport',
        type: EntityType.AIRPORT,
        position: { lat: 43.44, lon: 5.22 },
      },
    };
    const base: ContextActionInput = {
      context: 'BASE',
      target: { id: 'apt-base', label: 'BASE', type: EntityType.AIRPORT, position: { lat: 43, lon: 5.9 } },
    };

    expect(isDecorativeAirportContext(decorative)).toBe(true);
    expect(isScenarioBaseContext(decorative)).toBe(false);
    expect(getContextActionTree(decorative)).toMatchObject({
      accepted: false,
      available: false,
      rejectionReason: 'DECORATIVE_AIRPORT',
      nodes: [],
    });
    expect(getAvailableContextActions(decorative)).toEqual([]);
    expect(isScenarioBaseContext(base)).toBe(true);
    expect(getContextActionTree(base).accepted).toBe(true);
  });

  it('marks planned leaves unavailable and excludes them from the available path', () => {
    const mapInput: ContextActionInput = { context: 'MAP', position: { lat: 43.1, lon: 5.9 } };
    const waypointInput: ContextActionInput = {
      context: 'WAYPOINT',
      target: { id: 'wp-bravo', label: 'BRAVO', type: EntityType.WAYPOINT, position: { lat: 43.2, lon: 5.9 } },
    };
    const fullMap = getContextActionTree(mapInput);
    const fullWaypoint = getContextActionTree(waypointInput);
    const plannedMapLeaf = fullMap.actions.find(action => action.id === CONTEXT_ACTION_IDS.MAP.LOCAL_WAYPOINT);
    const plannedMeasureLeaf = fullMap.actions.find(action => action.id === CONTEXT_ACTION_IDS.MAP.CHOOSE_ORIGIN);
    const plannedRouteLeaf = fullWaypoint.actions.find(action => action.id === CONTEXT_ACTION_IDS.WAYPOINT.ADD_TO_DRAFT);

    for (const leaf of [plannedMapLeaf, plannedMeasureLeaf, plannedRouteLeaf]) {
      expect(leaf).toMatchObject({
        available: false,
        availability: 'UNAVAILABLE',
        disabledReason: 'NOT_IMPLEMENTED',
        reason: 'NOT_IMPLEMENTED',
        capability: 'NOT_IMPLEMENTED',
        effectKind: 'NOT_IMPLEMENTED',
        implementation: 'NOT_IMPLEMENTED',
      });
    }
    const availableMapIds = getAvailableContextActionIds(mapInput);
    const availableWaypointIds = getAvailableContextActionIds(waypointInput);
    expect(availableMapIds).not.toContain(CONTEXT_ACTION_IDS.MAP.LOCAL_WAYPOINT);
    expect(availableMapIds).not.toContain(CONTEXT_ACTION_IDS.MAP.CHOOSE_ORIGIN);
    expect(availableWaypointIds).not.toContain(CONTEXT_ACTION_IDS.WAYPOINT.ADD_TO_DRAFT);
  });

  it('exposes active state and confirmation policy without callbacks', () => {
    const input: ContextActionInput = {
      context: 'WAYPOINT',
      target: { id: 'wp-bravo', label: 'BRAVO', type: EntityType.WAYPOINT, position: { lat: 43.2, lon: 5.9 } },
      activeActionIds: [CONTEXT_ACTION_IDS.WAYPOINT.DIRECT_SIM],
    };
    const tree = getContextActionTree(input);
    const direct = tree.actions.find(action => action.id === CONTEXT_ACTION_IDS.WAYPOINT.DIRECT_SIM);

    expect(direct).toMatchObject({
      depth: 0,
      active: true,
      confirmation: 'REQUIRED',
      requiresConfirmation: true,
      capability: 'DIRECT_TO',
      effectKind: 'LOCAL_ACTION',
    });
    expect('action' in (direct ?? {})).toBe(false);
    expect('callback' in (direct ?? {})).toBe(false);
  });
});
