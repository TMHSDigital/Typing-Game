# TypeSpeed - Professional Typing Test

TypeSpeed is a modern, high-performance typing speed test application built with vanilla JavaScript. It features a "Glassmorphism & Tech" aesthetic, real-time metrics, and advanced gameplay features designed to provide a premium user experience without any frameworks or dependencies.

## Features

### Core Gameplay
- **Real-time Metrics**: Tracks Words Per Minute (WPM), Accuracy, and Mistakes instantly as you type.
- **High Score Tracking**: Automatically persists your personal best WPM using local storage.
- **Timer**: Configurable timer settings (15s, 30s, 60s).
- **Word Count Mode**: Alternative game mode where you race to complete a fixed number of words (10, 25, 50).
- **Anti-Cheat**: Paste events are blocked to ensure fair play.
- **Instant Restart**: Press `Tab` to quickly reset the game.

### Advanced Modes & Settings
- **Quote Categories**: Choose between:
  - **General**: Standard English sentences.
  - **Technology**: Tech-focused quotes and wisdom.
  - **Code Snippets**: Challenge yourself with real JavaScript/React syntax.
- **Hard Mode**: Blurs the future text, forcing you to type with flow and memory.
- **Ghost Mode**: Compete against your own best run with a visual ghost cursor that replays your past performance in real-time.
- **Progress Tracking**: Visual line chart of your last 10 games displayed in the results modal.

### UI/UX Design
- **Glassmorphism Theme**: A deep, animated gradient background with frosted glass containers.
- **Settings Hub**: A dedicated settings modal to customize every aspect of the experience without cluttering the main HUD.
- **Focus Mode**: The UI dims automatically when typing starts.
- **Sound Effects**: Satisfying mechanical click feedback, synthesized via the Web Audio API.

## File Structure

The project is entirely self-contained:

- `index.html`: Semantic HTML5 structure including the game HUD, typing area, and modals.
- `style.css`: Comprehensive CSS3 styling using CSS Variables for theming and Flexbox/Grid for layout.
- `script.js`: Vanilla JS logic handling the game loop, audio synthesis, ghost recording/playback, and chart generation.

## Setup & Usage

No build steps or installation required.

1. **Clone the repository** or download the source code.
2. **Open `index.html`** in any modern web browser.
3. **Start Typing**: The game begins on your first keystroke.

## Tech Stack & Design Choices

- **Vanilla JavaScript**: Chosen for performance and zero-dependency portability.
- **SVG Charts**: Custom-built SVG generation for the progress chart, avoiding heavy charting libraries.
- **AudioContext API**: Used to synthesize sound effects on the fly.
- **Local Storage**: Persists history, high scores, and best-run data for Ghost Mode.

## Deployment

Ready for static hosting (GitHub Pages, Vercel, Netlify):

1. Push to a repository.
2. Enable GitHub Pages in settings.
3. Your TypeSpeed app is live!
