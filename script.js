/**
 * TypeSpeed game logic. Plain browser script, loaded at the end of <body>.
 */

// --- DOM Elements ---
const quoteDisplayElement = document.getElementById('quote-display');
const quoteTextElement = document.getElementById('quote-text');
const typingContainer = document.querySelector('.typing-container');
const typingInputElement = document.getElementById('typing-input');
const timerElement = document.getElementById('timer');
const wpmElement = document.getElementById('wpm');
const accuracyElement = document.getElementById('accuracy');
const mistakesElement = document.getElementById('mistakes');
const highScoreElement = document.getElementById('high-score');
const resetButton = document.getElementById('reset-button');
const containerElement = document.querySelector('.container');
const categorySelect = document.getElementById('category-select');
const quickMode = document.getElementById('quick-mode');
const quickDuration = document.getElementById('quick-duration');
const quickWordCount = document.getElementById('quick-word-count');
const ghostBadge = document.getElementById('ghost-badge');
const storageWarning = document.getElementById('storage-warning');

// Modals
const resultModal = document.getElementById('result-modal');
const settingsModal = document.getElementById('settings-modal');
const resultTitle = document.getElementById('result-title');
const modalWpmElement = document.getElementById('modal-wpm');
const modalAccuracyElement = document.getElementById('modal-accuracy');
const modalSourceElement = document.getElementById('modal-source');
const modalBestElement = document.getElementById('modal-best');
const modalRawElement = document.getElementById('modal-raw');
const modalCharsElement = document.getElementById('modal-chars');
const modalTimeElement = document.getElementById('modal-time');
const modalKeysElement = document.getElementById('modal-keys');
const practiceBtn = document.getElementById('practice-btn');
const practiceNote = document.getElementById('practice-note');
const challengeBtn = document.getElementById('challenge-btn');
const modalChallengeElement = document.getElementById('modal-challenge');
const challengeLinkRow = document.getElementById('challenge-link-row');
const challengeLinkInput = document.getElementById('challenge-link');
const shareBtn = document.getElementById('share-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const settingsBtn = document.getElementById('settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');

// Custom text dialog
const customModal = document.getElementById('custom-modal');
const editCustomBtn = document.getElementById('edit-custom-btn');
const closeCustomBtn = document.getElementById('close-custom-btn');

// Stats dialog
const statsModal = document.getElementById('stats-modal');
const statsBtn = document.getElementById('stats-btn');
const statsSummary = document.getElementById('stats-summary');
const statsTables = document.getElementById('stats-tables');
const statsHeatmap = document.getElementById('stats-heatmap');
const dailyChartContainer = document.getElementById('daily-chart-container');
const dailyChartTitle = document.getElementById('daily-chart-title');
const dailyChart = document.getElementById('daily-chart');
const dailyChartSummary = document.getElementById('daily-chart-summary');
const statsBestsBody = document.getElementById('stats-bests');
const statsRunsBody = document.getElementById('stats-runs');
const statsStatus = document.getElementById('stats-status');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importInput = document.getElementById('import-input');
const clearBtn = document.getElementById('clear-btn');
const closeStatsBtn = document.getElementById('close-stats-btn');

// Settings inputs
const themeSelector = document.getElementById('theme-selector');
const soundToggle = document.getElementById('sound-toggle-settings');
const hardModeToggle = document.getElementById('hard-mode-toggle-settings');
const ghostModeToggle = document.getElementById('ghost-mode-toggle');
const paceSelect = document.getElementById('pace-select');
const paceWpmInput = document.getElementById('pace-wpm');
const punctuationToggle = document.getElementById('punctuation-toggle');
const numbersToggle = document.getElementById('numbers-toggle');
const stopOnErrorToggle = document.getElementById('stop-on-error-toggle');
const customTextInput = document.getElementById('custom-text');
const autoIndentToggle = document.getElementById('auto-indent-toggle');
// Main-screen options shown only for the categories they apply to
const punctuationOption = document.getElementById('punctuation-option');
const numbersOption = document.getElementById('numbers-option');
const autoIndentOption = document.getElementById('auto-indent-option');
const codeLanguageSelect = document.getElementById('code-language-select');
const capsWarning = document.getElementById('caps-warning');
const ghostStatus = document.getElementById('ghost-status');

// Chart
const chartContainer = document.getElementById('progress-chart-container');
const runChartContainer = document.getElementById('run-chart-container');
const runChart = document.getElementById('run-chart');
const progressChartTitle = document.getElementById('progress-chart-title');
const progressChart = document.getElementById('progress-chart');

// --- Storage ---
const STORAGE_KEYS = {
    history: 'typingGameHistory',
    bests: 'typingGameBests',
    settings: 'typingGameSettings',
    keyStats: 'typingGameKeyStats',
};

function loadJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
        console.warn(`Ignoring unreadable localStorage value for ${key}`, err);
        return fallback;
    }
}

// A failed save (storage full, or blocked in some private modes) shows a
// notice that stays until the page is reloaded.
function saveJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
        console.warn(`Could not save ${key} to localStorage`, err);
        storageWarning.classList.remove('hidden');
    }
}

// Keystroke timings, {t: ms since start, i: character index} per input
// event, are stored as a flat list of differences, [t1, i1, t2 - t1,
// i2 - i1, ...], about a third of the size in JSON. Bests store them this
// way and challenge links carry them. Bests saved before this hold the
// objects themselves; bestStrokes reads both.
function encodeStrokes(strokes) {
    const deltas = [];
    let t = 0;
    let i = 0;
    for (const stroke of strokes) {
        deltas.push(stroke.t - t, stroke.i - i);
        t = stroke.t;
        i = stroke.i;
    }
    return deltas;
}

function decodeStrokes(deltas) {
    const strokes = [];
    let t = 0;
    let i = 0;
    for (let n = 0; n + 1 < deltas.length; n += 2) {
        t += deltas[n];
        i += deltas[n + 1];
        strokes.push({ t, i });
    }
    return strokes;
}

const bestStrokes = (best) =>
    typeof best.keystrokes[0] === 'object' ? best.keystrokes : decodeStrokes(best.keystrokes);

// --- Game State ---
const DURATIONS = [15, 30, 60];
const WORD_COUNTS = [10, 25, 50];
const DEFAULT_SETTINGS = {
    mode: 'time', // 'time' or 'words'
    duration: 60, // seconds, time mode
    wordCount: 10, // words mode
    category: 'common', // 'common', 'weak', or a key of QUOTES (texts.js)
    isGhostEnabled: false,
    pace: 'off', // pace caret: 'off', 'target', 'average', or 'last'
    paceWpm: 60, // speed of the pace caret when pace is 'target'
    isHardMode: false,
    isSoundEnabled: true,
    hasPunctuation: false, // common words only
    hasNumbers: false, // common words only
    isStopOnError: false, // wrong keys do not advance the caret
    customText: '', // passage for the Custom Text category, already normalized
    codeLanguage: 'javascript', // key of CODE_SNIPPETS (texts.js)
    isAutoIndent: true, // fill in leading spaces after a new line in code
    theme: 'system', // 'system', 'dark', 'light', or 'contrast'
};

const THEMES = ['system', 'dark', 'light', 'contrast'];
const PACES = ['off', 'target', 'average', 'last'];
const PACE_MIN = 10;
const PACE_MAX = 300;

const CUSTOM_TEXT_LIMIT = 2000;

// Typographic quotes, dashes, and ellipses become the keys people can type,
// and all whitespace runs become single spaces.
function normalizeCustomText(text) {
    return String(text)
        .replace(/[\u2018\u2019\u201a\u2032]/g, "'")
        .replace(/[\u201c\u201d\u201e\u2033]/g, '"')
        .replace(/[\u2013\u2014\u2212]/g, '-')
        .replace(/\u2026/g, '...')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, CUSTOM_TEXT_LIMIT)
        .trim();
}

