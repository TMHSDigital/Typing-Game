const js = require('@eslint/js');
const prettier = require('eslint-config-prettier');
const globals = require('globals');

module.exports = [
    { ignores: ['node_modules/', 'test-results/', 'playwright-report/'] },
    js.configs.recommended,
    prettier,
    {
        files: ['script.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            // Declared in texts.js, which loads first.
            globals: {
                ...globals.browser,
                COMMON_WORDS: 'readonly',
                QUOTES: 'readonly',
                CODE_SNIPPETS: 'readonly',
                LESSON_HOME_WORDS: 'readonly',
                WORD_LISTS: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        },
    },
    {
        files: ['texts.js', 'wordlists.js', 'theme.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: { ...globals.browser },
        },
        // The constants are used by script.js.
        rules: { 'no-unused-vars': 'off' },
    },
    {
        files: ['sw.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: { ...globals.serviceworker },
        },
    },
    {
        files: ['tests/**/*.js', 'playwright.config.js', 'eslint.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            // Tests evaluate code in the browser as well as in Node.
            globals: { ...globals.node, ...globals.browser },
        },
    },
    {
        files: ['scripts/**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.node },
        },
    },
];
