const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    fullyParallel: true,
    retries: process.env.CI ? 1 : 0,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:8765',
        trace: 'retain-on-failure',
        // The service worker would cache responses across tests. The offline
        // test turns it back on for its own context.
        serviceWorkers: 'block',
    },
    webServer: {
        command: 'node scripts/serve.mjs',
        url: 'http://127.0.0.1:8765/index.html',
        reuseExistingServer: !process.env.CI,
    },
    // Desktop projects run everything except the phone tests in
    // mobile.spec.js; the phone projects run only those.
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec/ },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: /mobile\.spec/ },
        { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: /mobile\.spec/ },
        { name: 'pixel-7', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec/ },
        { name: 'iphone-15', use: { ...devices['iPhone 15'] }, testMatch: /mobile\.spec/ },
    ],
});
