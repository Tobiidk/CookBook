const CACHE_NAME = 'cookbook-v5';
const ASSETS = [
    '/CookBook/cookbook/',
    '/CookBook/cookbook/index.html',
    '/CookBook/cookbook/cookbook.css',
    '/CookBook/cookbook/cookbook.js',
    '/CookBook/cookbook/manifest.json',
    '/CookBook/shared/css/index.css',
    '/CookBook/shared/css/tokens.css',
    '/CookBook/shared/css/reset.css',
    '/CookBook/shared/css/layout.css',
    '/CookBook/shared/css/ambient.css',
    '/CookBook/shared/css/components/buttons.css',
    '/CookBook/shared/css/components/forms.css',
    '/CookBook/shared/css/components/modal.css',
    '/CookBook/shared/css/components/cards.css',
    '/CookBook/shared/css/components/tags.css',
    '/CookBook/shared/js/utils.js',
    '/CookBook/shared/js/modal.js',
    '/CookBook/icon-192.png',
    '/CookBook/icon-512.png',
    'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cached => {
            const fetched = fetch(event.request).then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => cached);
            return cached || fetched;
        })
    );
});
