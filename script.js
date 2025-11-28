/**
 * Typing Game Logic
 * Built with vanilla JavaScript
 */

// --- Constants and DOM Elements ---
const quoteDisplayElement = document.getElementById('quote-display');
const typingInputElement = document.getElementById('typing-input');
const timerElement = document.getElementById('timer');
const wpmElement = document.getElementById('wpm');
const accuracyElement = document.getElementById('accuracy');
const highScoreElement = document.getElementById('high-score');
const resetButton = document.getElementById('reset-button');

// --- Word Source ---
// Hardcoded array of quotes to ensure offline functionality
const QUOTES = [
    "The quick brown fox jumps over the lazy dog.",
    "Productivity is never an accident. It is always the result of a commitment to excellence, intelligent planning, and focused effort.",
    "To be or not to be, that is the question.",
    "All our dreams can come true, if we have the courage to pursue them.",
    "It does not matter how slowly you go as long as you do not stop.",
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "Believe you can and you're halfway there.",
    "The only way to do great work is to love what you do.",
    "In the middle of every difficulty lies opportunity.",
    "Happiness is not something ready made. It comes from your own actions."
];

// --- Game State Variables ---
let timer = 60;
let maxTime = 60;
let timerInterval = null;
let isGameStarted = false;
let totalCharactersTyped = 0;
let correctCharacters = 0;
let highScore = localStorage.getItem('typingGameHighScore') || 0;

// --- Functions ---

/**
 * Selects and returns a random quote from the QUOTES array.
 */
function getRandomQuote() {
    const randomIndex = Math.floor(Math.random() * QUOTES.length);
    return QUOTES[randomIndex];
}

/**
 * Renders a new quote to the display.
 * Clears existing content and creates span elements for each character.
 */
function renderNewQuote() {
    const quote = getRandomQuote();
    quoteDisplayElement.innerHTML = '';
    
    // Split quote into characters and create spans
    quote.split('').forEach(character => {
        const characterSpan = document.createElement('span');
        characterSpan.innerText = character;
        quoteDisplayElement.appendChild(characterSpan);
    });
    
    // Set the first character as current
    if (quoteDisplayElement.firstChild) {
        quoteDisplayElement.firstChild.classList.add('current');
    }
    
    // Reset input value
    typingInputElement.value = '';
}

/**
 * Main input handler.
 * Checks correctness, updates UI classes, and manages game state.
 */
function handleInput() {
    // Start timer on first keypress
    if (!isGameStarted) {
        startTimer();
    }

    const arrayQuote = quoteDisplayElement.querySelectorAll('span');
    const arrayValue = typingInputElement.value.split('');

    let correctCount = 0;
    
    // Loop through each character in the quote
    arrayQuote.forEach((characterSpan, index) => {
        const character = arrayValue[index];

        // Reset classes first
        characterSpan.classList.remove('correct');
        characterSpan.classList.remove('incorrect');
        characterSpan.classList.remove('current');

        if (character == null) {
            // Character hasn't been typed yet
            // Do nothing, it's future text
        } else if (character === characterSpan.innerText) {
            // Correctly typed
            characterSpan.classList.add('correct');
            correctCount++;
        } else {
            // Incorrectly typed
            characterSpan.classList.add('incorrect');
        }
    });

    // Update 'current' cursor position
    if (arrayValue.length < arrayQuote.length) {
        arrayQuote[arrayValue.length].classList.add('current');
    }

    // Update current correct count for metrics
    correctCharacters = correctCount;
    totalCharactersTyped = arrayValue.length;

    // Check for Game End (User typed the full quote)
    if (arrayValue.length === arrayQuote.length) {
        endGame();
    }
}

/**
 * Starts the game timer and interval.
 */
function startTimer() {
    isGameStarted = true;
    timerElement.innerText = timer;
    
    timerInterval = setInterval(() => {
        timer--;
        timerElement.innerText = timer;
        
        updateMetrics();

        if (timer <= 0) {
            endGame();
            // Ensure timer doesn't go negative visually
            timerElement.innerText = 0;
        }
    }, 1000);
}

/**
 * Ends the game, stops timer, updates final metrics and checks high score.
 */
function endGame() {
    clearInterval(timerInterval);
    typingInputElement.disabled = true;
    
    // Final metrics update
    const currentWPM = updateMetrics();
    
    // Check and update High Score
    if (currentWPM > highScore) {
        highScore = currentWPM;
        localStorage.setItem('typingGameHighScore', highScore);
        updateHighScoreDisplay();
    }
}

/**
 * Calculates and updates WPM and Accuracy.
 * Returns the calculated WPM.
 */
function updateMetrics() {
    const timeElapsed = maxTime - timer;
    let wpm = 0;
    
    // Prevent division by zero
    if (timeElapsed > 0) {
        // WPM = (Total Characters / 5) / (Time Elapsed in Minutes)
        wpm = Math.round((totalCharactersTyped / 5) / (timeElapsed / 60));
        wpmElement.innerText = wpm;
    }

    // Accuracy = (Correct Characters / Total Characters Typed) * 100
    let accuracy = 0;
    if (totalCharactersTyped > 0) {
        accuracy = Math.round((correctCharacters / totalCharactersTyped) * 100);
    }
    accuracyElement.innerText = accuracy;
    
    return wpm;
}

/**
 * Updates the High Score display.
 */
function updateHighScoreDisplay() {
    highScoreElement.innerText = highScore;
}

/**
 * Resets the game state to initial values.
 */
function resetGame() {
    clearInterval(timerInterval);
    timer = maxTime;
    timerElement.innerText = timer;
    
    isGameStarted = false;
    totalCharactersTyped = 0;
    correctCharacters = 0;
    
    wpmElement.innerText = 0;
    accuracyElement.innerText = 100;
    updateHighScoreDisplay();
    
    typingInputElement.disabled = false;
    
    renderNewQuote();
    typingInputElement.focus();
}

// --- Event Listeners ---
typingInputElement.addEventListener('input', handleInput);

// Prevent pasting (Anti-cheat)
typingInputElement.addEventListener('paste', (e) => {
    e.preventDefault();
    alert("No pasting allowed! Type it out properly.");
});

resetButton.addEventListener('click', resetGame);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Tab to restart
    if (e.key === 'Tab') {
        e.preventDefault(); // Prevent focus shift
        resetGame();
    }
});

// Initialize the first game
updateHighScoreDisplay();
renderNewQuote();
