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
3.  **Configure API Key**:
    - Locate the file named `.env.local` (or create it if it doesn't exist).
    - Add your Gemini API key like this:
      ```
      GEMINI_API_KEY=your_key_here
      ```
4.  **Run the App**: Start the development server by running:
    ```bash
    npm run dev
    ```
5.  **Open in Browser**: After running the command, you should see a link (usually `http://localhost:5173`). Open this link in your web browser.

## Troubleshooting

- **App won't start**: Make sure you ran `npm install` successfully.
- **Map not showing**: Ensure you have an active internet connection to load map tiles.

---
[Back to Introduction](./01-introduction.md) | [Next: Interface Guide](./03-interface-guide.md)
