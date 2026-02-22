# Fake MS - HMI Design & Prototyping Engine

Fake MS is a high-fidelity, tactile-first interface designed for **Human-Machine Interface (HMI) thought experiments**. It prioritizes rapid spatial awareness, gesture-driven interaction, and real-time design manipulation through a "Heads-Down Display" (HDD) metaphor.

---

## Technical & Functional Modules

### 1. Experimental Tactical Map
*   **Stabilization Modes**: Implements `NORTH-UP` and `HEADING-UP` (Map rotates based on simulated ownship heading).
*   **Symbology**: Employs simplified military-grade symbology (APP-6) as high-contrast visual anchors for tracking experiments.
*   **Projection & Math**: Uses Mercator-based tile mapping with **WGS84 Geodesic math** for distance and bearing calculations (`utils/geo.ts`). `MapDisplay.tsx` handles the conversion from World Coordinates (Meters) -> Mercator -> Screen (Pixels).
*   **Offline Resilience**: Dynamic loading and caching of dark-mode geographic tiles (CartoDB) via Service Worker for simulation stability.

### 2. Radial Interaction Lab (Pie Menu)
The Pie Menu is the primary research tool for testing spatial memory and rapid release tasking.
*   **Activation Delay**: Uses an emerald "Progress Ring" with `indicatorDelay` to signal menu opening.
*   **Interaction Paradigm**: Uses a "Pointer-Release" selection system. Highlighting sectors triggers haptic "ticks" via `navigator.vibrate` for tactile feedback.
*   **Safety (Ghost Buster)**: Prevents mobile "double-trigger" issues by ignoring emulated mouse events that follow touch events. **Crucial**: Always prioritize `PointerEvents` and use CSS `touch-action: none` on interactive canvases.

### 3. Smart Command Bar (Tactical Scratchpad)
Combines NLP-style input with navigation projection tools.
*   **Swipe-to-Execute**: High-list items in the palette support a "Swipe Right" gesture (using Framer Motion `drag`) to trigger actions instantly without the primary button.
*   **Drag-to-Map**: Command results (like coordinates or entities) can be dragged directly onto the map as `application/json` payloads, where `MapDisplay` resolves the drop into tactical actions.
*   **Math & Trig**: Native support for degrees (e.g., `cos45`). Math parser is resilient to missing parentheses and integrates **WGS84 Earth Radius** for accurate unit conversions.
*   **Fuzzy Search**: Implements generalized fuzzy search (via `fuse.js`) for finding entities and registry commands.

### 4. Info Panels & Telemetry
*   **Dynamic Anchoring**: Panels can be repositioned to any corner (`TL`, `TR`, `BL`, `BR`). 
*   **Stacking Guard**: In the `BR` corner, `OwnshipPanel` must stack vertically above the `TargetPanel`.
*   **Declutter (DET)**: A boolean state that toggles between full telemetry and "high-importance only" views.

---

## Agent & Developer Workflow

### 🚀 Parallel Branching (Git Worktree)
This codebase supports working on multiple branches simultaneously via **Git Worktrees**.
*   **Benefit**: Allows an agent to have `main` and a feature branch (e.g., `scratchpad`) checked out in separate directories.
*   **Workflow**: Use `git worktree add ../FakeMS-fix branch-name` to create a parallel workspace. This avoids the need to stash/commit when context switching.

### 🏗️ Build & CI/CD Awareness
*   **Dependency Management**: Always run `npm install` after a merge/pull. The project relies on `framer-motion` and `mathjs`, which can cause CI/CD failures if the lockfile or environment is out of sync.
*   **Deployment**: Merges to `main` trigger a GitHub Pages build. Bump the version in `package.json` to force a re-deploy if CI fails due to environmental issues.

### 🛡️ Code Consistency Rules
*   **Pointer Events**: Never use `mousedown/mouseup` alone. Use `PointerEvent` to ensure cross-platform compatibility (Touch + Mouse).
*   **Memoization**: Map layers must be memoized. A frame drop during a 360-degree rotation breaks the HMI "feel."
*   **Z-Index**: Keep `CommandPalette` at the highest level (`z-[100]`), followed by `Sidebars/TopBars` (`z-50`).

---

## Codebase Structure
*   `components/`: Core HMI elements (Map, PieMenu, Sidebar, InfoPanels).
*   `utils/CommandRegistry.ts`: Central registry for Smart Command Bar logic.
*   `types.ts`: Shared interfaces for entity states and interface settings.