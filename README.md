# TypeSpeed

```text
  _______   _____  ______   _____ ____  ______ ______ _____  
 |__   __| \ \   / /  __ \ |  ___/ ___||  ____|  ____|  __ \ 
    | |     \ \_/ /| |__) || |__ \___ \| |__  | |__  | |  | |
    | |      \   / |  ___/ |  __| ___) |  __| |  __| | |  | |
    | |       | |  | |     | |___|____/| |    | |____| |__| |
    |_|       |_|  |_|     |_____|____/|_|    |______|_____/ 
```

**A High-Performance, Zero-Dependency Typing Accelerator.**

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Status](https://img.shields.io/badge/Status-Active-success.svg)]()
[![Tech](https://img.shields.io/badge/Stack-Vanilla_JS-yellow.svg)]()

---

## Overview

TypeSpeed is a professional-grade typing trainer engineered with a focus on aesthetics, performance, and zero-latency feedback. Unlike bloated web apps, TypeSpeed runs entirely client-side using highly optimized Vanilla JavaScript, delivering a "Glassmorphism & Tech" experience that feels more like a HUD than a website.

Designed for developers and touch-typists who demand precision.

## Key Capabilities

### ⚡ Core Engine
*   **Real-Time Telemetry**: Calculates WPM, Accuracy, and Mistake ratios on every keystroke event.
*   **Zero Latency**: Input handling is decoupled from visual rendering for maximum responsiveness.
*   **Offline Architecture**: No backend required. All logic, data, and assets are contained within the client.

### 🎮 Gameplay Modes
*   **Sprint**: Classic 60-second endurance test.
*   **Blitz**: Short 15s and 30s bursts for raw speed training.
*   **Word Count**: Race to complete fixed sets of 10, 25, or 50 words.
*   **Code Mode**: Specialized syntax training featuring real JavaScript snippets (brackets, semicolons, camelCase).

### 🛡️ Advanced Systems
*   **Ghost Mode**: Records your keystroke timing data during a run and replays it visually in subsequent games, allowing you to race against your own "Ghost".
*   **Anti-Cheat**: Blocks paste events and monitors input integrity.
*   **Focus Protocol**: Automatically dims UI elements (header, footer, stats) when typing begins to eliminate peripheral distractions.

## Technical Architecture

### Audio Synthesis
Instead of loading heavy `.mp3` assets, TypeSpeed utilizes the **Web Audio API** to synthesize sound effects in real-time:
*   **Click**: High-frequency sine/exponential ramp.
*   **Error**: Sawtooth wave with linear decay.
*   **Success**: Polyphonic C-Major arpeggio.

### Data Persistence
User progress is stored locally using the browser's `localStorage` API, persisting:
*   **High Scores**: Best WPM per session.
*   **History**: Last 10 runs for chart visualization.
*   **Ghost Data**: Keystroke-level timestamp data of the best run.

### Visuals
*   **SVG Charting**: Custom implementation of line charts using SVG paths, avoiding heavy charting libraries.
*   **CSS Variables**: extensive use of `--var` for theming and easy refactoring.
*   **Glassmorphism**: `backdrop-filter: blur()` used heavily for the modern UI aesthetic.

## Project Structure

```text
TypeSpeed/
├── index.html       # Semantic DOM structure & Modals
├── style.css        # 500+ lines of CSS3 (Grid, Flex, Keyframes)
├── script.js        # Game Loop, Audio Engine, State Management
├── README.md        # Documentation
└── LICENSE          # Apache 2.0
```

## Quick Start

No build steps. No npm install. No servers.

1.  **Clone**
    ```bash
    git clone https://github.com/TMHSDigital/Typing-Game.git
    ```
2.  **Run**
    Open `index.html` in Chrome, Firefox, Edge, or Safari.

## Roadmap

*   [x] Core Typing Engine
*   [x] Glassmorphism UI
*   [x] Sound Synthesis
*   [x] Ghost Mode
*   [ ] Multiplayer Lobbies (WebSockets)
*   [ ] Custom Text Import

---

*Built with precision in 2025.*
