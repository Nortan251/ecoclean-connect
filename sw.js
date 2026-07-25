// EcoClean Connect — minimal service worker (app-shell cache)
const CACHE = 'ecoclean-v1';
const SHELL = [
  './',
  './index.html',
  './admin.html',
  './dashboard.html',
  './css/styles.css',
  './js/app.js',
  './js/admin.js',
  './js/dashboard.js',
  './manifest.json',
  './icon.svg',
];

self.addEventListener('install', (e) =>
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)))
);

self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
);

self.addEventListener('fetch', (e) => {
  // Network-first for live data; cache-first for the app shell.
  if (e.request.url.includes('/api/')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
  }
});
