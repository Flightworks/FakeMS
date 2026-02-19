# Fake MS - HMI Design & Prototyping Engine

Fake MS is a high-fidelity, tactile-first interface designed for **Human-Machine Interface (HMI) thought experiments**. It prioritizes rapid spatial awareness, gesture-driven interaction, and real-time design manipulation through a "Heads-Down Display" (HDD) metaphor.

---

## Technical & Functional Modules

### 1. Experimental Tactical Map
*   **Stabilization Modes**: Implements `NORTH-UP` and `HEADING-UP` (Map rotates based on simulated ownship heading).
*   **Symbology**: Employs simplified military-grade symbology (APP-6) as high-contrast visual anchors for tracking experiments.
*   **Projection & Math**: Uses Mercator-based tile mapping. `MapDisplay.tsx` handles the conversion from World Coordinates (Meters) -> Mercator -> Screen (Pixels), dynamically accounting for `zoomLevel` and `rotation`.
*   **Offline Resilience**: Dynamic loading and caching of dark-mode geographic tiles (CartoDB) via Service Worker for simulation stability.

### 2. Pie Menu System (Radial Interaction Lab)
The Pie Menu is the primary research tool for testing spatial memory and rapid release tasking.
*   **Activation Delay**: Uses an emerald "Progress Ring" with `indicatorDelay` to signal menu opening.
*   **Contextual Logic**: Distinguishes between Map-level (Long Press) and Entity-level (Short Tap) tasking.
*   **Interaction Paradigm**: Uses a "Pointer-Release" selection system. Highlighting sectors triggers haptic "ticks" via `navigator.vibrate` for tactile feedback.
*   **Ghost Buster Logic**: Prevents mobile browser "double-trigger" issues by ignoring mouse events that occur within 1000ms of a touch event, ensuring cross-platform stability.

### 3. Smart Command Bar (NLP & Math Parser)
An experiment in combining command-line speed with visual interfaces.
*   **Fuzzy Search**: Implements generalized fuzzy search for finding commands.
*   **Math Engine**: Supports math functions (e.g., `sqrt`, `cos`, `sin`) with flexible input rules (optional parentheses, e.g., `cos45` -> `cos(45)`).
*   **History & Suggestions**: Provides intelligent suggestions based on partial input (e.g., `sqr` suggests `sqrt(`).

### 4. HUD & Telemetry Panels
*   **Dynamic Anchoring**: Panels can be repositioned to any corner (`TL`, `TR`, `BL`, `BR`) to test layout efficiency.
*   **Declutter (DET)**: A boolean toggle that switches between full telemetry (HDG, HGT, TAS, ALT) and a "Telemetry Only" header.
*   **Visual Tokens**: Real-time manipulation of `scale`, `opacity` (Alpha), and `glow` via `PrototypeSettings`.

---

## Agent & Developer Implementation Notes

### Layout & Overlap Safeguards
*   **Panel Margins**: `OwnshipPanel` must maintain a 1rem margin when in `BL`.
*   **Safe Zones**: `TL` and `TR` positions require a vertical offset (~5.5rem) to clear the `TopSystemBar`. `TL` also requires horizontal clearance for the `LeftSidebar`.
*   **Stacking Priority**: In the `BR` corner, the `OwnshipPanel` must stack *vertically above* the `TargetPanel` to prevent occlusion.

### Performance & Tactile Feel
*   **Memoization**: All map layers and status panels are memoized to maintain 60fps during high-speed rotation or panning.
*   **Simulation Logic**: Track movement is frame-based, moving entities according to their heading and speed in the local coordinate system (Meters North/East).
*   **Animation**: System transitions use cubic-bezier easing ("fly-to" feel) governed by `animationSpeed`.

### Codebase Structure
*   `components/`: Core HMI elements (Map, PieMenu, Sidebar, InfoPanels).
*   `utils/CommandRegistry.ts`: Central registry for Smart Command Bar logic.
*   `types.ts`: Shared interfaces for entity states and interface settings.