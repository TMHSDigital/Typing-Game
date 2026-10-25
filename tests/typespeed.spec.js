// End-to-end tests against the real page. page.evaluate callbacks run in the
// browser, where script.js's top-level consts are in scope.
/* global runtime, gameState, resultModal, typingInputElement, wpmElement, updateMetrics,
   getPassage, settingsKey, COMMON_WORDS, QUOTES, renderNewQuote, parseChallenge,
   decodeChallenge, encodeChallenge, normalizeCustomText, CODE_SNIPPETS, playSound, playVoice,
   getAudioContext, audio, SOUND_PACKS, SOUND_PACK_NAMES, timerElement, tick, quoteDisplayElement, bests, bestStrokes,
   currentBest, validBests, currentStreak, runHistory, firstPassageHash, textHash, validDaily, cardPalette, VERSION,
   weakestKeys, keyStats, endGame */

const { test, expect } = require('@playwright/test');
const { default: AxeBuilder } = require('@axe-core/playwright');
const fs = require('node:fs');

const input = (page) => page.locator('#typing-input');
const currentQuote = (page) => page.evaluate(() => runtime.quoteText);

function collectErrors(page) {
    const errors = [];
    page.on('console', (message) => {
        // Playwright logs this itself when the config blocks service workers.
        if (message.text() === 'Service Worker registration blocked by Playwright') return;
        if (message.type() === 'error' || message.type() === 'warning') {
            errors.push(message.text());
        }
    });
    page.on('pageerror', (error) => errors.push(error.message));
    return errors;
}

test.describe('loading', () => {
    test('loads without console output and focuses the input', async ({ page }) => {
        const errors = collectErrors(page);
        await page.goto('/');

        await expect(page).toHaveTitle('TypeSpeed: typing test and trainer with code snippets');
        await expect(input(page)).toBeFocused();
        await expect(page.locator('#timer')).toHaveText('60');
        await expect(page.locator('#quick-duration .pill.active')).toHaveText('60s');
        await expect(page.locator('#quick-word-count')).toBeHidden();

        const quote = await currentQuote(page);
        expect(quote.length).toBeGreaterThan(0);
        await expect(input(page)).toHaveAttribute('maxlength', String(quote.length));
        await expect(page.locator('#quote-display span')).toHaveCount(quote.length);
        expect(errors).toEqual([]);
    });

    test('makes no requests to other origins and uses the bundled fonts', async ({ page }) => {
        const external = [];
        page.on('request', (request) => {
            if (!request.url().startsWith('http://127.0.0.1:8765/')) external.push(request.url());
        });
        const errors = collectErrors(page);
        await page.goto('/');
        await page.evaluate(() => document.fonts.ready);

        const loaded = await page.evaluate(() =>
            [...document.fonts]
                .filter((face) => face.status === 'loaded')
                .map((face) => face.family.replace(/"/g, ''))
                .sort()
        );
        expect(loaded).toEqual(['JetBrains Mono', 'Space Grotesk']);
        expect(external.filter((url) => !url.startsWith('data:'))).toEqual([]);
        expect(errors).toEqual([]);
    });

    test('the stats line sits above the passage, sharing its left edge', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        const stats = await page.locator('#stats-bar').boundingBox();
        const passage = await page.locator('#quote-display').boundingBox();
        expect(passage.y).toBeLessThan(450);
        expect(stats.y + stats.height).toBeLessThanOrEqual(passage.y);
        expect(Math.abs(stats.x - passage.x)).toBeLessThan(1);
        // Units sit on the same line as their numbers.
        const timer = await page.locator('#timer').boundingBox();
        const unit = await page.locator('.stat-timer .unit').boundingBox();
        expect(Math.abs(unit.y - timer.y)).toBeLessThan(4);
        await expect(page.locator('#reset-button .key-hint')).toHaveText('Tab');
    });

    test('says there is no account and data stays in this browser', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('footer')).toContainText(
            'No account. Your results are stored only in this browser.'
        );
        await expect(page.locator('footer a').first()).toHaveAttribute(
            'href',
            'https://github.com/TMHSDigital/Typing-Game#privacy'
        );
        await page.locator('#stats-btn').click();
        await expect(page.locator('#stats-modal .stats-note')).toHaveText(
            'Stored in this browser only. Export to keep a copy or move to another device.'
        );
    });

    test('ignores corrupt localStorage instead of crashing', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('typingGameSettings', '{not json');
            localStorage.setItem('typingGameHistory', '"nope"');
            localStorage.setItem('typingGameBests', '[1, 2]');
        });
        const errors = collectErrors(page);
        await page.goto('/');

        await expect(page.locator('#quote-display span').first()).toBeAttached();
        expect(await page.evaluate(() => gameState.mode)).toBe('time');
        await expect(page.locator('#high-score')).toHaveText('0');
        // The warnings about unreadable values are expected; nothing else is.
        expect(errors.filter((e) => !e.includes('Ignoring unreadable'))).toEqual([]);
    });

    test('scrolls on a short viewport instead of clipping', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 500 });
        await page.goto('/');

        const layout = await page.evaluate(() => ({
            overflowY: getComputedStyle(document.body).overflowY,
            taller: document.documentElement.scrollHeight > window.innerHeight,
        }));
        expect(layout.overflowY).toBe('auto');
        expect(layout.taller).toBe(true);

        await page.evaluate(() => window.scrollTo(0, 10000));
        expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    });
});

test.describe('time mode', () => {
    test('loads the next quote on completion and ends when the clock runs out', async ({
        page,
    }) => {
        await page.clock.install();
        await page.goto('/');
        const quote = await currentQuote(page);

        await input(page).pressSequentially(quote);

        const after = await page.evaluate(() => ({
            started: runtime.isStarted,
            quoteBase: runtime.quoteBase,
            quote: runtime.quoteText,
            resultShown: resultModal.classList.contains('show'),
            inputValue: typingInputElement.value,
        }));
        expect(after.started).toBe(true);
        expect(after.quoteBase).toBe(quote.length);
        expect(after.quote).not.toBe(quote);
        expect(after.resultShown).toBe(false);
        expect(after.inputValue).toBe('');

        await page.clock.runFor(61_000);

        await expect(page.locator('#result-modal')).toHaveClass(/show/);
        await expect(page.locator('#timer')).toHaveText('0');
        await expect(page.locator('#play-again-btn')).toBeFocused();
        await expect(input(page)).toBeDisabled();
    });

    test('WPM uses real elapsed time and correct characters only', async ({ page }) => {
        await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
        await page.goto('/');
        await page.clock.pauseAt(new Date('2026-01-01T00:00:10Z'));
        const quote = await currentQuote(page);

        await input(page).pressSequentially(quote.slice(0, 20));
        // Under one second of elapsed time the display stays at 0.
        await expect(page.locator('#wpm')).toHaveText('0');

        await page.clock.runFor(30_000);

        const metrics = await page.evaluate(() => ({
            wpm: Number(wpmElement.textContent),
            correct: runtime.correctChars,
            elapsed: performance.now() - runtime.startTime,
        }));
        expect(metrics.correct).toBe(20);
        expect(metrics.elapsed).toBe(30_000);
        expect(metrics.wpm).toBe(Math.round(20 / 5 / (30_000 / 60_000)));
    });

    test('a system clock change during a run does not move the timer or WPM', async ({ page }) => {
        await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
        await page.goto('/');
        await page.clock.pauseAt(new Date('2026-01-01T00:00:10Z'));
        const quote = await currentQuote(page);
        await input(page).pressSequentially(quote.slice(0, 20));
        await page.clock.runFor(30_000);
        const before = await page.evaluate(() => [
            wpmElement.textContent,
            timerElement.textContent,
        ]);
        expect(before[1]).toBe('30');

        // The clock jumps an hour ahead, as after an NTP sync or sleep.
        await page.clock.setSystemTime(new Date('2026-01-01T01:00:40Z'));
        await page.evaluate(() => tick());
        expect(
            await page.evaluate(() => [
                wpmElement.textContent,
                timerElement.textContent,
                runtime.isStarted,
            ])
        ).toEqual([...before, true]);
    });
});

test.describe('rendering', () => {
    test('a keystroke restyles only the characters around the caret', async ({ page }) => {
        const text = 'alpha beta gamma delta '.repeat(80).trim();
        await page.addInitScript((value) => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({ category: 'custom', customText: value })
            );
        }, text);
        await page.goto('/');
        await input(page).pressSequentially('alpha bet');
        await page.evaluate(() => {
            window.restyled = new Set();
            new MutationObserver((records) =>
                records.forEach((record) => window.restyled.add(record.target))
            ).observe(quoteDisplayElement, {
                attributes: true,
                attributeFilter: ['class'],
                subtree: true,
            });
        });
        await input(page).press('x');
        await input(page).press('Backspace');
        // The character typed, the one after it, and back again.
        expect(await page.evaluate(() => window.restyled.size)).toBe(2);
        await expect(page.locator('#quote-display span').nth(9)).toHaveClass('current');
        await expect(page.locator('#quote-display span').nth(8)).toHaveClass('correct');
    });

    test('a word longer than a phone line still breaks mid-word', async ({ page }) => {
        const long = 'supercalifragilisticexpialidocious-and-more';
        await page.setViewportSize({ width: 390, height: 800 });
        await page.addInitScript((value) => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({ category: 'custom', customText: value })
            );
        }, `the ${long} end`);
        await page.goto('/');
        const rows = await page.evaluate((index) => {
            const top = (n) =>
                quoteDisplayElement.querySelectorAll('span')[n].getBoundingClientRect().top;
            return { start: top(4), last: top(index), end: top(index + 2) };
        }, 3 + long.length);
        // The word wraps across lines like plain text, and "end" follows it on
        // its last line instead of being pushed below a full-width block.
        expect(rows.last).toBeGreaterThan(rows.start);
        expect(Math.abs(rows.end - rows.last)).toBeLessThan(2);
    });

    test('groups the passage by word, with new lines outside the words', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({ category: 'code', codeLanguage: 'python' })
            );
        });
        await page.goto('/');
        const quote = await currentQuote(page);
        const groups = await page.evaluate(() =>
            [...quoteDisplayElement.children]
                .filter((el) => el.id !== 'ghost-cursor')
                .map((el) => (el.className === 'newline' ? '\n' : el.textContent))
        );
        expect(groups.join('')).toBe(quote);
        expect(groups.every((g) => g === '\n' || !g.includes('\n'))).toBe(true);
        expect(groups.every((g) => g === '\n' || !/ \S/.test(g))).toBe(true);
    });
});

test('accuracy counts mistakes even after they are fixed', async ({ page }) => {
    await page.goto('/');
    const quote = await currentQuote(page);
    const wrongKey = quote[0] === 'x' ? 'y' : 'x';

    await input(page).press(wrongKey);
    await expect(page.locator('#mistakes')).toHaveText('1');
    await expect(page.locator('#accuracy')).toHaveText('0');
    await expect(page.locator('#quote-display span').first()).toHaveClass('incorrect');

    await input(page).press('Backspace');
    await input(page).pressSequentially(quote.slice(0, 9));

    await expect(page.locator('#mistakes')).toHaveText('1');
    await expect(page.locator('#accuracy')).toHaveText('90');
    await expect(page.locator('#quote-display span').first()).toHaveClass('correct');
    await expect(page.locator('#quote-display span').nth(9)).toHaveClass('current');
});

test.describe('settings dialog', () => {
    test('takes focus on open, traps Tab, ignores typing, closes on Escape', async ({ page }) => {
        await page.goto('/');
        await page.locator('#settings-btn').click();

        const dialog = page.locator('#settings-modal');
        await expect(dialog).toHaveClass(/show/);
        await expect(dialog).toHaveAttribute('role', 'dialog');
        await expect(page.locator('#stop-on-error-toggle')).toBeFocused();

        await page.keyboard.press('Tab');
        await expect(page.locator('#hard-mode-toggle-settings')).toBeFocused();

        await page.keyboard.press('a');
        expect(await page.evaluate(() => [runtime.isStarted, typingInputElement.value])).toEqual([
            false,
            '',
        ]);

        // Shift+Tab from the first control wraps to the last one.
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Shift+Tab');
        await expect(page.locator('#close-settings-btn')).toBeFocused();

        await page.keyboard.press('Escape');
        await expect(dialog).not.toHaveClass(/show/);
        await expect(input(page)).toBeFocused();
    });

    for (const [width, height] of [
        [1440, 900],
        [1280, 720],
    ]) {
        test(`fits without scrolling at ${width}x${height}`, async ({ page }) => {
            await page.setViewportSize({ width, height });
            await page.goto('/');
            await page.locator('#settings-btn').click();
            await expect(page.locator('#close-settings-btn')).toBeInViewport();
            const overflow = await page.evaluate(() => {
                const body = document.querySelector('#settings-modal .settings-body');
                return body.scrollHeight - body.clientHeight;
            });
            expect(overflow).toBeLessThanOrEqual(0);
        });
    }

    test('opening it during a run abandons the run', async ({ page }) => {
        await page.clock.install();
        await page.goto('/');
        const quote = await currentQuote(page);
        await input(page).pressSequentially(quote.slice(0, 5));

        // Focus mode blocks clicks on the header, but the keyboard still reaches it.
        for (let n = 0; n < 12; n++) {
            await page.keyboard.press('Shift+Tab');
            if (await page.evaluate(() => document.activeElement.id === 'settings-btn')) break;
        }
        await expect(page.locator('#settings-btn')).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.locator('#settings-modal')).toHaveClass(/show/);
        await page.clock.runFor(61_000);

        await expect(page.locator('#result-modal')).not.toHaveClass(/show/);
        expect(await page.evaluate(() => runtime.isStarted)).toBe(false);
        await expect(page.locator('#timer')).toHaveText('60');
        await expect(page.locator('#wpm')).toHaveText('0');
        expect(await page.evaluate(() => localStorage.getItem('typingGameHistory'))).toBeNull();
    });

    test('words mode is chosen by keyboard, saved, and ends after the word count', async ({
        page,
    }) => {
        await page.goto('/');
        await page.locator('#quick-mode [data-value="words"]').focus();
        await page.keyboard.press('Enter');

        await expect(page.locator('#quick-mode .pill.active')).toHaveText('Words');
        await expect(page.locator('#quick-word-count .pill.active')).toHaveText('10');
        await expect(page.locator('#timer')).toHaveText('0');

        const saved = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('typingGameSettings'))
        );
        expect(saved.mode).toBe('words');

        const quote = await currentQuote(page);
        expect(quote.split(' ')).toHaveLength(10);

        // A delay keeps the run over one second, so it is recorded.
        await input(page).pressSequentially(quote, { delay: 40 });

        await expect(page.locator('#result-modal')).toHaveClass(/show/);
        await expect(page.locator('#play-again-btn')).toBeFocused();
        await expect(input(page)).toBeDisabled();
        await expect(page.locator('#progress-chart-container')).toBeHidden();

        const history = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('typingGameHistory'))
        );
        expect(history).toHaveLength(1);
        expect(history[0].mode).toBe('words');
        expect(history[0].key).toBe('words:10w:common');

        // The chart appears from the third run, with its scale.
        await page.keyboard.press('Enter');
        await expect(input(page)).toBeFocused();
        await input(page).pressSequentially(await currentQuote(page), { delay: 40 });
        await expect(page.locator('#progress-chart-container')).toBeHidden();
        await page.keyboard.press('Enter');
        await input(page).pressSequentially(await currentQuote(page), { delay: 40 });
        await expect(page.locator('#progress-chart-container')).toBeVisible();
        await expect(page.locator('#progress-chart-title')).toHaveText('WPM, last 3 runs');
        await expect(page.locator('#progress-chart circle')).toHaveCount(3);
        const progress = page.locator('#progress-chart-container');
        await expect(progress.locator('.chart-x-start')).toHaveText('oldest');
        await expect(progress.locator('.chart-x-end')).toHaveText('latest');
        const runs = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('typingGameHistory')).map((run) => run.wpm)
        );
        await expect(progress.locator('.chart-y-max')).toHaveText(String(Math.max(...runs)));

        // Settings survive a reload.
        await page.reload();
        await expect(page.locator('#quick-mode .pill.active')).toHaveText('Words');
    });
});

