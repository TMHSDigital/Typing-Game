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
const mistakesElement = document.getElementById('mistakes');
const highScoreElement = document.getElementById('high-score');
const resetButton = document.getElementById('reset-button');
const hardModeToggle = document.getElementById('hard-mode-toggle');
const soundToggle = document.getElementById('sound-toggle');
const categorySelect = document.getElementById('category-select');
const containerElement = document.querySelector('.container');

// Modal Elements
const resultModal = document.getElementById('result-modal');
const modalWpmElement = document.getElementById('modal-wpm');
const modalAccuracyElement = document.getElementById('modal-accuracy');
const shareBtn = document.getElementById('share-btn');
const playAgainBtn = document.getElementById('play-again-btn');

// --- Word Source ---
// Expanded QUOTES object with categories
const QUOTES = {
    general: [
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
    ],
    technology: [
        "Any sufficiently advanced technology is indistinguishable from magic.",
        "The science of today is the technology of tomorrow.",
        "Technology is best when it brings people together.",
        "It has become appallingly obvious that our technology has exceeded our humanity.",
        "The Web does not just connect machines, it connects people.",
        "Innovation distinguishes between a leader and a follower.",
        "First we build the tools, then they build us.",
        "Code is like humor. When you have to explain it, it's bad.",
        "Simplicity is the soul of efficiency.",
        "Make it work, make it right, make it fast."
    ],
    code: [
        "function hello() { console.log('Hello World'); }",
        "const sum = (a, b) => a + b;",
        "if (input === expected) { return true; } else { return false; }",
        "document.getElementById('root').innerHTML = '<div></div>';",
        "for (let i = 0; i < array.length; i++) { process(array[i]); }",
        "import React, { useState } from 'react';",
        "git commit -m 'Initial commit'",
        "border-radius: 8px; background-color: #f0f0f0;",
        "SELECT * FROM users WHERE id = 1;",
        "while (isAlive) { eat(); sleep(); code(); }"
    ]
};

// --- Game State Variables ---
let timer = 60;
let maxTime = 60;
let timerInterval = null;
let isGameStarted = false;
let totalCharactersTyped = 0;
let correctCharacters = 0;
let mistakes = 0;
let highScore = localStorage.getItem('typingGameHighScore') || 0;
let isHardMode = false;
let currentCategory = 'general';

// --- Audio System ---
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (!soundToggle.checked) return;
    if (audioContext.state === 'suspended') audioContext.resume();

    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioContext.destination);

    const now = audioContext.currentTime;

    if (type === 'click') {
        // High pitched short mechanical click
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
        gainNode.gain.setValueAtTime(0.05, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
    } else if (type === 'error') {
        // Low buzzing thud
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.15);
        gainNode.gain.setValueAtTime(0.08, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'success') {
        // Ascending chime (multiple oscillators)
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major arpeggio
        notes.forEach((note, i) => {
            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();
            osc2.connect(gain2);
            gain2.connect(audioContext.destination);
            
            const time = now + (i * 0.1);
            osc2.type = 'sine';
            osc2.frequency.value = note;
            gain2.gain.setValueAtTime(0.05, time);
            gain2.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
            osc2.start(time);
            osc2.stop(time + 0.5);
        });
    }
}


// --- Functions ---

/**
 * Selects and returns a random quote from the QUOTES array based on category.
 */
function getRandomQuote() {
    const categoryQuotes = QUOTES[currentCategory] || QUOTES['general'];
    const randomIndex = Math.floor(Math.random() * categoryQuotes.length);
    return categoryQuotes[randomIndex];
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
function handleInput(e) {
    // Start timer on first keypress
    if (!isGameStarted) {
        startTimer();
        // Enable Focus Mode
        containerElement.classList.add('focus-mode');
    }

    const arrayQuote = quoteDisplayElement.querySelectorAll('span');
    const arrayValue = typingInputElement.value.split('');
    const inputLength = arrayValue.length;
    
    // Mistake Tracking Logic:
    if (e.inputType === 'insertText' || e.inputType === 'insertCompositionText') {
        const currentInd = inputLength - 1;
        if (currentInd < arrayQuote.length) {
             const charTyped = arrayValue[currentInd];
             const charQuote = arrayQuote[currentInd].innerText;
             if (charTyped !== charQuote) {
                 mistakes++;
                 mistakesElement.innerText = mistakes;
                 playSound('error');
             } else {
                 playSound('click');
             }
        }
    }

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
    
    // Disable Focus Mode
    containerElement.classList.remove('focus-mode');
    
    // Final metrics update
    const currentWPM = updateMetrics();
    
    // Check and update High Score
    if (currentWPM > highScore) {
        highScore = currentWPM;
        localStorage.setItem('typingGameHighScore', highScore);
        updateHighScoreDisplay();
        playSound('success');
    } else {
        // Play success sound even if not high score, just for completion
        playSound('success');
    }

    showResultModal(currentWPM);
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
    mistakes = 0;
    
    // Disable Focus Mode if active
    containerElement.classList.remove('focus-mode');
    
    wpmElement.innerText = 0;
    accuracyElement.innerText = 100;
    mistakesElement.innerText = 0;
    updateHighScoreDisplay();
    
    typingInputElement.disabled = false;
    
    // Hide modal if open
    resultModal.classList.remove('show');
    
    renderNewQuote();
    typingInputElement.focus();
}

/**
 * Toggles Hard Mode class on the quote display
 */
function toggleHardMode() {
    isHardMode = hardModeToggle.checked;
    if (isHardMode) {
        quoteDisplayElement.classList.add('blurred');
    } else {
        quoteDisplayElement.classList.remove('blurred');
    }
    // Focus input after toggle so user can keep typing/start
    typingInputElement.focus();
}

/**
 * Changes the quote category and resets the game
 */
function changeCategory() {
    currentCategory = categorySelect.value;
    resetGame();
}

/**
 * Shows the result modal
 */
function showResultModal(wpm) {
    modalWpmElement.innerText = wpm;
    modalAccuracyElement.innerText = accuracyElement.innerText + '%';
    resultModal.classList.add('show');
}

/**
 * Shares result to clipboard
 */
function shareResult() {
    const text = `I just typed ${modalWpmElement.innerText} WPM with ${modalAccuracyElement.innerText} accuracy on TypeSpeed!`;
    navigator.clipboard.writeText(text).then(() => {
        const originalText = shareBtn.innerText;
        shareBtn.innerText = 'Copied!';
        setTimeout(() => {
            shareBtn.innerText = originalText;
        }, 2000);
    });
}


// --- Event Listeners ---
typingInputElement.addEventListener('input', handleInput);

// Prevent pasting (Anti-cheat)
typingInputElement.addEventListener('paste', (e) => {
    e.preventDefault();
    alert("No pasting allowed! Type it out properly.");
});

resetButton.addEventListener('click', resetGame);

// Hard Mode Toggle
hardModeToggle.addEventListener('change', toggleHardMode);

// Category Select
categorySelect.addEventListener('change', changeCategory);

// Modal Buttons
shareBtn.addEventListener('click', shareResult);
playAgainBtn.addEventListener('click', resetGame);

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
