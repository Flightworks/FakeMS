<div align="center">
  <img width="1200" height="475" alt="Fake MS - HMI Design Prototype" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

  <h1>Fake MS (Mission System)</h1>
  <p><strong>A high-fidelity, tactile-first playground for Human-Machine Interface (HMI) prototyping.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
    <img src="https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white" alt="Leaflet" />
  </p>
</div>

---

## 🚁 Project Vision

**Fake MS** is designed as a "Heads-Down Display" (HDD) simulator for modern aviation and tactical systems. It serves as a functional sandbox for designers and developers to explore **Human-Machine Interface (HMI)** concepts without the overhead of real mission software.

> [!NOTE]
> This is a functional prototype built to test interaction control laws, gesture ergonomics, and complex spatial data visualization in real-time.

---

## ⚡ Tactical Features

### 🗺️ Advanced Tactical Map
Built on Leaflet and customized for mission-aware navigation:
- **Stabilization Modes**: Seamlessly toggle between `NORTH-UP` and `HEADING-UP` (Map-Centric vs. Ego-Centric).
- **Tactical Symbology**: Custom MIL-STD-style icons for Ownship, Hostiles, and Waypoints.
- **Gesture Control**: Precision panning and zooming with support for pinch-to-zoom and long-press interaction.

### 🔘 Radial Interaction (Pie Menu)
Optimized for high-stress environments where tiny buttons fail:
- **Context-Aware**: Different menus for map, ownship, and target entities.
- **Flick-to-Select**: Fast, muscle-memory driven workflows with tactile/haptic feedback.
- **Long-Press Activation**: Reduces accidental triggers and provides a dedicated "safe" interaction space.

### ⌨️ Smart Command Bar (Scratchpad)
A powerful HUD tool combining natural language commands with a navigation computer:
- **Math Engine**: Native support for degrees in trig (e.g., `cos45`) and complex expressions.
- **Coordinate Projection**: Project points using bearing/range shorthand (e.g., `HOSTILE1 180/5`).
- **Fuzzy Search**: Instantly find entities or system commands (RADAR, EOTS, DCT).
- **Command History**: Quick access to recent tactical queries.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | [React 19](https://react.dev/) | Component architecture and state management. |
| **Build Tool** | [Vite 6](https://vitejs.dev/) | Lightning-fast development and optimized production builds. |
| **Mapping** | [Leaflet](https://leafletjs.com/) | Tactical moving map engine. |
| **Animation** | [Framer Motion](https://www.framer.com/motion/) | Smooth UI transitions and radial gesture handling. |
| **Math** | [mathjs](https://mathjs.org/) | Robust command-bar calculations and unit conversions. |
| **Styles** | [Tailwind CSS](https://tailwindcss.com/) | Modern, responsive utility styling. |
| **Icons** | [Lucide](https://lucide.dev/) | Clean, vector-based aviation symbology. |

---

## 📖 Explore the Docs

Dive deeper into the design philosophy and technical setup:

- [📁 **Vision & Philosophy**](./docs/01-introduction.md) — The "Why" behind the project.
- [📁 **Interface Guide**](./docs/03-interface-guide.md) — Map mechanics, Pie Menus, and Telemetry.
- [📁 **Command Bar Guide**](./docs/05-scratchpad-guide.md) — Mastery of coordinates, math, and tactical tools.
- [📁 **Local Configuration**](./docs/04-configuration.md) — Tuning the visual and tactile engine.

---

## 🚀 Lab Start

1.  **Clone & Install**:
    ```bash
    npm install
    ```
2.  **API Config**: Create a `.env.local` and add your `GEMINI_API_KEY`.
3.  **Launch Experiment**:
    ```bash
    npm run dev
    ```

---
<div align="center">
  <p><em>Created for designers who believe interfaces should be both powerful and beautiful.</em></p>
</div>
