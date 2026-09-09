# Getting Started

This guide will help you get Fake MS running on your computer.

## Prerequisites

Before you begin, make sure you have the following installed:

1.  **Node.js**: This is the engine that runs the application. You can download it from [nodejs.org](https://nodejs.org/).

## Setting Up

1.  **Open a Terminal**: Open your command prompt, terminal, or power shell.
2.  **Install Dependencies**: Navigate to the project folder and run:
    ```bash
    npm install
    ```
3.  **Run the App**: Start the local simulation:
    ```bash
    npm run dev
    ```
4.  **Open in Browser**: Open the local URL shown by Vite.

Fake MS is a local interface simulation. It does not connect to an operational mission system and does not require an API key.

## Troubleshooting

- **App won't start**: Make sure you ran `npm install` successfully.
- **Map not showing**: The tactical basemap is local and does not require Internet access. Check that the application build contains `maps/ne_110m_land.geojson` and `maps/ne_10m_airports_major.geojson`.

---
[Back to Introduction](./01-introduction.md) | [Next: Interface Guide](./03-interface-guide.md)
