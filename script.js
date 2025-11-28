/**
 * Typing Game Logic
 * Built with vanilla JavaScript
 */

// --- Constants and DOM Elements ---
const quoteDisplayElement = document.getElementById('quote-display');
const typingInputElement = document.getElementById('typing-input');
const timerElement = document.getElementById('timer');
const timerLabelElement = document.getElementById('timer-label');
const wpmElement = document.getElementById('wpm');
const accuracyElement = document.getElementById('accuracy');
const mistakesElement = document.getElementById('mistakes');
const highScoreElement = document.getElementById('high-score');
const resetButton = document.getElementById('reset-button');
const containerElement = document.querySelector('.container');
const categorySelect = document.getElementById('category-select');
const timeBadge = document.getElementById('time-badge');
const ghostBadge = document.getElementById('ghost-badge');

// Modals
const resultModal = document.getElementById('result-modal');
const settingsModal = document.getElementById('settings-modal');
const modalWpmElement = document.getElementById('modal-wpm');
const modalAccuracyElement = document.getElementById('modal-accuracy');
const shareBtn = document.getElementById('share-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const settingsBtn = document.getElementById('settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');

// Settings Inputs
const modeSelector = document.getElementById('mode-selector');
const durationSelector = document.getElementById('duration-selector');
const wordCountSelector = document.getElementById('word-count-selector');
const timerSettingGroup = document.getElementById('timer-setting');
const wordCountSettingGroup = document.getElementById('word-count-setting');
const soundToggle = document.getElementById('sound-toggle-settings'); // Moved to settings
const hardModeToggle = document.getElementById('hard-mode-toggle-settings'); // Moved to settings
const ghostModeToggle = document.getElementById('ghost-mode-toggle');

// Chart
const progressChart = document.getElementById('progress-chart');

// --- Word Source ---
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
let gameState = {
    mode: 'time', // 'time' or 'words'
    duration: 60, // seconds
    wordCount: 10, // words
    category: 'general',
    isGhostEnabled: false,
    isHardMode: false,
    isSoundEnabled: true
};

let runtime = {
    timer: 60,
    interval: null,
    isStarted: false,
    startTime: 0,
    totalChars: 0,
    correctChars: 0,
    mistakes: 0,
    keystrokes: [] // Array of {time: ms, charIndex: int} for Ghost
};

let history = JSON.parse(localStorage.getItem('typingGameHistory')) || [];
let bestRun = JSON.parse(localStorage.getItem('typingGameBestRun')) || null;

// --- Audio System ---
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (!gameState.isSoundEnabled) return;
    if (audioContext.state === 'suspended') audioContext.resume();

    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioContext.destination);

    const now = audioContext.currentTime;

    if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
        gainNode.gain.setValueAtTime(0.05, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
    } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.15);
        gainNode.gain.setValueAtTime(0.08, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'success') {
        const notes = [523.25, 659.25, 783.99, 1046.50];
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

// --- Core Logic ---

function getRandomQuote() {
    const categoryQuotes = QUOTES[gameState.category] || QUOTES['general'];
    const randomIndex = Math.floor(Math.random() * categoryQuotes.length);
    // For word count mode, we might need longer text, so we could join multiple
    if (gameState.mode === 'words') {
        // Simplification: Just return a long enough string or multiple quotes
        let text = categoryQuotes[randomIndex];
        while (text.split(' ').length < gameState.wordCount) {
            text += ' ' + categoryQuotes[Math.floor(Math.random() * categoryQuotes.length)];
        }
        // Trim to approximate word count for cleaner UI
        return text.split(' ').slice(0, gameState.wordCount).join(' ');
    }
    return categoryQuotes[randomIndex];
}

function renderNewQuote() {
    const quote = getRandomQuote();
    quoteDisplayElement.innerHTML = '';
    
    // Create Ghost Cursor Element if needed
    if (gameState.isGhostEnabled) {
        const ghostCursor = document.createElement('div');
        ghostCursor.id = 'ghost-cursor';
        ghostCursor.className = 'ghost-cursor'; // Need CSS
        quoteDisplayElement.appendChild(ghostCursor);
    }

    quote.split('').forEach(character => {
        const characterSpan = document.createElement('span');
        characterSpan.innerText = character;
        quoteDisplayElement.appendChild(characterSpan);
    });
    
    if (quoteDisplayElement.querySelector('span')) {
        quoteDisplayElement.querySelector('span').classList.add('current');
    }
    typingInputElement.value = '';
}

function handleInput(e) {
    if (!runtime.isStarted) {
        startGame();
    }

    const arrayQuote = quoteDisplayElement.querySelectorAll('span');
    const arrayValue = typingInputElement.value.split('');
    
    // Record keystroke for Ghost
    if (runtime.isStarted) {
        const timeOffset = Date.now() - runtime.startTime;
        runtime.keystrokes.push({ t: timeOffset, i: arrayValue.length });
    }

    // Mistake Logic
    if (e.inputType === 'insertText' || e.inputType === 'insertCompositionText') {
        const currentInd = arrayValue.length - 1;
        if (currentInd < arrayQuote.length) {
             const charTyped = arrayValue[currentInd];
             const charQuote = arrayQuote[currentInd].innerText;
             if (charTyped !== charQuote) {
                 runtime.mistakes++;
                 mistakesElement.innerText = runtime.mistakes;
                 playSound('error');
             } else {
                 playSound('click');
             }
        }
    }

    let correctCount = 0;
    arrayQuote.forEach((characterSpan, index) => {
        const character = arrayValue[index];
        characterSpan.classList.remove('correct', 'incorrect', 'current');
        
        if (character == null) {
        } else if (character === characterSpan.innerText) {
            characterSpan.classList.add('correct');
            correctCount++;
        } else {
            characterSpan.classList.add('incorrect');
        }
    });

    if (arrayValue.length < arrayQuote.length) {
        arrayQuote[arrayValue.length].classList.add('current');
    }

    runtime.correctChars = correctCount;
    runtime.totalChars = arrayValue.length;

    // Check Completion
    if (arrayValue.length === arrayQuote.length) {
        endGame();
    }
}

function startGame() {
    runtime.isStarted = true;
    runtime.startTime = Date.now();
    containerElement.classList.add('focus-mode');
    
    if (gameState.mode === 'time') {
        runtime.timer = gameState.duration;
        timerLabelElement.innerText = 'Time';
        timerElement.innerText = runtime.timer;
        
        runtime.interval = setInterval(() => {
            runtime.timer--;
            timerElement.innerText = runtime.timer;
            updateMetrics();
            if (runtime.timer <= 0) endGame();
        }, 1000);
    } else {
        // Word Count Mode: Timer counts UP
        runtime.timer = 0;
        timerLabelElement.innerText = 'Time';
        timerElement.innerText = 0;
        runtime.interval = setInterval(() => {
            runtime.timer++;
            timerElement.innerText = runtime.timer;
            updateMetrics(); 
        }, 1000);
    }

    if (gameState.isGhostEnabled && bestRun) {
        startGhostPlayback();
    }
}

function startGhostPlayback() {
    const ghostCursor = document.getElementById('ghost-cursor');
    if (!ghostCursor) return;
    
    const spans = quoteDisplayElement.querySelectorAll('span');
    // Simple playback: schedule moves based on recorded timestamps
    bestRun.keystrokes.forEach(stroke => {
        setTimeout(() => {
            if (!runtime.isStarted) return;
            // Move ghost to index i
            const targetSpan = spans[stroke.i];
            if (targetSpan) {
                // Position logic needs simple offset or class toggle
                // Ideally, we move an absolute positioned div to the span's coordinates
                const rect = targetSpan.getBoundingClientRect();
                const parentRect = quoteDisplayElement.getBoundingClientRect();
                ghostCursor.style.transform = `translate(${rect.left - parentRect.left}px, ${rect.top - parentRect.top}px)`;
                ghostCursor.style.opacity = 1;
            }
        }, stroke.t);
    });
}

function updateMetrics() {
    let timeElapsed;
    if (gameState.mode === 'time') {
        timeElapsed = gameState.duration - runtime.timer;
    } else {
        timeElapsed = runtime.timer;
    }
    
    let wpm = 0;
    if (timeElapsed > 0) {
        wpm = Math.round((runtime.totalChars / 5) / (timeElapsed / 60));
        wpmElement.innerText = wpm;
    }

    let accuracy = 0;
    if (runtime.totalChars > 0) {
        accuracy = Math.round((runtime.correctChars / runtime.totalChars) * 100);
    }
    accuracyElement.innerText = accuracy;
    return wpm;
}

function endGame() {
    clearInterval(runtime.interval);
    typingInputElement.disabled = true;
    containerElement.classList.remove('focus-mode');
    
    const finalWPM = updateMetrics();
    
    // Save History
    const result = {
        wpm: finalWPM,
        accuracy: parseInt(accuracyElement.innerText),
        date: new Date().toISOString(),
        mode: gameState.mode
    };
    history.unshift(result);
    if (history.length > 10) history.pop();
    localStorage.setItem('typingGameHistory', JSON.stringify(history));
    
    // Check Best Run (Simple WPM check for now)
    const currentHighScore = parseInt(localStorage.getItem('typingGameHighScore') || 0);
    if (finalWPM > currentHighScore) {
        localStorage.setItem('typingGameHighScore', finalWPM);
        // Save Ghost Data
        bestRun = { keystrokes: runtime.keystrokes, wpm: finalWPM };
        localStorage.setItem('typingGameBestRun', JSON.stringify(bestRun));
        playSound('success');
    } else {
        playSound('success');
    }

    updateHighScoreDisplay();
    renderChart();
    showResultModal(finalWPM);
}

function renderChart() {
    // Simple SVG Line Chart
    const data = history.map(h => h.wpm).reverse(); // Oldest to newest
    if (data.length < 2) return;

    const width = 300;
    const height = 100;
    const max = Math.max(...data, 100); // Scale to at least 100
    const min = Math.min(...data, 0);
    
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / (max - min)) * height;
        return `${x},${y}`;
    }).join(' ');

    const circles = data.map((val, i) => {
         const x = (i / (data.length - 1)) * width;
         const y = height - ((val - min) / (max - min)) * height;
         return `<circle cx="${x}" cy="${y}" r="3" />`;
    }).join('');

    progressChart.innerHTML = `
        <polyline points="${points}" />
        ${circles}
    `;
}

