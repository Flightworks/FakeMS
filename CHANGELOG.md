# Changelog

All notable changes to this project will be documented in this file.

## [1.3.5] - 2026-04-15
### Changed
- **UI Refinement**: Removed background gradients and shadows from the top system bar and map for a cleaner, "floating" HMI interface.

## [1.3.0] - [1.3.4] - April 2026
### Added
- **Map Orientation & Stabilization**: Introduced high-fidelity **Navigation (HELICO)** and **Tactical (GND)** stabilization modes.
- **Maintain Screen Position**: Ownship now preserves its screen coordinates during North-Up/Heading-Up transitions.
- **Tactical Ghosting**: Advanced off-screen tracking with click-to-recenter functionality.
- **Improved Documentation**: Added comprehensive stabilization guides and architectural consistency rules.
- **Automated Testing**: Established unit test suites for sidebar controls and stabilization logic.

### Fixed
- **Stabilization Reliability**: Resolved issues with map rotation jitter, coordinate drift, and ownship "orbiting" during maneuvers.
- **Interface Logic**: Fixed button toggle regressions and ghost indicator clipping issues.

## [1.2.0] - 2026-04-11
### Added
- **Centralized Core Logic**: Unified stabilization, orientation, and heading freeze management in the application core.
- **Context-Aware Mode Switching**: Added intelligent defaults for heading freeze and recentering during stabilization transitions.

## [1.1.0] - 2026-03-15
### Added
- **Tactical Visibility Filtering**: Implemented sensor-based entity filtering (Radar, ADSB, etc.).
- **Upright Map Symbology**: Added alphanumeric labels with rotation compensation to remain upright.
- **Global UI Scale**: Established a unified scaling system across all HMI panels.

## [1.0.0] - [1.0.3] - February - March 2026
### Added
- **HMI Foundation**: Integrated Command Palette, Radial Pie Menu, and Telemetry Panels.
- **Operational Tools**: Introduced a Document Viewer with fuzzy search and operational tasking (OPTASK) reports.
- **Tactical Math**: Implemented WGS84 geodesic math for distance, bearing, and projection calculations.
- **Interaction Layer**: Added cross-platform pointer event support and haptic feedback.

### Fixed
- **Simulation Integrity**: Resolved critical state-mutation leaks impacting physics and rendering fidelity.
