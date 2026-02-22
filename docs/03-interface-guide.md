# Interface Guide

The Fake MS interface is divided into several key areas designed for easy access during flight operations.

## 1. Tactical Moving Map

The map is the heart of the application.

*   **Navigation**: Pan by dragging with one finger (or mouse) and zoom using the scroll wheel or pinch gestures.
*   **Stabilization Modes**:
    *   **NORTH-UP**: The top of the map is always North.
    *   **HEADING-UP**: The map rotates so that the direction you are facing is always at the top.
*   **Symbology**:
    *   **Blue Square (Viper 1-1)**: Your own ship (Ownship).
    *   **Red Diamond (Hostile)**: Enemy targets or unknown surface/air contacts.
    *   **Amber Circle (Waypoint)**: Waypoints, airports, or points of interest.
*   **Velocity Leaders**: Lines protruding from icons indicate their current heading and speed (Speed Vectors).

## 2. The Pie Menu (Radial Actions)

The Pie Menu is a fast way to perform actions without looking for tiny buttons.

*   **How to Activate**:
    *   **Tap on an icon**: Opens a menu specific to that target (e.g., Navigate To, Engage).
    *   **Long-press on the map**: Opens a general map menu (e.g., Drop Waypoint, Ruler Tool).
*   **How to Select**: Slide your finger toward the action you want and release. You will feel a small vibration (on touch devices) when you highlight an item.
*   **Safety (Ghost Buster)**: The menu uses advanced pointer filtering to prevent accidental "double-triggers" common on high-refresh-rate touch devices.

## 3. Info Panels (HUD & Telemetry)

These panels show your current status (Heading, Height, Airspeed, Altitude).

*   **Customization**: You can move these panels to any of the four corners (Top-Left, Top-Right, etc.) using the settings.
*   **Declutter (DET)**: Toggle the "DET" button in settings or use the `DET` command to hide or show detailed information, keeping only the most important numbers visible.
*   **Dynamic Stacking**: When panels are moved to the same corner, they automatically stack to prevent overlap (e.g., Target Panel stacks below Ownship in the Bottom-Right).

## 4. Top System Bar

Located at the top of the screen, this shows:
*   **Zulu Time**: Universal coordinated time used in aviation.
*   **System Health**: Quick status indicators for Radar (RDR), Electronic Warfare (EWS), and Sensors (EOS). Indicators glow when active.

## 5. Left Sidebar (Quick Access)

The sidebar on the left allows you to quickly:
*   Toggle stabilization modes.
*   Access HUD settings.
*   Calibrate touch gestures.

## 6. Smart Command Bar (Command Palette)

The Smart Command Bar is a powerful tool for quickly executing commands and performing calculations.

*   **How to Open**: Use the keyboard shortcut (`Ctrl+K`, `Space`, or `\`) or click the command icon.
*   **Gestures & Interaction**:
    *   **Swipe Right**: Swipe an item to the right to trigger its primary action (Direct-To) instantly.
    *   **Drag-to-Map**: Results can be dragged directly onto the map to drop coordinates or entities.
    *   **Arrow Keys**: Use Up/Down to navigate results or previous command history.
    *   **Copy Result**: Calculation results can be clicked to copy them to the clipboard.

👉 **View the [Detailed Command & Scratchpad Guide](./05-scratchpad-guide.md) for more examples.**

---
[Back to Getting Started](./02-getting-started.md) | [Next: Configuration](./04-configuration.md)
