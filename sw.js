// Service worker: works offline with the last loaded pages and data.
// App files: served from cache, refreshed in the background (a new deploy shows on the next load).
// Data (data/*.json, Open-Meteo): network first, cache only when offline.
// Bump VERSION when the list of app files changes.
const VERSION = 'v4';
const CACHE = 'teletekst-' + VERSION;

const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'fonts/PressStart2P-Regular.ttf',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'js/app.js',
  'js/teletext.js',
  'js/cities.js',
  'js/score.js',
  'js/weather.js',
  'js/data.js',
  'js/testcard.js',
  'js/pages/common.js',
  'js/pages/home.js',
  'js/pages/weather.js',
  'js/pages/money.js',
  'js/pages/football.js',
  'js/pages/extra.js'
];

const DATA_HOSTS = ['api.open-meteo.com', 'air-quality-api.open-meteo.com'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('teletekst-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(event.request, {ignoreSearch: true});
  const update = fetch(event.request).then(res => {
    if (res.ok) cache.put(event.request, res.clone());
    return res;
  });
  if (hit) {
    event.waitUntil(update.catch(() => {}));
    return hit;
  }
  return update;
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (DATA_HOSTS.includes(url.hostname) || (url.origin === location.origin && url.pathname.includes('/data/'))) {
    event.respondWith(networkFirst(event.request));
  } else if (url.origin === location.origin) {
    event.respondWith(staleWhileRevalidate(event));
  }
});