test.describe('best scores', () => {
    test('are kept per mode, length, and category', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameBests',
                JSON.stringify({
                    'time:60s:common': { wpm: 40, keystrokes: [] },
                    'words:10w:common': { wpm: 70, keystrokes: [] },
                })
            );
        });
        await page.goto('/');
        await expect(page.locator('#high-score')).toHaveText('40');

        await page.locator('#quick-mode [data-value="words"]').click();
        await expect(page.locator('#high-score')).toHaveText('70');

        await page.locator('#category-select').selectOption('code');
        await expect(page.locator('#high-score')).toHaveText('0');
    });

    test('are kept apart for Stop on error and Skip indentation', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({ mode: 'words', isStopOnError: true })
            );
        });
        await page.goto('/');
        await input(page).pressSequentially(await currentQuote(page), { delay: 40 });
        await expect(page.locator('#result-modal')).toHaveClass(/show/);
        const keys = await page.evaluate(() =>
            Object.keys(JSON.parse(localStorage.getItem('typingGameBests')))
        );
        expect(keys).toEqual(['words:10w:common+stop']);

        const codeKeys = await page.evaluate(() => {
            Object.assign(gameState, { category: 'code', codeLanguage: 'go' });
            const withStop = settingsKey();
            gameState.isAutoIndent = false;
            const noIndent = settingsKey();
            gameState.isStopOnError = false;
            return [withStop, noIndent, settingsKey()];
        });
        expect(codeKeys).toEqual([
            'words:10w:code-go+stop',
            'words:10w:code-go+noindent+stop',
            'words:10w:code-go+noindent',
        ]);
    });

    test('runs under one second are shown but not recorded', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('typingGameSettings', JSON.stringify({ mode: 'words' }));
        });
        await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
        await page.goto('/');
        // Freeze time so the whole run takes zero elapsed milliseconds,
        // however slowly the machine types.
        await page.clock.pauseAt(new Date('2026-01-01T00:00:10Z'));

        await input(page).pressSequentially(await currentQuote(page));
        await expect(page.locator('#result-modal')).toHaveClass(/show/);

        const stored = await page.evaluate(() => [
            localStorage.getItem('typingGameHistory'),
            localStorage.getItem('typingGameBests'),
        ]);
        expect(stored).toEqual([null, null]);
        await expect(page.locator('#high-score')).toHaveText('0');
    });
});

test('reduced motion turns off the caret blink', async ({ page }) => {
    await page.goto('/');
    const caret = () =>
        page.evaluate(
            () => getComputedStyle(document.querySelector('.current'), '::before').animationName
        );
    expect(await caret()).toBe('blink');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await caret()).toBe('none');
});

// An animation under the container's backdrop-filter makes the browser
// recompute the blur on every frame while the page is idle.
test('nothing behind the blurred container animates', async ({ page }) => {
    await page.goto('/');
    const glow = await page.evaluate(() => {
        const style = getComputedStyle(document.querySelector('.background-glow'));
        return [style.animationName, style.transitionDuration];
    });
    expect(glow).toEqual(['none', '0s']);
});

test('paste and drop are blocked', async ({ page }) => {
    await page.goto('/');
    const blocked = await page.evaluate(() => {
        const paste = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
        const drop = new Event('drop', { bubbles: true, cancelable: true });
        return [!typingInputElement.dispatchEvent(paste), !typingInputElement.dispatchEvent(drop)];
    });
    expect(blocked).toEqual([true, true]);
});

test('share copies a summary to the clipboard', async ({ page }) => {
    // Firefox and WebKit cannot grant clipboard permissions to tests, so
    // record what the page writes instead of reading the system clipboard.
    await page.addInitScript(() => {
        navigator.clipboard.writeText = async (text) => {
            window.copiedText = text;
        };
    });
    await page.goto('/');
    await page.evaluate(() => {
        gameState.mode = 'words';
    });
    await page.locator('#reset-button').click();
    await input(page).pressSequentially(await currentQuote(page));
    await expect(page.locator('#result-modal')).toHaveClass(/show/);

    await page.locator('#share-btn').click();
    await expect(page.locator('#share-btn')).toHaveText('Copied!');
    const clipboard = await page.evaluate(() => window.copiedText);
    expect(clipboard).toMatch(
        /^\d+ WPM, \d+% accuracy, 10 words Common Words on TypeSpeed https:\/\/tmhsdigital\.github\.io\/Typing-Game\/$/
    );
    await expect(page.locator('#share-btn')).toHaveText('Share result', { timeout: 3000 });
});

test('restarting during a ghost replay cancels the pending moves', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem(
            'typingGameBests',
            JSON.stringify({
                'time:60s:common': {
                    wpm: 40,
                    keystrokes: Array.from({ length: 30 }, (_, i) => ({
                        t: 100 + i * 200,
                        i: i + 1,
                    })),
                },
            })
        );
        localStorage.setItem('typingGameSettings', JSON.stringify({ isGhostEnabled: true }));
    });
    const errors = collectErrors(page);
    await page.goto('/');

    await expect(page.locator('#ghost-badge')).toBeVisible();
    await expect(page.locator('#ghost-cursor')).toHaveCount(1);

    const quote = await currentQuote(page);
    await input(page).press(quote[0]);
    expect(await page.evaluate(() => runtime.ghostTimeouts.length)).toBe(30);
    await expect(page.locator('#ghost-cursor')).toHaveCSS('opacity', '1');

    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => [runtime.isStarted, runtime.ghostTimeouts.length])).toEqual([
        false,
        0,
    ]);

    // Wait past the time the old moves would have fired; the new cursor stays put.
    await page.waitForTimeout(800);
    await expect(page.locator('#ghost-cursor')).toHaveCSS('opacity', '0');
    expect(errors).toEqual([]);
});

test.describe('input', () => {
    test('arrow keys, select-all, and clicks cannot move the caret off the end', async ({
        page,
    }) => {
        await page.goto('/');
        const quote = await currentQuote(page);

        await input(page).pressSequentially(quote.slice(0, 3));
        await input(page).press('ArrowLeft');
        await input(page).press('ArrowLeft');
        await input(page).press('Home');
        await input(page).press(quote[3]);
        await input(page).press('ControlOrMeta+a');
        await input(page).press(quote[4]);
        await input(page).click({ position: { x: 5, y: 5 } });
        await input(page).press(quote[5]);

        const state = await page.evaluate(() => ({
            value: typingInputElement.value,
            mistakes: runtime.mistakes,
            incorrect: document.querySelectorAll('#quote-display .incorrect').length,
        }));
        expect(state).toEqual({ value: quote.slice(0, 6), mistakes: 0, incorrect: 0 });
    });

    test('counts composed text from on-screen keyboards once per character', async ({ page }) => {
        await page.goto('/');
        const quote = await currentQuote(page);
        const word = quote.slice(0, 5);

        // Android keyboards resend the whole word being composed on every key.
        await page.evaluate((text) => {
            for (let n = 1; n <= text.length; n++) {
                typingInputElement.value = text.slice(0, n);
                typingInputElement.dispatchEvent(
                    new InputEvent('input', {
                        inputType: 'insertCompositionText',
                        data: text.slice(0, n),
                    })
                );
            }
        }, word);
        expect(await page.evaluate(() => [runtime.keystrokes, runtime.mistakes])).toEqual([5, 0]);

        // Autocorrect replaces text with inputType insertReplacementText and no data.
        const wrong = quote[5] === 'x' ? 'y' : 'x';
        await page.evaluate(
            ([before, after]) => {
                typingInputElement.value = before;
                typingInputElement.dispatchEvent(
                    new InputEvent('input', { inputType: 'insertText', data: before.slice(-1) })
                );
                typingInputElement.value = after;
                typingInputElement.dispatchEvent(
                    new InputEvent('input', { inputType: 'insertReplacementText', data: null })
                );
            },
            [word + wrong, quote.slice(0, 6)]
        );
        expect(await page.evaluate(() => [runtime.keystrokes, runtime.mistakes])).toEqual([7, 1]);
    });

    test('time mode ignores characters typed after the clock reaches zero', async ({ page }) => {
        await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
        await page.goto('/');
        // Paused, so the 250 ms interval only fires when the test says so.
        await page.clock.pauseAt(new Date('2026-01-01T00:00:10Z'));
        const quote = await currentQuote(page);
        await input(page).pressSequentially(quote.slice(0, 5));
        await page.clock.runFor(59_900);

        // Move past the deadline without letting the 250 ms interval fire.
        await page.evaluate(() => clearInterval(runtime.interval));
        await page.clock.runFor(300);
        await input(page).press(quote[5]);

        expect(await page.evaluate(() => [runtime.correctChars, runtime.isStarted])).toEqual([
            5,
            false,
        ]);
        await expect(page.locator('#result-modal')).toHaveClass(/show/);
        expect(await page.evaluate(() => runtime.endTime - runtime.startTime)).toBe(60_000);
    });

    test('accuracy is below 100 whenever there is a mistake', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            runtime.keystrokes = 250;
            runtime.mistakes = 1;
        });
        await page.evaluate(() => updateMetrics());
        await expect(page.locator('#accuracy')).toHaveText('99');
    });
});

test('ghost cursor lines up with its character while focus mode scales the text', async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
        localStorage.setItem(
            'typingGameBests',
            JSON.stringify({
                'time:60s:common': { wpm: 40, keystrokes: [{ t: 0, i: 30 }] },
            })
        );
        localStorage.setItem('typingGameSettings', JSON.stringify({ isGhostEnabled: true }));
    });
    await page.goto('/');
    const quote = await currentQuote(page);
    await input(page).press(quote[0]);
    await expect(page.locator('#ghost-cursor')).toHaveCSS('opacity', '1');

    const offset = await page.evaluate(() => {
        const span = document.querySelectorAll('#quote-display span')[30];
        const cursor = document.getElementById('ghost-cursor');
        return Math.abs(cursor.getBoundingClientRect().left - span.getBoundingClientRect().left);
    });
    expect(offset).toBeLessThan(1);
});

test.describe('ghost cursor on a different passage in Time mode', () => {
    const withGhost = (keystrokes) => {
        localStorage.setItem(
            'typingGameBests',
            JSON.stringify({ 'time:60s:common': { wpm: 40, keystrokes, seed: 11 } })
        );
        localStorage.setItem('typingGameSettings', JSON.stringify({ isGhostEnabled: true }));
    };
    const cursorState = (page) =>
        page.evaluate(() => {
            const cursor = document.getElementById('ghost-cursor');
            const spans = document.querySelectorAll('#quote-display span');
            const last = spans[spans.length - 1];
            return {
                opacity: getComputedStyle(cursor).opacity,
                ahead: cursor.classList.contains('ahead'),
                behind: cursor.classList.contains('behind'),
                left: new DOMMatrix(cursor.style.transform).m41,
                start: spans[0].offsetLeft + spans[0].offsetParent.offsetLeft,
                end: last.offsetLeft + last.offsetParent.offsetLeft + last.offsetWidth,
            };
        });

    test('waits at the end of the passage with an arrow when the ghost is ahead', async ({
        page,
    }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.clock.install();
        await page.addInitScript(withGhost, [{ t: 500, i: 1000 }]);
        await page.goto('/');
        await input(page).press((await currentQuote(page))[0]);
        await page.clock.runFor(600);
        const state = await cursorState(page);
        expect(state).toMatchObject({ opacity: '1', ahead: true, behind: false });
        expect(state.left).toBe(state.end);
    });

    test('waits at the start of the next passage when the ghost is behind', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.clock.install();
        await page.addInitScript(withGhost, [
            { t: 0, i: 3 },
            { t: 50000, i: 4 },
        ]);
        await page.goto('/');
        await input(page).pressSequentially(await currentQuote(page));
        expect(await page.evaluate(() => runtime.quoteBase)).toBeGreaterThan(0);
        const state = await cursorState(page);
        expect(state).toMatchObject({ opacity: '1', ahead: false, behind: true });
        expect(state.left).toBe(state.start);
    });
});

test.describe('accessibility', () => {
    const contrastViolations = async (page) => {
        const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
        return results.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')));
    };

    test('text meets WCAG AA contrast on the main screen and in the dialogs', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');
        expect(await contrastViolations(page)).toEqual([]);

        await page.locator('#settings-btn').click();
        expect(await contrastViolations(page)).toEqual([]);
        await page.keyboard.press('Escape');

        await page.locator('#category-select').selectOption('custom');
        await page.locator('#edit-custom-btn').click();
        await expect(page.locator('#custom-modal')).toHaveClass(/show/);
        expect(await contrastViolations(page)).toEqual([]);
        await page.keyboard.press('Escape');

        await page.locator('#category-select').selectOption('code');
        expect(await contrastViolations(page)).toEqual([]);
        await page.locator('#category-select').selectOption('common');
        await page.locator('#quick-mode [data-value="words"]').click();

        await input(page).pressSequentially(await currentQuote(page));
        await expect(page.locator('#result-modal')).toHaveClass(/show/);
        expect(await contrastViolations(page)).toEqual([]);

        await page.keyboard.press('Escape');
        await page.locator('#stats-btn').click();
        await expect(page.locator('#stats-modal')).toHaveClass(/show/);
        expect(await contrastViolations(page)).toEqual([]);
    });

    test('screen readers get the passage, pill state, and result values', async ({ page }) => {
        await page.goto('/');
        await expect(input(page)).toHaveAttribute('aria-describedby', 'quote-text');
        await expect(page.locator('#quote-text')).toHaveText(await currentQuote(page));

        // Time mode replaces the passage mid-run; the hidden copy follows.
        await input(page).pressSequentially(await currentQuote(page));
        await expect(page.locator('#quote-text')).toHaveText(await currentQuote(page));
        await page.keyboard.press('Tab');

        await expect(page.locator('#quick-mode [data-value="time"]')).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        await page.locator('#quick-mode [data-value="words"]').click();
        await expect(page.locator('#quick-mode [data-value="time"]')).toHaveAttribute(
            'aria-pressed',
            'false'
        );
        await expect(page.locator('#quick-mode [data-value="words"]')).toHaveAttribute(
            'aria-pressed',
            'true'
        );

        await expect(page.locator('#result-modal')).toHaveAttribute(
            'aria-describedby',
            'result-stats'
        );
    });
});

test.describe('focus hint', () => {
    test('appears when the input loses focus and a letter key brings typing back', async ({
        page,
    }) => {
        await page.goto('/');
        await expect(page.locator('#focus-hint')).toBeHidden();

        await page.locator('header h1').click();
        await expect(page.locator('#focus-hint')).toBeVisible();

        const quote = await currentQuote(page);
        await page.keyboard.press(quote[0]);
        await expect(input(page)).toBeFocused();
        await expect(page.locator('#focus-hint')).toBeHidden();
        await expect(input(page)).toHaveValue(quote[0]);
    });

    test('does not appear behind an open dialog', async ({ page }) => {
        await page.goto('/');
        await page.locator('#settings-btn').click();
        await expect(page.locator('#settings-modal')).toHaveClass(/show/);
        await expect(page.locator('#focus-hint')).toBeHidden();
    });
});

