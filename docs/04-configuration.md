# Configuration & Customization

Fake MS allows you to tailor the interface to your specific needs.

## Visual Settings

You can adjust how the application looks in real-time through the Sidebar settings:

*   **Panel Scale**: Make the info panels larger or smaller.
*   **Opacity (Alpha)**: Make the interface more or less transparent so you can see more of the map underneath.
*   **UI Glow**: Adjust the intensity of the "glow" effect on buttons and text for better visibility.
*   **Map Dimming**: Adjust the brightness of the map tiles independently of the UI.
*   **Ownship Panel Position**: Quickly relocate the Ownship telemetry panel to any of the four corners (TL, TR, BL, BR) to avoid obscuring tactical data.

## Track & Information Management

Control what data is visible on your Heads-Down Display:

*   **Show Coordinates**: Toggle the display of Latitude/Longitude on the Ownship panel.
*   **Show Details (DET)**: A "Declutter" toggle that hides secondary telemetry (Speed, Alt, Hdg) to focus purely on navigation.
*   **Speed Vectors**: Toggle velocity leaders on all map entities. These vectors indicate where a target will be in the future based on its current heading and speed.

## Technical Settings

Several settings control the underlying engine:

*   **Gesture Calibration**: Adjust sensitivity for `tapThreshold`, `indicatorDelay`, and `longPressDuration`.
*   **Animation Speed**: Control the duration of map transitions and panel animations.
*   **Haptic Feedback**: Enable or disable vibration feedback for radial menu highlights and command executions.
*   **Map Persistence**: The application automatically caches map tiles for offline use, ensuring the mission continues even without network access.

## Stabilization & Orientation

Fine-tune how the map behaves during movement and mode switches:

*   **Auto GND on Pan**: Automatically switches stabilization to `GND` (Ground) mode when a manual pan gesture is detected. This prevents the map from "snapping back" to the ownship while you are trying to look at something else.
*   **Recenter on Orient**: Controls whether the map jumps back to the ownship when switching between `NORTH-UP` and `HEADING-UP` modes. Disable this to maintain your current panned view during orientation changes.
*   **Freeze Heading Drop**: When enabled, switching to `HEADING-UP` while in `GND` mode will lock the map rotation to your current heading at that moment. This provides a stable reference point for tactical analysis.
*   **Auto Recenter Timer**: (Prototype) Set a delay for the map to automatically return to `HELICO` (Ownship Centered) mode after a period of inactivity.

## Advanced: Prototype Settings

The `PrototypeSettings` object in the code allows for live manipulation of all variables. This is the primary sandbox for developers to test new HMI control laws before they are finalized.

---
[Back to Interface Guide](./03-interface-guide.md) | [Back to Home](../README.md)
