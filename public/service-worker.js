const CACHE_NAME = 'pristonix-timesheet-v3';
const urlsToCache = [
    '/',
    '/index.html',
    '/login.html',
    '/css/style.css',
    '/css/login-style.css',
    '/css/modal-styles.css',
    '/css/activity-badges.css',
    '/css/timeslot-reminders.css',
    '/css/lunch-break.css',
    '/js/script.js',
    '/js/history.js'
];

// Install event - cache resources with error handling
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                // Cache files individually to avoid failing if one file is missing
                return Promise.allSettled(
                    urlsToCache.map(url =>
                        cache.add(url).catch(err => {
                            console.warn(`Failed to cache ${url}:`, err);
                            return null;
                        })
                    )
                );
            })
            .catch(err => {
                console.error('Cache installation failed:', err);
            })
    );
    // Skip waiting to activate immediately
    self.skipWaiting();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                return fetch(event.request);
            }
            )
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
