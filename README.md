# TypeSpeed

A typing trainer that runs in the browser. Plain HTML, CSS, and JavaScript, no framework, no build step.

Live: https://tmhsdigital.github.io/Typing-Game/

- No account. Results are stored in your browser only, and the page makes no requests to other sites (see Privacy).
- Works offline after the first visit (see Offline and install).
- Code snippets in six languages, with leading indentation filled in for you (see Code Snippets).
- Ghost Mode replays your best run on the same passage while you type (see Ghost Mode).
- Challenge links carry a run in the URL, so a friend can race it without a server (see Challenge links).

![A run in progress: stats bar, mode and length controls, and the passage with typed words in white](docs/screenshot-run.png)

![The result dialog: WPM, accuracy, raw WPM, characters, time, missed keys, and charts for this run and recent runs](docs/screenshot-result.png)

## Run it

Serve the folder with `npm run serve` (see Development) or any static file server, and open it in a browser. Opening `index.html` directly from disk also works, but Chromium-based browsers block the fonts on `file://`, so system fonts are used there, and offline support is skipped. The page makes no requests to other sites. The two fonts, JetBrains Mono and Space Grotesk, are served from `fonts/` under the SIL Open Font License, and a Content-Security-Policy limits scripts, styles, and fonts to the site itself.

## What it does

- **Mode and length**: picked from the bar above the text. Changing them starts a new run.
- **Time mode**: type for 15, 30, or 60 seconds. When you finish a passage a new one loads until the clock runs out.
- **Words mode**: type a fixed 10, 25, or 50 words. The clock counts up.
- **Categories**:
  - Common Words (the default): 200 frequent English words in random order, never the same word twice in a row. The Punctuation and Numbers checkboxes next to the category menu add punctuation (capitalized sentences, commas, full stops) and numbers; they are shown only for Common Words.
  - Weak Keys: common words that contain the three letters you miss most often, by miss rate, among letters you have typed at least five times. Until there is enough data it uses all common words.
  - Quotes: 50 passages, most of them opening lines of public-domain books.
  - Technology: 50 quotes about programming and computing.
  - Code Snippets: 3 to 8 line snippets in JavaScript, Python, Go, Rust, SQL, or Shell, picked with a second menu that appears next to the category. Enter types a new line, shown in the text as a return arrow. With Skip indentation on (the default, a checkbox next to the language menu), the leading spaces of each new line are filled in for you; they count toward neither WPM nor accuracy. In Words mode, whole snippets are used until there are at least that many words. Each language has its own best scores.
  - Custom Text: text you paste into the dialog that Edit text, next to the category menu, opens. Curly quotes and dashes are converted to plain ones, line breaks become spaces, and text past 2000 characters is dropped. Words mode repeats the text from the start when it has fewer words than the word count. Each custom text has its own best score, keyed by a hash of the text. Custom Text runs cannot be sent as challenge links. With no text saved, Custom Text uses common words and records the runs as Common Words.

  When the source of a passage is known, the result dialog shows it. Passages are in `texts.js`.

- **Live stats**: WPM, accuracy, mistakes, and your best WPM for the current settings, updated as you type.
  - WPM is correct characters divided by five, per minute of real elapsed time.
  - Accuracy is the share of typed characters that matched, counting mistakes you later fixed. It is rounded down, so 100% means no mistakes.
