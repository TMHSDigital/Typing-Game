# TypeSpeed - Professional Typing Test

TypeSpeed is a modern, high-performance typing speed test application built with vanilla JavaScript. It features a "Glassmorphism & Tech" aesthetic, real-time metrics, and advanced gameplay features designed to provide a premium user experience without any frameworks or dependencies.

## Features

### Core Gameplay
- **Real-time Metrics**: Tracks Words Per Minute (WPM), Accuracy, and Mistakes instantly as you type.
- **High Score Tracking**: Automatically persists your personal best WPM using local storage.
- **Timer**: Standard 60-second sprint mode.
- **Anti-Cheat**: Paste events are blocked to ensure fair play.
- **Instant Restart**: Press `Tab` to quickly reset the game.

### Advanced Modes & Settings
- **Quote Categories**: Choose between:
  - **General**: Standard English sentences.
  - **Technology**: Tech-focused quotes and wisdom.
  - **Code Snippets**: Challenge yourself with real JavaScript/React syntax (brackets, semicolons, etc.).
- **Hard Mode**: Toggling this blurs the future text, forcing you to memorize words and type with flow rather than reading character-by-character.
- **Sound Effects**: 
  - Mechanical click feedback for correct keystrokes.
  - Subtle "buzz" for errors.
  - Success chime upon completion.
  - Toggleable via the "Sound" switch.

### UI/UX Design
- **Glassmorphism Theme**: A deep, animated gradient background with frosted glass containers.
- **Focus Mode**: The UI (header, stats, footer) dims automatically when you start typing to reduce distractions.
- **Neon Aesthetics**: High-contrast text effects and a glowing cursor for maximum legibility.
- **Result Modal**: A clean summary screen appears after each game with options to share your score or play again.

## File Structure

The project is entirely self-contained:

- `index.html`: Semantic HTML5 structure including the game HUD, typing area, and modal.
- `style.css`: Comprehensive CSS3 styling using CSS Variables for theming, Flexbox/Grid for layout, and keyframe animations.
- `script.js`: Vanilla JS logic handling the game loop, audio synthesis (`AudioContext`), DOM manipulation, and state management.

## Setup & Usage

No build steps or installation required.

1. **Clone the repository** or download the source code.
2. **Open `index.html`** in any modern web browser.
3. **Start Typing**: The timer begins on your first keystroke.

## Tech Stack & Design Choices

- **Vanilla JavaScript**: chosen for performance and zero-dependency portability.
- **AudioContext API**: Used to synthesize sound effects on the fly, keeping the project asset-free (no external `.mp3` files needed).
- **CSS Glassmorphism**: Utilizes `backdrop-filter: blur()` and semi-transparent backgrounds to create a modern, layered depth effect.
- **Local Storage**: Provides a lightweight way to save user progress (High Score) without a backend.

## Deployment

Ready for static hosting (GitHub Pages, Vercel, Netlify):

1. Push to a repository.
2. Enable GitHub Pages in settings.
3. Your TypeSpeed app is live!
