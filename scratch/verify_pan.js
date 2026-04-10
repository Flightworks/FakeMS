
const EARTH_RADIUS = 6378137;

function testPan(rotationDeg, dx, dy) {
    const rad = rotationDeg * (Math.PI / 180);
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);

    // Current logic in app:
    // de = dx * cosR - dy * sinR
    // dn = -(dx * sinR + dy * cosR)
    // newPanX = startX - de * mpp
    // newPanY = startY - dn * mpp

    // Let's try the suspected correct logic:
    const de = dx * cosR + dy * sinR;
    const dn = -dx * sinR + dy * cosR;

    // Displacement of center in world coordinates
    // dx_world = -de?
    // dy_world = -dn?
    
    console.log(`Rotation: ${rotationDeg}, Drag: (${dx}, ${dy})`);
    console.log(`DE: ${de.toFixed(2)}, DN: ${dn.toFixed(2)}`);
}

console.log("--- NORTH UP (0) ---");
testPan(0, 100, 0); // Drag Right -> world moves Left (West). de should be 100? panX = start - 100.
testPan(0, 0, 100); // Drag Down -> world moves Up (North). dn should be -100? panY = start - (-100).

console.log("--- EAST UP (-90) ---");
// Top=East, Right=South, Bottom=West, Left=North
testPan(-90, 100, 0); // Drag Right (toward South) -> world moves North. panY should increase.
testPan(-90, 0, 100); // Drag Down (toward West) -> world moves East. panX should increase.
