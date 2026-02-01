const CACHE_NAME = 'toolkit-v2';
const ASSETS = [
  '/CookBook/',
  '/CookBook/index.html',
  '/CookBook/manifest.json',
  '/CookBook/icon-192.png',
  '/CookBook/icon-512.png',
  '/CookBook/cookbook/',
  '/CookBook/cookbook/index.html',
  '/CookBook/cookbook/manifest.json',
  '/CookBook/splitly/',
  '/CookBook/splitly/index.html',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        const fetched = fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetched;
      })
  );
});