test('hard mode blurs typed characters and leaves the rest readable', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('typingGameSettings', JSON.stringify({ isHardMode: true }));
    });
    await page.goto('/');
    const quote = await currentQuote(page);
    await input(page).pressSequentially(quote.slice(0, 3));

    const spans = page.locator('#quote-display span');
    await expect(spans.nth(0)).toHaveCSS('filter', 'blur(4px)');
    await expect(spans.nth(2)).toHaveCSS('filter', 'blur(4px)');
    await expect(spans.nth(3)).toHaveCSS('filter', 'none');
    await expect(spans.nth(10)).toHaveCSS('filter', 'none');
});

test.describe('sound', () => {
    // Counts AudioContexts and tones without making noise.
    const stubAudio = () => {
        window.audioCalls = { contexts: 0, tones: 0, stopped: 0, rampTargets: [] };
        const calls = window.audioCalls;
        const param = () => ({
            setValueAtTime(value) {
                calls.rampTargets.push(value);
            },
            linearRampToValueAtTime(value) {
                calls.rampTargets.push(value);
            },
            exponentialRampToValueAtTime(value) {
                calls.rampTargets.push(value);
            },
        });
        // Oscillators never end on their own here, so the voice cap is what
        // limits how many stay alive.
        class FakeAudioContext {
            constructor() {
                calls.contexts++;
                this.state = 'running';
                this.currentTime = 0;
                this.destination = {};
                this.sampleRate = 44100;
            }
            createOscillator() {
                calls.tones++;
                return {
                    frequency: param(),
                    connect() {},
                    disconnect() {},
                    start() {},
                    stop() {
                        calls.stopped++;
                    },
                };
            }
            createGain() {
                return { gain: param(), connect() {}, disconnect() {} };
            }
            createBufferSource() {
                calls.tones++;
                calls.noise = (calls.noise || 0) + 1;
                return {
                    connect() {},
                    disconnect() {},
                    start() {},
                    stop() {
                        calls.stopped++;
                    },
                };
            }
            createBiquadFilter() {
                return { frequency: param(), connect() {}, disconnect() {} };
            }
            createBuffer(channels, length) {
                const data = new Float32Array(length);
                return { getChannelData: () => data };
            }
            resume() {
                return Promise.resolve();
            }
        }
        window.AudioContext = FakeAudioContext;
        window.webkitAudioContext = FakeAudioContext;
    };

    test('creates the audio context on the first keystroke, not at load', async ({ page }) => {
        await page.addInitScript(stubAudio);
        await page.goto('/');
        const counts = () =>
            page.evaluate(() => ({
                contexts: window.audioCalls.contexts,
                tones: window.audioCalls.tones,
            }));
        expect(await counts()).toEqual({ contexts: 0, tones: 0 });

        await input(page).press((await currentQuote(page))[0]);
        expect(await counts()).toEqual({ contexts: 1, tones: 1 });
        await input(page).press((await currentQuote(page))[1]);
        expect(await counts()).toEqual({ contexts: 1, tones: 2 });
    });

    test('plays nothing when turned off', async ({ page }) => {
        await page.addInitScript(stubAudio);
        await page.addInitScript(() => {
            localStorage.setItem('typingGameSettings', JSON.stringify({ isSoundEnabled: false }));
        });
        await page.goto('/');
        await input(page).pressSequentially((await currentQuote(page)).slice(0, 5));
        expect(
            await page.evaluate(() => [window.audioCalls.contexts, window.audioCalls.tones])
        ).toEqual([0, 0]);
    });

    test('caps live voices at 16 and stops the oldest', async ({ page }) => {
        await page.addInitScript(stubAudio);
        await page.goto('/');
        const result = await page.evaluate(() => {
            for (let n = 0; n < 100; n++) playSound('click');
            return { live: audio.voices.length, stopped: window.audioCalls.stopped };
        });
        expect(result.live).toBe(16);
        // Each voice calls stop() once when scheduled; 84 more were stopped early.
        expect(result.stopped).toBe(100 + 84);
    });

    test('recipes compile to positive frequencies, durations, and ramp targets', async ({
        page,
    }) => {
        await page.addInitScript(stubAudio);
        await page.goto('/');
        const result = await page.evaluate(() => {
            const packs = Object.values(SOUND_PACKS);
            const complete = packs.every((pack) => pack.click && pack.error && pack.success);
            const steps = packs
                .flatMap((pack) => Object.values(pack))
                .flatMap((recipe) => recipe.steps || [recipe]);
            const valid = complete && steps.every((step) => step.freq > 0 && step.duration > 0);
            // A recipe sliding to 0 Hz at volume 0 must not throw or ramp to 0.
            getAudioContext();
            window.audioCalls.rampTargets = [];
            playVoice(audio.context, { freq: 440, toFreq: 0, volume: 0, duration: 0.1 }, 0);
            return { valid, targets: window.audioCalls.rampTargets };
        });
        expect(result.valid).toBe(true);
        expect(result.targets.length).toBeGreaterThan(0);
        for (const value of result.targets) expect(value).toBeGreaterThan(0);
    });

    test('the sound set is saved, used after a reload, and previewed with sound off', async ({
        page,
    }) => {
        await page.addInitScript(stubAudio);
        await page.goto('/');
        expect(await page.evaluate(() => SOUND_PACK_NAMES)).toEqual(
            await page.evaluate(() => Object.keys(SOUND_PACKS))
        );
        await page.locator('#settings-btn').click();
        await page.locator('#sound-pack-select').selectOption('mechanical');
        await page.locator('label', { hasText: 'Sound effects' }).click();
        await page.locator('#sound-preview-btn').click();
        // Three clicks, an error, and the success sound, all of two parts or more.
        expect(await page.evaluate(() => window.audioCalls.noise)).toBe(3 + 1 + 3);
        await page.locator('#close-settings-btn').click();

        await page.reload();
        await expect(page.locator('#sound-pack-select')).toHaveValue('mechanical');
        await page.evaluate(() => {
            gameState.isSoundEnabled = true;
        });
        await input(page).press((await currentQuote(page))[0]);
        // The mechanical click: one noise burst and one oscillator.
        expect(
            await page.evaluate(() => [window.audioCalls.noise, window.audioCalls.tones])
        ).toEqual([1, 2]);
    });

    test('an unknown sound set falls back to Tones', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('typingGameSettings', JSON.stringify({ soundPack: 'kazoo' }));
        });
        await page.goto('/');
        expect(await page.evaluate(() => gameState.soundPack)).toBe('tones');
    });

    test('a missing or blocked AudioContext is skipped without errors', async ({ page }) => {
        await page.addInitScript(() => {
            window.AudioContext = function () {
                throw new Error('blocked');
            };
            window.webkitAudioContext = undefined;
        });
        const errors = collectErrors(page);
        await page.goto('/');
        await input(page).pressSequentially((await currentQuote(page)).slice(0, 3));
        expect(await page.evaluate(() => [audio.failed, runtime.typedChars])).toEqual([true, 3]);
        expect(errors).toEqual([]);
    });
});

test('feature toggles are saved and applied after a reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('#settings-btn').click();
    await page.locator('label', { hasText: 'Sound effects' }).click();
    await page.locator('label', { hasText: 'Hard mode' }).click();
    await page.locator('label', { hasText: 'Ghost mode' }).click();
    await page.locator('#close-settings-btn').click();

    await page.reload();
    await expect(page.locator('#sound-toggle-settings')).not.toBeChecked();
    await expect(page.locator('#hard-mode-toggle-settings')).toBeChecked();
    await expect(page.locator('#ghost-mode-toggle')).toBeChecked();
    await expect(page.locator('#quote-display')).toHaveClass(/blurred/);
    await expect(page.locator('#ghost-badge')).toBeVisible();
});

test('share opens the system share sheet on touch devices', async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, isMobile: false });
    const page = await context.newPage();
    await page.addInitScript(() => {
        // Report a touch screen and record what would be shared.
        const coarse = window.matchMedia('(pointer: coarse)');
        window.matchMedia = (query) =>
            query === '(pointer: coarse)' ? { ...coarse, matches: true } : coarse;
        navigator.share = async (data) => {
            window.sharedData = data;
        };
    });
    await page.goto('/');
    await page.evaluate(() => {
        gameState.mode = 'words';
    });
    await page.locator('#reset-button').click();
    await input(page).pressSequentially(await currentQuote(page));
    await page.locator('#share-btn').click();

    const shared = await page.evaluate(() => window.sharedData);
    expect(shared.url).toBe('https://tmhsdigital.github.io/Typing-Game/');
    expect(shared.text).toMatch(/^\d+ WPM, \d+% accuracy, 10 words Common Words on TypeSpeed$/);
    await context.close();
});

test.describe('text', () => {
    test('defaults to common words with no word twice in a row', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#category-select')).toHaveValue('common');
        const words = (await currentQuote(page)).split(' ');
        expect(words).toHaveLength(25);
        const known = await page.evaluate(() => COMMON_WORDS);
        for (const word of words) expect(known).toContain(word);
        for (let i = 1; i < words.length; i++) expect(words[i]).not.toBe(words[i - 1]);
    });

    test('ten 50-word runs share no five-word sequence', async ({ page }) => {
        await page.goto('/');
        const texts = await page.evaluate(() => {
            gameState.mode = 'words';
            gameState.wordCount = 50;
            return Array.from({ length: 10 }, () => getPassage().text);
        });
        const seen = new Set();
        for (const text of texts) {
            const words = text.split(' ');
            expect(words).toHaveLength(50);
            for (let i = 0; i + 5 <= words.length; i++) {
                const gram = words.slice(i, i + 5).join(' ');
                expect(seen.has(gram)).toBe(false);
                seen.add(gram);
            }
        }
    });

    test('punctuation and numbers change the text and get their own best scores', async ({
        page,
    }) => {
        await page.goto('/');
        const result = await page.evaluate(() => {
            gameState.mode = 'words';
            gameState.wordCount = 50;
            gameState.hasPunctuation = true;
            gameState.hasNumbers = true;
            const texts = Array.from({ length: 5 }, () => getPassage().text).join(' ');
            return { texts, key: settingsKey() };
        });
        // Each sentence starts with a capital, or with a number in its place.
        for (const sentence of result.texts.split(/[.?] /)) {
            expect(sentence).toMatch(/^[A-Z0-9]/);
        }
        expect(result.texts).toMatch(/[.?]$/);
        expect(result.texts).toMatch(/,/);
        expect(result.texts).toMatch(/\d/);
        expect(result.key).toBe('words:50w:common+punctuation+numbers');

        // The toggles are next to the category select, save at once, and
        // start a new passage.
        await page.evaluate(() => {
            gameState.hasPunctuation = false;
            gameState.hasNumbers = false;
        });
        await page.locator('#punctuation-option').click();
        await expect(page.locator('#punctuation-toggle')).toBeChecked();
        await expect(input(page)).toBeFocused();
        expect(await currentQuote(page)).toMatch(/^[A-Z].*[.?]/);
        expect(
            await page.evaluate(() => JSON.parse(localStorage.getItem('typingGameSettings')))
        ).toMatchObject({ hasPunctuation: true, hasNumbers: false });
    });

    test('category options are shown only for the category they apply to', async ({ page }) => {
        await page.goto('/');
        const visible = async () => {
            const ids = [
                '#punctuation-option',
                '#numbers-option',
                '#code-language-select',
                '#auto-indent-option',
                '#edit-custom-btn',
            ];
            const shown = [];
            for (const id of ids) if (await page.locator(id).isVisible()) shown.push(id);
            return shown;
        };
        expect(await visible()).toEqual(['#punctuation-option', '#numbers-option']);
        await page.locator('#category-select').selectOption('code');
        expect(await visible()).toEqual(['#code-language-select', '#auto-indent-option']);
        await page.locator('#category-select').selectOption('custom');
        expect(await visible()).toEqual(['#edit-custom-btn']);
        for (const category of ['weak', 'general', 'technology']) {
            await page.locator('#category-select').selectOption(category);
            expect(await visible()).toEqual([]);
        }
    });

    test('weak keys ignore the hidden punctuation and numbers options', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({
                    mode: 'words',
                    wordCount: 50,
                    category: 'weak',
                    hasPunctuation: true,
                    hasNumbers: true,
                })
            );
        });
        await page.goto('/');
        const texts = await page.evaluate(() =>
            Array.from({ length: 5 }, () => getPassage().text).join(' ')
        );
        expect(texts).toMatch(/^[a-z' ]+$/);
    });

    test('every code language has at least 25 snippets', async ({ page }) => {
        await page.goto('/');
        const counts = await page.evaluate(() =>
            Object.values(CODE_SNIPPETS).map((list) => list.length)
        );
        expect(counts).toHaveLength(6);
        for (const count of counts) expect(count).toBeGreaterThanOrEqual(25);
    });

    test('every quote category has at least 50 passages', async ({ page }) => {
        await page.goto('/');
        const counts = await page.evaluate(() =>
            Object.fromEntries(Object.entries(QUOTES).map(([key, list]) => [key, list.length]))
        );
        expect(counts.general).toBeGreaterThanOrEqual(50);
        expect(counts.technology).toBeGreaterThanOrEqual(50);
    });

    test('the result dialog shows where the passage is from', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('typingGameSettings', JSON.stringify({ category: 'general' }));
        });
        await page.clock.install();
        await page.goto('/');
        // Pick the last quote, or the one before it if the last was just
        // shown. Both have a source.
        const source = await page.evaluate(() => {
            const values = [0.9999, 0.97];
            runtime.random = () => values.shift() ?? 0.5;
            renderNewQuote();
            return runtime.quoteSource;
        });
        expect(source).not.toBe('');

        await input(page).press((await currentQuote(page))[0]);
        await page.clock.runFor(61_000);
        await expect(page.locator('#modal-source')).toHaveText(source);
    });

    test('the result dialog hides the source line for common words', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            gameState.mode = 'words';
        });
        await page.locator('#reset-button').click();
        await input(page).pressSequentially(await currentQuote(page));
        await expect(page.locator('#result-modal')).toHaveClass(/show/);
        await expect(page.locator('#modal-source')).toBeHidden();
    });
});

test.describe('practice options', () => {
    test('stop on error counts the mistake and keeps the caret in place', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('typingGameSettings', JSON.stringify({ isStopOnError: true }));
        });
        await page.goto('/');
        await expect(page.locator('#stop-on-error-toggle')).toBeChecked();
        const quote = await currentQuote(page);
        const wrongKey = quote[2] === 'x' ? 'y' : 'x';

        await input(page).pressSequentially(quote.slice(0, 2));
        await input(page).press(wrongKey);
        await expect(input(page)).toHaveValue(quote.slice(0, 2));
        await expect(page.locator('#mistakes')).toHaveText('1');
        await expect(page.locator('#quote-display span').nth(2)).toHaveClass('current');

        await input(page).press(quote[2]);
        await expect(input(page)).toHaveValue(quote.slice(0, 3));
        await expect(page.locator('#quote-display .incorrect')).toHaveCount(0);
    });

    test('warns while Caps Lock is on', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#caps-warning')).toBeHidden();

        const press = (capsLock) =>
            page.evaluate((caps) => {
                typingInputElement.dispatchEvent(
                    new KeyboardEvent('keydown', { key: 'A', modifierCapsLock: caps })
                );
            }, capsLock);
        await press(true);
        await expect(page.locator('#caps-warning')).toBeVisible();
        await press(false);
        await expect(page.locator('#caps-warning')).toBeHidden();
    });
});

test('mode and length can be changed from the main screen', async ({ page }) => {
    await page.goto('/');
    await page.locator('#quick-mode [data-value="words"]').click();
    await expect(page.locator('#quick-word-count')).toBeVisible();
    await expect(page.locator('#quick-duration')).toBeHidden();
    await page.locator('#quick-word-count [data-value="25"]').click();

    expect((await currentQuote(page)).split(' ')).toHaveLength(25);
    await expect(input(page)).toBeFocused();
    await expect(page.locator('#quick-word-count [data-value="25"]')).toHaveAttribute(
        'aria-pressed',
        'true'
    );
    expect(
        await page.evaluate(() => JSON.parse(localStorage.getItem('typingGameSettings')))
    ).toMatchObject({ mode: 'words', wordCount: 25 });

    // Keyboard works too.
    await page.locator('#quick-mode [data-value="time"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#timer')).toHaveText('60');
});