// Short FNV-1a hash, so each custom text keeps its own best scores.
function textHash(text) {
    let hash = 0x811c9dc5;
    for (let n = 0; n < text.length; n++) {
        hash ^= text.charCodeAt(n);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(36);
}

const CATEGORIES = ['common', 'weak', 'custom', 'code', ...Object.keys(QUOTES)];
const CODE_LANGUAGES = Object.keys(CODE_SNIPPETS);

function sanitizeSettings(saved) {
    const settings = { ...DEFAULT_SETTINGS };
    if (!saved || typeof saved !== 'object') return settings;
    if (saved.mode === 'words') settings.mode = 'words';
    if (DURATIONS.includes(saved.duration)) settings.duration = saved.duration;
    if (WORD_COUNTS.includes(saved.wordCount)) settings.wordCount = saved.wordCount;
    if (CATEGORIES.includes(saved.category)) settings.category = saved.category;
    if (CODE_LANGUAGES.includes(saved.codeLanguage)) settings.codeLanguage = saved.codeLanguage;
    if (THEMES.includes(saved.theme)) settings.theme = saved.theme;
    if (PACES.includes(saved.pace)) settings.pace = saved.pace;
    if (Number.isInteger(saved.paceWpm) && saved.paceWpm >= PACE_MIN && saved.paceWpm <= PACE_MAX) {
        settings.paceWpm = saved.paceWpm;
    }
    if (typeof saved.customText === 'string') {
        settings.customText = normalizeCustomText(saved.customText);
    }
    for (const flag of [
        'isGhostEnabled',
        'isHardMode',
        'isSoundEnabled',
        'hasPunctuation',
        'hasNumbers',
        'isStopOnError',
        'isAutoIndent',
    ]) {
        if (typeof saved[flag] === 'boolean') settings[flag] = saved[flag];
    }
    return settings;
}

const gameState = sanitizeSettings(loadJSON(STORAGE_KEYS.settings, null));

// Per-run data. Reset by resetGame().
const runtime = {
    isStarted: false,
    startTime: 0,
    endTime: 0,
    interval: null,
    timer: 0, // seconds shown in the HUD
    quoteText: '', // text currently on screen
    quoteSource: '', // attribution of the passage on screen, if known
    quoteBase: 0, // characters in quotes already completed this run (time mode)
    baseCorrect: 0, // correct characters in completed quotes
    baseTyped: 0, // typed characters in completed quotes
    correctChars: 0, // correct characters across the whole run
    typedChars: 0, // typed characters across the whole run
    previousValue: '', // input value after the last input event
    keystrokes: 0, // characters inserted, including ones later deleted
    mistakes: 0, // inserted characters that did not match
    ghostStrokes: [], // {t: ms since start, i: character index} for Ghost Mode
    keyStats: {}, // {[expected character]: {attempts, misses}} for this run
    seed: 0, // passages for the run are drawn from this seed
    random: Math.random, // seeded generator, replaced in resetGame
    weakKeys: [], // letters the Weak Keys category uses this run
    passageHash: '', // textHash of the run's first passage
    textChanged: false, // the replayed run was recorded on a different first passage
    ghostIndex: 0, // character index the ghost has reached
    challenge: null, // decoded challenge link, kept across resets until a run uses it
    indent: [], // per character of quoteText: true for indentation Skip indentation fills in
    ghostTimeouts: [],
    challengeUrl: '', // link for the finished run, built when the result dialog opens
};

const HISTORY_LIMIT = 500;
const CHART_POINTS = 10;

let runHistory = loadJSON(STORAGE_KEYS.history, []);
if (!Array.isArray(runHistory)) runHistory = [];

// Best run per settings combination:
// { [settingsKey]: { wpm, keystrokes, seed, textHash, weakKeys? } }.
let bests = loadJSON(STORAGE_KEYS.bests, {});
if (!bests || typeof bests !== 'object' || Array.isArray(bests)) bests = {};

// Attempts and misses per expected character across all recorded runs.
let keyStats = loadJSON(STORAGE_KEYS.keyStats, {});
if (!keyStats || typeof keyStats !== 'object' || Array.isArray(keyStats)) keyStats = {};

// Keys missed most often, by miss rate, among keys tried at least
// WEAK_MIN_ATTEMPTS times: letters (lowercased), digits, and symbols, but not
// space or new line. Used by the Weak Keys category.
const WEAK_MIN_ATTEMPTS = 5;
const WEAK_KEY_COUNT = 3;
const isWeakKeyCandidate = (key) => /^[!-~]$/.test(key); // printable ASCII, no space

function weakestKeys() {
    const keys = Object.entries(keyStats)
        .filter(([key, stat]) => isWeakKeyCandidate(key) && stat && stat.misses > 0)
        .filter(([, stat]) => stat.attempts >= WEAK_MIN_ATTEMPTS)
        .sort(([, a], [, b]) => b.misses / b.attempts - a.misses / a.attempts)
        .map(([key]) => key.toLowerCase());
    return [...new Set(keys)].slice(0, WEAK_KEY_COUNT);
}

// Custom Text with no text saved uses common words, and is recorded as them.
function passageCategory() {
    return gameState.category === 'custom' && !gameState.customText ? 'common' : gameState.category;
}

// Runs only compete with runs of the same mode, length, category, and
// rules. The defaults (Stop on error off, Skip indentation on) add nothing.
function settingsKey() {
    const length = gameState.mode === 'time' ? `${gameState.duration}s` : `${gameState.wordCount}w`;
    let category = passageCategory();
    if (category === 'custom') category = `custom-${textHash(gameState.customText)}`;
    if (category === 'code') category = `code-${gameState.codeLanguage}`;
    if (category === 'common') {
        if (gameState.hasPunctuation) category += '+punctuation';
        if (gameState.hasNumbers) category += '+numbers';
    }
    if (category.startsWith('code-') && !gameState.isAutoIndent) category += '+noindent';
    if (gameState.isStopOnError) category += '+stop';
    return `${gameState.mode}:${length}:${category}`;
}

function currentBest() {
    const best = bests[settingsKey()];
    if (!best || typeof best.wpm !== 'number' || !Array.isArray(best.keystrokes)) return null;
    return best;
}

// --- Audio ---
// Each sound is a recipe: oscillator shape, start and end frequency,
// duration, and volume. `steps` lists sub-recipes with start offsets in
// seconds, for sounds made of several notes.
const SOUNDS = {
    click: { wave: 'sine', freq: 800, toFreq: 400, duration: 0.05, volume: 0.05, jitter: 0.03 },
    error: {
        wave: 'sawtooth',
        freq: 100,
        toFreq: 80,
        slide: 'linear',
        duration: 0.15,
        volume: 0.08,
    },
    // C5, E5, G5, C6
    success: {
        steps: [523.25, 659.25, 783.99, 1046.5].map((freq, i) => ({
            at: i * 0.1,
            wave: 'sine',
            freq,
            duration: 0.5,
            volume: 0.05,
        })),
    },
};

const MAX_VOICES = 16; // oldest voice is stopped beyond this
const GAIN_FLOOR = 0.0001; // exponential ramps cannot reach 0

// The context is created on the first sound, after a keystroke, so the
// browser does not start it suspended. Every voice goes through one master
// gain node. If Web Audio is missing or blocked, sounds are skipped.
const audio = { context: null, master: null, failed: false, voices: [] };

function getAudioContext() {
    if (audio.failed) return null;
    if (!audio.context) {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            audio.context = new Ctx();
            audio.master = audio.context.createGain();
            audio.master.connect(audio.context.destination);
        } catch {
            audio.failed = true;
            audio.context = null;
            return null;
        }
    }
    if (audio.context.state === 'suspended') audio.context.resume().catch(() => {});
    return audio.context;
}

function playVoice(ctx, recipe, at) {
    while (audio.voices.length >= MAX_VOICES) audio.voices.shift().stop();

    // A few percent of random pitch keeps repeated clicks from sounding identical.
    const jitter = recipe.jitter ? 1 + (Math.random() * 2 - 1) * recipe.jitter : 1;
    const duration = recipe.duration > 0 ? recipe.duration : 0.1;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(audio.master);
    osc.type = recipe.wave || 'square';
    osc.frequency.setValueAtTime(Math.max(recipe.freq * jitter, 1), at);
    if (recipe.toFreq !== undefined) {
        const target = Math.max(recipe.toFreq * jitter, 1);
        if (recipe.slide === 'linear') osc.frequency.linearRampToValueAtTime(target, at + duration);
        else osc.frequency.exponentialRampToValueAtTime(target, at + duration);
    }
    gain.gain.setValueAtTime(Math.max(recipe.volume ?? 0.08, GAIN_FLOOR), at);
    gain.gain.exponentialRampToValueAtTime(GAIN_FLOOR, at + duration);
    osc.start(at);
    osc.stop(at + duration);

    audio.voices.push(osc);
    osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
        const index = audio.voices.indexOf(osc);
        if (index !== -1) audio.voices.splice(index, 1);
    };
}

// Fire and forget: never throws, and returns before touching Web Audio when
// sound is off.
function playSound(name) {
    if (!gameState.isSoundEnabled) return;
    const recipe = SOUNDS[name];
    if (!recipe) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
        const now = ctx.currentTime;
        for (const step of recipe.steps || [recipe]) playVoice(ctx, step, now + (step.at || 0));
    } catch {
        // A failed sound must not interrupt typing.
    }
}

// --- Random ---
// Small seeded generator (mulberry32), so the passages of a run can be
// rebuilt from its seed for Ghost Mode and challenge links.
function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function newSeed() {
    return Math.floor(Math.random() * 4294967296);
}

// --- Text Selection ---
// Words per passage when Common Words runs in time mode. A new passage is
// loaded each time one is finished.
const COMMON_CHUNK = 25;
// Longest word, with its trailing space, that renderNewQuote groups into a
// .word. A phone screen fits about 20 characters per line.
const WORD_GROUP_MAX = 16;
let lastQuoteIndex = -1;

function pickQuote(categoryQuotes) {
    let index;
    do {
        index = Math.floor(runtime.random() * categoryQuotes.length);
    } while (categoryQuotes.length > 1 && index === lastQuoteIndex);
    lastQuoteIndex = index;
    return categoryQuotes[index];
}

// Random common words with no word twice in a row, plus optional
// punctuation (capitalized sentences, commas, full stops) and numbers.
// Only Common Words shows those options, so other callers turn them off.
function commonWords(
    count,
    list = COMMON_WORDS,
    { punctuation = gameState.hasPunctuation, numbers = gameState.hasNumbers } = {}
) {
    const words = [];
    let previous = '';
    let sentenceStart = true;
    for (let n = 0; n < count; n++) {
        let word;
        do {
            word = list[Math.floor(runtime.random() * list.length)];
        } while (word === previous);
        previous = word;

        if (numbers && runtime.random() < 0.1) {
            word = String(1 + Math.floor(runtime.random() * 9999));
        }
        if (punctuation) {
            if (sentenceStart) word = word[0].toUpperCase() + word.slice(1);
            sentenceStart = false;
            const roll = runtime.random();
            if (n === count - 1 || roll < 0.1) {
                word += roll < 0.02 ? '?' : '.';
                sentenceStart = true;
            } else if (roll < 0.2) {
                word += ',';
            }
        }
        words.push(word);
    }
    return words.join(' ');
}

// Common words that contain at least one of the given letters. Falls back
// to the whole list when too few words match.
function wordsWithKeys(keys) {
    const matching = COMMON_WORDS.filter((word) => keys.some((key) => word.includes(key)));
    return matching.length >= 10 ? matching : COMMON_WORDS;
}

// Weak digits and symbols are practiced on common words: about every other
// word gets one, wrapped around the word for brackets and quotes, as a
// two-digit number for digits, and after the word otherwise.
const SYMBOL_PAIRS = { '(': ')', '[': ']', '{': '}', '<': '>', '"': '"', "'": "'", '`': '`' };

function withSymbols(text, symbols) {
    const closers = Object.fromEntries(Object.entries(SYMBOL_PAIRS).map(([a, b]) => [b, a]));
    return text
        .split(' ')
        .map((word) => {
            if (runtime.random() >= 0.5) return word;
            const symbol = symbols[Math.floor(runtime.random() * symbols.length)];
            if (/\d/.test(symbol)) return `${symbol}${Math.floor(runtime.random() * 10)}`;
            const open = SYMBOL_PAIRS[symbol] ? symbol : closers[symbol];
            if (open) return `${open}${word}${SYMBOL_PAIRS[open]}`;
            return `${word}${symbol}`;
        })
        .join(' ');
}

