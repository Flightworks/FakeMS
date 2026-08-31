import { useEffect, useRef, useState } from 'react';
import { Entity, NavMode } from '../types';
import { stepEntity } from '../domain/kinematics';

export { stepEntity } from '../domain/kinematics';

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
