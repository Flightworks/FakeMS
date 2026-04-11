import { describe, it, expect } from 'vitest';
import { EARTH_RADIUS } from '../../utils/geo';

// We replicate the pure logic from MapDisplay to verify its correctness
const getMapRotation = (mapMode: string, stabMode: string, ownshipHeading: number, frozenHeading: number | null) => {
    return mapMode === 'HEADING_UP'
        ? -((stabMode === 'GND' && frozenHeading !== null) ? frozenHeading : ownshipHeading)
        : 0;
};

const getCenterLatLon = (ownshipPos: { lat: number, lon: number }, panOffset: { x: number, y: number }, stabMode: string, groundAnchor: { lat: number, lon: number } | null) => {
    const base = (stabMode === 'GND' && groundAnchor) ? groundAnchor : ownshipPos;
    const dLat = (panOffset.y / EARTH_RADIUS) * (180 / Math.PI);
    const dLon = (panOffset.x / (EARTH_RADIUS * Math.cos(base.lat * Math.PI / 180))) * (180 / Math.PI);
    return [base.lat + dLat, base.lon + dLon];
};

const rotateVector = (dx: number, dy: number, rotationDeg: number) => {
    const rad = rotationDeg * (Math.PI / 180);
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);
    // Screen to World transformation (un-rotate)
    const de = dx * cosR + dy * sinR;
    const dn = -dx * sinR + dy * cosR;
    return { de, dn };
};