// Returns { text, source } for the next passage.
function getPassage() {
    if (gameState.category === 'weak') {
        const count = gameState.mode === 'words' ? gameState.wordCount : COMMON_CHUNK;
        const plain = { punctuation: false, numbers: false };
        const letters = runtime.weakKeys.filter((key) => /^[a-z]$/.test(key));
        const symbols = runtime.weakKeys.filter((key) => !/^[a-z]$/.test(key));
        const text = commonWords(count, wordsWithKeys(letters), plain);
        return { text: symbols.length ? withSymbols(text, symbols) : text, source: '' };
    }
    if (gameState.category === 'code') {
        const snippets = CODE_SNIPPETS[gameState.codeLanguage];
        if (gameState.mode !== 'words') return { text: pickQuote(snippets).join('\n'), source: '' };
        // Words mode uses whole snippets until there are at least that many words.
        const parts = [];
        let words = 0;
        while (words < gameState.wordCount) {
            const snippet = pickQuote(snippets).join('\n');
            parts.push(snippet);
            words += snippet.split(/\s+/).filter(Boolean).length;
        }
        return { text: parts.join('\n'), source: '' };
    }
    const custom = gameState.customText;
    if (gameState.category === 'custom' && custom) {
        if (gameState.mode !== 'words') return { text: custom, source: '' };
        // Words mode repeats the text from the start until there are enough words.
        const words = [];
        while (words.length < gameState.wordCount) words.push(...custom.split(' '));
        return { text: words.slice(0, gameState.wordCount).join(' '), source: '' };
    }
    if (passageCategory() === 'common') {
        const count = gameState.mode === 'words' ? gameState.wordCount : COMMON_CHUNK;
        return { text: commonWords(count), source: '' };
    }
    const categoryQuotes = QUOTES[gameState.category];
    if (gameState.mode === 'words') {
        const words = [];
        while (words.length < gameState.wordCount) {
            words.push(...pickQuote(categoryQuotes).text.split(' '));
        }
        return { text: words.slice(0, gameState.wordCount).join(' '), source: '' };
    }
    return pickQuote(categoryQuotes);
}

// textHash of the first passage a seed gives under the current settings.
// Bests and challenge links store it, so a replay can tell when a change to
// texts.js has changed the passages a seed gives.
function firstPassageHash(seed, weakKeys) {
    const saved = { random: runtime.random, weakKeys: runtime.weakKeys, lastQuoteIndex };
    runtime.random = seededRandom(seed);
    runtime.weakKeys = weakKeys;
    lastQuoteIndex = -1;
    const hash = textHash(getPassage().text);
    runtime.random = saved.random;
    runtime.weakKeys = saved.weakKeys;
    lastQuoteIndex = saved.lastQuoteIndex;
    return hash;
}

function renderNewQuote() {
    const passage = getPassage();
    runtime.quoteText = passage.text;
    runtime.quoteSource = passage.source;
    quoteDisplayElement.textContent = '';
    quoteTextElement.textContent = runtime.quoteText;

    if (gameState.isGhostEnabled || runtime.challenge || paceSpeed()) {
        const ghostCursor = document.createElement('div');
        ghostCursor.id = 'ghost-cursor';
        ghostCursor.className = 'ghost-cursor';
        quoteDisplayElement.appendChild(ghostCursor);
    }

    // One span per character, grouped by word: each word and the space after
    // it go in a .word element, which the browser paints separately, so a
    // keystroke repaints one word instead of the whole passage. A new line
    // stays outside the words so it breaks the passage's line.
    const fragment = document.createDocumentFragment();
    let word = [];
    const addWord = () => {
        if (word.length === 0) return;
        // A word that may not fit on a phone's line is left ungrouped, so it
        // can still break mid-word like plain text.
        let parent = fragment;
        if (word.length <= WORD_GROUP_MAX) {
            parent = document.createElement('div');
            parent.className = 'word';
            fragment.appendChild(parent);
        }
        word.forEach((span) => parent.appendChild(span));
        word = [];
    };
    for (const character of runtime.quoteText) {
        const span = document.createElement('span');
        if (character === '\n') {
            addWord();
            // Shown as a return arrow, then breaks the line.
            span.textContent = '\u21b5\n';
            span.className = 'newline';
            fragment.appendChild(span);
            continue;
        }
        span.textContent = character;
        word.push(span);
        if (character === ' ') addWord();
    }
    addWord();
    quoteDisplayElement.appendChild(fragment);

    const firstSpan = quoteDisplayElement.querySelector('span');
    if (firstSpan) firstSpan.classList.add('current');
    // A new passage mid-run: show where the ghost is relative to it.
    if (runtime.isStarted && runtime.ghostTimeouts.length > 0) placeGhostCursor();

    typingInputElement.value = '';
    typingInputElement.maxLength = runtime.quoteText.length;
    runtime.previousValue = '';

    // Positions of leading spaces after a new line, which Skip indentation
    // fills in for code.
    runtime.indent = [];
    if (gameState.category === 'code' && gameState.isAutoIndent) {
        let lineStart = true;
        for (const character of runtime.quoteText) {
            lineStart = character === '\n' ? true : lineStart && character === ' ';
            runtime.indent.push(lineStart && character === ' ');
        }
    }
}

// --- Core Logic ---
function handleInput() {
    if (isModalOpen(settingsModal) || isModalOpen(customModal)) return;
    if (!runtime.isStarted) startGame();

    // The interval checks the clock only every 250 ms. Input that arrives
    // after the deadline ends the run instead of counting toward it.
    if (gameState.mode === 'time' && elapsedMs() >= gameState.duration * 1000) {
        endGame(runtime.startTime + gameState.duration * 1000);
        return;
    }

    let typed = typingInputElement.value;
    const quote = runtime.quoteText;
    const spans = quoteDisplayElement.querySelectorAll('span');

    // Count keystrokes and mistakes for the characters past the part of the
    // value that did not change. Diffing against the previous value, instead
    // of trusting e.data, also handles on-screen keyboards that resend the
    // whole word being composed or replace it after autocorrect.
    const previous = runtime.previousValue;
    let unchanged = 0;
    while (
        unchanged < previous.length &&
        unchanged < typed.length &&
        previous[unchanged] === typed[unchanged]
    ) {
        unchanged++;
    }
    const inserted = typed.slice(unchanged);
    if (inserted.length > 0) {
        let wrong = 0;
        let firstWrong = -1;
        for (let k = 0; k < inserted.length; k++) {
            const pos = unchanged + k;
            if (pos >= quote.length) continue;
            runtime.keystrokes++;
            const expected = quote[pos];
            const stat = runtime.keyStats[expected] || { attempts: 0, misses: 0 };
            runtime.keyStats[expected] = stat;
            stat.attempts++;
            if (inserted[k] !== expected) {
                stat.misses++;
                wrong++;
                if (firstWrong === -1) firstWrong = pos;
            }
        }
        if (wrong > 0) {
            runtime.mistakes += wrong;
            mistakesElement.textContent = runtime.mistakes;
            playSound('error');
        } else {
            playSound('click');
        }
        // Stop on error: the mistake is counted, but the caret stays put
        // until the right key is pressed.
        if (gameState.isStopOnError && firstWrong !== -1) {
            typed = typed.slice(0, firstWrong);
            typingInputElement.value = typed;
        }
    }
    // Skip indentation: after a correct new line in code, fill in the next
    // line's leading spaces. Setting the value does not fire an input event,
    // so they are not keystrokes.
    const atNewLine =
        typed.length > 0 && typed[typed.length - 1] === '\n' && quote[typed.length - 1] === '\n';
    if (inserted.length > 0 && atNewLine && runtime.indent[typed.length]) {
        let end = typed.length;
        while (runtime.indent[end]) end++;
        typed += quote.slice(typed.length, end);
        typingInputElement.value = typed;
    }
    runtime.previousValue = typed;

    runtime.ghostStrokes.push({
        t: Math.round(performance.now() - runtime.startTime),
        i: runtime.quoteBase + typed.length,
    });

    // Filled-in indentation shows as typed but counts toward neither WPM
    // nor accuracy.
    let correctCount = 0;
    let filled = 0;
    for (let index = 0; index < typed.length; index++) {
        if (typed[index] !== quote[index]) continue;
        if (runtime.indent[index]) filled++;
        else correctCount++;
    }

    // Only spans from the first changed character to the end of the longer
    // of the old and new values can change state. Restyling just those keeps
    // each keystroke from restyling the whole passage.
    const last = Math.min(Math.max(previous.length, typed.length), spans.length - 1);
    for (let index = Math.min(unchanged, typed.length); index <= last; index++) {
        const span = spans[index];
        const isTyped = index < typed.length;
        span.classList.toggle('correct', isTyped && typed[index] === quote[index]);
        span.classList.toggle('incorrect', isTyped && typed[index] !== quote[index]);
        span.classList.toggle('current', index === typed.length);
    }
    // Reading the caret's position costs a layout per keystroke, so only
    // touch screens, where an on-screen keyboard can cover it, pay for it.
    if (coarsePointer.matches) keepCurrentInView();

    updateGhostStatus();

    const countedTyped = typed.length - filled;
    runtime.correctChars = runtime.baseCorrect + correctCount;
    runtime.typedChars = runtime.baseTyped + countedTyped;
    updateMetrics();

    if (typed.length === quote.length) {
        if (gameState.mode === 'time') {
            // Keep going until the clock runs out.
            runtime.baseCorrect += correctCount;
            runtime.baseTyped += countedTyped;
            runtime.quoteBase += quote.length;
            renderNewQuote();
        } else {
            endGame();
        }
    }
}

// An on-screen keyboard shrinks the visual viewport but not the page, so
// the line being typed can end up behind it. Scroll the page until the
// current character is inside the visible part, with a line of margin.
const coarsePointer = window.matchMedia('(pointer: coarse)');