test('the result dialog shows raw WPM, characters, time, the run chart, and a new best', async ({
    page,
}) => {
    await page.addInitScript(() => {
        localStorage.setItem('typingGameSettings', JSON.stringify({ mode: 'words' }));
        localStorage.setItem(
            'typingGameBests',
            JSON.stringify({ 'words:10w:common': { wpm: 1, keystrokes: [] } })
        );
    });
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.goto('/');
    await page.clock.pauseAt(new Date('2026-01-01T00:00:10Z'));
    const quote = await currentQuote(page);
    const wrongKey = quote[1] === 'x' ? 'y' : 'x';

    // One wrong character left in place, the rest typed over 30 seconds.
    await input(page).press(quote[0]);
    await input(page).press(wrongKey);
    await page.clock.runFor(10_000);
    await input(page).pressSequentially(quote.slice(2, 20));
    await page.clock.runFor(20_000);
    await input(page).pressSequentially(quote.slice(20));
    await expect(page.locator('#result-modal')).toHaveClass(/show/);

    const n = quote.length;
    await expect(page.locator('#modal-time')).toHaveText('30.0s');
    await expect(page.locator('#modal-chars')).toHaveText(`${n - 1} / 1`);
    await expect(page.locator('#modal-raw')).toHaveText(String(Math.round(n / 5 / 0.5)));
    await expect(page.locator('#modal-wpm')).toHaveText(String(Math.round((n - 1) / 5 / 0.5)));
    await expect(page.locator('#modal-best')).toHaveText(
        'New best for these settings. Previous best: 1 WPM.'
    );
    await expect(page.locator('#result-title')).toHaveText('10 words · Common Words');
    await expect(page.locator('#run-chart-container')).toBeVisible();
    const runChart = page.locator('#run-chart-container');
    await expect(runChart.locator('.chart-x-start')).toHaveText('1s');
    await expect(runChart.locator('.chart-x-end')).toHaveText('30s');
    await expect(runChart.locator('.chart-y-max')).toHaveText(/^\d+$/);
    // Play again is the only primary button.
    await expect(page.locator('#result-modal .action-btn.primary')).toHaveCount(1);
    await expect(page.locator('#play-again-btn')).toBeFocused();
    const segments = await page
        .locator('#run-chart polyline')
        .evaluate((line) => line.getAttribute('points').split(' ').length);
    expect(segments).toBe(30);
});

test('the result dialog names the standing best when a run does not beat it', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('typingGameSettings', JSON.stringify({ mode: 'words' }));
        localStorage.setItem(
            'typingGameBests',
            JSON.stringify({ 'words:10w:common': { wpm: 999, keystrokes: [] } })
        );
    });
    await page.goto('/');
    await input(page).pressSequentially(await currentQuote(page), { delay: 40 });
    await expect(page.locator('#modal-best')).toHaveText('Best for these settings: 999 WPM.');
    await expect(page.locator('#modal-best')).not.toHaveClass(/new-best/);
});

test('the result dialog is positioned against the viewport, not the page card', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript(() => {
        localStorage.setItem('typingGameSettings', JSON.stringify({ mode: 'words' }));
        localStorage.setItem(
            'typingGameHistory',
            JSON.stringify([50, 40].map((wpm) => ({ wpm, accuracy: 100, key: 'words:10w:common' })))
        );
    });
    await page.goto('/');
    await input(page).pressSequentially(await currentQuote(page), { delay: 40 });
    await expect(page.locator('#result-modal')).toHaveClass(/show/);

    const overlay = await page.locator('#result-modal').boundingBox();
    expect(overlay).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
    const title = await page.locator('#result-title').boundingBox();
    expect(title.y).toBeGreaterThanOrEqual(0);
});

test.describe('weak keys', () => {
    test('weak symbols are practiced on common words', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({ category: 'weak', mode: 'words', wordCount: 50 })
            );
            localStorage.setItem(
                'typingGameKeyStats',
                JSON.stringify({
                    '{': { attempts: 10, misses: 6 },
                    ';': { attempts: 10, misses: 5 },
                    e: { attempts: 40, misses: 4 },
                    ' ': { attempts: 90, misses: 80 },
                    '\n': { attempts: 9, misses: 9 },
                })
            );
        });
        await page.goto('/');
        expect(await page.evaluate(() => runtime.weakKeys)).toEqual(['{', ';', 'e']);
        await expect(page.locator('#practice-note')).toHaveText('Practicing: {, ;, e');
        const quote = await currentQuote(page);
        expect(quote.split(' ')).toHaveLength(50);
        expect(quote).toMatch(/\{[a-z]+\}/);
        expect(quote).toMatch(/[a-z];/);
        // The same seed gives the same passage, so Ghost Mode can replay it.
        const again = await page.evaluate(() => firstPassageHash(runtime.seed, runtime.weakKeys));
        expect(again).toBe(await page.evaluate(() => textHash(runtime.quoteText)));
    });

    test('counts misses per expected key and shows the most missed after a run', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem('typingGameSettings', JSON.stringify({ mode: 'words' }));
        });
        await page.goto('/');
        const quote = await currentQuote(page);
        const wrong = (c) => (c === 'x' ? 'y' : 'x');

        // Miss the first character twice, fixing it each time.
        await input(page).press(wrong(quote[0]));
        await input(page).press('Backspace');
        await input(page).press(wrong(quote[0]));
        await input(page).press('Backspace');
        await input(page).pressSequentially(quote, { delay: 40 });

        const stat = await page.evaluate((key) => runtime.keyStats[key], quote[0]);
        expect(stat.misses).toBe(2);
        expect(stat.attempts).toBeGreaterThanOrEqual(3);
        await expect(page.locator('#modal-keys')).toHaveText(
            new RegExp(`^Most missed keys: ${quote[0]} \\(2 of \\d+\\)$`)
        );

        // The totals are saved and survive a reload.
        await page.reload();
        const saved = await page.evaluate(
            (key) => JSON.parse(localStorage.getItem('typingGameKeyStats'))[key],
            quote[0]
        );
        expect(saved).toEqual(stat);
    });

    test('Practice weak keys starts a run of words containing the weakest keys', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem('typingGameSettings', JSON.stringify({ mode: 'words' }));
            localStorage.setItem(
                'typingGameKeyStats',
                JSON.stringify({
                    k: { attempts: 10, misses: 5 },
                    v: { attempts: 10, misses: 4 },
                    e: { attempts: 100, misses: 1 },
                    q: { attempts: 2, misses: 2 }, // too few attempts; no common word has q
                    ' ': { attempts: 10, misses: 9 }, // space is not practiced
                })
            );
        });
        await page.goto('/');
        await input(page).pressSequentially(await currentQuote(page), { delay: 40 });
        await expect(page.locator('#practice-btn')).toBeVisible();
        await page.locator('#practice-btn').click();

        await expect(page.locator('#category-select')).toHaveValue('weak');
        await expect(page.locator('#practice-note')).toHaveText('Practicing: k, v, e');
        const words = (await currentQuote(page)).split(' ');
        expect(words).toHaveLength(10);
        for (const word of words) expect(word).toMatch(/[kve]/);
        expect(await page.evaluate(() => settingsKey())).toBe('words:10w:weak');
    });

    test("with Ghost Mode on, says the letters are the best run's", async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({ category: 'weak', isGhostEnabled: true })
            );
            localStorage.setItem(
                'typingGameBests',
                JSON.stringify({
                    'time:60s:weak': { wpm: 40, keystrokes: [], seed: 3, weakKeys: ['q', 'z'] },
                })
            );
        });
        await page.goto('/');
        await expect(page.locator('#practice-note')).toHaveText(
            "Practicing your best run's letters: q, z"
        );
    });

    test('hides the practice button until a letter has enough misses', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('typingGameSettings', JSON.stringify({ mode: 'words' }));
        });
        await page.goto('/');
        await input(page).pressSequentially(await currentQuote(page), { delay: 40 });
        await expect(page.locator('#modal-keys')).toHaveText('No missed keys.');
        await expect(page.locator('#practice-btn')).toBeHidden();
    });
});

test.describe('stats dialog', () => {
    // Files are passed as buffers: WebKit on Windows cannot read files that
    // tests pick from a drive other than the system drive.
    const jsonFile = (name, text) => ({
        name,
        mimeType: 'application/json',
        buffer: Buffer.from(text),
    });

    const seed = () => {
        localStorage.setItem(
            'typingGameHistory',
            JSON.stringify([
                {
                    wpm: 60,
                    accuracy: 98,
                    date: '2026-01-02T10:00:00Z',
                    mode: 'time',
                    key: 'time:60s:common',
                },
                {
                    wpm: 40,
                    accuracy: 95,
                    date: '2026-01-01T10:00:00Z',
                    mode: 'words',
                    key: 'words:25w:code',
                },
            ])
        );
        localStorage.setItem(
            'typingGameBests',
            JSON.stringify({
                'time:60s:common': {
                    wpm: 60,
                    keystrokes: [{ t: 100, i: 1 }],
                    seed: 8,
                    textHash: 'k3x9q1',
                },
                'words:25w:code': { wpm: 40, keystrokes: [], textHash: 'NOT A HASH' },
            })
        );
        localStorage.setItem(
            'typingGameKeyStats',
            JSON.stringify({ k: { attempts: 9, misses: 3 } })
        );
    };

    test('opens by keyboard, lists bests and runs, traps Tab, and closes on Escape', async ({
        page,
    }) => {
        await page.addInitScript(seed);
        await page.goto('/');
        await page.locator('#stats-btn').focus();
        await page.keyboard.press('Enter');

        const dialog = page.locator('#stats-modal');
        await expect(dialog).toHaveClass(/show/);
        await expect(page.locator('#close-stats-btn')).toBeFocused();
        await expect(page.locator('#stats-summary')).toHaveText(
            '2 recorded runs. Average of the last 2: 50 WPM.'
        );
        await expect(page.locator('#stats-bests tr')).toHaveCount(2);
        await expect(page.locator('#stats-bests tr').first()).toHaveText(/60s, Common Words\s*60/);
        await expect(page.locator('#stats-runs tr')).toHaveCount(2);
        await expect(page.locator('#stats-runs tr').nth(1)).toContainText(
            '25 words, Code Snippets'
        );

        // Done is last, so Tab wraps to the first action, Clear data.
        await page.keyboard.press('Tab');
        await expect(page.locator('#clear-btn')).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(page.locator('#close-stats-btn')).toBeFocused();

        await page.keyboard.press('a');
        expect(await page.evaluate(() => runtime.isStarted)).toBe(false);

        await page.keyboard.press('Escape');
        await expect(dialog).not.toHaveClass(/show/);
        await expect(input(page)).toBeFocused();
    });

    test('export then import restores the data in a fresh browser', async ({ page, browser }) => {
        await page.addInitScript(seed);
        await page.goto('/');
        await page.locator('#stats-btn').click();
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('#export-btn').click(),
        ]);
        expect(download.suggestedFilename()).toBe('typespeed-data.json');
        const saved = test.info().outputPath('typespeed-data.json');
        await download.saveAs(saved);
        const file = jsonFile('typespeed-data.json', fs.readFileSync(saved, 'utf8'));

        const fresh = await browser.newContext();
        const other = await fresh.newPage();
        await other.goto('/');
        await expect(other.locator('#high-score')).toHaveText('0');
        await other.locator('#stats-btn').click();
        await other.locator('#import-input').setInputFiles(file);
        await expect(other.locator('#stats-status')).toHaveText(
            'Imported 2 runs and 2 best scores.'
        );
        await expect(other.locator('#stats-bests tr')).toHaveCount(2);

        const stored = await other.evaluate(() => ({
            bests: JSON.parse(localStorage.getItem('typingGameBests')),
            keyStats: JSON.parse(localStorage.getItem('typingGameKeyStats')),
        }));
        expect(stored.bests['time:60s:common']).toMatchObject({
            wpm: 60,
            seed: 8,
            textHash: 'k3x9q1',
        });
        expect(stored.bests['words:25w:code'].textHash).toBeUndefined();
        expect(stored.keyStats).toEqual({ k: { attempts: 9, misses: 3 } });
        await other.keyboard.press('Escape');
        await expect(other.locator('#high-score')).toHaveText('60');
        await fresh.close();
    });

    test('importing a different theme applies it without a reload', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('typingGameSettings', JSON.stringify({ theme: 'dark' }));
        });
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        await page.locator('#stats-btn').click();
        await page
            .locator('#import-input')
            .setInputFiles(
                jsonFile(
                    'theme.json',
                    JSON.stringify({ app: 'TypeSpeed', typingGameSettings: { theme: 'contrast' } })
                )
            );
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast');
    });

    test('import rejects files that are not TypeSpeed exports', async ({ page }) => {
        await page.addInitScript(seed);
        await page.goto('/');
        await page.locator('#stats-btn').click();
        await page.locator('#import-input').setInputFiles(jsonFile('bad.json', '{oops'));
        await expect(page.locator('#stats-status')).toHaveText('That file is not valid JSON.');

        await page
            .locator('#import-input')
            .setInputFiles(jsonFile('other.json', JSON.stringify({ typingGameBests: {} })));
        await expect(page.locator('#stats-status')).toHaveText(
            'That file is not a TypeSpeed export.'
        );
        await expect(page.locator('#stats-bests tr')).toHaveCount(2);
    });

    test('clear data takes two clicks and removes history, bests, and key stats', async ({
        page,
    }) => {
        await page.addInitScript(seed);
        await page.goto('/');
        await page.locator('#stats-btn').click();
        await page.locator('#clear-btn').click();
        await expect(page.locator('#clear-btn')).toHaveText('Click again to clear');
        expect(await page.evaluate(() => localStorage.getItem('typingGameBests'))).not.toBeNull();

        await page.locator('#clear-btn').click();
        await expect(page.locator('#stats-summary')).toHaveText(
            'No runs yet. Finish a run of a second or longer to see it here.'
        );
        await expect(page.locator('#stats-tables')).toBeHidden();
        const stored = await page.evaluate(() =>
            ['typingGameHistory', 'typingGameBests', 'typingGameKeyStats'].map((key) =>
                localStorage.getItem(key)
            )
        );
        expect(stored).toEqual([null, null, null]);
        await expect(page.locator('#high-score')).toHaveText('0');
    });
});