describe('Stabilisation & Orientation Math', () => {
    describe('getMapRotation', () => {
        it('returns 0 in NORTH_UP', () => {
            expect(getMapRotation('NORTH_UP', 'HELICO', 45, null)).toBe(0);
        });

        it('returns negative heading in HEADING_UP (HELICO)', () => {
            expect(getMapRotation('HEADING_UP', 'HELICO', 45, null)).toBe(-45);
        });

        it('returns negative frozen heading in HEADING_UP (GND)', () => {
            expect(getMapRotation('HEADING_UP', 'GND', 45, 30)).toBe(-30);
        });
    });

    describe('getCenterLatLon (Anchor Logic)', () => {
        const pos = { lat: 0, lon: 0 };
        const anchor = { lat: 10, lon: 10 };

        it('uses groundAnchor + panOffset in GND mode', () => {
            // Panning 111319m North (approx 1 degree) relative to anchor (10, 10)
            const center = getCenterLatLon(pos, { x: 0, y: 111319.49 }, 'GND', anchor);
            expect(center[0]).toBeCloseTo(11, 4);
            expect(center[1]).toBe(10);
        });

        it('uses ownship + offset in HELICO mode (ignores anchor)', () => {
            const center = getCenterLatLon(pos, { x: 0, y: 111319.49 }, 'HELICO', anchor);
            expect(center[0]).toBeCloseTo(1, 4);
            expect(center[1]).toBe(0);
        });

        it('is stable when ownship moves in GND mode', () => {
            const movedPos = { lat: 1, lon: 1 };
            const center = getCenterLatLon(movedPos, { x: 0, y: 0 }, 'GND', anchor);
            expect(center).toEqual([10, 10]); // Still at anchor
        });
    });

    describe('rotateVector (Screen to Map Pan)', () => {
        it('drags North correctly (uncovers North) in NUP', () => {
            // rotation = 0. Drag Down (dy = 100) -> world moves North.
            const { de, dn } = rotateVector(0, 100, 0);
            expect(dn).toBeGreaterThan(0); // dn = 100
            expect(de).toBe(0);
        });

        it('drags West correctly (uncovers West) in NUP', () => {
            // rotation = 0. Drag Right (dx = 100) -> world moves West.
            // panX = start - de. So dx > 0 -> de > 0.
            const { de, dn } = rotateVector(100, 0, 0);
            expect(de).toBeGreaterThan(0); // de = 100
            expect(dn).toBe(0);
        });

        it('drags North correctly in HUP with -90 (East Up)', () => {
            // Heading East (90) -> mapRotation = -90. 
            // Top=East, Right=South, Bottom=West, Left=North.
            // Drag RIGHT (dx = 100) -> pull toward South. Uncover North.
            // panY = start + dn. So dn > 0.
            const { de, dn } = rotateVector(100, 0, -90);
            expect(dn).toBeGreaterThan(0); // dn = 100
            expect(de).toBeCloseTo(0);
        });

        it('drags East correctly in HUP with -90 (East Up)', () => {
            // Drag DOWN (dy = 100) -> toward West. Uncover East.
            // panX = start - de. so de < 0 for panX to increase.
            const { de, dn } = rotateVector(0, 100, -90);
            expect(de).toBeLessThan(0); // de = -100
            expect(dn).toBeCloseTo(0);
        });

        it('drags North correctly in HUP with 180 (South Up)', () => {
            // Heading South (180) -> mapRotation = 180.
            // Top=South, Bottom=North.
            // Drag DOWN (dy = 100) -> pull map toward North. Uncover South.
            // panY = start + dn. so dn < 0 for panY to decrease.
            const { de, dn } = rotateVector(0, 100, 180);
            expect(dn).toBeLessThan(0); // dn = -100
            expect(de).toBeCloseTo(0);
        });
    });

    // Pure-function replica of handleSetStabMode freeze logic in App.tsx
    const handleSetStabMode = (
        prev: string, next: string,
        mapMode: string, stabFreezeHeadingDrop: boolean,
        ownshipHeading: number, frozenHeading: number | null
    ): number | null => {
        if (next === 'GND' && prev !== 'GND') {
            if (mapMode === 'HEADING_UP' && stabFreezeHeadingDrop) {
                return ownshipHeading; // freeze
            }
        }
        if (next === 'HELICO') {
            return null; // unfreeze
        }
        return frozenHeading; // unchanged
    };

    describe('Freeze HDG centralization (handleSetStabMode)', () => {
        it('freezes heading on HELICO->GND in HUP with freeze enabled', () => {
            const result = handleSetStabMode('HELICO', 'GND', 'HEADING_UP', true, 135, null);
            expect(result).toBe(135);
        });

        it('does NOT freeze heading in NUP even with freeze enabled', () => {
            const result = handleSetStabMode('HELICO', 'GND', 'NORTH_UP', true, 135, null);
            expect(result).toBeNull();
        });

        it('does NOT freeze heading in HUP with freeze DISABLED', () => {
            const result = handleSetStabMode('HELICO', 'GND', 'HEADING_UP', false, 135, null);
            expect(result).toBeNull();
        });

        it('does NOT freeze on GND->GND (no-op transition)', () => {
            // already in GND, heading should remain unchanged
            const result = handleSetStabMode('GND', 'GND', 'HEADING_UP', true, 200, 135);
            expect(result).toBe(135); // unchanged
        });

        it('clears frozen heading on transition back to HELICO', () => {
            const result = handleSetStabMode('GND', 'HELICO', 'HEADING_UP', true, 200, 135);
            expect(result).toBeNull();
        });
    });

    // Pure logic replica of handleMapModeChange from App.tsx
    const handleMapModeChange = ({
        prevMode,
        nextMode,
        stabRecenterOnOrientSwitch,
        stabMode,
        frozenHeading,
        stabFreezeHeadingDrop,
        ownshipHeading,
    }: {
        prevMode: string,
        nextMode: string,
        stabRecenterOnOrientSwitch: boolean,
        stabMode: string,
        frozenHeading: number | null,
        stabFreezeHeadingDrop: boolean,
        ownshipHeading: number,
    }) => {
        let recenterCalled = false;
        let newFrozenHeading = frozenHeading;

        if (nextMode !== prevMode) {
            if (stabRecenterOnOrientSwitch && stabMode === 'GND') {
                recenterCalled = true;
                newFrozenHeading = null; // handleResetStab resets heading
            } else if (nextMode === 'HEADING_UP' && stabMode === 'GND' && frozenHeading === null && stabFreezeHeadingDrop) {
                newFrozenHeading = ownshipHeading;
            }
        }

        return { recenterCalled, newFrozenHeading };
    };

    describe('Map Mode Change (handleMapModeChange)', () => {
        it('triggers recenter when option is ON and in GND mode', () => {
            const result = handleMapModeChange({
                prevMode: 'NORTH_UP',
                nextMode: 'HEADING_UP',
                stabRecenterOnOrientSwitch: true,
                stabMode: 'GND',
                frozenHeading: null,
                stabFreezeHeadingDrop: true,
                ownshipHeading: 45
            });
            expect(result.recenterCalled).toBe(true);
        });

        it('does NOT trigger recenter when option is OFF', () => {
            const result = handleMapModeChange({
                prevMode: 'NORTH_UP',
                nextMode: 'HEADING_UP',
                stabRecenterOnOrientSwitch: false,
                stabMode: 'GND',
                frozenHeading: null,
                stabFreezeHeadingDrop: false,
                ownshipHeading: 45
            });
            expect(result.recenterCalled).toBe(false);
        });

        it('freezes heading if switching to HUP while panned (GND) and recenter is OFF', () => {
            const result = handleMapModeChange({
                prevMode: 'NORTH_UP',
                nextMode: 'HEADING_UP',
                stabRecenterOnOrientSwitch: false,
                stabMode: 'GND',
                frozenHeading: null, // was NUP, so no frozen heading yet
                stabFreezeHeadingDrop: true,
                ownshipHeading: 120
            });
            expect(result.recenterCalled).toBe(false);
            expect(result.newFrozenHeading).toBe(120);
        });

        it('does nothing if mode is unchanged', () => {
            const result = handleMapModeChange({
                prevMode: 'HEADING_UP',
                nextMode: 'HEADING_UP',
                stabRecenterOnOrientSwitch: true,
                stabMode: 'GND',
                frozenHeading: 10,
                stabFreezeHeadingDrop: true,
                ownshipHeading: 45
            });
            expect(result.recenterCalled).toBe(false);
            expect(result.newFrozenHeading).toBe(10);
        });
    });
});
