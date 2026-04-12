import { useEffect, useRef, useState } from 'react';
import { Entity, EntityType, NavMode } from '../types';
import { getDestinationPoint, distanceBetween, bearingBetween } from './geo';

const KNOTS_TO_M_S = 0.514444; // 1 knot = 0.514444 m/s

/**
 * Normalizes an angle to 0-360 range
 */
const normalizeAngle = (angle: number) => {
    return ((angle % 360) + 360) % 360;
};

/**
 * Computes shortest turn direction (-1 left, 1 right, 0 no turn) and difference
 */
const angleDifference = (current: number, target: number) => {
    const diff = normalizeAngle(target - current);
    if (Math.abs(diff) < 0.1) return 0; // Close enough
    return diff > 180 ? diff - 360 : diff;
};

/**
 * Common kinematic step function for advancing an entity
 */
export const stepEntity = (entity: Entity, dtSeconds: number): Entity => {
    if (!entity.speed && !entity.targetSpeed) return entity;

    let { lat, lon } = entity.position;
    let currentSpeed = entity.speed || 0;
    let currentHeading = entity.heading || 0;
    let targetHeading = entity.targetHeading ?? currentHeading;
    let targetSpeed = entity.targetSpeed ?? currentSpeed;

    const turnRate = entity.turnRate || 3.0; // Standard rate turn: 3 deg/sec
    const acceleration = entity.acceleration || 5.0; // knots/sec

    // --- 1. Waypoint Logic ---
    let waypoints = entity.waypoints ? [...entity.waypoints] : undefined;
    if (waypoints && waypoints.length > 0) {
        const nextWp = waypoints[0];
        const distToWp = distanceBetween(lat, lon, nextWp.lat, nextWp.lon);

        if (distToWp < 200) {
            waypoints.shift();
            if (waypoints.length === 0) waypoints = undefined;
        } else {
            targetHeading = bearingBetween(lat, lon, nextWp.lat, nextWp.lon);
        }
    }

    // --- 2. Heading / Turn Logic ---
    if (entity.continuousTurn) {
        let change = turnRate * dtSeconds;
        currentHeading += (entity.continuousTurn === 'R' ? 1 : -1) * change;
        currentHeading = normalizeAngle(currentHeading);
        targetHeading = currentHeading; // Keep target in sync
    } else {
        const turnDiff = angleDifference(currentHeading, targetHeading);
        if (turnDiff !== 0) {
            let change = turnRate * dtSeconds;
            if (Math.abs(turnDiff) < change) {
                currentHeading = targetHeading;
            } else {
                currentHeading += Math.sign(turnDiff) * change;
            }
            currentHeading = normalizeAngle(currentHeading);
        }
    }

    // --- 3. Speed / Acceleration Logic ---
    if (Math.abs(currentSpeed - targetSpeed) > 0.1) {
        const speedDir = Math.sign(targetSpeed - currentSpeed);
        let speedChange = acceleration * dtSeconds;

        if (Math.abs(targetSpeed - currentSpeed) < speedChange) {
            currentSpeed = targetSpeed;
        } else {
            currentSpeed += speedDir * speedChange;
        }
        if (currentSpeed < 0) currentSpeed = 0; 
    }

    // --- 4. Position Update ---
    if (currentSpeed > 0) {
        const distanceMeters = (currentSpeed * KNOTS_TO_M_S) * dtSeconds;
        const newPos = getDestinationPoint(lat, lon, distanceMeters, currentHeading);
        lat = newPos.lat;
        lon = newPos.lon;
    }

    return {
        ...entity,
        position: { lat, lon },
        heading: currentHeading,
        targetHeading,
        speed: currentSpeed,
        targetSpeed,
        waypoints
    };
};

/**
 * The core simulation engine Hook.
 */
export const useSimulation = (
    initialEntities: Entity[],
    ownship: Entity,
    setOwnship: React.Dispatch<React.SetStateAction<Entity>>,
    ownshipNavMode: NavMode
) => {
    const [entities, setEntities] = useState<Entity[]>(initialEntities);
    const lastTickRef = useRef<number>(Date.now());
    const ownshipRef = useRef(ownship);
    const navModeRef = useRef(ownshipNavMode);

    // Keep refs populated for the interval closure
    useEffect(() => { ownshipRef.current = ownship; }, [ownship]);
    useEffect(() => { navModeRef.current = ownshipNavMode; }, [ownshipNavMode]);

    const TICK_RATE_MS = 1000 / 30;

    useEffect(() => {
        lastTickRef.current = Date.now();

        const tick = () => {
            const now = Date.now();
            const dtSeconds = Math.min((now - lastTickRef.current) / 1000.0, 0.1);
            lastTickRef.current = now;

            if (dtSeconds <= 0) return;

            // Update traditional entities
            setEntities(prev => prev.map(e => stepEntity(e, dtSeconds)));

            // Update ownship if in SIM mode
            if (navModeRef.current === NavMode.SIM) {
                const updatedOwnship = stepEntity(ownshipRef.current, dtSeconds);
                if (updatedOwnship !== ownshipRef.current) {
                    setOwnship(updatedOwnship);
                }
            }
        };

        const interval = setInterval(tick, TICK_RATE_MS);
        return () => clearInterval(interval);
    }, [setOwnship]);

    return { entities, setEntities };
};