test.describe('ghost on the same passage', () => {
    test('a new best records its seed, and the next ghost run uses the same passage', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({ mode: 'words', isGhostEnabled: true })
            );
        });
        await page.goto('/');
        await expect(page.locator('#ghost-status')).toHaveText(
            'No ghost yet for these settings: finish a run to record one.'
        );
        const first = await currentQuote(page);
        await input(page).pressSequentially(first, { delay: 40 });
        await expect(page.locator('#result-modal')).toHaveClass(/show/);
        const seed = await page.evaluate(() => runtime.seed);
        const stored = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('typingGameBests'))
        );
        expect(stored['words:10w:common'].seed).toBe(seed);

        await page.locator('#play-again-btn').click();
        expect(await currentQuote(page)).toBe(first);
        await expect(page.locator('#ghost-status')).toHaveText(/^Racing your best: \d+ WPM$/);

        // With Ghost Mode off, passages are new again.
        await page.evaluate(() => {
            gameState.isGhostEnabled = false;
        });
        await page.keyboard.press('Tab');
        expect(await currentQuote(page)).not.toBe(first);
        await expect(page.locator('#ghost-status')).toBeHidden();
    });

    test('a best recorded on a different version of the text is not replayed until a new best', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({ mode: 'words', isGhostEnabled: true })
            );
        });
        await page.goto('/');
        const first = await currentQuote(page);
        await input(page).pressSequentially(first, { delay: 40 });
        await expect(page.locator('#result-modal')).toHaveClass(/show/);
        const seed = await page.evaluate(() => runtime.seed);
        const stored = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('typingGameBests'))
        );
        expect(stored['words:10w:common'].textHash).toMatch(/^[0-9a-z]+$/);

        // An edit to texts.js changes a word of the best's passage. The best's
        // WPM is lowered so the next run replaces it.
        await page.evaluate((word) => {
            COMMON_WORDS.forEach((w, n) => {
                if (w === word) COMMON_WORDS[n] = 'zzz';
            });
            bests['words:10w:common'].wpm = 1;
        }, first.split(' ')[0]);
        await page.locator('#play-again-btn').click();
        await expect(page.locator('#ghost-status')).toHaveText(
            'Your best for these settings was recorded on a different version of the text. Set a new best to race a ghost.'
        );
        expect(await page.evaluate(() => runtime.seed)).not.toBe(seed);
        const second = await currentQuote(page);
        await input(page).press(second[0]);
        expect(await page.evaluate(() => runtime.ghostTimeouts.length)).toBe(0);

        await input(page).pressSequentially(second.slice(1), { delay: 40 });
        await expect(page.locator('#result-modal')).toHaveClass(/show/);
        await page.locator('#play-again-btn').click();
        await expect(page.locator('#ghost-status')).toHaveText(/^Racing your best: \d+ WPM$/);
        expect(await currentQuote(page)).toBe(second);
    });

    test('time mode replays the same sequence of passages', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameBests',
                JSON.stringify({ 'time:60s:common': { wpm: 40, keystrokes: [], seed: 12345 } })
            );
            localStorage.setItem('typingGameSettings', JSON.stringify({ isGhostEnabled: true }));
        });
        await page.goto('/');
        const passages = async () => {
            const one = await currentQuote(page);
            await input(page).pressSequentially(one);
            const two = await currentQuote(page);
            await page.keyboard.press('Tab');
            return [one, two];
        };
        const firstRun = await passages();
        expect(firstRun[0]).not.toBe(firstRun[1]);
        expect(await passages()).toEqual(firstRun);
    });

    test('shows how far ahead of or behind the ghost you are', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameBests',
                JSON.stringify({
                    'time:60s:common': { wpm: 40, keystrokes: [{ t: 0, i: 6 }], seed: 7 },
                })
            );
            localStorage.setItem('typingGameSettings', JSON.stringify({ isGhostEnabled: true }));
        });
        await page.goto('/');
        const quote = await currentQuote(page);
        await input(page).press(quote[0]);
        await expect(page.locator('#ghost-status')).toHaveText('-5 chars vs ghost');
        await input(page).pressSequentially(quote.slice(1, 6));
        await expect(page.locator('#ghost-status')).toHaveText('Level with the ghost');
        await input(page).pressSequentially(quote.slice(6, 9));
        await expect(page.locator('#ghost-status')).toHaveText('+3 chars vs ghost');
    });
});

test.describe('pace caret', () => {
    const setPace = async (page, pace, wpm) => {
        await page.locator('#settings-btn').click();
        await page.locator('#pace-select').selectOption(pace);
        if (wpm) await page.locator('#pace-wpm').fill(String(wpm));
        await page.locator('#close-settings-btn').click();
    };

    test('moves at the target speed and reads vs pace', async ({ page }) => {
        await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
        await page.goto('/');
        await page.clock.pauseAt(new Date('2026-01-01T00:00:10Z'));
        await expect(page.locator('#pace-wpm')).toBeHidden();
        await page.locator('#settings-btn').click();
        await page.locator('#pace-select').selectOption('target');
        await expect(page.locator('#pace-wpm')).toBeVisible();
        await page.locator('#pace-wpm').fill('60');
        await page.locator('#close-settings-btn').click();
        await expect(page.locator('#ghost-status')).toHaveText('Pace: 60 WPM');

        const quote = await currentQuote(page);
        await input(page).press(quote[0]);
        await page.clock.runFor(11900);
        expect(await page.evaluate(() => runtime.ghostIndex)).toBe(59);
        await page.clock.runFor(100);
        expect(await page.evaluate(() => runtime.ghostIndex)).toBe(60);
        await expect(page.locator('#ghost-status')).toHaveText('-59 chars vs pace');
        await expect(page.locator('#ghost-cursor')).toHaveCSS('opacity', '1');
    });

    test('is saved, and its speed is kept between 10 and 300', async ({ page }) => {
        await page.goto('/');
        await setPace(page, 'target', 900);
        await page.reload();
        await expect(page.locator('#pace-select')).toHaveValue('target');
        await expect(page.locator('#pace-wpm')).toHaveValue('300');
        await expect(page.locator('#ghost-status')).toHaveText('Pace: 300 WPM');
    });

    test('follows your average or last run at these settings', async ({ page }) => {
        await page.addInitScript(() => {
            const run = (wpm) => ({
                wpm,
                accuracy: 95,
                date: 0,
                mode: 'time',
                key: 'time:60s:common',
            });
            localStorage.setItem('typingGameHistory', JSON.stringify([run(50), run(71)]));
        });
        await page.goto('/');
        await setPace(page, 'average');
        await expect(page.locator('#ghost-status')).toHaveText('Pace: your average, 61 WPM');
        await setPace(page, 'last');
        await expect(page.locator('#ghost-status')).toHaveText('Pace: your last run, 50 WPM');

        await page.locator('#quick-duration .pill', { hasText: '30s' }).click();
        await expect(page.locator('#ghost-status')).toHaveText(
            'No runs at these settings yet, so there is no pace caret.'
        );
        await expect(page.locator('#ghost-cursor')).toHaveCount(0);
    });

    test('gives way to Ghost mode', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({ isGhostEnabled: true, pace: 'target', paceWpm: 80 })
            );
        });
        await page.goto('/');
        await expect(page.locator('#ghost-status')).toHaveText(
            'No ghost yet for these settings: finish a run to record one.'
        );
        await input(page).press((await currentQuote(page))[0]);
        expect(await page.evaluate(() => runtime.ghostTimeouts.length)).toBe(0);
    });
});

test.describe('daily', () => {
    const openDaily = async (page, time) => {
        await page.clock.install({ time: new Date(time) });
        await page.goto('/');
        await page.clock.pauseAt(new Date(new Date(time).getTime() + 10000));
        await page.locator('#daily-btn').click();
        return currentQuote(page);
    };

    test('everyone gets the same passage on the same UTC date, and a new one the next day', async ({
        browser,
    }) => {
        const quoteOn = async (time) => {
            const context = await browser.newContext();
            const page = await context.newPage();
            const quote = await openDaily(page, time);
            await expect(page.locator('#ghost-status')).toContainText('Daily #');
            const number = (await page.locator('#ghost-status').textContent()).match(/#(\d+)/)[1];
            await context.close();
            return [quote, number];
        };
        const morning = await quoteOn('2026-10-26T01:00:00Z');
        const evening = await quoteOn('2026-10-26T22:00:00Z');
        const nextDay = await quoteOn('2026-10-27T01:00:00Z');
        expect(morning).toEqual(evening);
        expect(morning[1]).toBe('2');
        expect(nextDay[1]).toBe('3');
        expect(nextDay[0]).not.toBe(morning[0]);
    });

    test('uses fixed settings and gives the saved ones back after the run', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({ mode: 'words', wordCount: 25, category: 'general' })
            );
        });
        const quote = await openDaily(page, '2026-10-25T12:00:00Z');
        await expect(page.locator('#daily-btn')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('#quick-duration .pill.active')).toHaveText('30s');
        await expect(page.locator('#category-select')).toHaveValue('common');
        await expect(page.locator('#punctuation-toggle')).toBeChecked();
        await expect(page.locator('#ghost-status')).toHaveText(
            'Daily #1: the same passage for everyone today. Your first run is the one recorded.'
        );

        await input(page).pressSequentially(quote.slice(0, 5));
        await page.clock.runFor(31000);
        await expect(page.locator('#result-modal')).toHaveClass(/show/);
        await page.locator('#play-again-btn').click();
        await expect(page.locator('#daily-btn')).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('#category-select')).toHaveValue('general');
        await expect(page.locator('#quick-word-count .pill.active')).toHaveText('25');
    });

    test('records the first run of the day and shares it as a line and a grid', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            navigator.clipboard.writeText = async (text) => {
                window.copiedText = text;
            };
        });
        const quote = await openDaily(page, '2026-10-25T12:00:00Z');
        // All typed in the first five seconds: one green square, then white.
        await input(page).pressSequentially(quote.slice(0, 20));
        await page.clock.runFor(31000);
        await expect(page.locator('#modal-challenge')).toHaveText(
            'Daily #1 recorded: \u{1f7e9}⬜⬜⬜⬜⬜'
        );
        const wpm = await page.locator('#modal-wpm').textContent();
        await page.locator('#share-btn').click();
        expect(await page.evaluate(() => window.copiedText)).toBe(
            `TypeSpeed Daily #1: ${wpm} WPM, 100%\n\u{1f7e9}⬜⬜⬜⬜⬜\nhttps://tmhsdigital.github.io/Typing-Game/#daily`
        );
        const stored = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('typingGameDaily'))
        );
        expect(stored).toEqual({
            1: { wpm: Number(wpm), accuracy: 100, grid: '\u{1f7e9}⬜⬜⬜⬜⬜' },
        });

        // A second attempt is practice: not recorded, and sharing still sends the first.
        await page.locator('#play-again-btn').click();
        await page.locator('#daily-btn').click();
        await expect(page.locator('#ghost-status')).toHaveText(
            `Daily #1: already played today at ${wpm} WPM. This run is practice.`
        );
        await input(page).pressSequentially(quote.slice(0, 3));
        await input(page).press(quote[3] === 'x' ? 'y' : 'x');
        await page.clock.runFor(31000);
        await expect(page.locator('#modal-challenge')).toHaveText(
            `Daily #1 was already played today at ${wpm} WPM, so this run was practice.`
        );
        await page.locator('#share-btn').click();
        expect(await page.evaluate(() => window.copiedText)).toContain(
            `TypeSpeed Daily #1: ${wpm} WPM, 100%`
        );
        expect(
            await page.evaluate(() => JSON.parse(localStorage.getItem('typingGameDaily')))
        ).toEqual(stored);
    });

    test('#daily in the URL opens it, and the button leaves it', async ({ page }) => {
        await page.goto('/#daily');
        await expect(page.locator('#daily-btn')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('#ghost-status')).toContainText('Daily #');
        await page.locator('#daily-btn').click();
        await expect(page.locator('#daily-btn')).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('#ghost-status')).toBeHidden();
        await expect(page.locator('#quick-duration .pill.active')).toHaveText('60s');
        expect(await page.evaluate(() => location.hash)).toBe('');
    });

    test('import keeps only well-formed daily results', async ({ page }) => {
        await page.goto('/');
        const result = await page.evaluate(() =>
            validDaily({
                1: { wpm: 80, accuracy: 97, grid: '\u{1f7e9}\u{1f7e8}\u{1f7e5}⬜' },
                2: { wpm: 80, accuracy: 97, grid: '<img>' },
                abc: { wpm: 80, accuracy: 97, grid: '' },
                3: { wpm: '80', accuracy: 97, grid: '' },
            })
        );
        expect(result).toEqual({
            1: { wpm: 80, accuracy: 97, grid: '\u{1f7e9}\u{1f7e8}\u{1f7e5}⬜' },
        });
    });
});

test.describe('replay', () => {
    const finishWithTypo = async (page) => {
        await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
        await page.addInitScript(() => {
            localStorage.setItem('typingGameSettings', JSON.stringify({ duration: 15 }));
        });
        await page.goto('/');
        await page.clock.pauseAt(new Date('2026-01-01T00:00:10Z'));
        const quote = await currentQuote(page);
        const wrong = quote[0] === 'x' ? 'y' : 'x';
        await input(page).press(wrong); // t = 0
        await page.clock.runFor(1000);
        await input(page).press('Backspace'); // t = 1000
        await page.clock.runFor(1000);
        await input(page).press(quote[0]); // t = 2000
        await page.clock.runFor(14000);
        await expect(page.locator('#result-modal')).toHaveClass(/show/);
        return { quote, wrong };
    };
    const first = (page) => page.locator('#replay-display span').first();

    test('shows the wrong character and its correction at the recorded times', async ({ page }) => {
        const { wrong } = await finishWithTypo(page);
        await page.locator('#replay-btn').click();
        await expect(page.locator('#replay-modal')).toHaveClass(/show/);
        await expect(page.locator('#replay-pause-btn')).toBeFocused();

        await page.clock.runFor(100);
        await expect(first(page)).toHaveClass(/incorrect/);
        expect(await page.evaluate(() => runtime.replay.events[0].value)).toBe(wrong);
        await page.clock.runFor(1000);
        await expect(first(page)).not.toHaveClass(/incorrect|correct/);
        await expect(first(page)).toHaveClass(/current/);
        await expect(page.locator('#replay-clock')).toHaveText('1.1');
        await page.clock.runFor(1000);
        await expect(first(page)).toHaveClass(/correct/);
        await expect(first(page)).not.toHaveClass(/incorrect/);
        await expect(page.locator('#replay-pause-btn')).toHaveText('Play again');

        // Escape goes back to the result dialog.
        await page.keyboard.press('Escape');
        await expect(page.locator('#replay-modal')).not.toHaveClass(/show/);
        await expect(page.locator('#result-modal')).toHaveClass(/show/);
        await expect(page.locator('#replay-btn')).toBeFocused();
    });

    test('pauses, resumes, and plays at 2x', async ({ page }) => {
        await finishWithTypo(page);
        await page.locator('#replay-btn').click();
        await page.locator('#replay-pause-btn').click();
        await expect(page.locator('#replay-pause-btn')).toHaveText('Resume');
        await page.clock.runFor(3000);
        await expect(first(page)).toHaveClass(/incorrect/);

        await page.locator('#replay-speed .pill', { hasText: '2x' }).click();
        await page.locator('#replay-pause-btn').click();
        // 2x: the correction at 1000 ms shows after 500 ms.
        await page.clock.runFor(600);
        await expect(first(page)).not.toHaveClass(/incorrect/);
    });

    test('a new run clears the replay', async ({ page }) => {
        await finishWithTypo(page);
        await page.locator('#play-again-btn').click();
        expect(await page.evaluate(() => runtime.replay.events.length)).toBe(0);
        expect(await page.evaluate(() => runtime.replay.passages.length)).toBe(1);
    });
});