function keepCurrentInView() {
    const viewport = window.visualViewport;
    const current = quoteDisplayElement.querySelector('.current');
    if (!viewport || !current) return;
    const rect = current.getBoundingClientRect();
    const margin = rect.height;
    const top = viewport.offsetTop + margin;
    const bottom = viewport.offsetTop + viewport.height - margin;
    if (rect.bottom > bottom) window.scrollBy(0, rect.bottom - bottom);
    else if (rect.top < top) window.scrollBy(0, rect.top - top);
}

function elapsedMs() {
    const end = runtime.endTime || performance.now();
    return end - runtime.startTime;
}

function startGame() {
    runtime.isStarted = true;
    runtime.startTime = performance.now();
    runtime.endTime = 0;
    containerElement.classList.add('focus-mode');

    runtime.timer = gameState.mode === 'time' ? gameState.duration : 0;
    timerElement.textContent = runtime.timer;
    runtime.interval = setInterval(tick, 250);

    const best = currentBest();
    // A ghost recorded on other text would not match this passage.
    if (runtime.challenge) {
        runtime.challenge.used = true;
        if (!runtime.textChanged) startGhostPlayback(runtime.challenge.strokes);
    } else if (gameState.isGhostEnabled && best && !runtime.textChanged) {
        startGhostPlayback(bestStrokes(best));
    } else if (paceSpeed()) {
        startGhostPlayback(paceStrokes(paceSpeed()));
    }
    updateGhostStatus();
}

function tick() {
    const elapsedSeconds = Math.floor(elapsedMs() / 1000);
    if (gameState.mode === 'time') {
        runtime.timer = Math.max(0, gameState.duration - elapsedSeconds);
        setText(timerElement, runtime.timer);
        if (elapsedMs() >= gameState.duration * 1000) {
            endGame(runtime.startTime + gameState.duration * 1000);
            return;
        }
    } else {
        runtime.timer = elapsedSeconds;
        setText(timerElement, runtime.timer);
    }
    updateMetrics();
}

function startGhostPlayback(strokes) {
    if (!document.getElementById('ghost-cursor')) return;
    runtime.ghostTimeouts = strokes.map((stroke) =>
        setTimeout(() => {
            if (!runtime.isStarted) return;
            // Look everything up live: the quote (and its spans) may have
            // been replaced since playback started.
            runtime.ghostIndex = stroke.i;
            updateGhostStatus();
            placeGhostCursor();
        }, stroke.t)
    );
}

// Puts the ghost cursor on the character the ghost has reached. In Time
// mode the ghost can be on a later or earlier passage; then the cursor
// waits at the end or start of this one, with an arrow pointing the way.
function placeGhostCursor() {
    const cursor = document.getElementById('ghost-cursor');
    const spans = quoteDisplayElement.querySelectorAll('span');
    if (!cursor || spans.length === 0) return;
    const index = runtime.ghostIndex - runtime.quoteBase;
    const ahead = index >= spans.length;
    const behind = index < 0;
    const span = spans[Math.min(Math.max(index, 0), spans.length - 1)];
    // offsetLeft/Top are layout coordinates, so the focus-mode scale does not
    // shift them. A span inside a .word is measured from the word, so the
    // word's offset is added.
    let left = span.offsetLeft + (ahead ? span.offsetWidth : 0);
    let top = span.offsetTop;
    if (span.offsetParent !== quoteDisplayElement) {
        left += span.offsetParent.offsetLeft;
        top += span.offsetParent.offsetTop;
    }
    cursor.style.transform = `translate(${left}px, ${top}px)`;
    cursor.style.opacity = 1;
    cursor.classList.toggle('ahead', ahead);
    cursor.classList.toggle('behind', behind);
}

// Before a run: what the ghost is. During a run: how far ahead or behind
// the ghost you are, in characters.
function updateGhostStatus() {
    const challenge = runtime.challenge;
    if (!gameState.isGhostEnabled && !challenge) {
        updatePaceStatus();
        return;
    }
    ghostStatus.classList.remove('hidden');
    if (runtime.textChanged) {
        ghostStatus.textContent = challenge
            ? 'This challenge was recorded on a different version of the text, so there is no ghost or winner.'
            : 'Your best for these settings was recorded on a different version of the text. Set a new best to race a ghost.';
        return;
    }
    const best = challenge || currentBest();
    if (challenge && !runtime.isStarted) {
        ghostStatus.textContent = `Challenge: beat ${challenge.wpm} WPM on this text`;
        return;
    }
    if (!best) {
        ghostStatus.textContent = 'No ghost yet for these settings: finish a run to record one.';
        return;
    }
    if (!runtime.isStarted) {
        ghostStatus.textContent = `Racing your best: ${best.wpm} WPM`;
        return;
    }
    showRaceDelta('ghost');
}

// How far ahead of or behind the ghost or pace caret you are, in characters.
function showRaceDelta(name) {
    const delta = runtime.quoteBase + typingInputElement.value.length - runtime.ghostIndex;
    if (delta === 0) setText(ghostStatus, `Level with the ${name}`);
    else setText(ghostStatus, `${delta > 0 ? '+' : ''}${delta} chars vs ${name}`);
}

// --- Pace caret ---
// The pace caret is the ghost cursor fed with strokes at a steady speed.
// Returns that speed in WPM, or 0 when there is no pace caret: Ghost Mode
// and challenges take its place, and Average and Last need a recorded run
// at these settings.
function paceSpeed() {
    if (gameState.pace === 'off' || gameState.isGhostEnabled || runtime.challenge) return 0;
    if (gameState.pace === 'target') return gameState.paceWpm;
    const runs = runHistory.filter((h) => h.key === settingsKey());
    if (runs.length === 0) return 0;
    if (gameState.pace === 'last') return runs[0].wpm;
    const recent = runs.slice(0, CHART_POINTS);
    return Math.round(recent.reduce((sum, h) => sum + h.wpm, 0) / recent.length);
}

// At five characters a word, character i is reached at i * 12000 / wpm ms.
// Time mode covers the whole duration, Words mode the passage.
function paceStrokes(wpm) {
    const count =
        gameState.mode === 'time'
            ? Math.ceil((gameState.duration * wpm * 5) / 60)
            : runtime.quoteText.length;
    return Array.from({ length: count }, (_, n) => ({ t: ((n + 1) * 12000) / wpm, i: n + 1 }));
}

function updatePaceStatus() {
    if (gameState.pace === 'off') {
        ghostStatus.classList.add('hidden');
        return;
    }
    ghostStatus.classList.remove('hidden');
    if (runtime.isStarted && runtime.ghostTimeouts.length > 0) {
        showRaceDelta('pace');
        return;
    }
    const wpm = paceSpeed();
    if (!wpm) {
        ghostStatus.textContent = 'No runs at these settings yet, so there is no pace caret.';
        return;
    }
    const labels = {
        target: `${wpm} WPM`,
        average: `your average, ${wpm} WPM`,
        last: `your last run, ${wpm} WPM`,
    };
    ghostStatus.textContent = `Pace: ${labels[gameState.pace]}`;
}

function stopGhostPlayback() {
    runtime.ghostTimeouts.forEach(clearTimeout);
    runtime.ghostTimeouts = [];
}

// Setting textContent replaces the text node and invalidates layout even
// when the value is unchanged, so values written every keystroke or tick go
// through here.
function setText(element, value) {
    const text = String(value);
    if (element.textContent !== text) element.textContent = text;
}

function updateMetrics() {
    const elapsed = elapsedMs();
    const wpm = elapsed >= 1000 ? Math.round(runtime.correctChars / 5 / (elapsed / 60000)) : 0;
    const accuracy =
        runtime.keystrokes > 0
            ? Math.floor(((runtime.keystrokes - runtime.mistakes) / runtime.keystrokes) * 100)
            : 100;
    setText(wpmElement, wpm);
    setText(accuracyElement, accuracy);
    return { wpm, accuracy };
}

function endGame(endTime = performance.now()) {
    if (!runtime.isStarted) return;
    runtime.isStarted = false;
    runtime.endTime = endTime;
    clearInterval(runtime.interval);
    stopGhostPlayback();
    typingInputElement.disabled = true;
    containerElement.classList.remove('focus-mode');

    const { wpm, accuracy } = updateMetrics();
    const previousBest = currentBest();
    let isNewBest = false;

    // Runs under a second have no meaningful WPM. Show them, but do not record them.
    if (elapsedMs() >= 1000) {
        const key = settingsKey();
        runHistory.unshift({
            wpm,
            accuracy,
            date: new Date().toISOString(),
            mode: gameState.mode,
            key,
        });
        runHistory.length = Math.min(runHistory.length, HISTORY_LIMIT);
        saveJSON(STORAGE_KEYS.history, runHistory);

        for (const [key, stat] of Object.entries(runtime.keyStats)) {
            const total = keyStats[key] || { attempts: 0, misses: 0 };
            keyStats[key] = {
                attempts: total.attempts + stat.attempts,
                misses: total.misses + stat.misses,
            };
        }
        saveJSON(STORAGE_KEYS.keyStats, keyStats);

        if (wpm > (previousBest ? previousBest.wpm : 0)) {
            bests[key] = {
                wpm,
                keystrokes: encodeStrokes(runtime.ghostStrokes),
                seed: runtime.seed,
                textHash: runtime.passageHash,
            };
            if (gameState.category === 'weak') bests[key].weakKeys = runtime.weakKeys;
            saveJSON(STORAGE_KEYS.bests, bests);
            isNewBest = true;
        }
    }

    playSound('success');
    updateHighScoreDisplay();
    renderChart();
    renderRunChart();
    showResultModal(wpm, accuracy, { isNewBest, previousBest });
}

function renderChart() {
    const key = settingsKey();
    const data = runHistory
        .filter((h) => h.key === key)
        .slice(0, CHART_POINTS)
        .map((h) => h.wpm)
        .reverse(); // oldest to newest
    // Two points only draw a line between them, so the chart waits for three.
    chartContainer.classList.toggle('hidden', data.length < 3);
    if (data.length < 3) return;

    drawLineChart(progressChart, data, true, ['oldest', 'latest']);
    progressChartTitle.textContent = `WPM, last ${data.length} runs`;
}

