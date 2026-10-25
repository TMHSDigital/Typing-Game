// Checks the content of texts.js without a browser: what the forms in
// .github/ISSUE_TEMPLATE ask contributors for has to fit these rules.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const QUOTE_MAX_LENGTH = 300;
const LINE_MAX_LENGTH = 100;
const SNIPPET_MIN_LINES = 2;
const SNIPPET_MAX_LINES = 9;
// Keys on a US keyboard: printable ASCII. No tabs, curly quotes, or dashes.
const TYPABLE = /^[ -~]*$/;

const source = fs.readFileSync(path.join(__dirname, '..', 'texts.js'), 'utf8');
const sandbox = {};
vm.runInNewContext(
    `${source}\nthis.texts = { COMMON_WORDS, QUOTES, CODE_SNIPPETS, LESSON_HOME_WORDS };`,
    sandbox
);
const { COMMON_WORDS, QUOTES, CODE_SNIPPETS, LESSON_HOME_WORDS } = sandbox.texts;

// The same content in every browser project, so it is checked once.
test.skip(({ browserName }) => browserName !== 'chromium', 'checked in Chromium only');

test('common words are unique lowercase letters', () => {
    expect(COMMON_WORDS.filter((word) => !/^[a-z]+$/.test(word))).toEqual([]);
    expect(COMMON_WORDS.length).toBe(new Set(COMMON_WORDS).size);
});

test('home row lesson words use only the home row, once each', () => {
    expect(LESSON_HOME_WORDS.filter((word) => !/^[asdfghjkl]+$/.test(word))).toEqual([]);
    expect(LESSON_HOME_WORDS.length).toBe(new Set(LESSON_HOME_WORDS).size);
});

test('quotes are typable, trimmed, unique, and short enough', () => {
    const all = Object.values(QUOTES).flat();
    const problems = all
        .filter(
            (quote) =>
                typeof quote.text !== 'string' ||
                typeof quote.source !== 'string' ||
                !TYPABLE.test(quote.text) ||
                !TYPABLE.test(quote.source) ||
                quote.text !== quote.text.trim() ||
                /\s{2}/.test(quote.text) ||
                quote.text.length === 0 ||
                quote.text.length > QUOTE_MAX_LENGTH
        )
        .map((quote) => quote.text);
    expect(problems).toEqual([]);
    const texts = all.map((quote) => quote.text);
    expect(texts.length).toBe(new Set(texts).size);
});

test('code snippets are typable, unique, and fit the line limits', () => {
    const problems = [];
    for (const [language, snippets] of Object.entries(CODE_SNIPPETS)) {
        snippets.forEach((lines, n) => {
            const name = `${language} #${n + 1}`;
            if (lines.length < SNIPPET_MIN_LINES || lines.length > SNIPPET_MAX_LINES) {
                problems.push(`${name}: ${lines.length} lines`);
            }
            if (lines[0] === '' || lines[lines.length - 1] === '') {
                problems.push(`${name}: starts or ends with a blank line`);
            }
            for (const line of lines) {
                if (!TYPABLE.test(line)) problems.push(`${name}: untypable character in "${line}"`);
                if (line.length > LINE_MAX_LENGTH) problems.push(`${name}: line over 100`);
                if (/ $/.test(line)) problems.push(`${name}: trailing space in "${line}"`);
            }
        });
        const joined = snippets.map((lines) => lines.join('\n'));
        if (joined.length !== new Set(joined).size) problems.push(`${language}: duplicates`);
    }
    expect(problems).toEqual([]);
});
