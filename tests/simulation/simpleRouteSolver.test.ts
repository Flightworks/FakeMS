import { describe, expect, it } from 'vitest';
import { MissionIntent } from '../../domain/intent';
import { RouteConstraints } from '../../domain/constraints';
import { solveSimpleRouteProposals } from '../../simulation/simpleRouteSolver';

const intent: MissionIntent = {
  id: 'intent-1',
  objective: 'THREAT_PRIORITY',
  target: { lat: 34.1, lon: -118 },
  createdAt: 100,
};

const constraints: RouteConstraints = {
  fuelAvailableUnits: 100,
  fuelReserveUnits: 20,
  fuelBurnUnitsPerNm: 1,
  returnPolicy: 'PREFERRED',
  returnTo: { lat: 34, lon: -118 },
};

const request = {
  ownshipPosition: { lat: 34, lon: -118 },
  intent,
  constraints,
  speedKnots: 60,
  altitudeFt: 2_000,
};

describe('simple deterministic route solver', () => {
  it('returns exactly two deterministic, contrasting proposals', () => {
    const first = solveSimpleRouteProposals(request);
    const second = solveSimpleRouteProposals(request);

    expect(first).toEqual(second);
    expect(first.proposals).toHaveLength(2);
    expect(first.proposals.map(proposal => proposal.variant)).toEqual(['DIRECT', 'RETURN_AWARE']);
    expect(first.proposals[0].waypoints).toHaveLength(1);
    expect(first.proposals[1].waypoints).toHaveLength(2);
    expect(first.proposals[0].distanceNm).toBeLessThan(first.proposals[1].distanceNm);
  });

  it('reports fuel margins and structured reasons for the tradeoff', () => {
    const result = solveSimpleRouteProposals(request);
    const direct = result.proposals[0];
    const returnAware = result.proposals[1];

    expect(direct.margins.fuelUnits).toBeGreaterThan(0);
    expect(returnAware.margins.fuelUnits).toBeLessThan(direct.margins.fuelUnits);
    expect(direct.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'RETURN_PREFERRED_NOT_INCLUDED', category: 'CONSTRAINT' }),
    ]));
    expect(returnAware.tradeoffs.length).toBeGreaterThan(0);
  });

  it('marks a route prohibited when fuel cannot preserve the reserve', () => {
    const result = solveSimpleRouteProposals({
      ...request,
      constraints: { ...constraints, fuelAvailableUnits: 2, fuelReserveUnits: 1, returnPolicy: 'REQUIRED' },
    });

    expect(result.proposals.every(proposal => proposal.status === 'PROHIBITED')).toBe(true);
    expect(result.proposals.flatMap(proposal => proposal.reasons)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'FUEL_RESERVE_BREACH', category: 'CONSTRAINT' }),
    ]));
  });

  it('distinguishes a preferred return from a required return', () => {
    const preferred = solveSimpleRouteProposals(request);
    const required = solveSimpleRouteProposals({
      ...request,
      constraints: { ...constraints, returnPolicy: 'REQUIRED' },
    });

    expect(preferred.proposals[0].status).toBe('CONSTRAINED');
    expect(required.proposals[0].status).toBe('PROHIBITED');
    expect(required.proposals[0].reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'RETURN_REQUIRED', category: 'CONSTRAINT' }),
    ]));
  });

  it('marks an outside-area route prohibited', () => {
    const result = solveSimpleRouteProposals({
      ...request,
      constraints: {
        ...constraints,
        allowedArea: { minLat: 33, maxLat: 34.05, minLon: -119, maxLon: -117 },
      },
    });

    expect(result.proposals[0].status).toBe('PROHIBITED');
    expect(result.proposals[0].reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'OUTSIDE_ALLOWED_AREA', category: 'CONSTRAINT' }),
    ]));
  });

  it('uses objective-specific reasons without a generative dependency', () => {
    const result = solveSimpleRouteProposals({
      ...request,
      intent: { ...intent, objective: 'ENDURANCE' },
    });

    expect(result.proposals.flatMap(proposal => proposal.reasons)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'OBJECTIVE_ENDURANCE', category: 'OBJECTIVE' }),
    ]));
  });
});
