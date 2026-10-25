// Phone tests, run by the pixel-7 (Chromium) and iphone-15 (WebKit)
// projects only. page.evaluate callbacks run in the browser, where
// script.js's top-level consts are in scope.
/* global runtime */

const { test, expect } = require('@playwright/test');

const input = (page) => page.locator('#typing-input');
const currentQuote = (page) => page.evaluate(() => runtime.quoteText);

test('fits the screen, with no Tab hints', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator('#reset-button .key-hint')).toBeHidden();
    await expect(page.locator('#quote-display')).toBeInViewport();
});

test('a run hides the controls and ends in a result dialog that fits', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('typingGameSettings', JSON.stringify({ mode: 'words' }));
    });
    await page.goto('/');
    const quote = await currentQuote(page);
    await input(page).pressSequentially(quote.slice(0, 3));
    await expect(page.locator('.controls')).toBeHidden();
    await expect(page.locator('#timer')).toBeVisible();
    await expect(page.locator('#wpm')).toBeVisible();

    await input(page).pressSequentially(quote.slice(3), { delay: 40 });
    await expect(page.locator('#result-modal')).toHaveClass(/show/);
    await expect(page.locator('#modal-wpm')).toBeInViewport();
    await expect(page.locator('#play-again-btn')).toBeVisible();
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
});

test('the line being typed stays above an on-screen keyboard', async ({ page }) => {
    // An on-screen keyboard covering the bottom 60% of the screen: the
    // visual viewport keeps only the top 40%.
    await page.addInitScript(() => {
        const real = window.visualViewport;
        const fake = new EventTarget();
        Object.defineProperties(fake, {
            offsetTop: { get: () => real.offsetTop },
            height: { get: () => Math.round(window.innerHeight * 0.4) },
        });
        Object.defineProperty(window, 'visualViewport', { get: () => fake });
        localStorage.setItem(
            'typingGameSettings',
            JSON.stringify({ mode: 'words', wordCount: 50 })
        );
    });
    await page.goto('/');
    const quote = await currentQuote(page);
    await input(page).pressSequentially(quote.slice(0, 1));
    await page.evaluate(() => window.visualViewport.dispatchEvent(new Event('resize')));

    const visible = () =>
        page.evaluate(() => {
            const rect = document.querySelector('#quote-display .current').getBoundingClientRect();
            const viewport = window.visualViewport;
            return (
                rect.top >= viewport.offsetTop &&
                rect.bottom <= viewport.offsetTop + viewport.height
            );
        });
    expect(await visible()).toBe(true);

    // Typing on through several lines keeps the caret in view.
    await input(page).pressSequentially(quote.slice(1, 200));
    expect(await visible()).toBe(true);
});