function resetGame() {
    clearInterval(runtime.interval);
    runtime.isStarted = false;
    runtime.totalChars = 0;
    runtime.correctChars = 0;
    runtime.mistakes = 0;
    runtime.keystrokes = [];
    
    timerElement.innerText = gameState.mode === 'time' ? gameState.duration : 0;
    wpmElement.innerText = 0;
    accuracyElement.innerText = 100;
    mistakesElement.innerText = 0;
    
    containerElement.classList.remove('focus-mode');
    typingInputElement.disabled = false;
    resultModal.classList.remove('show');
    settingsModal.classList.remove('show');
    
    // Update UI Badges
    timeBadge.innerText = gameState.mode === 'time' ? `${gameState.duration}s` : `${gameState.wordCount} Words`;
    ghostBadge.classList.toggle('hidden', !gameState.isGhostEnabled);
    
    renderNewQuote();
    typingInputElement.focus();
}

// --- UI Handlers ---

// Settings Logic
function openSettings() {
    settingsModal.classList.add('show');
}
function closeSettings() {
    settingsModal.classList.remove('show');
    // Apply logic is effectively immediate as we update state on click
    resetGame(); // Restart with new settings
}

// Toggle logic for pills
function handlePillClick(e, group) {
    if (!e.target.classList.contains('pill')) return;
    const parent = e.currentTarget;
    parent.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    e.target.classList.add('active');
    
    const val = e.target.dataset.value;
    if (group === 'mode') {
        gameState.mode = val;
        if (val === 'time') {
            timerSettingGroup.classList.remove('hidden');
            wordCountSettingGroup.classList.add('hidden');
        } else {
            timerSettingGroup.classList.add('hidden');
            wordCountSettingGroup.classList.remove('hidden');
        }
    } else if (group === 'duration') {
        gameState.duration = parseInt(val);
    } else if (group === 'wordCount') {
        gameState.wordCount = parseInt(val);
    }
}

