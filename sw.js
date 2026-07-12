// IMPORTANT: bump this version string with every app update (even small ones).
// The browser only detects a new service worker by diffing this file's content —
// if this string doesn't change, updates to index.html can go undetected for a long
// time, since the cache-first fetch strategy below keeps serving old cached content.
const CACHE = 'soe-v13';
const FONTS_CACHE = 'soe-fonts-v1';

// App shell: everything needed to load and run the app fully offline.
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== FONTS_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Google Fonts: cache separately with a long-lived cache, since font files rarely change.
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(FONTS_CACHE).then(c =>
        c.match(e.request).then(r => r || fetch(e.request).then(res => {
          c.put(e.request, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  // Everything else (app shell, icons, manifest): cache-first, falling back to network,
  // and finally falling back to the cached index.html if both the network and a specific
  // cache entry are unavailable (e.g. cold-starting the app while fully offline).
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const resClone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, resClone));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
