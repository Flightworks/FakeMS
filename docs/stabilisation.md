# Tactical Map Stabilization & Orientation Logic

Fake MS implements a high-fidelity separation between **Navigation (H/C)** and **Tactical (GND)** exploitation modes.

## The Two Operational Needs

| Mode | Context | Stabilization Logic | Focus |
| :--- | :--- | :--- | :--- |
| **NAVIGATION** | En-route, transit, approach | **H/C (Helicopter/Cursor)** | Ownship position and heading are primary. Map rotates around the H/C position. |
| **TACTICAL** | Area exploitation, target tracking | **GND (Ground)** | Geographic coordinates are primary. Map is anchored to a ground point. |

---

## Stabilization Controls (STAB Button)

The **STAB** button in the Left Sidebar acts as a state carousel:

1.  **H/C Mode**:
    - Ownship remains fixed at its screen position (center or panned offset).
    - Map rotates around the ownship.
    - Continuous orientation stabilization maintains the ownship's screen position regardless of heading changes.

2.  **GND Mode**:
    - Map is anchored to a specific geographic coordinate.
    - Ownship moves relative to the ground.
    - Map rotation occurs around the **screen center**.

**Automatic Transition (Ghosting):**
If the user pans the map in **H/C** mode and the ownship leaves the viewport boundaries, the system automatically transitions to **GND** stabilization at the last memorized heading.

**Manual Recovery:**
If in **GND** (ghosted or panned), pressing the **H/C** button or clicking the **Ghost Indicator** triggers a smooth recovery:
- Map glides back to center on ownship.
- Stabilization resets to **H/C**.
- The map orientation (NUP/HUP) is restored to its state prior to the ghosting/pan event.

---

## Orientation Logic (Compass Button)

The compass button (top-left) controls map orientation. Its behavior depends on the active stabilization.

### Logic Matrix

| Initial Stab | Orientation Switch | HUP Behavior | NUP Behavior |
| :--- | :--- | :--- | :--- |
| **H/C** | NUP $\leftrightarrow$ HUP | Rotation around ownship. | Rotation around ownship. |
| **GND** | NUP $\leftrightarrow$ HUP | Rotation around screen center. | Rotation around screen center. |

**HUP Stabilization (Frozen Heading):**
In **GND** mode with **HEADING-UP**, the map orientation is "frozen" at the specific heading (usually the heading at the moment of transition) to avoid the "orbiting" effect while tracking ground targets. Pressing the compass will re-align or toggle back to North.

---

## Implementation Details for Developers

- **Maintain Screen Position**: Implemented via calculated `activePan` offsets that compensate for map rotation relative to the ground anchor.
- **Ghost Tracking**: Monitored via the `GhostTracker` component which uses the actual parent viewport dimensions (not the oversized map element) for boundary clipping.
- **Rotation Math**: Map rotation is applied via CSS `rotate()` on the `MapContainer`, while icons are counter-rotated to remain upright.
