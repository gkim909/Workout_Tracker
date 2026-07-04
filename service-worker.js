// Bump APP_VERSION on EVERY deploy. A new version = a new cache that replaces the
// old one on activate, so iPhone home-screen installs can't get stuck on stale files.
const APP_VERSION = 'v1.33.2';
const CACHE_NAME = 'fittrack-' + APP_VERSION;

// Local app shell — must be cached for the app to work offline.
// Relative URLs resolve against the SW scope, so this works on GitHub Pages
// (/Workout_Tracker/) and on localhost without hardcoding a base path.
const CORE_ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './db.js',
    './manifest.json'
];

// Third-party assets — cached best-effort (a CDN hiccup must not break install).
const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

// Install: pre-cache the shell, bypassing the HTTP cache so GitHub Pages
// can't hand us stale files, then take over immediately.
self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(CORE_ASSETS.map((url) => new Request(url, { cache: 'reload' })));
        await Promise.all(CDN_ASSETS.map(async (url) => {
            try {
                await cache.add(new Request(url, { cache: 'reload' }));
            } catch (err) {
                // Offline/unreachable CDN should not block installation.
            }
        }));
        await self.skipWaiting();
    })());
});

// Activate: delete every cache that isn't the current version, then control all clients.
self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    // Navigations (the app shell): network-first so a fresh deploy always wins.
    // Falls back to the cached shell when offline. This is what prevents the
    // "stale HTML / refresh-crash" loop on the iOS home-screen app.
    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const fresh = await fetch(request);
                const cache = await caches.open(CACHE_NAME);
                cache.put(request, fresh.clone());
                return fresh;
            } catch (err) {
                return (await caches.match(request))
                    || (await caches.match('./index.html'))
                    || Response.error();
            }
        })());
        return;
    }

    // Everything else: cache-first for speed, fall back to network and cache same-origin GETs.
    event.respondWith((async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
            const fresh = await fetch(request);
            if (fresh && fresh.status === 200 && request.url.startsWith(self.location.origin)) {
                const cache = await caches.open(CACHE_NAME);
                cache.put(request, fresh.clone());
            }
            return fresh;
        } catch (err) {
            return Response.error();
        }
    })());
});
