const APP_CACHE_NAME = 'communes-app-cache-v401'; // NOUVELLE VERSION DU CACHE
const DATA_CACHE_NAME = 'communes-data-cache-v401'; // NOUVELLE VERSION DU CACHE
const TILE_CACHE_NAME = 'communes-tile-cache-v401'; // NOUVELLE VERSION DU CACHE

const APP_SHELL_URLS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './leaflet.min.js',
    './leaflet.css',
    './manifest.json',
    './suncalc.js',
    './jszip.min.js'
];

const DATA_URLS = [
    './communes.json'
];

self.addEventListener('install', event => {
    console.log(`[SW] Installation ${APP_CACHE_NAME}`);
    // La ligne ".then(() => self.skipWaiting())" a été supprimée ici pour une mise à jour plus sûre.
    event.waitUntil(
        Promise.all([
            caches.open(APP_CACHE_NAME).then(cache => cache.addAll(APP_SHELL_URLS)),
            caches.open(DATA_CACHE_NAME).then(cache => cache.addAll(DATA_URLS))
        ])
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => Promise.all(
            cacheNames.map(cacheName => {
                if (cacheName !== APP_CACHE_NAME && cacheName !== DATA_CACHE_NAME && cacheName !== TILE_CACHE_NAME) {
                    return caches.delete(cacheName);
                }
            })
        )).then(() => self.clients.claim())
    );
});

let db;

function getDb() {
    return new Promise((resolve, reject) => {
        if (db) return resolve(db);
        const request = indexedDB.open('OfflineTilesDB', 1);
        request.onsuccess = event => {
            db = event.target.result;
            resolve(db);
        };
        request.onerror = event => {
            reject('Erreur ouverture DB dans SW:', event.target.error);
        };
    });
}

function getTileFromDb(url) {
    return getDb().then(db => {
        return new Promise(resolve => {
            const transaction = db.transaction('tiles', 'readonly');
            const store = transaction.objectStore('tiles');
            const request = store.get(url);
            request.onsuccess = () => {
                resolve(request.result ? new Response(request.result.tile) : null);
            };
            request.onerror = () => resolve(null);
        });
    });
}

self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    if (requestUrl.hostname.includes('tile.openstreetmap.org')) {
        event.respondWith(
            getTileFromDb(event.request.url).then(responseFromDb => {
                if (responseFromDb) {
                    return responseFromDb;
                }
                return caches.open(TILE_CACHE_NAME).then(cache => {
                    return cache.match(event.request).then(cachedResponse => {
                        const fetchPromise = fetch(event.request).then(networkResponse => {
                            if (networkResponse.ok) {
                                cache.put(event.request, networkResponse.clone());
                            }
                            return networkResponse;
                        });
                        return cachedResponse || fetchPromise;
                    });
                });
            })
        );
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                return cachedResponse || fetch(event.request).catch(() => {
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});
