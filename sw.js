// --- FICHIER sw.js AVEC suncalc.js ---

const APP_CACHE_NAME = 'communes-app-cache-v38'; // Version pour suncalc
const TILE_CACHE_NAME = 'communes-tile-cache-v1';
const DATA_CACHE_NAME = 'communes-data-cache-v1';

const APP_SHELL_URLS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './leaflet.min.js',
    './leaflet.css',
    './manifest.json',
    './suncalc.js' // NOUVEAU FICHIER AJOUTÉ À LA LISTE
];

const DATA_URLS = [
    './communes.json'
];

self.addEventListener('install', event => {
    console.log(`[SW] Installation ${APP_CACHE_NAME}`);
    event.waitUntil(
        Promise.all([
            caches.open(APP_CACHE_NAME).then(cache => cache.addAll(APP_SHELL_URLS)),
            caches.open(DATA_CACHE_NAME).then(cache => cache.addAll(DATA_URLS))
        ]).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => Promise.all(
            cacheNames.map(cacheName => {
                if (cacheName !== APP_CACHE_NAME && cacheName !== TILE_CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
                    return caches.delete(cacheName);
                }
            })
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    if (requestUrl.hostname.includes('tile.openstreetmap.org')) {
        event.respondWith(
            caches.open(TILE_CACHE_NAME).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        if (networkResponse.ok) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(err => {});
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).catch(error => {
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                    return new Response('', { status: 404, statusText: 'Not Found' });
                });
            })
    );
});