- **Stop on error**: with this setting on, a wrong key is counted as a mistake but does not move the caret, so each mistake has to be fixed with the right key before you can continue.
- **Caps Lock warning**: a notice below the text while Caps Lock is on.
- **Hard Mode**: blurs the characters you have already typed, so you cannot see your mistakes. The text ahead stays readable.
- **Ghost Mode**: records the timing of your best run and replays its position as a second cursor while you type. Bests record the seed their passages were drawn from, so with Ghost Mode on you type the same passages as your best run. In Time mode, when the ghost is on a later or earlier passage than you, its cursor waits at the end or start of yours with an arrow pointing the way. A line below the text shows how many characters ahead of or behind the ghost you are, or says that no ghost exists yet for the current settings. In Weak Keys, a ghost run uses the letters the best run practiced, and the note above the text says so. Bests also record a hash of their first passage. If a change to `texts.js` means the seed no longer gives that passage, Ghost Mode says so and does not replay the best until a new best is set.
- **Results**: a modal titled with the run's length and category, with your WPM as the headline; accuracy, raw WPM (all typed characters, right or wrong), correct and wrong character counts, and elapsed time under it; whether the run set a new best for its settings, and the previous best; the keys you missed most in this run, and, once you have missed letters often enough, a link that starts a Weak Keys run; a line chart of raw WPM at the end of each second of the run; a line chart of your last ten runs at the current settings once you have three or more, both labeled with their lowest and highest value and the ends of their x axis; and a Share result button. The shared text has the WPM, accuracy, settings, and a link to the site. On touch devices it opens the system share sheet; elsewhere it copies to the clipboard.
- **Challenge links**: after a run of a second or longer, Copy challenge link puts a URL on the clipboard, or on touch devices opens the system share sheet. If copying fails, the link is shown, selected, in the result dialog. The URL's hash holds the run's settings, including Stop on error and Skip indentation, the seed of its passages, its WPM, and its keystroke timings, compressed. Opening it, also in a tab that already has the page open, starts a run on the same passages with that run as the ghost, and the result dialog says who was faster. The receiver's saved settings are not changed; after the run, Play again goes back to them. Links also carry a hash of the run's first passage. If a change to `texts.js` means the seed no longer gives that passage, the run is still played, but without a ghost, and the result dialog does not say who won. Links made before this hash was added are played without the check.
- **Stats dialog**: opened from the chart icon in the header, with your best WPM for every setting you have played, the average of your last ten runs, and a list of recorded runs. Export saves everything in `localStorage` to a JSON file, Import loads such a file and replaces the stored data, and Clear data (two clicks) removes history, bests, and key stats.
- **Themes**: System (follows the OS light/dark and increased-contrast settings), Dark, Light, and Contrast, chosen in Settings. `theme.js`, loaded in `<head>`, applies the saved theme before the page paints.
- **Offline and install**: `sw.js`, a service worker, saves the app's files on the first visit, so later visits load without a network connection. It tries the network first, bypassing the browser's HTTP cache, so a new version is used as soon as you are online. If the network has not answered after 3 seconds, the saved copy is used, and for the next 30 seconds the page's other files come from the saved copy without waiting; the network's answer still updates the saved copy when it arrives. A new version of `sw.js` deletes the files saved by older versions. `manifest.webmanifest` and the icons in `icons/` let browsers install the page as an app.
- **Sound**: short tones made with the Web Audio API for keypress, mistake, and completion, defined as a table of recipes in `script.js`. The audio context is created on the first keystroke, at most 16 tones play at once, and nothing is created while sound is off. Can be turned off.
- **Keyboard**: Tab restarts while you are typing. Escape closes a dialog. Opening a dialog during a run abandons the run.
- **Focus**: if the typing input loses focus, a hint appears over the text. Pressing a letter key moves focus back to the input.
- **Screen readers**: the passage is available as the input's description, settings buttons report whether they are selected, and the result dialog reads out WPM and accuracy.
- **Reduced motion**: with the OS reduce-motion setting on, the caret blink and fades are turned off.

Pasting into the input is blocked, and the caret stays at the end: arrow keys, Home, End, select-all, and clicks do not move it.

## Privacy

There is no account and no backend: GitHub Pages serves the static files, and the page makes no requests to other sites, which a test checks. Settings, run history, best scores, and key stats are stored in this browser's `localStorage`, under the keys listed below, and are not sent anywhere. Challenge links carry one run's settings, seed, first passage hash, WPM, and keystroke timings in the URL hash, which browsers do not send to the server; they leave the browser only if you share the link.

Clearing the browser's site data deletes everything. To keep a copy or move to another device, use Export in the Stats dialog and Import on the other side. Clear data in the same dialog removes history, bests, and key stats.

## Settings and data

Everything is stored in `localStorage` under these keys:

| Key                  | Contents                                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `typingGameSettings` | mode, duration, word count, category, and the feature toggles                                                                                                                                                            |
| `typingGameHistory`  | last 500 runs as `{wpm, accuracy, date, mode, key}`                                                                                                                                                                      |
| `typingGameBests`    | for each settings key, the best run as `{wpm, keystrokes, seed, textHash, weakKeys?}`: keystroke timings, the passage seed, and a hash of the first passage for Ghost Mode, and the letters practiced for Weak Keys runs |
| `typingGameKeyStats` | attempts and misses for each expected character across recorded runs                                                                                                                                                     |

A settings key combines mode, length, and category, for example `time:60s:common` or `words:25w:code-python`. Common Words with punctuation or numbers adds them to the category, as in `time:30s:common+punctuation+numbers`. Code Snippets with Skip indentation off adds `+noindent`, and Stop on error adds `+stop`. Best scores, Ghost Mode, and the chart only compare runs with the same key. Runs that finish in under a second are shown but not saved.

## Development

```
npm install
npx playwright install chromium firefox webkit   # once, for the tests

npm run serve         # static server on http://127.0.0.1:8765, no caching
npm test              # Playwright end-to-end tests in Chromium, Firefox, and WebKit
npm run lint          # ESLint
npm run format:check  # Prettier
npm run format        # Prettier, write mode
npm run check         # lint, format check, and tests
```

`index.html`, `theme.js`, `texts.js`, `script.js`, and `style.css` are the app; `sw.js`, `manifest.webmanifest`, and `icons/` add offline use and installing. The script runs at load and expects to be the last tag in `<body>`. Tests live in `tests/` and drive the real page with keystrokes in Chromium, Firefox, and WebKit; `tests/mobile.spec.js` also runs in Playwright's Pixel 7 and iPhone 15 profiles. Each item under "What it does" has at least one test, as do recovery from corrupt `localStorage`, the contrast check, and the absence of requests to other sites.

Each push to `main` runs lint, the format check, and the tests in GitHub Actions. If they pass, the same workflow publishes those files and `fonts/` to GitHub Pages; if they fail, the live site is not changed.

Conventions for code, tests, docs, and commits are in `CONTRIBUTING.md`.

## License

Apache 2.0. See `LICENSE`.