// Draws numbers as a polyline in a 300x100 viewBox, and writes the lowest
// and highest value and the two ends of the x axis into the labels around
// it. Only numbers reach innerHTML.
function drawLineChart(svg, data, withDots, [xStart, xEnd]) {
    const width = 300;
    const height = 100;
    const pad = 6;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const x = (i) => pad + (i / (data.length - 1)) * (width - 2 * pad);
    const y = (v) => pad + (1 - (v - min) / range) * (height - 2 * pad);

    const points = data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    const circles = withDots
        ? data.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" />`).join('')
        : '';
    svg.innerHTML = `<polyline points="${points}" />${circles}`;

    const plot = svg.parentElement;
    plot.querySelector('.chart-y-max').textContent = max;
    plot.querySelector('.chart-y-min').textContent = min === max ? '' : min;
    plot.querySelector('.chart-x-start').textContent = xStart;
    plot.querySelector('.chart-x-end').textContent = xEnd;
}

// WPM at the end of each whole second, from the recorded input events.
// Counts every typed character, right or wrong.
function wpmBySecond() {
    const seconds = Math.floor(elapsedMs() / 1000);
    const strokes = runtime.ghostStrokes;
    const points = [];
    let k = 0;
    let index = 0;
    for (let s = 1; s <= seconds; s++) {
        while (k < strokes.length && strokes[k].t <= s * 1000) {
            index = strokes[k].i;
            k++;
        }
        points.push(Math.round(index / 5 / (s / 60)));
    }
    return points;
}

function renderRunChart() {
    const data = wpmBySecond();
    runChartContainer.classList.toggle('hidden', data.length < 2);
    if (data.length < 2) return;
    drawLineChart(runChart, data, false, ['1s', `${data.length}s`]);
}

// The run whose passages the next run replays: an open challenge, or with
// Ghost Mode on, the best for these settings if it recorded its seed and
// was recorded on the same text. Otherwise runs start from a new seed.
function replayedRun() {
    const best = currentBest();
    if (runtime.challenge) return runtime.challenge;
    if (runtime.textChanged) return null;
    return gameState.isGhostEnabled && best && Number.isInteger(best.seed) ? best : null;
}

const replayedWeakKeys = (replay) =>
    replay && Array.isArray(replay.weakKeys) ? replay.weakKeys : weakestKeys();

// A replayed run with a stored hash that its seed no longer reproduces was
// recorded before a change to texts.js. Runs without a hash are not checked.
function textChangedSince(replay) {
    if (!replay || typeof replay.textHash !== 'string') return false;
    return replay.textHash !== firstPassageHash(replay.seed, replayedWeakKeys(replay));
}

function resetGame() {
    if (runtime.challenge && runtime.challenge.used) endChallenge();
    clearInterval(runtime.interval);
    stopGhostPlayback();
    Object.assign(runtime, {
        isStarted: false,
        startTime: 0,
        endTime: 0,
        interval: null,
        quoteBase: 0,
        baseCorrect: 0,
        baseTyped: 0,
        correctChars: 0,
        typedChars: 0,
        keystrokes: 0,
        mistakes: 0,
        ghostStrokes: [],
        keyStats: {},
        ghostIndex: 0,
        challengeUrl: '',
        textChanged: false,
    });

    // A challenge on changed text is still played, without a ghost or
    // winner. A best on changed text is not replayed.
    runtime.textChanged = textChangedSince(replayedRun());
    const replay = replayedRun();
    runtime.seed = replay ? replay.seed : newSeed();
    runtime.random = seededRandom(runtime.seed);
    runtime.weakKeys = replayedWeakKeys(replay);
    lastQuoteIndex = -1;

    runtime.timer = gameState.mode === 'time' ? gameState.duration : 0;
    timerElement.textContent = runtime.timer;
    wpmElement.textContent = 0;
    accuracyElement.textContent = 100;
    mistakesElement.textContent = 0;

    containerElement.classList.remove('focus-mode');
    typingInputElement.disabled = false;
    resultModal.classList.remove('show');
    settingsModal.classList.remove('show');
    statsModal.classList.remove('show');
    customModal.classList.remove('show');

    updateQuickBar();
    updateHighScoreDisplay();
    renderNewQuote();
    runtime.passageHash = textHash(runtime.quoteText);
    updateGhostStatus();
    typingInputElement.focus();
}

// The mode and length pills and the category options on the main screen
// mirror gameState. Each category option is shown only where it applies.
function updateQuickBar() {
    setActivePill(quickMode, gameState.mode);
    setActivePill(quickDuration, String(gameState.duration));
    setActivePill(quickWordCount, String(gameState.wordCount));
    quickDuration.classList.toggle('hidden', gameState.mode !== 'time');
    quickWordCount.classList.toggle('hidden', gameState.mode !== 'words');
    ghostBadge.classList.toggle('hidden', !gameState.isGhostEnabled);
    codeLanguageSelect.classList.toggle('hidden', gameState.category !== 'code');
    autoIndentOption.classList.toggle('hidden', gameState.category !== 'code');
    punctuationOption.classList.toggle('hidden', gameState.category !== 'common');
    numbersOption.classList.toggle('hidden', gameState.category !== 'common');
    editCustomBtn.classList.toggle('hidden', gameState.category !== 'custom');

    const weak = runtime.weakKeys;
    const noCustomText = gameState.category === 'custom' && !gameState.customText;
    practiceNote.classList.toggle('hidden', gameState.category !== 'weak' && !noCustomText);
    if (noCustomText) {
        practiceNote.textContent =
            'No custom text yet. Add it with Edit text; using common words until then.';
    } else if (!weak.length) {
        practiceNote.textContent = 'Not enough mistakes recorded yet. Using all common words.';
    } else {
        // A replayed run keeps the letters it was typed with.
        const replay = replayedRun();
        let label = 'Practicing';
        if (replay && Array.isArray(replay.weakKeys)) {
            label = runtime.challenge
                ? "Practicing the challenge's letters"
                : "Practicing your best run's letters";
        }
        practiceNote.textContent = `${label}: ${weak.join(', ')}`;
    }
}

function updateHighScoreDisplay() {
    const best = currentBest();
    highScoreElement.textContent = best ? best.wpm : 0;
}

// Focus an element inside a dialog that was shown in this same tick. If the
// browser refuses because the dialog has not rendered yet, retry next frame.
function focusInDialog(element) {
    element.focus();
    if (document.activeElement !== element) {
        requestAnimationFrame(() => element.focus());
    }
}

function showResultModal(wpm, accuracy, { isNewBest, previousBest }) {
    const elapsed = elapsedMs();
    const raw = elapsed >= 1000 ? Math.round(runtime.typedChars / 5 / (elapsed / 60000)) : 0;
    const wrong = runtime.typedChars - runtime.correctChars;
    resultTitle.textContent = settingsLabel(' · ');
    modalWpmElement.textContent = wpm;
    modalAccuracyElement.textContent = `${accuracy}%`;
    modalRawElement.textContent = raw;
    modalCharsElement.textContent = `${runtime.correctChars} / ${wrong}`;
    modalTimeElement.textContent = `${(elapsed / 1000).toFixed(1)}s`;
    if (isNewBest) {
        modalBestElement.textContent = previousBest
            ? `New best for these settings. Previous best: ${previousBest.wpm} WPM.`
            : 'First recorded run for these settings.';
    } else if (elapsed < 1000) {
        modalBestElement.textContent = 'Runs under one second are not recorded.';
    } else if (!previousBest) {
        modalBestElement.textContent = 'No recorded best for these settings yet.';
    } else {
        modalBestElement.textContent = `Best for these settings: ${previousBest.wpm} WPM.`;
    }
    modalBestElement.classList.toggle('new-best', isNewBest && Boolean(previousBest));

    const missed = Object.entries(runtime.keyStats)
        .filter(([, stat]) => stat.misses > 0)
        .sort(([, a], [, b]) => b.misses - a.misses || a.attempts - b.attempts)
        .slice(0, 3)
        .map(
            ([key, stat]) => `${key === ' ' ? 'space' : key} (${stat.misses} of ${stat.attempts})`
        );
    modalKeysElement.textContent = missed.length
        ? `Most missed keys: ${missed.join(', ')}`
        : 'No missed keys.';
    practiceBtn.classList.toggle('hidden', weakestKeys().length === 0);
    // A custom text stays on this device, so it cannot be sent as a challenge.
    const canChallenge = elapsed >= 1000 && passageCategory() !== 'custom';
    challengeBtn.classList.toggle('hidden', !canChallenge);
    challengeBtn.textContent = 'Copy challenge link';
    challengeLinkRow.classList.add('hidden');
    if (canChallenge) prepareChallengeUrl();

    const challenge = runtime.challenge;
    modalChallengeElement.classList.toggle('hidden', !challenge);
    if (challenge) {
        const verdict =
            wpm > challenge.wpm ? 'You won.' : wpm === challenge.wpm ? 'A tie.' : 'They won.';
        const outcome = runtime.textChanged
            ? 'Recorded on a different version of the text: no winner.'
            : verdict;
        modalChallengeElement.textContent = `Challenge: you ${wpm} WPM, them ${challenge.wpm} WPM. ${outcome}`;
    }
    modalSourceElement.textContent = runtime.quoteSource;
    modalSourceElement.classList.toggle('hidden', !runtime.quoteSource);
    resultModal.classList.add('show');
    updateFocusHint();
    focusInDialog(playAgainBtn);
}

// --- Sharing ---
const SITE_URL = 'https://tmhsdigital.github.io/Typing-Game/';

function settingsLabel(separator = ' ') {
    const length =
        gameState.mode === 'time' ? `${gameState.duration}s` : `${gameState.wordCount} words`;
    const category = categorySelect.selectedOptions[0]?.textContent || gameState.category;
    return `${length}${separator}${category}`;
}

function shareText() {
    return `${modalWpmElement.textContent} WPM, ${modalAccuracyElement.textContent} accuracy, ${settingsLabel()} on TypeSpeed`;
}

