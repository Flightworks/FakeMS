import { useCallback, useEffect, useRef, useState } from 'react';
import { Entity, NavMode } from '../types';
import { cloneEntity } from '../simulation/scenario';
import { stepEntity } from '../domain/kinematics';

export { stepEntity } from '../domain/kinematics';

export const SIMULATION_TICK_MS = 100;

export interface SimulationControls {
    isRunning: boolean;
    status: 'RUNNING' | 'PAUSED' | 'RESET · PAUSED' | 'REPLAY · RUNNING';
    pause: () => void;
    resume: () => void;
    reset: () => void;
    replay: () => void;
}

/**
 * The core simulation engine Hook.
 *
 * The UI controls below only change the local deterministic simulation. They
 * never acquire a real position or send an external command.
 */
export const useSimulation = (
    initialEntities: Entity[],
    ownship: Entity,
    setOwnship: React.Dispatch<React.SetStateAction<Entity>>,
    ownshipNavMode: NavMode
) => {
    const [entities, setEntities] = useState<Entity[]>(() => initialEntities.map(cloneEntity));
    const [isRunning, setIsRunning] = useState(true);
    const [status, setStatus] = useState<SimulationControls['status']>('RUNNING');
    const lastTickRef = useRef<number>(Date.now());
    const ownshipRef = useRef(ownship);
    const navModeRef = useRef(ownshipNavMode);
    const initialEntitiesRef = useRef(initialEntities.map(cloneEntity));
    const initialOwnshipRef = useRef(cloneEntity(ownship));

    // Keep refs populated for the interval closure
    useEffect(() => { ownshipRef.current = ownship; }, [ownship]);
    useEffect(() => { navModeRef.current = ownshipNavMode; }, [ownshipNavMode]);

    const pause = useCallback(() => {
        setIsRunning(false);
        setStatus('PAUSED');
    }, []);

    const resume = useCallback(() => {
        lastTickRef.current = Date.now();
        setIsRunning(true);
        setStatus('RUNNING');
    }, []);

    const reset = useCallback(() => {
        setEntities(initialEntitiesRef.current.map(cloneEntity));
        const resetOwnship = cloneEntity(initialOwnshipRef.current);
        ownshipRef.current = resetOwnship;
        setOwnship(resetOwnship);
        lastTickRef.current = Date.now();
        setIsRunning(false);
        setStatus('RESET · PAUSED');
    }, [setOwnship]);

    const replay = useCallback(() => {
        setEntities(initialEntitiesRef.current.map(cloneEntity));
        const replayOwnship = cloneEntity(initialOwnshipRef.current);
        ownshipRef.current = replayOwnship;
        setOwnship(replayOwnship);
        lastTickRef.current = Date.now();
        setIsRunning(true);
        setStatus('REPLAY · RUNNING');
    }, [setOwnship]);

    useEffect(() => {
        lastTickRef.current = Date.now();

        const tick = () => {
            const now = Date.now();
            const dtSeconds = Math.min((now - lastTickRef.current) / 1000.0, 0.1);
            lastTickRef.current = now;

            if (!isRunning || dtSeconds <= 0) return;

            // Update traditional entities
            setEntities(prev => prev.map(e => stepEntity(e, dtSeconds)));

            // Update ownship if in SIM mode
            if (navModeRef.current === NavMode.SIM) {
                const updatedOwnship = stepEntity(ownshipRef.current, dtSeconds);
                if (updatedOwnship !== ownshipRef.current) {
                    ownshipRef.current = updatedOwnship;
                    setOwnship(updatedOwnship);
                }
            }
        };

        const interval = setInterval(tick, SIMULATION_TICK_MS);
        return () => clearInterval(interval);
    }, [isRunning, setOwnship]);

    return {
        entities,
        setEntities,
        simulationControls: { isRunning, status, pause, resume, reset, replay },
    };
};
