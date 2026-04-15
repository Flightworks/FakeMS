# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.3] - 2026-04-15

### Added
- **Stabilization Logic Documentation**: Created a comprehensive guide (`docs/stabilisation.md`) defining the behavioral matrix for Navigation vs. Tactical modes.
- **Improved H/C Recenter**: The STAB toggle in the sidebar now triggers a coordinated recovery (glide + orientation restore) when switching from GND back to HELICO mode.

### Fixed
- **Ghost Ownship Visibility**: Resolved a bug where the off-screen indicator was clipped incorrectly. Now uses actual parent viewport dimensions for boundary calculations instead of oversized map buffering zones.

## [1.3.2] - 2026-04-12

### Fixed
- **Tactical Map Stabilization**: Corrected the coordinate transformation math in the stabilization engine. Fixed a sign error where the map was counter-rotating with the wrong polarity, causing "jumps" during orientation toggles and drift during continuous turns. The fix correctly accounts for Leaflet's screen-space y-axis inversion.
- **Orientation Synchronization**: Centralized stabilization logic in `MapDisplay` and removed redundant path compensation in `App.tsx` that was causing jitter.

## [1.3.1] - 2026-04-12

### Fixed
- **HELICO Mode Orbit Drift**: Fixed a critical stabilization bug where the ownship would "orbit" the map center during continuous heading changes. The map now dynamically offsets in the background to maintain its locked screen-pixel relationship with the helicopter's position during rotation.

## [1.3.0] - 2026-04-11

### Added
- **Maintain Screen Position**: Added a new stabilization feature that preserves the ownship's screen coordinates when switching between map orientations (North-Up vs Heading-Up). This allows for seamless tactical context transitions without the ownship "jumping" relative to the operator's gaze.
- **Interactive Ghost Ownship**: Enhanced the off-screen ownship indicator with better visibility and interactivity. Users can now click the ghost indicator to immediately recenter the map on the ownship.
- **Smooth Rotation Unfreeze**: Added an option to smoothly animate the map rotation back to the live heading when recentering from GND mode, improving spatial awareness during recovery.

## [1.2.0] - 2026-04-11

### Added
- **Centralized Stabilization Logic**: Refactored the application core to centrally manage stabilization modes (`GND` vs `HELICO`), map orientation (`NORTH-UP` vs `HEADING-UP`), and heading freeze states.
- **Orientation Recenter Control**: Added the `stabRecenterOnOrientSwitch` setting, allowing users to toggle whether the map automatically recenters on the ownship when switching map modes.
- **Smart Heading Freeze**: The map now automatically freezes to the current heading when switching to `HEADING-UP` while in a panned state (`GND` mode), preventing disorienting jumps.
- **Stabilization Test Suite**: Added a dedicated comprehensive test suite for stabilization transitions and edge cases.

### Fixed
- **Unintended Map Resets**: Fixed a bug where switching map modes would always force a recenter, bypassing the "Recenter on Orient" toggle.
- **Command Palette Inconsistency**: Ensured that map mode changes triggered via the command palette correctly route through the centralized stabilization handler.

## [1.1.0] - 2026-03-15

### Added
- **Tactical Visibility Filtering**: Implemented context-aware entity filtering. Entities now automatically toggle visibility based on their sensor requirements (e.g., Enemy targets require Radar, Friendly targets require ADSB).
- **Map Symbology Labels**: Added persistent high-contrast alphanumeric labels (e.g., "HOSTILE-1", "BASE") to tactical symbols. Labels use fixed rotation to remain upright during map maneuvers.
- **Robust Test Infrastructure**: Integrated a complete Vitest and React Testing Library suite covering MapDisplay, CommandPalette, InfoPanels, and geographic utilities.
- **Global UI Scaling System**: Established a consistent scale transformation across all tactical panels.

### Changed
- **Enhanced Map Component**: Refactored `MapDisplay` to support deep integration with the system status registry and improve interaction handling for touch devices.

### Fixed
- **State Closure Issues**: Resolved several minor mathematical drift issues in origin recalculation and panel positioning.
- **TypeScript Compliance**: Fixed several latent type errors and initialized refs for better structural safety.

## [1.0.3] - 2026-03-08

### Added
- **Document Viewer Overlay**: Introduced a dedicated documentation reader component to view Markdown files directly within the application.
- **Fuzzy Search for Documentation**: The command palette now supports fuzzy searching and opening documentation files (e.g., `README.md`, `CHANGELOG.md`, `optask.md`).
- **Sidebar Version Info & Changelog**: The left sidebar now displays the current application version and provides a direct link to view the changelog.
- **OPTASK Manual**: Added a new `optask.md` operational tasking report with structured mission data.
- **Automatic Changelog Rule**: Added a new agent rule to ensure version bumps always trigger changelog updates.

### Changed
- **UI Scaling Support**: Enhanced various components to respect global UI scaling settings for better accessibility.
- **Refined Document Rendering**: Improved Markdown presentation with syntax highlighting, GFM support, and "Raw" vs "Rendered" view toggles.

### Fixed
- **Sidebar Interaction**: Fixed an issue where sidebar category tooltips or submenus might persist incorrectly.

## [1.0.2] - 2026-03-01

### Added
- **Command Palette/Scratchpad History**: The scratchpad now visually supports standard full text saves.
- **Improved History Logs**: History timestamps are now rendered elegantly as `HH:MM`. Furthermore, history entries now gracefully default to saving the *final command configuration executed* instead of saving just the partial string that was initially typed.
- **Scratchpad Copy Controls**: 
  - Complete inputs can be instantly copied via a direct GUI action.
  - Hovering over historical executions provides localized clipboard icon copying points.
  - Coordinate extraction prompts are automatically exposed in the GUI context once latitude and longitude definitions are parsed.

### Fixed
- **Simulation Physics**: Fixed a serious critical state-mutation memory leak impacting rendering fidelity on mount. The hook `useSimulation.ts` incorrectly chained `setEntities` inside of React Strict Mode 18's closed side-effect loops, multiplying mathematical geofence shift jumps resulting in tracks warping drastically off the edge of the world. Now natively references an idempotent absolute constant node.


## [1.0.1] - Previous Updates

### Added
- New key mapping: "ESC" has been bound structurally mapping as an exit context for the command UI.
- Tactical command options update specific interactions via `navigator.vibrate` adding tactical haptic feedback mechanisms over browser interactions. 

### Fixed
- Geolocation tracking now directly recalculates relative offsets from specific track properties to the origin layer preventing instances of tracks clipping completely away from local viewport domains. 


## [1.0.0] 

### Added
- Tactical command interfaces defined, supporting basic navigation calculations and mapping. 
- Math evaluation functions via specific `eval` libraries to interpret spatial telemetry.
- Support relative projection parsing allowing operators to generate distance endpoints over specific tactical vectors.
