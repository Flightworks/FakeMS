# Interface Guide

The Fake MS interface is divided into several key areas designed for easy access during flight operations.

## 1. Tactical Moving Map

The map is the heart of the application.

*   **Navigation**: Pan by dragging with one finger (or mouse) and zoom using the scroll wheel or pinch gestures.
*   **Stabilization Modes**:
    *   **NORTH-UP**: The top of the map is always North.
    *   **HEADING-UP**: The map rotates so that your ownship heading is at the top.
    *   **Transition Logic**: By default, switching modes will recenter the map on your ownship. This can be toggled in the **STABLN CFG** menu.
*   **Stabilization States**:
    *   **HELICO (Centered)**: The map is locked to your ownship. The ship stays in the center while the world moves underneath.
    *   **GND (Panned)**: The map is anchored to a point on the ground. This occurs automatically when you pan the map manually.
*   **Symbology**:
    *   **Blue Square (Viper 1-1)**: Your own ship (Ownship).
    *   **Red Diamond (Hostile)**: Enemy targets or unknown surface/air contacts.
    *   **Amber Circle (Waypoint)**: Waypoints, airports, or points of interest.
*   **Velocity Leaders**: Lines protruding from icons indicate their current heading and speed (Speed Vectors).
*   **Maritime Basemap**: The sea is dark grey, land is simplified, and the coastline remains visible without roads or civilian points of interest.
*   **Major Airports**: Small muted airport points provide geographic context. They are not simulated entities and are not interactive.
*   **No GPS**: The initial simulated position is the military port of Toulon. A valid browser GPS position replaces it when available.

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

## 6. Palette de commandes

La palette regroupe les calculs, les consultations du scénario et les contrôles locaux de la carte et de la simulation.

- **Ouvrir** : `Ctrl+K`, `Espace`, `\` ou le bouton `⌘`.
- **Lire avant de valider** : la palette distingue les calculs, les prévisualisations, les actions locales et les confirmations requises.
- **Interagir** : utilisez les flèches `↑` et `↓`, le glissement vers la droite et le glisser-déposer vers la carte.
- **Sécurité** : une cible ambiguë ou une donnée indisponible bloque l’action. FakeMS ne pilote aucun système opérationnel.

👉 Consultez le [guide rapide de la palette de commandes](./05-scratchpad-guide.md) pour les commandes et exemples.

---
[Back to Getting Started](./02-getting-started.md) | [Next: Configuration](./04-configuration.md)