// Phones get the system share sheet. Desktops, where navigator.share opens
// an OS dialog people do not expect, copy to the clipboard.
async function shareResult() {
    const text = shareText();
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.share) {
        try {
            await navigator.share({ title: 'TypeSpeed', text, url: SITE_URL });
        } catch {
            // Dismissing the share sheet rejects; nothing to report.
        }
        return;
    }
    try {
        await navigator.clipboard.writeText(`${text} ${SITE_URL}`);
        shareBtn.textContent = 'Copied!';
    } catch {
        shareBtn.textContent = 'Copy failed';
    }
    setTimeout(() => {
        shareBtn.textContent = 'Share result';
    }, 2000);
}

// --- Challenge Links ---
// A link carries a finished run's settings, seed, first passage hash, WPM,
// and keystroke timings in the URL hash. Opening it plays those passages
// with the run as the ghost, without changing the receiver's saved
// settings. Version 1 links have no passage hash and are not checked.
const CHALLENGE_VERSION = 2;
const CHALLENGE_MAX_LENGTH = 20000; // characters in the hash
const CHALLENGE_MAX_STROKES = 5000;
const CHALLENGE_SETTINGS = [
    'mode',
    'duration',
    'wordCount',
    'category',
    'hasPunctuation',
    'hasNumbers',
    'codeLanguage',
    'isStopOnError',
    'isAutoIndent',
];

function toBase64Url(bytes) {
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

// Runs bytes through a (de)compression stream. Reading the stream directly,
// with the writer's rejections caught, keeps a corrupt link from logging
// stream errors; the read rejects instead and the caller ignores the link.
async function pipeBytes(bytes, stream) {
    const writer = stream.writable.getWriter();
    writer.write(bytes).catch(() => {});
    writer.close().catch(() => {});
    const reader = stream.readable.getReader();
    const chunks = [];
    let length = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        length += value.length;
    }
    const result = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}

// 'z' + deflated JSON where CompressionStream exists, otherwise 'j' + JSON.
async function encodeChallenge(payload) {
    const json = new TextEncoder().encode(JSON.stringify(payload));
    if (typeof CompressionStream === 'function') {
        return `z${toBase64Url(await pipeBytes(json, new CompressionStream('deflate-raw')))}`;
    }
    return `j${toBase64Url(json)}`;
}

async function decodeChallenge(text) {
    let bytes = fromBase64Url(text.slice(1));
    if (text[0] === 'z') {
        if (typeof DecompressionStream !== 'function') return null;
        bytes = await pipeBytes(bytes, new DecompressionStream('deflate-raw'));
    } else if (text[0] !== 'j') {
        return null;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
}

// Checks every field of a decoded payload. Returns null if anything is off.
function parseChallenge(data) {
    if (!data || ![1, CHALLENGE_VERSION].includes(data.v)) return null;
    if (!data.s || typeof data.s !== 'object') return null;
    if (data.v === CHALLENGE_VERSION && !isTextHash(data.h)) return null;
    if (!Number.isInteger(data.seed) || data.seed < 0 || data.seed >= 4294967296) return null;
    if (!isNumber(data.wpm) || data.wpm < 0 || data.wpm > 1000) return null;
    if (!Array.isArray(data.d) || data.d.length % 2 !== 0) return null;
    if (data.d.length > CHALLENGE_MAX_STROKES * 2 || !data.d.every(Number.isInteger)) return null;

    const strokes = [];
    let t = 0;
    let i = 0;
    for (let n = 0; n < data.d.length; n += 2) {
        t += data.d[n];
        i += data.d[n + 1];
        if (data.d[n] < 0 || t > 600000 || i < 0 || i > 100000) return null;
        strokes.push({ t, i });
    }

    const sanitized = sanitizeSettings(data.s);
    if (sanitized.category === 'custom') return null;
    const settings = {};
    for (const name of CHALLENGE_SETTINGS) settings[name] = sanitized[name];
    const weakKeys = Array.isArray(data.k)
        ? data.k.filter(isWeakKeyCandidate).slice(0, WEAK_KEY_COUNT)
        : [];
    const challenge = {
        settings,
        seed: data.seed,
        wpm: Math.round(data.wpm),
        weakKeys,
        strokes,
        used: false,
    };
    if (data.v === CHALLENGE_VERSION) challenge.textHash = data.h;
    return challenge;
}

function challengePayload() {
    const deltas = encodeStrokes(runtime.ghostStrokes.slice(0, CHALLENGE_MAX_STROKES));
    const settings = {};
    for (const name of CHALLENGE_SETTINGS) settings[name] = gameState[name];
    settings.category = passageCategory();
    return {
        v: CHALLENGE_VERSION,
        s: settings,
        seed: runtime.seed,
        h: runtime.passageHash,
        wpm: Number(modalWpmElement.textContent),
        k: gameState.category === 'weak' ? runtime.weakKeys : [],
        d: deltas,
    };
}

async function buildChallengeUrl() {
    const code = await encodeChallenge(challengePayload());
    return `${location.origin}${location.pathname}#c=${code}`;
}

// Safari allows clipboard writes and the share sheet only during the click
// itself, and encoding is async. So the link is built when the result
// dialog opens, and the click uses it without waiting.
function prepareChallengeUrl() {
    const strokes = runtime.ghostStrokes;
    buildChallengeUrl()
        .then((url) => {
            if (runtime.ghostStrokes === strokes) runtime.challengeUrl = url;
        })
        .catch(() => {});
}

// Like Share result: the share sheet on phones, the clipboard elsewhere. If
// neither works, the link is shown so it can be copied by hand.
async function copyChallengeLink() {
    let url = runtime.challengeUrl;
    try {
        if (!url) url = await buildChallengeUrl();
    } catch {
        challengeBtn.textContent = 'Copy failed';
        return;
    }
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.share) {
        try {
            await navigator.share({ title: 'TypeSpeed challenge', url });
            return;
        } catch (err) {
            // Dismissing the share sheet rejects; anything else falls through.
            if (err && err.name === 'AbortError') return;
        }
    }
    try {
        await navigator.clipboard.writeText(url);
        challengeBtn.textContent = 'Link copied';
    } catch {
        challengeBtn.textContent = 'Copy failed';
        challengeLinkInput.value = url;
        challengeLinkRow.classList.remove('hidden');
        challengeLinkInput.focus();
        challengeLinkInput.select();
    }
}

