/**
 * Sets data-theme on <html> before the page paints, from the saved setting
 * or the OS preferences, so a light theme does not flash dark first. Also
 * sets the passage font, size, line spacing, and caret from the saved
 * settings, so the passage does not change after it is first drawn.
 * script.js keeps them up to date after load.
 */
(() => {
    let theme = 'system';
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem('typingGameSettings'));
        if (saved && ['dark', 'light', 'contrast'].includes(saved.theme)) theme = saved.theme;
    } catch {
        // Unreadable or unavailable settings: follow the OS.
    }
    if (theme === 'system') {
        if (window.matchMedia('(prefers-contrast: more)').matches) theme = 'contrast';
        else if (window.matchMedia('(prefers-color-scheme: light)').matches) theme = 'light';
        else theme = 'dark';
    }
    const root = document.documentElement;
    root.dataset.theme = theme;
    // Keep in step with PASSAGE_STYLES in script.js.
    const passage = {
        passageFont: ['mono', 'sans', 'dyslexic'],
        textSize: ['medium', 'small', 'large', 'xlarge'],
        lineSpacing: ['normal', 'compact', 'wide'],
        caretStyle: ['underline', 'line', 'block'],
    };
    if (!saved || typeof saved !== 'object') return;
    for (const [setting, values] of Object.entries(passage)) {
        if (values.includes(saved[setting])) root.dataset[setting] = saved[setting];
    }
})();
