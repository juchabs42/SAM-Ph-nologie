const CACHE = 'sam-pheno-phenology-observations-1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './supabase-config.js',
  './manifest.webmanifest',
  './logo-sudexpe.png',
  './logo-sam-pheno.png',
  './bouton-connexion.png',
  './favicon.ico?v=phenologie-4',
  './favicon.png?v=phenologie-4',
  './apple-touch-icon.png?v=phenologie-4',
  './icon-192.png?v=phenologie-4',
  './icon-512.png?v=phenologie-4'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (event.request.url.includes('open-meteo.com') || event.request.url.includes('supabase.co')) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
