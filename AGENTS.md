# Fake MS (Mission System) - Functional Specification

Fake MS is a high-fidelity, tactile-first Mission System interface designed for helicopter tactical operations. It prioritizes rapid spatial awareness and data manipulation through a "Heads-Down Display" (HDD) metaphor.

## Core Functionalities

### 1. Tactical Moving Map
- **Stabilization Modes**: Supports `NORTH-UP` (Static map orientation) and `HEADING-UP` (Map rotates based on ownship heading).
- **Symbology**: Employs simplified APP-6 military symbology.
  - **Ownship**: Cyan rectangle frame (Friendly) with rotary-wing icon.
  - **Hostile**: Red diamond frame with "ENY" identifier.
  - **Waypoint/Control Measures**: Amber circles/points.
- **Speed Vectors**: Optional velocity leaders for all tracked entities, indicating projected path based on current speed and heading.
- **Tile Management**: Dynamic loading and caching of dark-mode geographic tiles for offline mission resilience.

### 2. HUD & Telemetry (Ownship Infobox)
- **Dynamic Positioning**: Users can prototype the interface by anchoring the infobox to any of the four corners (`TL`, `TR`, `BL`, `BR`).
- **Declutter Logic**: Features a `DET` (Detail) toggle to switch between a full telemetry suite (HDG, HGT, TAS, ALT) and a minimized "Telemetry Only" header.
- **Visual Customization**: Real-time adjustment of panel scale and opacity (Alpha) to optimize visibility against varying map backgrounds.

### 3. System Status & Management
- **Top System Bar**: Displays Zulu time (Z) and critical system health for Radar (RDR), Electronic Warfare (EWS), ADS-B/AIS integration, and Electro-Optical Sensors (EOS).
- **Sidebar (QAK)**: Quick Access Keys for stabilization, HUD prototyping, gesture calibration, and visual filter settings.

## The Pie Menu System (Contextual Radial Interface)

The Pie Menu is the primary interaction layer for mission tasking. It is designed to minimize cognitive load by using spatial memory. short press pie menu is for objects and long press anywhere on map.

### Activation Mechanics
- **Trigger**: A long-press gesture (configurable threshold, default ~1000ms).
- **Visual Feedback**: An emerald "Progress Ring" appears after an initial delay (`indicatorDelay`) to signal the transition from a map pan/tap to a menu request.
- **Selection**: Radial selection uses a "Pointer-Release" paradigm. Users move their finger/cursor toward a sector to highlight it and release to execute.

### Contextual Logic
The system generates distinct menus based on the target of the long-press:

#### A. Map Context Menu (Tactical Planning)
- **DROP**: Rapid marking of Waypoints (WPT), Targets (TGT), Landing Zones (LZ), or Forward Arming and Refueling Points (FARP).
- **TRACKS**: Global track management, including toggling vectors (VEC) or clearing the track file.
- **TOOLS**: Measurement tools (RULER), Mark points, and Elevation profiles.
- **VIEW**: Display filters like Night Vision (NVG) or Thermal (THERM).

#### B. Entity Context Menu (Track Management)
- **NAV**: Engagement-specific navigation (Direct To, Holding Patterns, Flight Plan offsets).
- **ENGAGE**: Weapon systems authorization (AUTH) or SPI (Sensor Point of Interest) designation.
- **COMMS**: Tactical data exchange (Handoffs, Squawk interrogation, Datalink).
- **SENSORS**: Slewing the EOS/FLIR to the target or establishing a Single Target Track (STT).
- **ADMIN**: Manual track deletion or property inspection.

### Technical Precision
- **Inner Ring**: High-level categories (e.g., NAV, ENGAGE).
- **Outer Ring**: Specific sub-actions (e.g., DIRECT, HOLD). The outer ring dynamically fans out relative to the parent sector's angle to ensure ergonomic reach.
- **Haptic Integration**: Variable vibration pulses signal hover states (light) vs. selection execution (strong).