test.describe('result image', () => {
    const finishRun = async (page) => {
        await page.evaluate(() => {
            gameState.mode = 'words';
        });
        await page.locator('#reset-button').click();
        await input(page).pressSequentially(await currentQuote(page), { delay: 40 });
        await expect(page.locator('#result-modal')).toHaveClass(/show/);
    };

    test('downloads a 1200x630 PNG with the values from the dialog', async ({ page }) => {
        await page.addInitScript(() => {
            window.drawnText = [];
            const fillText = CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText = function (value, ...rest) {
                window.drawnText.push(String(value));
                return fillText.call(this, value, ...rest);
            };
        });
        await page.goto('/');
        await finishRun(page);
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('#save-image-btn').click(),
        ]);
        expect(download.suggestedFilename()).toMatch(/^typespeed-\d{4}-\d{2}-\d{2}\.png$/);
        await expect(page.locator('#save-image-btn')).toHaveText('Image saved');

        const saved = test.info().outputPath('card.png');
        await download.saveAs(saved);
        const png = fs.readFileSync(saved);
        expect(png.subarray(1, 4).toString()).toBe('PNG');
        // IHDR: width and height as big-endian 32-bit numbers.
        expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);

        const drawn = await page.evaluate(() => window.drawnText);
        for (const id of ['#result-title', '#modal-wpm', '#modal-accuracy', '#modal-time']) {
            expect(drawn).toContain(await page.locator(id).textContent());
        }
        expect(drawn).toContain(await page.locator('#modal-chars').textContent());
        expect(drawn).toContain('tmhsdigital.github.io/Typing-Game/');
    });

    test('goes to the share sheet with the text on phones', async ({ browser }) => {
        const context = await browser.newContext({ hasTouch: true, isMobile: false });
        const page = await context.newPage();
        await page.addInitScript(() => {
            const coarse = window.matchMedia('(pointer: coarse)');
            window.matchMedia = (query) =>
                query === '(pointer: coarse)' ? { ...coarse, matches: true } : coarse;
            navigator.canShare = (data) => Boolean(data.files);
            navigator.share = async (data) => {
                window.sharedData = {
                    text: data.text,
                    url: data.url,
                    files: data.files.map((file) => [file.name, file.type, file.size > 0]),
                };
            };
        });
        await page.goto('/');
        await finishRun(page);
        await page.locator('#save-image-btn').click();
        await expect.poll(() => page.evaluate(() => window.sharedData)).toBeTruthy();
        const shared = await page.evaluate(() => window.sharedData);
        expect(shared.files).toEqual([
            [expect.stringMatching(/^typespeed-.*\.png$/), 'image/png', true],
        ]);
        expect(shared.text).toMatch(/^\d+ WPM, \d+% accuracy/);
        expect(shared.url).toBe('https://tmhsdigital.github.io/Typing-Game/');
        await context.close();
    });

    for (const theme of ['dark', 'light', 'contrast']) {
        test(`${theme}: the image's text meets 4.5:1 on its background`, async ({ page }) => {
            await page.addInitScript((value) => {
                localStorage.setItem('typingGameSettings', JSON.stringify({ theme: value }));
            }, theme);
            await page.goto('/');
            const ratios = await page.evaluate(() => {
                const palette = cardPalette();
                // Let a canvas turn each CSS color into RGB.
                const ctx = document.createElement('canvas').getContext('2d');
                const rgb = (color) => {
                    ctx.clearRect(0, 0, 1, 1);
                    ctx.fillStyle = color;
                    ctx.fillRect(0, 0, 1, 1);
                    return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
                };
                const luminance = (color) => {
                    const [r, g, b] = rgb(color).map((v) => {
                        const c = v / 255;
                        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
                    });
                    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
                };
                const background = luminance(palette.background);
                return ['text', 'muted', 'accent'].map((name) => {
                    const fg = luminance(palette[name]);
                    return (Math.max(fg, background) + 0.05) / (Math.min(fg, background) + 0.05);
                });
            });
            for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
        });
    }
});

test.describe('keyboard layout', () => {
    // Opens the page with these settings saved, typing a custom text.
    const openWithLayout = async (page, layout, customText = 'rst Rst') => {
        await page.addInitScript(
            (value) => localStorage.setItem('typingGameSettings', JSON.stringify(value)),
            { layout, category: 'custom', customText }
        );
        await page.goto('/');
    };

    test('with Colemak, physical keys type Colemak characters', async ({ page }) => {
        await openWithLayout(page, 'colemak');
        await page.keyboard.press('KeyS');
        await page.keyboard.press('KeyD');
        await page.keyboard.press('KeyF');
        await expect(input(page)).toHaveValue('rst');
        await page.keyboard.press('Space');
        await page.keyboard.press('Shift+KeyS');
        await expect(input(page)).toHaveValue('rst R');
        expect(await page.evaluate(() => [runtime.keystrokes, runtime.mistakes])).toEqual([5, 0]);
        await expect(page.locator('#quote-display span').nth(4)).toHaveClass(/correct/);
    });

    test('a key pressed while focus is elsewhere is remapped too', async ({ page }) => {
        await openWithLayout(page, 'dvorak', 'aoeu');
        await page.locator('#settings-btn').focus();
        // Dvorak puts o on the physical S key.
        await page.keyboard.press('KeyA');
        await page.keyboard.press('KeyS');
        await expect(input(page)).toBeFocused();
        await expect(input(page)).toHaveValue('ao');
    });

    test('QWERTY leaves keys alone, and Ctrl shortcuts are never remapped', async ({ page }) => {
        await openWithLayout(page, 'qwerty', 'sss');
        await page.keyboard.press('KeyS');
        await expect(input(page)).toHaveValue('s');
        await page.evaluate(() => {
            gameState.layout = 'colemak';
        });
        await page.keyboard.press('Control+KeyS');
        await expect(input(page)).toHaveValue('s');
    });

    test('the layout is saved, and bests, weak keys, and the heatmap are kept per layout', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameKeyStats',
                JSON.stringify({
                    e: { attempts: 10, misses: 2 },
                    'colemak:r': { attempts: 10, misses: 8 },
                })
            );
        });
        await page.clock.install();
        await page.goto('/');
        await page.locator('#settings-btn').click();
        await page.locator('#layout-select').selectOption('colemak');
        await page.locator('#close-settings-btn').click();
        await page.reload();
        await expect(page.locator('#layout-select')).toHaveValue('colemak');
        expect(await page.evaluate(() => [settingsKey(), weakestKeys()])).toEqual([
            'time:60s:common+colemak',
            ['r'],
        ]);
        await page.locator('#stats-btn').click();
        await expect(page.locator('.heatmap-row').nth(2)).toHaveText(/^arstdhneio'$/);
        await expect(page.locator('.heat-key', { hasText: /^r$/ })).toHaveAttribute(
            'aria-label',
            'r: 80% missed of 10 attempts'
        );
        await page.keyboard.press('Escape');

        // A run under Colemak records its key stats under Colemak.
        await page.keyboard.press('KeyS');
        await page.keyboard.press('KeyD');
        await page.clock.runFor(1100); // runs under a second are not recorded
        await page.evaluate(() => endGame());
        const keys = await page.evaluate(() => Object.keys(keyStats));
        expect(keys.filter((key) => !key.startsWith('colemak:'))).toEqual(['e']);

        await page.evaluate(() => {
            gameState.layout = 'qwerty';
        });
        expect(await page.evaluate(() => weakestKeys())).toEqual(['e']);
    });
});

test.describe('challenge links', () => {
    const recordClipboard = () => {
        navigator.clipboard.writeText = async (text) => {
            window.copiedText = text;
        };
    };

    test("replay the sender's passage and ghost without changing saved settings", async ({
        page,
        browser,
    }) => {
        await page.addInitScript(recordClipboard);
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({ mode: 'words', wordCount: 10, category: 'technology' })
            );
        });
        await page.goto('/');
        const sent = await currentQuote(page);
        await input(page).pressSequentially(sent, { delay: 30 });
        await page.locator('#challenge-btn').click();
        await expect(page.locator('#challenge-btn')).toHaveText('Link copied');
        const link = await page.evaluate(() => window.copiedText);
        expect(link).toMatch(/^http:\/\/127\.0\.0\.1:8765\/#c=[zj][A-Za-z0-9_-]+$/);
        const senderWpm = Number(await page.locator('#modal-wpm').textContent());

        const fresh = await browser.newContext();
        const other = await fresh.newPage();
        const errors = collectErrors(other);
        await other.goto(link);
        await expect(other.locator('#ghost-status')).toHaveText(
            `Challenge: beat ${senderWpm} WPM on this text`
        );
        expect(await currentQuote(other)).toBe(sent);
        await expect(other.locator('#quick-mode .pill.active')).toHaveText('Words');
        await expect(other.locator('#quick-word-count .pill.active')).toHaveText('10');
        await expect(other.locator('#category-select')).toHaveValue('technology');
        await expect(other.locator('#ghost-cursor')).toHaveCount(1);

        await input(other).pressSequentially(sent, { delay: 30 });
        await expect(other.locator('#modal-challenge')).toHaveText(
            new RegExp(
                `^Challenge: you \\d+ WPM, them ${senderWpm} WPM\\. (You won|A tie|They won)\\.$`
            )
        );
        expect(await other.evaluate(() => localStorage.getItem('typingGameSettings'))).toBeNull();

        // Play again returns to the receiver's own settings and drops the hash.
        await other.locator('#play-again-btn').click();
        await expect(other.locator('#quick-mode .pill.active')).toHaveText('Time');
        await expect(other.locator('#category-select')).toHaveValue('common');
        expect(await other.evaluate(() => location.hash)).toBe('');
        await expect(other.locator('#ghost-status')).toBeHidden();
        expect(errors).toEqual([]);
        await fresh.close();
    });

    test('a failed copy shows the link, selected, in the result dialog', async ({ page }) => {
        await page.addInitScript(() => {
            navigator.clipboard.writeText = async () => {
                throw new DOMException('Not allowed', 'NotAllowedError');
            };
        });
        await page.addInitScript(() => {
            localStorage.setItem('typingGameSettings', JSON.stringify({ mode: 'words' }));
        });
        await page.goto('/');
        await input(page).pressSequentially(await currentQuote(page), { delay: 40 });
        await expect(page.locator('#challenge-link-row')).toBeHidden();
        await page.locator('#challenge-btn').click();

        await expect(page.locator('#challenge-btn')).toHaveText('Copy failed');
        const link = page.locator('#challenge-link');
        await expect(link).toBeVisible();
        await expect(link).toBeFocused();
        await expect(link).toHaveValue(/^http:\/\/127\.0\.0\.1:8765\/#c=[zj][A-Za-z0-9_-]+$/);
        const selected = await link.evaluate((el) => el.selectionEnd - el.selectionStart);
        expect(selected).toBe((await link.inputValue()).length);

        // The next result starts with the link hidden again.
        await page.locator('#play-again-btn').click();
        await input(page).pressSequentially(await currentQuote(page), { delay: 40 });
        await expect(page.locator('#challenge-link-row')).toBeHidden();
    });

    test('on touch devices the link goes to the share sheet', async ({ browser }) => {
        const context = await browser.newContext({ hasTouch: true, isMobile: false });
        const page = await context.newPage();
        await page.addInitScript(() => {
            const coarse = window.matchMedia('(pointer: coarse)');
            window.matchMedia = (query) =>
                query === '(pointer: coarse)' ? { ...coarse, matches: true } : coarse;
            navigator.share = async (data) => {
                window.sharedData = data;
            };
            localStorage.setItem('typingGameSettings', JSON.stringify({ mode: 'words' }));
        });
        await page.goto('/');
        await input(page).pressSequentially(await currentQuote(page), { delay: 40 });
        await page.locator('#challenge-btn').click();
        await expect
            .poll(() => page.evaluate(() => window.sharedData && window.sharedData.url))
            .toMatch(/^http:\/\/127\.0\.0\.1:8765\/#c=[zj][A-Za-z0-9_-]+$/);
        await context.close();
    });

    test('a link opened in a tab that already has the page starts the challenge', async ({
        page,
    }) => {
        await page.goto('/');
        await input(page).pressSequentially('ab');
        const code = await page.evaluate(() =>
            encodeChallenge({
                v: 1,
                s: { mode: 'words', wordCount: 10, category: 'common' },
                seed: 99,
                wpm: 42,
                k: [],
                d: [100, 1],
            })
        );
        await page.goto(`/#c=${code}`);
        await expect(page.locator('#ghost-status')).toHaveText(
            'Challenge: beat 42 WPM on this text'
        );
        expect(await page.evaluate(() => [runtime.isStarted, runtime.seed])).toEqual([false, 99]);
        await expect(page.locator('#quick-mode .pill.active')).toHaveText('Words');
    });

    test('a link recorded on a different version of the text says so and calls no winner', async ({
        page,
    }) => {
        await page.addInitScript(recordClipboard);
        await page.addInitScript(() => {
            localStorage.setItem('typingGameSettings', JSON.stringify({ mode: 'words' }));
        });
        await page.goto('/');
        const sent = await currentQuote(page);
        await input(page).pressSequentially(sent, { delay: 40 });
        await page.locator('#challenge-btn').click();
        await expect(page.locator('#challenge-btn')).toHaveText('Link copied');
        const link = await page.evaluate(() => window.copiedText);

        // An edit to texts.js changes a word of the sender's passage.
        await page.evaluate((word) => {
            COMMON_WORDS.forEach((w, n) => {
                if (w === word) COMMON_WORDS[n] = 'zzz';
            });
        }, sent.split(' ')[0]);
        await page.goto(link);
        await expect(page.locator('#ghost-status')).toHaveText(
            'This challenge was recorded on a different version of the text, so there is no ghost or winner.'
        );
        const received = await currentQuote(page);
        expect(received).not.toBe(sent);
        await input(page).press(received[0]);
        expect(await page.evaluate(() => runtime.ghostTimeouts.length)).toBe(0);

        await input(page).pressSequentially(received.slice(1), { delay: 40 });
        await expect(page.locator('#modal-challenge')).toHaveText(
            /^Challenge: you \d+ WPM, them \d+ WPM\. Recorded on a different version of the text: no winner\.$/
        );
    });

    test("play under the sender's Stop on error and Skip indentation", async ({ page }) => {
        await page.goto('/');
        const code = await page.evaluate(() =>
            encodeChallenge({
                v: 1,
                s: { mode: 'words', category: 'code', isStopOnError: true, isAutoIndent: false },
                seed: 5,
                wpm: 30,
                k: [],
                d: [100, 1],
            })
        );
        await page.goto(`/#c=${code}`);
        await expect(page.locator('#ghost-status')).toHaveText(
            'Challenge: beat 30 WPM on this text'
        );
        expect(
            await page.evaluate(() => [
                gameState.isStopOnError,
                gameState.isAutoIndent,
                runtime.indent.some(Boolean),
            ])
        ).toEqual([true, false, false]);

        // A wrong key does not advance the caret, as on the sender's side.
        const quote = await currentQuote(page);
        await input(page).press(quote[0] === 'x' ? 'y' : 'x');
        await expect(input(page)).toHaveValue('');
        await page.keyboard.press('Tab');
        await page.locator('#reset-button').click();
        expect(
            await page.evaluate(() => [gameState.isStopOnError, gameState.isAutoIndent])
        ).toEqual([false, true]);
    });

    test('malformed and oversized links fall back to a normal run', async ({ page }) => {
        const errors = collectErrors(page);
        for (const hash of [
            '#c=zAAAA',
            '#c=jeyJ2IjoxfQ', // {"v":1} with nothing else
            '#c=q123',
            `#c=j${'A'.repeat(20001)}`,
        ]) {
            await page.goto(`/${hash}`);
            await expect(page.locator('#ghost-status')).toBeHidden();
            expect(await page.evaluate(() => runtime.challenge)).toBeNull();
            await expect(page.locator('#category-select')).toHaveValue('common');
        }
        expect(errors).toEqual([]);
    });

    test('encoding round-trips and validation rejects bad strokes', async ({ page }) => {
        await page.goto('/');
        const result = await page.evaluate(async () => {
            const payload = {
                v: 1,
                s: { mode: 'time', duration: 30, category: 'code' },
                seed: 42,
                wpm: 55,
                k: [],
                d: [100, 1, 120, 1, 90, -1],
            };
            const decoded = parseChallenge(await decodeChallenge(await encodeChallenge(payload)));
            const negativeTime = parseChallenge({ ...payload, d: [100, 1, -50, 1] });
            const badSeed = parseChallenge({ ...payload, seed: -1 });
            const withHash = parseChallenge({ ...payload, v: 2, h: 'abc12' });
            const missingHash = parseChallenge({ ...payload, v: 2 });
            const badHash = parseChallenge({ ...payload, v: 2, h: 'ABC!' });
            const laterVersion = parseChallenge({ ...payload, v: 3, h: 'abc12' });
            return { decoded, negativeTime, badSeed, withHash, missingHash, badHash, laterVersion };
        });
        // Version 1 links have no hash and are played without the check.
        expect(result.decoded.textHash).toBeUndefined();
        expect(result.withHash.textHash).toBe('abc12');
        expect(result.missingHash).toBeNull();
        expect(result.badHash).toBeNull();
        expect(result.laterVersion).toBeNull();
        expect(result.decoded.seed).toBe(42);
        expect(result.decoded.settings).toMatchObject({
            mode: 'time',
            duration: 30,
            category: 'code',
        });
        expect(result.decoded.strokes).toEqual([
            { t: 100, i: 1 },
            { t: 220, i: 2 },
            { t: 310, i: 1 },
        ]);
        expect(result.negativeTime).toBeNull();
        expect(result.badSeed).toBeNull();
    });
});

