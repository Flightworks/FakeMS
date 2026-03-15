# 🧠 The Scratchpad (Smart Command Bar)

The **Scratchpad** is your primary "Heads-Down" interface. It is a unified command line, mission calculator, navigation computer, system controller, and document reader all rolled into a single, lightning-fast input field.

---

## 🚀 Quick Access

| Method | Action |
| :--- | :--- |
| **Keyboard** | Press `Ctrl + K`, `Space`, or `\` |
| **Touch** | Tap the **⌘** icon in the left sidebar |
| **Dismiss** | Press `ESC` or click anywhere outside the bar |

---

## 🔢 Calculator & Conversions

The Scratchpad includes a robust math engine that operates in **degrees** by default and understands complex trigonometry and unit conversions.

> **💡 Pro Tip:** Click any calculation result in the list to instantly copy the raw value to your clipboard.

### Math Examples
*No parentheses are required for basic trigonometry!*
*   `10 * (2 + 3) / 5` ➔ **10**
*   `cos45` ➔ **0.70710678** 
*   `sin30` ➔ **0.5**
*   `sqrt(144)` ➔ **12**
*   `abs(-50)` ➔ **50**
*   `log(100)` ➔ **2**

### Unit Conversions
Convert metrics on the fly using natural language:
*   `100 knots to km/h` ➔ **185.2 km/h**
*   `5000 ft to meters` ➔ **1524 m**
*   `20 degC to degF` ➔ **68 °F**

---

## 📍 Coordinates & Navigation

Jump to any exact location on the map. The system supports two major formats and provides raw data extraction options.

| Format | Example | Result |
| :--- | :--- | :--- |
| **DDMM (Military)** | `N45E006` <br> `N4530E00630` <br> `S2330W04515` | 45°N, 6°E <br> 45°30'N, 6°30'E <br> 23°30'S, 45°15'W |
| **Decimal Degrees** | `45.5, 6.5` <br> `-23.5, -45.25` | 45.5°N, 6.5°E <br> 23.5°S, 45.25°W |

When a coordinate is recognized, you get three instant actions:
1. **🚀 FLY TO** — Instantly centers the map on the coordinates.
2. **📋 COPY POS** — Copies the normalized decimal degrees (e.g., `45.50000, 6.50000`).
3. **📝 COPY TEXT** — Copies precisely what you typed.

*(Typing incomplete coordinates like `N45` or `N4530E` will show helpful format hints!)*

---

## 🎯 Tactical Tools

Execute complex navigation and projection tasks against live map entities. 

*(Note: Entity names are fuzzy-matched, so typing `hostle` or `h1` will usually match `HOSTILE 1`!)*

### Direct-To (DCT)
Instantly lock the map onto a tracked entity or waypoint.
*   `DCT HOSTILE 1`
*   `DCT BRAVO`
*   `DCT BASE`

### Entity Projection (Bearing & Range)
Calculate an exact physical position relative to any entity.
*   `HOSTILE 1 180/5` ➔ Point 5 NM directly South of HOSTILE 1.
*   `G01 090/10` ➔ Point 10 NM directly East of G01.
*   `180/5` ➔ Point 5 NM South of your **Ownship**.

### Estimated Time of Arrival (ETA)
Estimate your arrival time based on the distance to the target and your current speed.
*   `ETA ALPHA`
*   `ETA HOSTILE 2`

*(The result will display your Estimated Time En Route (ETE) in minutes, along with the slant range in kilometers.)*

---

## 🕹️ System Controls

Toggle your vehicle's sensors and map orientations instantly without hunting for buttons.

| System | Command | Fuzzy Keywords to try |
| :--- | :--- | :--- |
| **Radar** | `RADAR` | `rdr`, `radar`, `sensor` |
| **ADS-B** | `ADSB` | `adsb`, `transponder`, `ident` |
| **AIS** | `AIS` | `ais`, `ship`, `marine` |
| **Visual/Camera** | `EOTS` | `eots`, `camera`, `visual` |
| **Map Mode** | `North Up` | `north`, `nup` |
| **Map Mode** | `Heading Up` | `heading`, `hup` |

---

## 📄 Document Viewer

Access critical mission documents directly over the tactical map.

*   `optask` ➔ Opens **optask.md**
*   `readme` ➔ Opens **README.md**
*   `changelog` ➔ Opens **CHANGELOG.md**

**Viewer Features:**
*   Toggle between **Rendered Text** and **Raw Codeview** using the top-right button.
*   Hit `ESC` or click the `✕` to immediately dismiss the document and return to the map.

---

## 📝 Quick Notes

Any text entered that does not match a specific command is caught by the **SAVE** function. 
*   **Try typing:** `Bridge damaged in sector B` 
*   **Result:** `SAVE: "Bridge damaged in sector B"`

Executing this will log the text into your local Scratchpad history.

---

## ⚡ Advanced Interactivity

*   **Autocompletion:** Typing an entity name (e.g., `HOSTILE`) suggests an autocomplete track. Selecting it adds `HOSTILE 1 ` to the input, allowing you to quickly append projection coordinates (`090/5`).
*   **Swipe to Execute:** On touch devices (or using a mouse), swipe any result row to the **right** to immediately execute its primary action without tapping.
*   **Drag-to-Map:** You can drag any result (like a coordinate or an entity) out of the Scratchpad and **drop it directly onto the tactical map**.
*   **Persistent History:** Your command history is saved securely on your local device. 
    *   Use the **Up/Down arrow keys** to cycle through past commands. 
    *   Hover over any history item and click the **Copy icon** to extract it without running it again.

---
[Back to Interface Guide](./03-interface-guide.md) | [Back to Home](../README.md)
