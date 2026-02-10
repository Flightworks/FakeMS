# Fake MS (Mission System) - Technical & Functional Specification

Fake MS is a high-fidelity, tactile-first Mission System interface designed for helicopter tactical operations. It prioritizes rapid spatial awareness and data manipulation through a "Heads-Down Display" (HDD) metaphor.

## Core Functionalities

### 1. Tactical Moving Map
- **Stabilization Modes**: Supports `NORTH-UP` (Static map orientation) and `HEADING-UP` (Map rotates based on ownship heading).
- **Symbology**: Employs simplified APP-6 military symbology.
  - **Ownship**: Cyan rectangle frame (Friendly) with rotary-wing icon.
  - **Hostile**: Red diamond frame with "ENY" identifier.
  - **Waypoint/Control Measures**: Amber circles/points.
- **Speed Vectors**: Optional velocity leaders for all tracked entities, indicating projected path. Calculated as a projection of current ground speed and track heading.
- **Tile Management**: Dynamic loading and caching of dark-mode geographic tiles (OpenStreetMap/CartoDB) for offline mission resilience via Service Worker.
- use state of the art tactile control laws for touch screens.
### 2. HUD & Telemetry (Ownship Infobox)
- **Dynamic Positioning**: Users can prototype the interface by anchoring the infobox to any of the four corners (`TL`, `TR`, `BL`, `BR`).
- **Declutter Logic**: Features a `DET` (Detail) toggle to switch between a full telemetry suite (HDG, HGT, TAS, ALT) and a minimized "Telemetry Only" header.
- **Visual Customization**: Real-time adjustment of panel scale, opacity (Alpha), and UI glow intensity.

### 3. System Status & Management
- **Top System Bar**: Displays Zulu time (Z) and critical system health for Radar (RDR), Electronic Warfare (EWS), ADS-B/AIS integration, and Electro-Optical Sensors (EOS). those are called permanent widget keys (or PW)
- **Sidebar (QAK)**: Quick Access Keys for stabilization, HUD prototyping, and gesture calibration.

## The Pie Menu System (Contextual Radial Interface)

The Pie Menu is the primary interaction layer for mission tasking, optimized for spatial memory.

### Activation Mechanics
- **Entity Context Menu (Short Press)**: Triggered by a quick tap (below `tapThreshold`) directly on a track/entity icon. This avoids the delay of a long-press for immediate track tasking.
- **Map Context Menu (Long Press)**: Triggered by holding anywhere on the map background. 
- **Visual Feedback**: An emerald "Progress Ring" appears after `indicatorDelay` during a hold to signal the transition to a menu request.
- **Selection Paradigm**: Uses "Pointer-Release". The user slides their finger/cursor to highlight a sector and releases to execute. Crossing the inner/outer radius boundaries or angular sectors triggers haptic "ticks".

### Contextual Logic
- **Map Menu**: Actions like `DROP` (WPT/TGT/LZ), `TRACKS` (VEC/CLR), `TOOLS` (RULER), and `VIEW` (NVG/THERM).
- **Entity Menu**: Specific tasking like `NAV` (Direct To), `ENGAGE` (Weapons Auth), `COMMS` (Handoff), and `SENSORS` (Slew to Target).

---

## Developer & Agent Implementation Notes

### Layout & Overlap Safeguards
- **Infobox Positioning**: The `OwnshipPanel` (infobox) must Sit flush with the screen margin (1rem) when in the `BL` (Bottom Left) position. 
- **HUD Safe Zones**: When positioned in `TL` or `TR`, the panel must include a vertical offset (approx 5.5rem) to avoid overlapping the `TopSystemBar`. When in `TL`, it must also include a horizontal offset to clear the `LeftSidebar` trigger area.
- **Stacking Logic**: If the `OwnshipPanel` is set to `BR`, it should stack vertically above the `TargetPanel` to ensure neither is obscured.

### Coordinate Systems & Mapping
- **Projection**: The app uses a Mercator-based projection for tile mapping. 
- **Local Space**: Entities are tracked in a local coordinate system (Meters North/East from a central origin). 
- **Map Math**: `MapDisplay` handles the conversion between World (Meters) -> Mercator -> Screen (Pixels), accounting for both `zoomLevel` and the `rotation` applied by Heading-Up mode.

### Performance & Tactile Feel
- **Memoization**: Panels (`OwnshipPanel`, `TargetPanel`) and individual map layers are memoized to ensure high frame rates during high-speed panning or rotation.
- **Haptics**: Use `navigator.vibrate` with distinct patterns for hover (short 5ms) vs. selection (20ms) vs. authorization (50ms).
- **Animation**: System transitions (e.g., centering the map) use cubic-bezier easing for a "fly-to" feel, controlled by `animationSpeed` in settings.

### Simulation Logic
- **Track Movement**: A simple frame-based simulation moves "Enemy" tracks based on their heading and speed. 
- **State**: Centralized `PrototypeSettings` allows live manipulation of all gesture and visual variables without app reloads.