function clearChallengeHash() {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

async function loadChallengeFromHash() {
    const match = location.hash.match(/^#c=([A-Za-z0-9_-]+)$/);
    if (!match || match[1].length > CHALLENGE_MAX_LENGTH) return;
    let challenge;
    try {
        challenge = parseChallenge(await decodeChallenge(match[1]));
    } catch {
        challenge = null;
    }
    if (!challenge) {
        clearChallengeHash();
        return;
    }
    runtime.challenge = challenge;
    Object.assign(gameState, challenge.settings);
    applySettingsToUI();
    resetGame();
}

// After a challenge run, go back to the receiver's own saved settings.
function endChallenge() {
    runtime.challenge = null;
    Object.assign(gameState, sanitizeSettings(loadJSON(STORAGE_KEYS.settings, null)));
    applySettingsToUI();
    clearChallengeHash();
}

// --- Settings ---
// Changing a setting by hand ends a challenge; the visible settings,
// including the change, become the saved ones.
function saveSettings() {
    if (runtime.challenge) {
        runtime.challenge = null;
        clearChallengeHash();
    }
    saveJSON(STORAGE_KEYS.settings, gameState);
}

function setActivePill(selector, value) {
    selector.querySelectorAll('.pill').forEach((pill) => {
        const active = pill.dataset.value === value;
        pill.classList.toggle('active', active);
        pill.setAttribute('aria-pressed', String(active));
    });
}

// Push gameState into the settings controls and the quote display.
function applySettingsToUI() {
    setActivePill(themeSelector, gameState.theme);
    categorySelect.value = gameState.category;
    soundToggle.checked = gameState.isSoundEnabled;
    hardModeToggle.checked = gameState.isHardMode;
    ghostModeToggle.checked = gameState.isGhostEnabled;
    paceSelect.value = gameState.pace;
    paceWpmInput.value = gameState.paceWpm;
    paceWpmInput.hidden = gameState.pace !== 'target';
    punctuationToggle.checked = gameState.hasPunctuation;
    numbersToggle.checked = gameState.hasNumbers;
    stopOnErrorToggle.checked = gameState.isStopOnError;
    autoIndentToggle.checked = gameState.isAutoIndent;
    codeLanguageSelect.value = gameState.codeLanguage;
    customTextInput.value = gameState.customText;
    quoteDisplayElement.classList.toggle('blurred', gameState.isHardMode);
    applyTheme();
}

// Settings changes reset the game on close anyway, so a run in progress is
// abandoned here instead of letting its clock run out behind the dialog.
function openSettings() {
    if (runtime.isStarted) resetGame();
    typingInputElement.blur();
    settingsModal.classList.add('show');
    updateFocusHint();
    focusInDialog(stopOnErrorToggle);
}

// Toggle and pill changes update gameState immediately; the new settings
// take effect when the modal closes and the game resets.
function closeSettings() {
    settingsModal.classList.remove('show');
    saveSettings();
    resetGame();
}

// Like Settings, the custom text dialog abandons a run in progress.
function openCustomText() {
    if (runtime.isStarted) resetGame();
    typingInputElement.blur();
    customTextInput.value = gameState.customText;
    customModal.classList.add('show');
    updateFocusHint();
    focusInDialog(customTextInput);
}

function closeCustomText() {
    customModal.classList.remove('show');
    gameState.customText = normalizeCustomText(customTextInput.value);
    customTextInput.value = gameState.customText;
    saveSettings();
    resetGame();
}

// --- Theme ---
const prefersLight = window.matchMedia('(prefers-color-scheme: light)');
const prefersContrast = window.matchMedia('(prefers-contrast: more)');

// Same rules as theme.js, which runs before the first paint.
function applyTheme() {
    let theme = gameState.theme;
    if (theme === 'system') {
        if (prefersContrast.matches) theme = 'contrast';
        else theme = prefersLight.matches ? 'light' : 'dark';
    }
    document.documentElement.dataset.theme = theme;
}

function applyPill(group, value) {
    if (group === 'mode') {
        gameState.mode = value === 'words' ? 'words' : 'time';
    } else if (group === 'duration') {
        gameState.duration = parseInt(value, 10);
    } else if (group === 'wordCount') {
        gameState.wordCount = parseInt(value, 10);
    }
}

function handleThemeClick(e) {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    setActivePill(themeSelector, pill.dataset.value);
    gameState.theme = THEMES.includes(pill.dataset.value) ? pill.dataset.value : 'system';
    applyTheme();
}

// Main-screen pills change the setting and start a fresh run at once, like
// the category select.
function handleQuickPillClick(e, group) {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    applyPill(group, pill.dataset.value);
    saveSettings();
    applySettingsToUI();
    resetGame();
}

// --- Stats ---
const KEY_EXTRA_LABELS = { stop: 'stop on error', noindent: 'indentation typed' };

// "time:60s:common+punctuation" -> "60s, Common Words, punctuation"
function describeKey(key) {
    const [mode, length, category = ''] = String(key).split(':');
    const [base, ...extras] = category.split('+');
    const value = base.replace(/-.*$/, '');
    const option = categorySelect.querySelector(`option[value="${CSS.escape(value)}"]`);
    const lengthLabel = mode === 'words' ? `${parseInt(length, 10)} words` : length;
    let label = option ? option.textContent : base;
    const language = value === 'code' && base.slice(5);
    const languageOption =
        language && codeLanguageSelect.querySelector(`option[value="${CSS.escape(language)}"]`);
    if (languageOption) label += ` (${languageOption.textContent})`;
    const extraLabels = extras.map((extra) => KEY_EXTRA_LABELS[extra] || extra);
    return [lengthLabel, label, ...extraLabels].join(', ');
}

function tableRow(cells) {
    const row = document.createElement('tr');
    for (const text of cells) {
        const cell = document.createElement('td');
        cell.textContent = text;
        if (/^\d+%?$/.test(String(text))) cell.className = 'num';
        row.appendChild(cell);
    }
    return row;
}

// A US QWERTY layout. Each key counts the character on it and its shifted
// one (a letter's capital, or the symbol above a digit or punctuation key).
const HEATMAP_ROWS = ['`1234567890-=', 'qwertyuiop[]\\', "asdfghjkl;'", 'zxcvbnm,./', ' '];
const SHIFTED = '~!@#$%^&*()_+{}|:"<>?';
const UNSHIFTED = "`1234567890-=[]\\;',./";

function keyStat(key) {
    const shifted = /[a-z]/.test(key) ? key.toUpperCase() : SHIFTED[UNSHIFTED.indexOf(key)];
    const total = { attempts: 0, misses: 0 };
    for (const character of [key, shifted]) {
        const stat = keyStats[character];
        if (!stat) continue;
        total.attempts += stat.attempts;
        total.misses += stat.misses;
    }
    return total;
}

// Keys shaded by miss rate, relative to the most missed key. Each key's
// accessible name carries its rate and attempts.
function renderHeatmap() {
    const stats = HEATMAP_ROWS.map((row) => [...row].map((key) => [key, keyStat(key)]));
    const rates = stats
        .flat()
        .filter(([, stat]) => stat.attempts >= WEAK_MIN_ATTEMPTS)
        .map(([, stat]) => stat.misses / stat.attempts);
    const worst = Math.max(0, ...rates);
    statsHeatmap.textContent = '';
    for (const row of stats) {
        const rowElement = document.createElement('div');
        rowElement.className = 'heatmap-row';
        for (const [key, stat] of row) {
            const cell = document.createElement('span');
            cell.className = key === ' ' ? 'heat-key space' : 'heat-key';
            cell.textContent = key === ' ' ? 'space' : key;
            cell.setAttribute('role', 'img');
            const name = key === ' ' ? 'space' : key;
            if (stat.attempts < WEAK_MIN_ATTEMPTS) {
                cell.classList.add('no-data');
                cell.setAttribute('aria-label', `${name}: not enough data`);
            } else {
                const rate = stat.misses / stat.attempts;
                const percent = Math.round(rate * 100);
                cell.style.setProperty('--heat', worst ? rate / worst : 0);
                cell.setAttribute(
                    'aria-label',
                    `${name}: ${percent}% missed of ${stat.attempts} attempts`
                );
            }
            cell.title = cell.getAttribute('aria-label');
            rowElement.appendChild(cell);
        }
        statsHeatmap.appendChild(rowElement);
    }
}

// Local calendar day of an ISO date, as YYYY-MM-DD.
function dayOf(iso) {
    const date = new Date(iso);
    if (isNaN(date)) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Average WPM per day at the current settings, oldest first.
function renderDailyChart() {
    const key = settingsKey();
    const days = new Map();
    for (const run of runHistory) {
        const day = dayOf(run.date);
        if (run.key !== key || !day) continue;
        const total = days.get(day) || { sum: 0, count: 0 };
        total.sum += run.wpm;
        total.count++;
        days.set(day, total);
    }
    const entries = [...days.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    dailyChartContainer.classList.toggle('hidden', entries.length < 2);
    if (entries.length < 2) return;
    const data = entries.map(([, total]) => Math.round(total.sum / total.count));
    const first = entries[0][0];
    const last = entries[entries.length - 1][0];
    drawLineChart(dailyChart, data, true, [first, last]);
    dailyChartTitle.textContent = `WPM by day, ${settingsLabel(' · ')}`;
    dailyChartSummary.textContent = `Daily average WPM from ${first} to ${last}: ${data.join(', ')}.`;
}

// Days in a row, ending today or yesterday, with at least one recorded run.
function currentStreak(now = new Date()) {
    const days = new Set(runHistory.map((run) => dayOf(run.date)));
    const day = new Date(now);
    if (!days.has(dayOf(day.toISOString()))) day.setDate(day.getDate() - 1);
    let streak = 0;
    while (days.has(dayOf(day.toISOString()))) {
        streak++;
        day.setDate(day.getDate() - 1);
    }
    return streak;
}

function renderStats() {
    const recent = runHistory.slice(0, 10);
    const streak = currentStreak();
    const streakText = streak > 1 ? ` Practiced ${streak} days in a row.` : '';
    statsSummary.textContent = recent.length
        ? `${runHistory.length} recorded ${runHistory.length === 1 ? 'run' : 'runs'}. Average of the last ${recent.length}: ${Math.round(recent.reduce((sum, run) => sum + run.wpm, 0) / recent.length)} WPM.${streakText}`
        : 'No runs yet. Finish a run of a second or longer to see it here.';
    renderHeatmap();
    renderDailyChart();
    // Empty tables with headers say nothing the line above does not.
    statsTables.classList.toggle('hidden', recent.length === 0 && !Object.keys(bests).length);

    statsBestsBody.textContent = '';
    Object.entries(bests)
        .filter(([, best]) => best && typeof best.wpm === 'number')
        .sort(([, a], [, b]) => b.wpm - a.wpm)
        .forEach(([key, best]) =>
            statsBestsBody.appendChild(tableRow([describeKey(key), best.wpm]))
        );

    statsRunsBody.textContent = '';
    runHistory.forEach((run) => {
        const date = new Date(run.date);
        const when = isNaN(date)
            ? ''
            : date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
        statsRunsBody.appendChild(
            tableRow([when, describeKey(run.key), run.wpm, `${run.accuracy}%`])
        );
    });
}

// Like Settings, the dialog abandons a run in progress.
function openStats() {
    if (runtime.isStarted) resetGame();
    typingInputElement.blur();
    statsStatus.textContent = '';
    clearBtn.textContent = 'Clear data';
    renderStats();
    statsModal.classList.add('show');
    updateFocusHint();
    focusInDialog(closeStatsBtn);
}

function closeStats() {
    statsModal.classList.remove('show');
    resetGame();
}

function exportData() {
    const data = {
        app: 'TypeSpeed',
        version: 1,
        exported: new Date().toISOString(),
        [STORAGE_KEYS.settings]: gameState,
        [STORAGE_KEYS.history]: runHistory,
        [STORAGE_KEYS.bests]: bests,
        [STORAGE_KEYS.keyStats]: keyStats,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'typespeed-data.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    statsStatus.textContent = 'Exported typespeed-data.json.';
}

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
// textHash output: a 32-bit number in base 36.
const isTextHash = (value) => typeof value === 'string' && /^[0-9a-z]{1,7}$/.test(value);

function validHistory(list) {
    if (!Array.isArray(list)) return [];
    return list
        .filter(
            (run) =>
                run && isNumber(run.wpm) && isNumber(run.accuracy) && typeof run.key === 'string'
        )
        .map((run) => ({
            wpm: run.wpm,
            accuracy: run.accuracy,
            date: typeof run.date === 'string' ? run.date : '',
            mode: run.mode === 'words' ? 'words' : 'time',
            key: run.key,
        }))
        .slice(0, HISTORY_LIMIT);
}

function validBests(map) {
    const result = {};
    if (!map || typeof map !== 'object' || Array.isArray(map)) return result;
    for (const [key, best] of Object.entries(map)) {
        if (!best || !isNumber(best.wpm) || !Array.isArray(best.keystrokes)) continue;
        // Either form is accepted; both are stored as differences.
        const list = best.keystrokes;
        const keystrokes = list.every(isNumber)
            ? list.slice(0, list.length - (list.length % 2))
            : encodeStrokes(list.filter((s) => s && isNumber(s.t) && isNumber(s.i)));
        result[key] = { wpm: best.wpm, keystrokes };
        if (Number.isInteger(best.seed)) result[key].seed = best.seed;
        if (isTextHash(best.textHash)) result[key].textHash = best.textHash;
        if (Array.isArray(best.weakKeys)) {
            result[key].weakKeys = best.weakKeys.filter(isWeakKeyCandidate).slice(0, 3);
        }
    }
    return result;
}

function validKeyStats(map) {
    const result = {};
    if (!map || typeof map !== 'object' || Array.isArray(map)) return result;
    for (const [key, stat] of Object.entries(map)) {
        if (stat && isNumber(stat.attempts) && isNumber(stat.misses)) {
            result[key] = { attempts: stat.attempts, misses: stat.misses };
        }
    }
    return result;
}

// Replaces the stored data with a file from Export. Anything malformed is
// dropped rather than trusted.
async function importData(file) {
    let text;
    try {
        text = await file.text();
    } catch {
        statsStatus.textContent = 'Could not read that file.';
        return;
    }
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        statsStatus.textContent = 'That file is not valid JSON.';
        return;
    }
    if (!data || data.app !== 'TypeSpeed') {
        statsStatus.textContent = 'That file is not a TypeSpeed export.';
        return;
    }
    runHistory = validHistory(data[STORAGE_KEYS.history]);
    bests = validBests(data[STORAGE_KEYS.bests]);
    keyStats = validKeyStats(data[STORAGE_KEYS.keyStats]);
    Object.assign(gameState, sanitizeSettings(data[STORAGE_KEYS.settings]));
    saveJSON(STORAGE_KEYS.history, runHistory);
    saveJSON(STORAGE_KEYS.bests, bests);
    saveJSON(STORAGE_KEYS.keyStats, keyStats);
    saveSettings();
    applySettingsToUI();
    updateHighScoreDisplay();
    renderStats();
    statsStatus.textContent = `Imported ${runHistory.length} ${runHistory.length === 1 ? 'run' : 'runs'} and ${Object.keys(bests).length} best scores.`;
}

// Two clicks: the first asks, the second clears.
function clearData() {
    if (clearBtn.textContent !== 'Click again to clear') {
        clearBtn.textContent = 'Click again to clear';
        statsStatus.textContent = 'This removes run history, best scores, and key stats.';
        return;
    }
    runHistory = [];
    bests = {};
    keyStats = {};
    for (const key of [STORAGE_KEYS.history, STORAGE_KEYS.bests, STORAGE_KEYS.keyStats]) {
        try {
            localStorage.removeItem(key);
        } catch {
            // Storage unavailable; the in-memory copies are already empty.
        }
    }
    clearBtn.textContent = 'Clear data';
    statsStatus.textContent = 'Cleared.';
    updateHighScoreDisplay();
    renderStats();
}

// --- Keyboard ---
// Keys that would move the caret or select text inside the input. Typing
// always happens at the end of the value.
const CARET_KEYS = [
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
    'PageUp',
    'PageDown',
];

function handleInputKeydown(e) {
    updateCapsWarning(e);
    const selectAll = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a';
    if (CARET_KEYS.includes(e.key) || selectAll) e.preventDefault();
}

// With Caps Lock on, every letter is wrong. Warn before the run is wasted.
function updateCapsWarning(e) {
    if (typeof e.getModifierState !== 'function') return;
    capsWarning.classList.toggle('hidden', !e.getModifierState('CapsLock'));
}

function pinCaretToEnd() {
    const end = typingInputElement.value.length;
    typingInputElement.setSelectionRange(end, end);
}

// A click would place the caret where it lands. Focus without moving it.
function handleInputMousedown(e) {
    e.preventDefault();
    typingInputElement.focus();
    pinCaretToEnd();
}

function isModalOpen(modal) {
    return modal.classList.contains('show');
}

function openModal() {
    return [settingsModal, customModal, statsModal, resultModal].find(isModalOpen) || null;
}

// Keep Tab and Shift+Tab inside the open dialog.
function trapFocus(e, modal) {
    const focusable = Array.from(
        modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.disabled && el.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!modal.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
    } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
}

// Show the "press any key" hint while nothing would receive typing. Runs
// after focus has settled, so opening a dialog does not flash it.
function updateFocusHint() {
    const lost = document.activeElement !== typingInputElement && !openModal();
    typingContainer.classList.toggle('unfocused', lost);
}

// A printable key pressed while focus is elsewhere goes to the input. Form
// controls keep their own keys, and Space still presses a focused button.
function refocusOnType(e) {
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    const active = document.activeElement;
    if (active === typingInputElement || typingInputElement.disabled) return;
    if (active && ['INPUT', 'SELECT', 'TEXTAREA'].includes(active.tagName)) return;
    if (e.key === ' ' && active && active.tagName === 'BUTTON') return;
    typingInputElement.focus();
}

function handleKeydown(e) {
    const modal = openModal();
    if (e.key === 'Escape') {
        if (modal === settingsModal) closeSettings();
        else if (modal === customModal) closeCustomText();
        else if (modal === statsModal) closeStats();
        else if (modal === resultModal) resetGame();
        return;
    }
    if (e.key === 'Tab' && modal) {
        trapFocus(e, modal);
        return;
    }

    if (e.key !== 'Tab') {
        if (!modal) refocusOnType(e);
        return;
    }

    // Tab restarts only while typing. Elsewhere, and for Shift+Tab, it
    // moves focus as usual so the page stays keyboard-navigable.
    if (e.shiftKey || document.activeElement !== typingInputElement) return;
    e.preventDefault();
    resetGame();
}

// --- Init ---
function init() {
    applySettingsToUI();
    updateHighScoreDisplay();

    typingInputElement.addEventListener('input', handleInput);
    typingInputElement.addEventListener('keydown', handleInputKeydown);
    typingInputElement.addEventListener('keyup', updateCapsWarning);
    typingInputElement.addEventListener('mousedown', handleInputMousedown);
    typingInputElement.addEventListener('select', pinCaretToEnd);
    typingInputElement.addEventListener('focus', pinCaretToEnd);
    typingInputElement.addEventListener('focus', updateFocusHint);
    typingInputElement.addEventListener('blur', () => setTimeout(updateFocusHint, 0));
    typingInputElement.addEventListener('paste', (e) => e.preventDefault());
    typingInputElement.addEventListener('drop', (e) => e.preventDefault());
    resetButton.addEventListener('click', resetGame);

    settingsBtn.addEventListener('click', openSettings);
    statsBtn.addEventListener('click', openStats);
    closeStatsBtn.addEventListener('click', closeStats);
    exportBtn.addEventListener('click', exportData);
    importBtn.addEventListener('click', () => importInput.click());
    // Cleared after the import finishes, so picking the same file again
    // still fires change.
    importInput.addEventListener('change', async () => {
        if (importInput.files[0]) await importData(importInput.files[0]);
        importInput.value = '';
    });
    clearBtn.addEventListener('click', clearData);
    closeSettingsBtn.addEventListener('click', closeSettings);
    editCustomBtn.addEventListener('click', openCustomText);
    closeCustomBtn.addEventListener('click', closeCustomText);
    themeSelector.addEventListener('click', handleThemeClick);
    prefersLight.addEventListener('change', applyTheme);
    prefersContrast.addEventListener('change', applyTheme);
    quickMode.addEventListener('click', (e) => handleQuickPillClick(e, 'mode'));
    quickDuration.addEventListener('click', (e) => handleQuickPillClick(e, 'duration'));
    quickWordCount.addEventListener('click', (e) => handleQuickPillClick(e, 'wordCount'));

    categorySelect.addEventListener('change', (e) => {
        gameState.category = e.target.value;
        saveSettings();
        resetGame();
    });

    soundToggle.addEventListener('change', (e) => {
        gameState.isSoundEnabled = e.target.checked;
    });
    hardModeToggle.addEventListener('change', (e) => {
        gameState.isHardMode = e.target.checked;
        quoteDisplayElement.classList.toggle('blurred', gameState.isHardMode);
    });
    ghostModeToggle.addEventListener('change', (e) => {
        gameState.isGhostEnabled = e.target.checked;
    });
    paceSelect.addEventListener('change', (e) => {
        gameState.pace = e.target.value;
        paceWpmInput.hidden = gameState.pace !== 'target';
    });
    paceWpmInput.addEventListener('change', (e) => {
        const wpm = Math.round(Number(e.target.value));
        if (Number.isFinite(wpm)) gameState.paceWpm = Math.min(PACE_MAX, Math.max(PACE_MIN, wpm));
        paceWpmInput.value = gameState.paceWpm;
    });
    stopOnErrorToggle.addEventListener('change', (e) => {
        gameState.isStopOnError = e.target.checked;
    });
    // Category options on the main screen save and reset at once.
    const optionToggles = [
        [punctuationToggle, 'hasPunctuation'],
        [numbersToggle, 'hasNumbers'],
        [autoIndentToggle, 'isAutoIndent'],
    ];
    for (const [toggle, flag] of optionToggles) {
        toggle.addEventListener('change', (e) => {
            gameState[flag] = e.target.checked;
            saveSettings();
            resetGame();
            // WebKit focuses the checkbox after its change event, which would
            // leave typing going to the checkbox.
            requestAnimationFrame(() => typingInputElement.focus());
        });
    }
    codeLanguageSelect.addEventListener('change', (e) => {
        gameState.codeLanguage = e.target.value;
        saveSettings();
        resetGame();
    });

    shareBtn.addEventListener('click', shareResult);
    playAgainBtn.addEventListener('click', resetGame);
    practiceBtn.addEventListener('click', () => {
        gameState.category = 'weak';
        categorySelect.value = 'weak';
        saveSettings();
        resetGame();
    });

    challengeBtn.addEventListener('click', copyChallengeLink);

    document.addEventListener('keydown', handleKeydown);
    // A link opened in a tab that already has the page only changes the
    // hash. clearChallengeHash uses replaceState, which does not fire this.
    window.addEventListener('hashchange', loadChallengeFromHash);
    // The on-screen keyboard opening or closing resizes the visual viewport.
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            if (document.activeElement === typingInputElement) keepCurrentInView();
        });
    }

    resetGame();
    loadChallengeFromHash();
    registerServiceWorker();
}

// --- Offline ---
// sw.js saves the app's files so the page loads offline. Service workers
// only run over HTTPS or on localhost, so file:// and other origins skip it.
function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    // Offline use is optional: if registration fails (blocked by the
    // browser or its settings), the page works the same without it.
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
