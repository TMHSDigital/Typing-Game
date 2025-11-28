# Vanilla JS Typing Game

A lightweight, self-contained typing speed test game built entirely with HTML, CSS, and vanilla JavaScript. No frameworks, no build steps, and no server-side dependencies.

## Features

- **Real-time Feedback**: Visual cues for correct (green) and incorrect (red) characters as you type.
- **Live Metrics**: Accurately calculates Words Per Minute (WPM) and typing accuracy in real-time.
- **High Score Tracking**: Automatically saves your best WPM to local storage.
- **Hard Mode**: Optional challenge mode that blurs the text, forcing you to look ahead and memorize.
- **Mistake Counter**: Tracks the total number of typing errors in the current session.
- **Anti-Cheat**: Prevents pasting text into the input field.
- **Keyboard Shortcuts**: Press `Tab` to instantly restart the game.
- **Timer**: 60-second countdown timer.
- **Responsive Design**: Clean, modern interface that centers on the screen.
- **Offline Capable**: Uses a hardcoded set of quotes, ensuring the game works without an internet connection.

## File Structure

The project consists of three main files:

- `index.html`: The structural markup of the game.
- `style.css`: The styling, including specific classes for character states (`.correct`, `.incorrect`, `.current`) and Hard Mode blur effects.
- `script.js`: The core game logic, state management, and DOM manipulation.

## Setup & Usage

Since this project requires no build tools, setup is instant:

1. **Clone the repository** or download the files.
2. **Open `index.html`** in any modern web browser.
3. **Start typing**: The game begins automatically when you type the first character.
4. **Restart**: Click the "Restart Game" button or press `Tab`.

## Game Logic

### Word Source
Quotes are stored in a `QUOTES` constant array within `script.js`. A random quote is selected via `getRandomQuote()` each time the game starts or resets.

### State Management
The game tracks several variables:
- `timer`: Remaining time (starts at 60s).
- `isGameStarted`: Boolean flag to trigger the timer on the first keystroke.
- `correctCharacters`: Counter for accurate keystrokes.
- `totalCharactersTyped`: Counter for total keystrokes.
- `mistakes`: Counter for every incorrect keystroke.
- `highScore`: Persisted best WPM using `localStorage`.
- `isHardMode`: Boolean state for the visual blur toggle.

### Metrics Calculation
- **WPM (Words Per Minute)**: Calculated using the standard formula:
  $$ \frac{(\text{Total Characters} / 5)}{\text{Time Elapsed (in minutes)}} $$
- **Accuracy**:
  $$ \frac{\text{Correct Characters}}{\text{Total Characters Typed}} \times 100 $$

## Customization

### Changing the Quotes
To add or change the text content, edit the `QUOTES` array in `script.js`:

```javascript
const QUOTES = [
    "Your new quote here.",
    "Another custom sentence.",
    // ...
];
```

### Adjusting the Timer
To change the game duration, update the `timer` and `maxTime` variables in `script.js`:

```javascript
let timer = 60; // Change to desired seconds
let maxTime = 60;
```

## Deployment

This project is ready for static hosting services like **GitHub Pages**:

1. Push the code to a GitHub repository.
2. Go to **Settings** > **Pages**.
3. Select the **main** branch as the source.
4. Save, and your game will be live.
