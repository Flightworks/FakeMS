# Smart Command Bar (Scratchpad)

The Smart Command Bar is a powerful "Heads-Down" tool that combines a calculator, a navigation computer, and a system controller into a single input field.

## 🚀 How to Open
*   **Keyboard**: Press `Ctrl + K`, `Space`, or `\`.
*   **Touch**: Tap the Command icon in the interface.

---

## 🔢 Math & Calculations
The command bar uses a robust math engine that understands degrees by default for trigonometric functions and uses **WGS84 spherical approximations** for all geographic calculations.

*   **Basic Math**: `10 * (2 + 3) / 5`
*   **Shorthand Trig**: `cos45`, `sin30`, `tan10` (no parentheses needed!)
*   **Full Functions**: `sqrt(144)`, `abs(-50)`, `log(100)`
*   **Unit Conversions**: `100 knots to km/h`, `5000 ft to meters`, `20 degC to degF`
*   **Copy Result**: Clicking a calculation result copies the value directly to your clipboard.

---

## 📍 Navigation & Coordinates
Quickly jump to any location on the map using various coordinate formats. All mapping is performed using accurate Mercator projections.

*   **Standard DDMM**: `N45E006` or `S2330W04515`
*   **Decimal Degrees**: `45.5, 6.5` or `-23.5, -45.25`
*   **Format Hints**: If you start typing `N45`, the system will show you a hint for the full `NddmmEdddmm` format.

---

## 🎯 Tactical Tools
Perform complex tactical calculations and navigation tasks instantly.

### Entity Projection
Calculate a position relative to an existing track using geodesic math.
*   **Format**: `[ENTITY_NAME] [BEARING]/[RANGE]`
*   **Example**: `HOSTILE1 180/5` (Finds the spot 5 Nautical Miles South of HOSTILE1)

### Direct-To (DCT)
Instantly center the map on a specific target or waypoint.
*   **Example**: `DCT TGT 1` or `DCT BASE`

### ETA Calculations
Calculate estimated time of arrival based on your current ground speed and destination.
*   **Example**: `ETA ALPHA` (Shows the time and distance to reaching point ALPHA)

---

## 🕹️ System Controls
Control your helicopter's systems using simple text commands.

*   **Sensors**: `RADAR`, `ADSB`, `AIS`, `EOTS` (Electro-Optical Targeting System)
*   **Map Modes**: `North Up`, `Heading Up`
*   **Fuzzy Search**: Just start typing "Rad" to find the "RADAR" command – the parser is resilient to typos.

---

## 🖱️ Advanced Interactivity

### Swipe Right to Execute
In the result list, swipe any item to the right (using a mouse or finger) to immediately trigger its primary action without needing to click.

### Drag-to-Map
Any item in the command palette can be **dragged and dropped** directly onto the tactical map. This allows you to "drop" coordinates or targets onto specific spatial locations.

### History & Navigation
*   **Up/Down Arrows**: Navigate through your previous commands.
*   **Suggestions**: Typing `sqr` will suggest `sqrt(` for you.
*   **Persistent History**: Your command history is saved locally and remains available between sessions.

---
[Back to Interface Guide](./03-interface-guide.md) | [Back to Home](../README.md)
