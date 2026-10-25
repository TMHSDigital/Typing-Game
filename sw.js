/**
 * TypeSpeed service worker. Saves the app's files on install so the page
 * loads without a network connection. Requests try the network first and
 * fall back to the saved copy, so a new deploy is picked up on the next
 * load while online. A network that answers slower than NETWORK_TIMEOUT
 * gets the saved copy instead; the response still updates the cache when
 * it arrives.
 */
// Change the version when FILES changes: activate deletes every other cache,
// so files removed from the site do not stay saved.
const CACHE = 'typespeed-v2';
const NETWORK_TIMEOUT = 3000; // ms
const FILES = [
    './',
    'index.html',
    'style.css',
    'theme.js',
    'texts.js',
    'script.js',
    'manifest.webmanifest',
    'fonts/jetbrains-mono-latin.woff2',
    'fonts/space-grotesk-latin.woff2',
    'icons/icon-192.png',
    'icons/icon-512.png',
];

// 'reload' and 'no-cache' skip the browser's HTTP cache, which GitHub Pages
// lets keep files for ten minutes. Without that, a deploy could be saved or
// served as a new script.js next to an older index.html.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE)
            .then((cache) =>
                cache.addAll(FILES.map((file) => new Request(file, { cache: 'reload' })))
            )
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
            )
            .then(() => self.clients.claim())
    );
});

function fromNetwork(request) {
    return fetch(request, { cache: 'no-cache' }).then((response) => {
        if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
    });
}

// ignoreSearch: the page URL may carry a query string.
const fromCache = (request) => caches.match(request, { ignoreSearch: true });

// After a request times out, the network counts as slow for this long: the
// page's other files then come from the cache at once instead of each
// waiting out its own timeout. A response within the timeout ends it early.
// The worker may be stopped between loads, which only resets this.
const SLOW_PERIOD = 30000; // ms
let slowUntil = 0;

// Whichever comes first: the network, or after NETWORK_TIMEOUT (at once
// while the network counts as slow) the saved copy. With no saved copy,
// keep waiting for the network. When the network fails outright, use the
// saved copy at once.
function networkFirst(request) {
    const started = Date.now();
    const network = fromNetwork(request);
    network
        .then(() => {
            if (Date.now() - started < NETWORK_TIMEOUT) slowUntil = 0;
        })
        .catch(() => {});
    const isSlow = started < slowUntil;
    const timedOut = new Promise((resolve) =>
        setTimeout(resolve, isSlow ? 0 : NETWORK_TIMEOUT)
    ).then(() =>
        fromCache(request).then((cached) => {
            if (!cached) return network;
            if (!isSlow) slowUntil = Date.now() + SLOW_PERIOD;
            return cached;
        })
    );
    const failed = network.catch(() =>
        fromCache(request).then((cached) => cached || Response.error())
    );
    return Promise.race([failed, timedOut]);
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
    event.respondWith(networkFirst(request));
});