// --- Initializers ---
function init() {
    updateHighScoreDisplay();
    renderNewQuote();
    
    // Events
    typingInputElement.addEventListener('input', handleInput);
    resetButton.addEventListener('click', resetGame);
    
    // Settings Events
    settingsBtn.addEventListener('click', openSettings);
    closeSettingsBtn.addEventListener('click', closeSettings);
    
    modeSelector.addEventListener('click', (e) => handlePillClick(e, 'mode'));
    durationSelector.addEventListener('click', (e) => handlePillClick(e, 'duration'));
    wordCountSelector.addEventListener('click', (e) => handlePillClick(e, 'wordCount'));
    
    categorySelect.addEventListener('change', (e) => {
        gameState.category = e.target.value;
        resetGame();
    });
    
    // Toggles
    soundToggle.addEventListener('change', (e) => gameState.isSoundEnabled = e.target.checked);
    hardModeToggle.addEventListener('change', (e) => {
        gameState.isHardMode = e.target.checked;
        if (gameState.isHardMode) quoteDisplayElement.classList.add('blurred');
        else quoteDisplayElement.classList.remove('blurred');
    });
    ghostModeToggle.addEventListener('change', (e) => gameState.isGhostEnabled = e.target.checked);
    
    // Result Modal
    shareBtn.addEventListener('click', () => {
        /* Share Logic */
        const text = `I just typed ${wpmElement.innerText} WPM on TypeSpeed!`;
        navigator.clipboard.writeText(text);
        shareBtn.innerText = 'Copied!';
        setTimeout(() => shareBtn.innerText = 'Share Result', 2000);
    });
    playAgainBtn.addEventListener('click', resetGame);

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            resetGame();
        }
    });
}

function updateHighScoreDisplay() {
    highScoreElement.innerText = localStorage.getItem('typingGameHighScore') || 0;
}

function showResultModal(wpm) {
    modalWpmElement.innerText = wpm;
    modalAccuracyElement.innerText = accuracyElement.innerText + '%';
    resultModal.classList.add('show');
}

init();