test.describe('custom text', () => {
    test('pasted text is normalized, typed, and kept after a reload', async ({
        page,
        context,
        browserName,
    }) => {
        await page.goto('/');
        await page.locator('#category-select').selectOption('custom');
        await expect(page.locator('#practice-note')).toHaveText(
            'No custom text yet. Add it with Edit text; using common words until then.'
        );

        await page.locator('#edit-custom-btn').click();
        await expect(page.locator('#custom-text')).toBeFocused();
        const raw = '\u201cIt\u2019s  fine\u201d \u2014 she said\u2026\n\nline two';
        if (browserName === 'chromium') {
            // A real paste works in this field, unlike in the typing input.
            await context.grantPermissions(['clipboard-read', 'clipboard-write']);
            await page.evaluate((text) => navigator.clipboard.writeText(text), raw);
            await page.locator('#custom-text').focus();
            await page.keyboard.press('ControlOrMeta+v');
        } else {
            await page.locator('#custom-text').fill(raw);
        }
        await expect(page.locator('#custom-text')).toHaveValue(raw);
        await page.keyboard.press('Escape');

        const expected = '"It\'s fine" - she said... line two';
        expect(await currentQuote(page)).toBe(expected);
        await expect(page.locator('#practice-note')).toBeHidden();
        expect(await page.evaluate(() => settingsKey())).toMatch(/^time:60s:custom-[0-9a-z]+$/);

        await page.reload();
        expect(await currentQuote(page)).toBe(expected);
        await page.locator('#edit-custom-btn').click();
        await expect(page.locator('#custom-text')).toHaveValue(expected);
    });

    test('words mode repeats short text, and long text is capped', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({ mode: 'words', category: 'custom', customText: 'one two three' })
            );
        });
        await page.goto('/');
        expect(await currentQuote(page)).toBe('one two three one two three one two three one');
        const capped = await page.evaluate(() => normalizeCustomText('word '.repeat(1000)));
        expect(capped.length).toBeLessThanOrEqual(2000);
        expect(capped.endsWith(' ')).toBe(false);
    });

    test('different texts keep separate bests, and challenge links are not offered', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({ mode: 'words', category: 'custom', customText: 'alpha beta' })
            );
        });
        await page.goto('/');
        const first = await page.evaluate(() => settingsKey());
        await page.evaluate(() => {
            gameState.customText = 'gamma delta';
        });
        expect(await page.evaluate(() => settingsKey())).not.toBe(first);
        await page.evaluate(() => {
            gameState.customText = 'alpha beta';
        });

        await input(page).pressSequentially(await currentQuote(page), { delay: 40 });
        await expect(page.locator('#result-modal')).toHaveClass(/show/);
        await expect(page.locator('#challenge-btn')).toBeHidden();
    });

    test('with no text saved, runs are recorded as Common Words', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({ mode: 'words', category: 'custom', customText: '' })
            );
        });
        await page.goto('/');
        await input(page).pressSequentially(await currentQuote(page), { delay: 40 });
        await expect(page.locator('#result-modal')).toHaveClass(/show/);
        const keys = await page.evaluate(() =>
            Object.keys(JSON.parse(localStorage.getItem('typingGameBests')))
        );
        expect(keys).toEqual(['words:10w:common']);
        await expect(page.locator('#challenge-btn')).toBeVisible();
    });

    test('the typing input still blocks paste', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({ category: 'custom', customText: 'paste me' })
            );
        });
        await page.goto('/');
        const blocked = await page.evaluate(() => {
            const paste = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
            return !typingInputElement.dispatchEvent(paste);
        });
        expect(blocked).toBe(true);
    });
});

test.describe('code snippets', () => {
    // Shows a snippet that has an indented line. Each attempt forces a
    // different snippet index; the second value keeps pickQuote from looping
    // when the forced index is the one already shown.
    const indentedSnippet = (page) =>
        page.evaluate(() => {
            const count = CODE_SNIPPETS[gameState.codeLanguage].length;
            for (let k = 0; k < count; k++) {
                const values = [(k + 0.5) / count, ((k + 1.5) % count) / count];
                runtime.random = () => values.shift() ?? 0.5;
                renderNewQuote();
                if (/\n +/.test(runtime.quoteText)) return runtime.quoteText;
            }
            return null;
        });

    const throughFirstIndentedLine = (text) => {
        const lines = text.split('\n');
        const last = lines.findIndex((line, n) => n > 0 && line.startsWith(' '));
        return lines.slice(0, last + 1).join('\n');
    };

    // Types the passage key by key, as a person would: Enter for new lines,
    // and no leading spaces when the page fills them in.
    const typeCode = async (page, text, { skipIndent }) => {
        let lineStart = false;
        for (const character of text) {
            if (character === '\n') {
                await input(page).press('Enter');
                lineStart = true;
                continue;
            }
            if (skipIndent && lineStart && character === ' ') continue;
            lineStart = false;
            await input(page).press(character === ' ' ? 'Space' : character);
        }
    };

    // Tabs, Windows line ends, trailing spaces, a run of blank lines, and a
    // line over 100 characters, which is dropped.
    const OWN_SOURCE =
        'function add(a, b) {\r\n\treturn a + b;   \r\n}\r\n\r\n\r\n\r\n' +
        `// ${'x'.repeat(120)}\r\n` +
        'class Box {\r\n\tconstructor(v) {\r\n\t\tthis.v = v;\r\n\t}\r\n}\r\n';
    const OWN_NORMALIZED =
        'function add(a, b) {\n    return a + b;\n}\n\n' +
        'class Box {\n    constructor(v) {\n        this.v = v;\n    }\n}';
    const loadOwnCode = async (page) => {
        await page.locator('#code-language-select').selectOption('own');
        await expect(page.locator('#practice-note')).toHaveText(
            'No code yet. Add it with Edit code; using JavaScript snippets until then.'
        );
        await page.locator('#edit-code-btn').click();
        await expect(page.locator('#own-code')).toBeFocused();
        await page.locator('#code-file').setInputFiles({
            name: 'example.js',
            mimeType: 'text/javascript',
            buffer: Buffer.from(OWN_SOURCE),
        });
        await expect(page.locator('#code-file-status')).toHaveText('Loaded example.js.');
        await page.locator('#close-code-btn').click();
    };

    test('your own code file is typed with Enter and filled-in indentation', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('typingGameSettings', JSON.stringify({ category: 'code' }));
        });
        await page.goto('/');
        await loadOwnCode(page);
        expect(await page.evaluate(() => gameState.ownCode)).toBe(OWN_NORMALIZED);
        await expect(page.locator('#practice-note')).toBeHidden();
        const key = await page.evaluate(() => settingsKey());
        expect(key).toMatch(/^time:60s:code-own-[0-9a-z]+$/);

        const quote = await currentQuote(page);
        expect(OWN_NORMALIZED.split('\n\n')).toContain(quote);
        await typeCode(page, quote, { skipIndent: true });
        const counted = quote.replace(/\n +/g, '\n').length;
        expect(
            await page.evaluate(() => [
                runtime.quoteBase,
                runtime.keystrokes,
                runtime.mistakes,
                runtime.correctChars,
            ])
        ).toEqual([quote.length, counted, 0, counted]);
    });

    test('your own code survives a reload and an export and import', async ({ page, browser }) => {
        await page.addInitScript(() => {
            if (!localStorage.getItem('typingGameSettings')) {
                localStorage.setItem('typingGameSettings', JSON.stringify({ category: 'code' }));
            }
        });
        await page.goto('/');
        await loadOwnCode(page);
        const key = await page.evaluate(() => settingsKey());
        await page.reload();
        await expect(page.locator('#edit-code-btn')).toBeVisible();
        expect(await page.evaluate(() => [gameState.ownCode, settingsKey()])).toEqual([
            OWN_NORMALIZED,
            key,
        ]);

        await page.locator('#stats-btn').click();
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('#export-btn').click(),
        ]);
        const saved = test.info().outputPath('export.json');
        await download.saveAs(saved);

        const fresh = await browser.newContext();
        const other = await fresh.newPage();
        await other.goto('/');
        await other.locator('#stats-btn').click();
        await other.locator('#import-input').setInputFiles({
            name: 'export.json',
            mimeType: 'application/json',
            buffer: fs.readFileSync(saved),
        });
        await expect(other.locator('#stats-status')).toContainText('Imported');
        expect(await other.evaluate(() => [gameState.ownCode, settingsKey()])).toEqual([
            OWN_NORMALIZED,
            key,
        ]);
        await fresh.close();
    });

    test('your own code is not sent in challenge links', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({
                    mode: 'words',
                    category: 'code',
                    codeLanguage: 'own',
                    ownCode: 'let a = 1;',
                })
            );
        });
        await page.goto('/');
        await input(page).pressSequentially(await currentQuote(page), { delay: 60 });
        await expect(page.locator('#result-modal')).toHaveClass(/show/);
        await expect(page.locator('#challenge-btn')).toBeHidden();
        const parsed = await page.evaluate(() =>
            parseChallenge({
                v: 2,
                s: { category: 'code', codeLanguage: 'own' },
                h: 'abc',
                seed: 1,
                wpm: 50,
                d: [],
            })
        );
        expect(parsed).toBeNull();
    });

    test('a language menu appears and each language keeps its own best', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#code-language-select')).toBeHidden();
        await page.locator('#category-select').selectOption('code');
        await expect(page.locator('#code-language-select')).toBeVisible();
        await page.locator('#code-language-select').selectOption('python');

        const quote = await currentQuote(page);
        expect(quote).toContain('\n');
        const snippets = await page.evaluate(() => CODE_SNIPPETS.python.map((s) => s.join('\n')));
        expect(snippets).toContain(quote);
        expect(await page.evaluate(() => settingsKey())).toBe('time:60s:code-python');
        await expect(page.locator('#quote-display .newline').first()).toHaveText('\u21b5\n');

        await page.reload();
        await expect(page.locator('#code-language-select')).toHaveValue('python');
    });

    test('Enter types a new line and indentation is filled in without counting', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({ category: 'code', codeLanguage: 'python' })
            );
        });
        await page.goto('/');
        const quote = await indentedSnippet(page);
        const firstLines = throughFirstIndentedLine(quote);
        await typeCode(page, firstLines, { skipIndent: true });
        await expect(input(page)).toHaveValue(firstLines);

        const indentation = firstLines
            .split('\n')
            .slice(1)
            .reduce((sum, line) => sum + line.match(/^ */)[0].length, 0);
        const counts = await page.evaluate(() => [
            runtime.keystrokes,
            runtime.correctChars,
            runtime.typedChars,
        ]);
        const typedByHand = firstLines.length - indentation;
        expect(counts).toEqual([typedByHand, typedByHand, typedByHand]);
        await expect(page.locator('#quote-display .incorrect')).toHaveCount(0);
    });

    test('with Skip indentation off, the spaces have to be typed', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({ category: 'code', codeLanguage: 'python', isAutoIndent: false })
            );
        });
        await page.goto('/');
        await expect(page.locator('#auto-indent-toggle')).not.toBeChecked();
        const quote = await indentedSnippet(page);
        const firstLines = throughFirstIndentedLine(quote);
        await typeCode(page, firstLines, { skipIndent: false });
        await expect(input(page)).toHaveValue(firstLines);
        expect(await page.evaluate(() => runtime.typedChars)).toBe(firstLines.length);
    });
});

test.describe('themes', () => {
    const contrastViolations = async (page, include) => {
        let builder = new AxeBuilder({ page }).withRules(['color-contrast']);
        if (include) builder = builder.include(include);
        const results = await builder.analyze();
        return results.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')));
    };

    for (const theme of ['dark', 'light', 'contrast']) {
        test(`${theme} passes the contrast check on the main screen and in Settings`, async ({
            page,
        }) => {
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.addInitScript((value) => {
                localStorage.setItem('typingGameSettings', JSON.stringify({ theme: value }));
            }, theme);
            await page.goto('/');
            await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
            expect(await contrastViolations(page)).toEqual([]);

            // Correct, wrong, and current characters. Focus mode dims the rest
            // of the page on purpose during a run, so only the text is checked.
            const quote = await currentQuote(page);
            await input(page).pressSequentially(quote.slice(0, 3));
            await input(page).press(quote[3] === 'x' ? 'y' : 'x');
            expect(await contrastViolations(page, '.typing-container')).toEqual([]);
            await page.keyboard.press('Tab');
            await page.locator('#settings-btn').click();
            expect(await contrastViolations(page)).toEqual([]);
        });
    }

    test('the choice is saved and applied before the page script runs', async ({ page }) => {
        await page.goto('/');
        await page.locator('#settings-btn').click();
        await page.locator('#theme-selector [data-value="light"]').click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
        await page.keyboard.press('Escape');

        // Block script.js: theme.js alone must apply the saved theme.
        await page.route('**/script.js', (route) => route.abort());
        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    });

    test('System follows the OS color scheme and contrast settings', async ({
        page,
        browserName,
    }) => {
        await page.emulateMedia({ colorScheme: 'light' });
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
        await page.emulateMedia({ colorScheme: 'dark' });
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        // Playwright cannot emulate prefers-contrast in Firefox.
        if (browserName === 'firefox') return;
        await page.emulateMedia({ contrast: 'more' });
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast');
    });
});

