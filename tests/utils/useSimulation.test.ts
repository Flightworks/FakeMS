import { describe, it, expect } from 'vitest';
import { stepEntity } from '../../utils/useSimulation';
import { Entity, EntityType } from '../../types';

describe('Simulation Kinematics', () => {
    const baseEntity: Entity = {
        id: 'test',
        type: EntityType.FRIENDLY,
        position: { lat: 34, lon: -118 },
        heading: 0,
        speed: 100,
        targetHeading: 0,
        targetSpeed: 100,
        turnRate: 3,
        acceleration: 5
    };

    it('stays on course when heading matches target', () => {
        const next = stepEntity(baseEntity, 1.0);
        expect(next.heading).toBe(0);
        expect(next.position.lat).toBeGreaterThan(34); // Moving North
        expect(next.position.lon).toBe(-118);
    });

    it('turns toward target heading', () => {
        const turningEntity = { ...baseEntity, targetHeading: 90 };
        // At 3 deg/sec, after 10 seconds it should be at 30 deg
        const next = stepEntity(turningEntity, 10.0);
        expect(next.heading).toBe(30);
    });

    it('accelerates toward target speed', () => {
        const accelEntity = { ...baseEntity, targetSpeed: 150 };
        // At 5 knots/sec, after 4 seconds it should be 120
        const next = stepEntity(accelEntity, 4.0);
        expect(next.speed).toBe(120);
    });

    it('handles turn direction change mid-turn', () => {
        const turningEntity = { ...baseEntity, targetHeading: 180 };
        const step1 = stepEntity(turningEntity, 10.0);
        expect(step1.heading).toBe(30); // Turning Right (Shortest path)

        // Change target to 330 (which is -30)
        // From 30, it should now turn Left toward 330
        const redirected = { ...step1, targetHeading: 330 };
        const step2 = stepEntity(redirected, 5.0);
        // From 30, 5 seconds at 3 deg/sec is 15 deg change.
        // It was 30. It should turn toward 330 (Left).
        // 30 - 15 = 15.
        expect(step2.heading).toBe(15);
    });

    it('stops turning when target is reached', () => {
        const turningEntity = { ...baseEntity, targetHeading: 5 };
        const next = stepEntity(turningEntity, 10.0); // 10s * 3deg = 30deg > 5deg
        expect(next.heading).toBe(5);
    });
});
