import { useCallback, useEffect, useRef, useState } from 'react';
import { Entity, NavMode } from '../types';
import { cloneEntity } from '../simulation/scenario';
import {
    advanceClock,
    createSimulationClock,
    setClockRunning,
    setClockSpeedValidated,
} from '../simulation/clock';
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
    speed?: number;
    setSpeed?: (speed: number) => boolean;
    simTimeMs: number;
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
    const initialScenarioTimeRef = useRef<number>(Date.now());
    const [simulationClock, setSimulationClock] = useState(() => ({
        ...createSimulationClock(initialScenarioTimeRef.current),
        running: true,
    }));
    const simulationClockRef = useRef(simulationClock);
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
        const pausedClock = setClockRunning(simulationClockRef.current, false);
        simulationClockRef.current = pausedClock;
        setSimulationClock(pausedClock);
        setStatus('PAUSED');
    }, []);

    const resume = useCallback(() => {
        lastTickRef.current = Date.now();
        setIsRunning(true);
        const runningClock = setClockRunning(simulationClockRef.current, true);
        simulationClockRef.current = runningClock;
        setSimulationClock(runningClock);
        setStatus('RUNNING');
    }, []);

    const reset = useCallback(() => {
        setEntities(initialEntitiesRef.current.map(cloneEntity));
        const resetOwnship = cloneEntity(initialOwnshipRef.current);
        ownshipRef.current = resetOwnship;
        setOwnship(resetOwnship);
        lastTickRef.current = Date.now();
        const resetClock = {
            ...createSimulationClock(initialScenarioTimeRef.current),
            running: false,
        };
        simulationClockRef.current = resetClock;
        setSimulationClock(resetClock);
        setIsRunning(false);
        setStatus('RESET · PAUSED');
    }, [setOwnship]);

    const replay = useCallback(() => {
        setEntities(initialEntitiesRef.current.map(cloneEntity));
        const replayOwnship = cloneEntity(initialOwnshipRef.current);
        ownshipRef.current = replayOwnship;
        setOwnship(replayOwnship);
        lastTickRef.current = Date.now();
        const replayClock = {
            ...createSimulationClock(initialScenarioTimeRef.current),
            running: true,
        };
        simulationClockRef.current = replayClock;
        setSimulationClock(replayClock);
        setIsRunning(true);
        setStatus('REPLAY · RUNNING');
    }, [setOwnship]);

    const setSpeed = useCallback((speed: number): boolean => {
        const result = setClockSpeedValidated(simulationClockRef.current, speed);
        if (result.status === 'UNAVAILABLE') return false;
        simulationClockRef.current = result.clock;
        setSimulationClock(result.clock);
        return true;
    }, []);

    useEffect(() => {
        lastTickRef.current = Date.now();

        const tick = () => {
            const now = Date.now();
            const realDeltaMs = now - lastTickRef.current;
            lastTickRef.current = now;

            if (!isRunning || realDeltaMs <= 0) return;

            const currentClock = simulationClockRef.current;
            const advancedClock = advanceClock(setClockRunning(currentClock, true), realDeltaMs);
            simulationClockRef.current = advancedClock;
            setSimulationClock(advancedClock);
            const simulatedDeltaSeconds = (advancedClock.simTimeMs - currentClock.simTimeMs) / 1000;
            if (simulatedDeltaSeconds <= 0) return;

            // Update traditional entities using the shared simulated clock delta.
            setEntities(prev => prev.map(e => stepEntity(e, simulatedDeltaSeconds)));

            // Update ownship if in SIM mode
            if (navModeRef.current === NavMode.SIM) {
                const updatedOwnship = stepEntity(ownshipRef.current, simulatedDeltaSeconds);
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
        simulationControls: {
            isRunning,
            status,
            pause,
            resume,
            reset,
            replay,
            speed: simulationClock.speed,
            setSpeed,
            simTimeMs: simulationClock.simTimeMs,
        },
    };
};