test.describe('passage appearance', () => {
    test('font, size, spacing, and caret are saved and applied before the page script runs', async ({
        page,
    }) => {
        await page.goto('/');
        await page.locator('#settings-btn').click();
        await page.locator('#font-select').selectOption('sans');
        await page.locator('#text-size-select').selectOption('large');
        await page.locator('#line-spacing-select').selectOption('wide');
        await page.locator('#caret-select').selectOption('line');
        // Shown behind the dialog at once. Browsers round these differently.
        const size = (property) =>
            page
                .locator('#quote-display')
                .evaluate((el, name) => parseFloat(getComputedStyle(el)[name]), property);
        expect(await size('fontSize')).toBeCloseTo(30.4, 1);
        await page.keyboard.press('Escape');

        // Block script.js: theme.js alone must apply the saved settings.
        await page.route('**/script.js', (route) => route.abort());
        await page.reload();
        const html = page.locator('html');
        await expect(html).toHaveAttribute('data-passage-font', 'sans');
        await expect(html).toHaveAttribute('data-text-size', 'large');
        await expect(html).toHaveAttribute('data-line-spacing', 'wide');
        await expect(html).toHaveAttribute('data-caret-style', 'line');
        const display = page.locator('#quote-display');
        await expect(display).toHaveCSS('font-family', /Space Grotesk/);
        expect(await size('fontSize')).toBeCloseTo(30.4, 1);
        expect(await size('lineHeight')).toBeCloseTo(30.4 * 2.1, 1);
    });

    test('unknown values fall back to the defaults', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'typingGameSettings',
                JSON.stringify({ passageFont: 'comic', textSize: 99, caretStyle: null })
            );
        });
        await page.goto('/');
        await expect(page.locator('#quote-display')).toHaveCSS('font-family', /JetBrains Mono/);
        await expect(page.locator('#quote-display')).toHaveCSS('font-size', '24px');
        await expect(page.locator('#font-select')).toHaveValue('mono');
        await expect(page.locator('#caret-select')).toHaveValue('underline');
    });

    for (const [font, family] of [
        ['mono', 'JetBrains Mono'],
        ['sans', 'Space Grotesk'],
        ['dyslexic', 'OpenDyslexic'],
    ]) {
        test(`${font} at the largest size: the ghost lines up and the text passes the contrast check`, async ({
            page,
        }) => {
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.addInitScript((value) => {
                localStorage.setItem(
                    'typingGameBests',
                    JSON.stringify({
                        'time:60s:common': { wpm: 40, keystrokes: [{ t: 0, i: 30 }] },
                    })
                );
                localStorage.setItem(
                    'typingGameSettings',
                    JSON.stringify({
                        isGhostEnabled: true,
                        passageFont: value,
                        textSize: 'xlarge',
                        caretStyle: 'block',
                    })
                );
            }, font);
            await page.goto('/');
            // The font file loads and is used.
            await page.waitForFunction((name) => document.fonts.check(`24px "${name}"`), family);
            await expect(page.locator('#quote-display')).toHaveCSS(
                'font-family',
                new RegExp(`^"?${family}`)
            );
            const quote = await currentQuote(page);
            await input(page).pressSequentially(quote.slice(0, 3));
            await input(page).press(quote[3] === 'x' ? 'y' : 'x');
            await expect(page.locator('#ghost-cursor')).toHaveCSS('opacity', '1');

            const placement = await page.evaluate(() => {
                const span = document.querySelectorAll('#quote-display span')[30];
                const cursor = document.getElementById('ghost-cursor').getBoundingClientRect();
                const box = span.getBoundingClientRect();
                return {
                    left: Math.abs(cursor.left - box.left),
                    top: Math.abs(cursor.top - box.top),
                };
            });
            expect(placement.left).toBeLessThan(1);
            expect(placement.top).toBeLessThan(1);

            const results = await new AxeBuilder({ page })
                .withRules(['color-contrast'])
                .include('.typing-container')
                .analyze();
            expect(
                results.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))
            ).toEqual([]);
        });
    }
});

test('works offline after one visit', async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    const page = await context.newPage();
    await page.addInitScript(() => {
        localStorage.setItem('typingGameSettings', JSON.stringify({ mode: 'words' }));
    });
    await page.goto('/');
    await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) {
            await new Promise((resolve) =>
                navigator.serviceWorker.addEventListener('controllerchange', resolve, {
                    once: true,
                })
            );
        }
    });

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#quote-display span').first()).toBeAttached();
    await input(page).pressSequentially(await currentQuote(page), { delay: 40 });
    await expect(page.locator('#result-modal')).toHaveClass(/show/);
    const fonts = await page.evaluate(
        () => [...document.fonts].filter((face) => face.status === 'loaded').length
    );
    expect(fonts).toBe(2);
    await context.close();
});

test('a network slower than the timeout gets the saved files', async ({ browser, browserName }) => {
    // Only Chromium lets a test intercept the service worker's own requests.
    test.skip(browserName !== 'chromium', 'Service worker requests are routed only in Chromium');
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    const page = await context.newPage();
    await page.goto('/');
    await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) {
            await new Promise((resolve) =>
                navigator.serviceWorker.addEventListener('controllerchange', resolve, {
                    once: true,
                })
            );
        }
    });
    const cacheNames = await page.evaluate(() => caches.keys());
    expect(cacheNames).toEqual([`typespeed-${await page.evaluate(() => VERSION)}`]);

    // Every response now takes 20 seconds.
    await context.route('**/*', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 20_000));
        await route.continue().catch(() => {});
    });
    const started = Date.now();
    await page.reload({ timeout: 10_000 });
    await expect(page.locator('#quote-display span').first()).toBeAttached({ timeout: 10_000 });
    expect(Date.now() - started).toBeLessThan(10_000);
    await context.close();
});

test('the service worker removes caches from older versions', async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    const page = await context.newPage();
    await page.goto('/sw.js');
    // A cache left by an older version, created before the worker installs.
    await page.evaluate(() =>
        caches.open('typespeed').then((cache) => cache.put('/old', new Response('x')))
    );
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    const version = await page.evaluate(() => VERSION);
    await expect.poll(() => page.evaluate(() => caches.keys())).toEqual([`typespeed-${version}`]);
    await context.close();
});

test.describe('version', () => {
    test('the footer, sw.js, package.json, and CHANGELOG.md agree on the version', async ({
        page,
    }) => {
        await page.goto('/');
        const version = await page.evaluate(() => VERSION);
        await expect(page.locator('#version-link')).toHaveText(version);
        expect(fs.readFileSync('sw.js', 'utf8')).toContain(`const CACHE = 'typespeed-${version}';`);
        expect(JSON.parse(fs.readFileSync('package.json', 'utf8')).version).toBe(version);
        expect(fs.readFileSync('CHANGELOG.md', 'utf8')).toContain(`## ${version} (`);
    });

    test('a visitor from an older version sees the notice once', async ({ page }) => {
        await page.addInitScript(() => {
            if (!sessionStorage.getItem('seeded')) {
                sessionStorage.setItem('seeded', '1');
                localStorage.setItem(
                    'typingGameSettings',
                    JSON.stringify({ lastSeenVersion: '1.0.0' })
                );
            }
        });
        await page.goto('/');
        const version = await page.evaluate(() => VERSION);
        await expect(page.locator('#update-notice')).toBeVisible();
        await expect(page.locator('#update-text')).toHaveText(
            new RegExp(`^Updated to ${version}: `)
        );
        await page.locator('#dismiss-update-btn').click();
        await expect(page.locator('#update-notice')).toBeHidden();
        await expect(input(page)).toBeFocused();

        await page.reload();
        await expect(page.locator('#update-notice')).toBeHidden();
    });

    test('settings saved before versions were recorded also get the notice', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('typingGameSettings', JSON.stringify({ theme: 'dark' }));
        });
        await page.goto('/');
        await expect(page.locator('#update-notice')).toBeVisible();
    });

    test('a first visit shows no notice, then or after a settings change', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#update-notice')).toBeHidden();
        expect(await page.evaluate(() => localStorage.getItem('typingGameSettings'))).toBeNull();
        await page.locator('#quick-mode [data-value="words"]').click();
        await page.reload();
        await expect(page.locator('#update-notice')).toBeHidden();
    });
});

test.describe('stats views', () => {
    const keyStatsSeed = () => {
        localStorage.setItem(
            'typingGameKeyStats',
            JSON.stringify({
                e: { attempts: 20, misses: 4 },
                E: { attempts: 5, misses: 1 },
                '{': { attempts: 10, misses: 5 },
                '[': { attempts: 2, misses: 0 },
                q: { attempts: 3, misses: 3 },
            })
        );
    };

    test('the heatmap shades keys by miss rate and names each one', async ({ page }) => {
        await page.addInitScript(keyStatsSeed);
        await page.goto('/');
        await page.locator('#stats-btn').click();
        const key = (label) =>
            page
                .locator('#stats-heatmap .heat-key')
                .filter({ hasText: new RegExp(`^\\${label}$`) });
        // e and E count together: 5 misses of 25.
        await expect(key('e')).toHaveAttribute('aria-label', 'e: 20% missed of 25 attempts');
        // [ and { count together and are the worst key, 5 of 12.
        await expect(key('[')).toHaveAttribute('aria-label', '[: 42% missed of 12 attempts');
        // q has fewer than five attempts.
        await expect(key('q')).toHaveAttribute('aria-label', 'q: not enough data');
        await expect(key('q')).toHaveClass(/no-data/);
        const heat = await page.evaluate(() =>
            [...document.querySelectorAll('#stats-heatmap .heat-key')]
                .filter((cell) => ['e', '['].includes(cell.textContent))
                .map((cell) => Number(cell.style.getPropertyValue('--heat')).toFixed(2))
        );
        expect(heat).toEqual(['0.48', '1.00']);
        await expect(page.locator('#stats-heatmap .heat-key')).toHaveCount(13 + 13 + 11 + 10 + 1);
    });

    test('a streak counts days in a row with runs, ending today or yesterday', async ({ page }) => {
        await page.clock.install({ time: new Date('2026-03-10T12:00:00') });
        await page.goto('/');
        const streak = (dates) =>
            page.evaluate((list) => {
                runHistory.length = 0;
                runHistory.push(
                    ...list.map((date) => ({
                        wpm: 40,
                        accuracy: 100,
                        date: new Date(date).toISOString(),
                        mode: 'time',
                        key: 'time:60s:common',
                    }))
                );
                return currentStreak();
            }, dates);
        expect(await streak([])).toBe(0);
        expect(await streak(['2026-03-10T08:00', '2026-03-09T23:00', '2026-03-08T07:00'])).toBe(3);
        // No run yet today: the streak up to yesterday still counts.
        expect(await streak(['2026-03-09T08:00', '2026-03-08T08:00'])).toBe(2);
        // A missed day ends it.
        expect(await streak(['2026-03-10T08:00', '2026-03-08T08:00'])).toBe(1);
        expect(await streak(['2026-03-07T08:00'])).toBe(0);
    });

    test('WPM by day averages each day at the current settings', async ({ page }) => {
        await page.addInitScript(() => {
            const run = (wpm, date, key = 'time:60s:common') => ({
                wpm,
                accuracy: 100,
                date: new Date(date).toISOString(),
                mode: 'time',
                key,
            });
            localStorage.setItem(
                'typingGameHistory',
                JSON.stringify([
                    run(60, '2026-03-03T10:00'),
                    run(40, '2026-03-03T09:00'),
                    run(99, '2026-03-02T09:00', 'words:10w:common'),
                    run(30, '2026-03-01T09:00'),
                ])
            );
        });
        await page.goto('/');
        await page.locator('#stats-btn').click();
        const chart = page.locator('#daily-chart-container');
        await expect(chart).toBeVisible();
        await expect(page.locator('#daily-chart circle')).toHaveCount(2);
        await expect(chart.locator('.chart-x-start')).toHaveText('2026-03-01');
        await expect(chart.locator('.chart-x-end')).toHaveText('2026-03-03');
        await expect(chart.locator('.chart-y-max')).toHaveText('50');
        await expect(page.locator('#daily-chart-summary')).toHaveText(
            'Daily average WPM from 2026-03-01 to 2026-03-03: 30, 50.'
        );
    });

    for (const theme of ['dark', 'light', 'contrast']) {
        test(`${theme}: the heatmap passes the contrast check`, async ({ page }) => {
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.addInitScript((value) => {
                localStorage.setItem('typingGameSettings', JSON.stringify({ theme: value }));
                localStorage.setItem(
                    'typingGameKeyStats',
                    JSON.stringify({
                        a: { attempts: 10, misses: 10 },
                        s: { attempts: 10, misses: 5 },
                        d: { attempts: 10, misses: 0 },
                    })
                );
            }, theme);
            await page.goto('/');
            await page.locator('#stats-btn').click();
            await expect(page.locator('#stats-modal')).toHaveClass(/show/);
            const results = await new AxeBuilder({ page })
                .withRules(['color-contrast'])
                .include('#stats-heatmap')
                .analyze();
            expect(results.violations.flatMap((v) => v.nodes.map((n) => n.target))).toEqual([]);
        });
    }
});

test.describe('storage', () => {
    test('a failed save shows a notice that says to export', async ({ page }) => {
        await page.addInitScript(() => {
            Storage.prototype.setItem = () => {
                throw new DOMException('Quota exceeded', 'QuotaExceededError');
            };
        });
        await page.goto('/');
        await expect(page.locator('#storage-warning')).toBeHidden();
        await page.locator('#quick-mode [data-value="words"]').click();
        await expect(page.locator('#storage-warning')).toBeVisible();
        await expect(page.locator('#storage-warning')).toContainText(
            'Progress could not be saved: browser storage is full or blocked.'
        );
        await expect(page.locator('#storage-warning')).toHaveAttribute('role', 'alert');
    });

    test('a best stores its keystrokes as differences and replays them', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('typingGameSettings', JSON.stringify({ mode: 'words' }));
        });
        await page.goto('/');
        await input(page).pressSequentially(await currentQuote(page), { delay: 40 });
        await expect(page.locator('#result-modal')).toHaveClass(/show/);
        const { stored, strokes } = await page.evaluate(() => ({
            stored: JSON.parse(localStorage.getItem('typingGameBests'))['words:10w:common'],
            strokes: runtime.ghostStrokes,
        }));
        expect(stored.keystrokes.every((n) => typeof n === 'number')).toBe(true);
        expect(stored.keystrokes).toHaveLength(strokes.length * 2);
        // Less than half the size of one {t, i} object per keystroke.
        expect(JSON.stringify(stored.keystrokes).length).toBeLessThan(
            JSON.stringify(strokes).length / 2
        );
        expect(await page.evaluate(() => bestStrokes(currentBest()))).toEqual(strokes);
    });

    test('bests saved as {t, i} objects still replay, and import converts them', async ({
        page,
    }) => {
        const strokes = [
            { t: 100, i: 1 },
            { t: 250, i: 2 },
        ];
        await page.addInitScript((list) => {
            localStorage.setItem(
                'typingGameBests',
                JSON.stringify({ 'time:60s:common': { wpm: 40, keystrokes: list } })
            );
        }, strokes);
        await page.goto('/');
        expect(await page.evaluate(() => bestStrokes(currentBest()))).toEqual(strokes);
        const imported = await page.evaluate(
            (list) => validBests({ 'time:60s:common': { wpm: 40, keystrokes: list } }),
            strokes
        );
        expect(imported['time:60s:common'].keystrokes).toEqual([100, 1, 150, 1]);
    });
});

test('the manifest names the app and its icons', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest).toMatchObject({ name: 'TypeSpeed', start_url: './', display: 'standalone' });
    for (const icon of manifest.icons) {
        expect((await request.get(`/${icon.src}`)).ok()).toBe(true);
    }
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512']);
});

test('link previews have a title, description, and an image that exists', async ({
    page,
    request,
}) => {
    await page.goto('/');
    const meta = await page.evaluate(() =>
        Object.fromEntries(
            [...document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]')].map(
                (tag) => [tag.getAttribute('property') || tag.getAttribute('name'), tag.content]
            )
        )
    );
    expect(meta['og:title']).toBe('TypeSpeed');
    expect(meta['og:description'].length).toBeGreaterThan(20);
    expect(meta['twitter:card']).toBe('summary_large_image');
    expect(meta['og:image']).toBe('https://tmhsdigital.github.io/Typing-Game/preview.png');
    // The deployed URL maps to the file in the repo root.
    expect((await request.get('/preview.png')).ok()).toBe(true);

    // Search engines get one URL, a description of the app, and permission
    // to crawl.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://tmhsdigital.github.io/Typing-Game/'
    );
    const app = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    expect(app).toMatchObject({
        '@type': 'WebApplication',
        name: 'TypeSpeed',
        url: 'https://tmhsdigital.github.io/Typing-Game/',
        applicationCategory: 'EducationalApplication',
        offers: { price: '0' },
    });
    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain('Allow: /');
    // The deploy step copies robots.txt with the rest of the site.
    expect(fs.readFileSync('.github/workflows/ci.yml', 'utf8')).toMatch(/cp [^\n]*robots\.txt/);
});
