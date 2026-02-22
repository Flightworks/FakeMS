import { useEffect, useRef, useState } from 'react';
import { Entity, EntityType } from '../types';
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
 * The core simulation engine Hook.
 * Automatically ticks entities forward based on true elapsed time and kinematics rules.
 */
export const useSimulation = (initialEntities: Entity[]) => {
    const [entities, setEntities] = useState<Entity[]>(initialEntities);
    const lastTickRef = useRef<number>(Date.now());

    // Configurable sim tick rate. 
    // Usually 20-50ms for smooth UI, or 1000ms for strict periodic updates.
    const TICK_RATE_MS = 1000 / 30;

    useEffect(() => {
        lastTickRef.current = Date.now();

        const tick = () => {
            const now = Date.now();
            const dtSeconds = (now - lastTickRef.current) / 1000.0;
            lastTickRef.current = now;

            if (dtSeconds <= 0) return;

            setEntities(prev => prev.map(entity => {
                // Currently only moving enemies or entities with actual speeds/kinematics.
                // You can remove this check if you want ownship to physically follow waypoints too.
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

                    // If close to waypoint (e.g. within 200 meters), pop it
                    if (distToWp < 200) {
                        waypoints.shift();
                        if (waypoints.length === 0) {
                            waypoints = undefined;
                        }
                    } else {
                        // Steer towards waypoint
                        targetHeading = bearingBetween(lat, lon, nextWp.lat, nextWp.lon);
                    }
                }

                // --- 2. Heading / Turn Logic ---
                const turnDiff = angleDifference(currentHeading, targetHeading);
                if (turnDiff !== 0) {
                    let change = turnRate * dtSeconds;
                    // Cap the change if we are very close to target heading
                    if (Math.abs(turnDiff) < change) {
                        currentHeading = targetHeading;
                    } else {
                        currentHeading += Math.sign(turnDiff) * change;
                    }
                    currentHeading = normalizeAngle(currentHeading);
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
                    if (currentSpeed < 0) currentSpeed = 0; // No reverse for now
                }

                // --- 4. Position Update ---
                if (currentSpeed > 0) {
                    // distance in meters = speed (m/s) * time (s)
                    const distanceMeters = (currentSpeed * KNOTS_TO_M_S) * dtSeconds;

                    // get new Geographic coordinates
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
            }));
        };

        const interval = setInterval(tick, TICK_RATE_MS);
        return () => clearInterval(interval);
    }, []);

    return { entities, setEntities };
};
