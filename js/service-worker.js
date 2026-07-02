/* ============================================================
   FRIDAY — Service Worker
   Cache-first strategy for offline PWA support
   ============================================================ */

const CACHE_NAME = 'friday-v3';
const SERVICE_WORKER_PATH = '/js/service-worker.js';
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasExpectedPath = self.location.pathname.endsWith(SERVICE_WORKER_PATH);
if (!hasExpectedPath) {
  console.warn(`[Friday][service-worker] Unexpected registration path: ${self.location.pathname}`);
}
const RAW_APP_ROOT = self.location.pathname
  .replace(new RegExp(`${escapeRegExp(SERVICE_WORKER_PATH)}$`), '')
  .replace(/\/$/, '');
const APP_ROOT = RAW_APP_ROOT === '/' ? '' : RAW_APP_ROOT;
const withRoot = path => {
  const normalizedPath = path === '/' ? '/' : path.startsWith('/') ? path : `/${path}`;
  return `${APP_ROOT}${normalizedPath}`;
};

const PRECACHE_ASSETS = [
  withRoot('/'),
  withRoot('/index.html'),
  withRoot('/css/style.css'),
  withRoot('/js/app.js'),
  withRoot('/manifest.webmanifest'),
  withRoot('/icons/icon-192.png'),
  withRoot('/icons/icon-512.png'),
  withRoot('/icons/icon.svg'),
];

/* ── Install: pre-cache all shell assets ─────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: remove stale caches ──────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: cache-first, fall back to network ────────────── */
self.addEventListener('fetch', event => {
  // Only handle GET requests for same-origin assets
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Cache valid same-origin responses
        if (
          response.ok &&
          response.type === 'basic' &&
          event.request.url.startsWith(self.location.origin)
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback — return cached index for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match(withRoot('/index.html'));
        }
      });
    })
  );
});
