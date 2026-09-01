import { describe, expect, it } from 'vitest';
import {
  createMissionActionState,
  dispatchMissionAction,
} from '../../application/missionActionReducer';
import { MissionActionRequest } from '../../domain/missionActions';

const implementedRequest: MissionActionRequest = {
  id: 'sensor:stt:track-1',
  label: 'Radar single target track',
  category: 'SENSORS',
  targetId: 'track-1',
  issuedAt: 100,
  implementation: 'SIMULATED_EFFECT',
  requiresAuthorization: true,
};

const unavailableRequest: MissionActionRequest = {
  ...implementedRequest,
  id: 'engage:auth:track-1',
  label: 'Engage authorization',
  category: 'ENGAGE',
  implementation: 'NOT_IMPLEMENTED',
};

describe('mission action lifecycle', () => {
  it('records propose, preview, authorize, execute and result as separate events', () => {
    const proposed = dispatchMissionAction(createMissionActionState(), {
      type: 'PROPOSE',
      request: implementedRequest,
    });
    const previewed = dispatchMissionAction(proposed, { type: 'PREVIEW', at: 150 });
    const authorized = dispatchMissionAction(previewed, { type: 'AUTHORIZE', at: 200 });
    const completed = dispatchMissionAction(authorized, { type: 'EXECUTE_SIM', at: 300 });

    expect(completed.active?.status).toBe('COMPLETED_SIM');
    expect(completed.journal.map(event => event.status)).toEqual([
      'PROPOSED',
      'PREVIEWED',
      'AUTHORIZED',
      'EXECUTING_SIM',
      'COMPLETED_SIM',
    ]);
    expect(completed.journal[1]).toMatchObject({ at: 150, status: 'PREVIEWED' });
    expect(completed.journal.at(-1)).toMatchObject({ at: 300, status: 'COMPLETED_SIM' });
  });

  it('does not authorize before the explicit preview step', () => {
    const proposed = dispatchMissionAction(createMissionActionState(), {
      type: 'PROPOSE',
      request: implementedRequest,
    });
    const attempted = dispatchMissionAction(proposed, { type: 'AUTHORIZE', at: 200 });

    expect(attempted).toEqual(proposed);
  });

  it('does not execute before explicit authorization', () => {
    const proposed = dispatchMissionAction(createMissionActionState(), {
      type: 'PROPOSE',
      request: implementedRequest,
    });
    const attempted = dispatchMissionAction(proposed, { type: 'EXECUTE_SIM', at: 300 });

    expect(attempted).toEqual(proposed);
  });

  it('records a safe unavailable result instead of pretending to execute', () => {
    const proposed = dispatchMissionAction(createMissionActionState(), {
      type: 'PROPOSE',
      request: unavailableRequest,
    });
    const authorized = dispatchMissionAction(
      dispatchMissionAction(proposed, { type: 'PREVIEW', at: 150 }),
      { type: 'AUTHORIZE', at: 200 },
    );
    const result = dispatchMissionAction(authorized, { type: 'EXECUTE_SIM', at: 300 });

    expect(result.active?.status).toBe('NOT_IMPLEMENTED');
    expect(result.journal.at(-1)).toMatchObject({
      status: 'NOT_IMPLEMENTED',
      reason: 'No simulator effect is available for this action',
    });
  });

  it('rejects and journals an action without mutating a prior entry', () => {
    const proposed = dispatchMissionAction(createMissionActionState(), {
      type: 'PROPOSE',
      request: implementedRequest,
    });
    const rejected = dispatchMissionAction(proposed, { type: 'REJECT', at: 150 });

    expect(rejected.active?.status).toBe('REJECTED');
    expect(rejected.journal).toHaveLength(2);
    expect(proposed.journal).toHaveLength(1);
  });
});
