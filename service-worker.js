// Development-friendly service worker: force network first for critical assets
const CACHE_NAME = 'shift-salary-dev-' + Date.now();
const FILES = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './service-worker.js'];

self.addEventListener('install', event => {
  // populate cache but don't rely on it; ensure new SW activates immediately
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // delete old caches
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => { if (key !== CACHE_NAME) return caches.delete(key); })))
  );
  self.clients.claim();
});

function networkFirst(event) {
  return fetch(event.request).then(response => {
    try { const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)); } catch (e) {}
    return response;
  }).catch(() => caches.match(event.request));
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // For CSS/JS/HTML prefer network-first to avoid stale cached styles during development
  if (url.pathname.endsWith('.css') || url.pathname.endsWith('.js') || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(networkFirst(event));
    return;
  }
  // otherwise default to cache-first then network
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { try { const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)); } catch (e) {} return response; }).catch(() => cached)));
});

// Allow page to message the SW to skip waiting (future use)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
