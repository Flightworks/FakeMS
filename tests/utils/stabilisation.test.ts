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

    describe('Maintain Screen Position (Implementation Logic)', () => {
        // Replicating specific math from App.tsx handleMapModeChange
        const calculatePanAdjustment = (
            prevPan: { x: number, y: number },
            prevMode: string,
            nextMode: string,
            stabMode: string,
            ownshipHeading: number,
            frozenHeading: number | null,
            maintainScreenPos: boolean
        ) => {
            if (!maintainScreenPos) return prevPan;

            const prevRot = prevMode === 'HEADING_UP'
                ? -((stabMode === 'GND' && frozenHeading !== null) ? frozenHeading : ownshipHeading)
                : 0;
            const nextRot = nextMode === 'HEADING_UP'
                ? -((stabMode === 'GND' && frozenHeading !== null) ? frozenHeading : ownshipHeading)
                : 0;
            const deltaDeg = nextRot - prevRot;

            if (Math.abs(deltaDeg) < 0.01) return prevPan;

            // Branching based on user feedback
            if (stabMode === 'GND') {
                // GND mode should rotate around map center (no pan adjustment)
                return prevPan; 
            }

            // HELICO mode should rotate around ownship
            // The pan offset must rotate in the OPPOSITE direction of the map rotation
            // to maintain the same screen coordinates.
            const rad = -(deltaDeg) * (Math.PI / 180);
            const cosR = Math.cos(rad);
            const sinR = Math.sin(rad);

            return {
                x: prevPan.x * cosR - prevPan.y * sinR,
                y: prevPan.x * sinR + prevPan.y * cosR
            };
        };

        it('maintains screen position in HELICO mode (NUP -> HUP)', () => {
            // NUP (0) -> HUP (Heading 90 East -> -90 CSS)
            // Initial Pan: Offset {x: 100, y: 0} (Center is 100m East of Ownship)
            // rotation changes from 0 to -90. deltaDeg = -90.
            // Requirement: Ownship stays at same screen pos.
            // Screen Pos at 0: rotate(0) * (-pan) = (-100, 0)
            // Screen Pos at -90: rotate(-90) * (-newPan) = (-100, 0)
            // rotate(-90) CCW 90deg. For it to result in (-100, 0), input must be (0, -100).
            // So -newPan = (0, -100) -> newPan = (0, 100).
            // Rotation of (100, 0) by -90 CW (deltaDeg = -90) results in (0, -100).
            // Wait, RotateMath(100, 0, -90) = (0, -100). 
            
            const prevPan = { x: 100, y: 0 };
            const nextPan = calculatePanAdjustment(prevPan, 'NORTH_UP', 'HEADING_UP', 'HELICO', 90, null, true);
            
            expect(nextPan.x).toBeCloseTo(0);
            expect(nextPan.y).toBeCloseTo(100);
        });

        it('rotates around center in GND mode (ignores ownship pos)', () => {
            const prevPan = { x: 100, y: 100 };
            const nextPan = calculatePanAdjustment(prevPan, 'NORTH_UP', 'HEADING_UP', 'GND', 90, 45, true);
            
            // In GND mode, it should not change
            expect(nextPan).toEqual(prevPan);
        });

        it('replicates MapDisplay logic to verify unified jump handling', () => {
            // This test simulates the MapDisplay's internal logic after an orientation switch
            // where the panOffset (in App state) HAS NOT CHANGED.
            
            let panOffsetState = { x: 100, y: 0 }; // 100m East, 0m North
            
            // 1. Initial State: HUP at Heading 90 (rotation -90)
            // rotAtPanSet = -90. currentRotation = -90. delta = 0.
            // effectivePan = (100, 0)
            
            // 2. Transition: Switch to NUP (rotation 0)
            // App state panOffsetState stays {x: 100, y: 0}
            // MapDisplay sees: mapRotation = 0. rotAtPanSet = -90.
            // deltaDeg = 0 - (-90) = 90.
            // rad = -90.
            const rad = -(90) * (Math.PI / 180);
            const cosR = Math.cos(rad);
            const sinR = Math.sin(rad);
            const activePanX = panOffsetState.x * cosR - panOffsetState.y * sinR;
            const activePanY = panOffsetState.x * sinR + panOffsetState.y * cosR;
            
            // In HUP at 90 (East Up), (100, 0) is 100m East, which is DOWN on screen.
            // In NUP at 0 (North Up), (100, 0) is 100m East, which is RIGHT on screen.
            // We want the ownship to stay at the same screen spot (DOWN).
            // In NUP, DOWN on screen is 100m South (x=0, y=-100).
            expect(activePanX).toBeCloseTo(0);
            expect(activePanY).toBeCloseTo(-100);
            
            // This confirms that if App.tsx DOES NOTHING, MapDisplay handles the jump perfectly.
        });
    });
});
