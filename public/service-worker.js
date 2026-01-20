const CACHE_NAME = 'pristonix-timesheet-v4';
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
    // Skip caching for external resources (Google Fonts, CDNs, etc.)
    const url = new URL(event.request.url);
    const isExternal = url.origin !== location.origin;

    // For external resources, just fetch directly without caching
    if (isExternal) {
        event.respondWith(
            fetch(event.request).catch(err => {
                console.warn('External resource fetch failed:', event.request.url);
                // Return a basic response to prevent errors
                return new Response('', { status: 200 });
            })
        );
        return;
    }

    // For local resources, use cache-first strategy
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                // Fetch from network with error handling
                return fetch(event.request).catch(err => {
                    console.warn('Fetch failed for:', event.request.url, err);
                    // Return a basic error response
                    return new Response('Network error', {
                        status: 408,
                        statusText: 'Network request failed'
                    });
                });
            })
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
