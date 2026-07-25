/* ============================================================================
 * sw.js — EcoClean Connect service worker (robust offline + performance layer)
 * ----------------------------------------------------------------------------
 * This worker decides, request-by-request, HOW to serve each resource. Picking
 * the right *caching strategy* per resource type is the core of offline-first
 * engineering. We use four strategies, chosen by what the resource is:
 *
 *   NETWORK-FIRST   -> fresh live data (/api/*). Always try the network; if it
 *                      fails (offline), fall back to the last cached copy.
 *                      Correct for pollution reports: we want the newest pins,
 *                      but a stale map is better than an empty one when offline.
 *
 *   CACHE-FIRST     -> versioned CDN libraries (Leaflet, chart.js, exif-js ...).
 *                      These URLs never change, so we serve the cached copy and
 *                      only hit the network on the very first visit.
 *
 *   BOUNDED CACHE   -> OpenStreetMap map tiles. Cache-first so a panned area
 *                      still shows offline, BUT we cap the cache to MAX_TILES and
 *                      evict the oldest entries, otherwise the tile cache would
 *                      grow without bound and exhaust the browser's storage quota.
 *
 *   STALE-WHILE-    -> same-origin app assets (css/js/images). Show the cached
 *   REVALIDATE        copy *instantly*, then quietly refresh it in the background
 *                      so the next load is up to date. Fastest perceived load.
 *
 * We also call skipWaiting() + clients.claim() so a new deploy takes control of
 * already-open tabs immediately (users get fixes without a manual reload).
 * ==========================================================================*/

const SHELL = 'ecoclean-shell-v6';   // same-origin app shell (pre-cached on install)
const RUNTIME = 'ecoclean-runtime-v6'; // CDN libs + live-data cache + misc runtime gets
const TILES = 'ecoclean-tiles-v6';   // OSM tiles, size-bounded
const MAX_TILES = 400;               // cap so offline map tiles can't blow the quota

// Pre-cache the same-origin app shell. IMPORTANT: only same-origin URLs go here,
// because addAll() is all-or-nothing — a single unreachable CDN file at install
// time would abort the whole installation. CDN libs (incl. markercluster and the
// Supabase realtime client) are cached lazily at runtime by the cache-first rule.
const SHELL_ASSETS = [
  './', './index.html', './dashboard.html', './admin.html',
  './css/styles.css', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png',
  './js/i18n.js', './js/ecoclean-addons.js', './js/app.js',
  './js/camera-location.js', './js/validation.js', './js/trust-system.js',
  './js/map-sync.js', './js/cluster.js', './js/realtime.js', './js/install-prompt.js', './js/offline-submit.js', './js/thankyou.js',
  './js/dashboard.js', './js/rewards.js', './js/gamification.js', './js/analytics.js',
  './js/admin.js', './js/verification.js', './js/dispatch.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  const keep = [SHELL, RUNTIME, TILES];
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;          // never cache POSTs (report submit, verify)
  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  if (url.pathname.startsWith('/api/'))                 return e.respondWith(networkFirst(req, RUNTIME));
  if (url.hostname.includes('tile.openstreetmap.org'))  return e.respondWith(cacheFirstBounded(req, TILES, MAX_TILES));
  if (url.hostname === 'unpkg.com' || url.hostname.endsWith('.jsdelivr.net'))
                                                        return e.respondWith(cacheFirst(req, RUNTIME));
  if (req.mode === 'navigate')                          return e.respondWith(networkFirst(req, SHELL, './index.html'));
  e.respondWith(staleWhileRevalidate(req, RUNTIME));    // everything else (same-origin assets)
});

/* --- Strategy: NETWORK-FIRST ------------------------------------------------
 * Try the network; cache a successful same-origin response for offline reuse;
 * on any failure serve the cached copy, else an optional offline fallback page. */
async function networkFirst(req, cache, fallbackUrl) {
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') {
      const c = await caches.open(cache);
      c.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (fallbackUrl) { const fb = await caches.match(fallbackUrl); if (fb) return fb; }
    return new Response('You are offline', { status: 503, statusText: 'Offline' });
  }
}

/* --- Strategy: CACHE-FIRST --------------------------------------------------
 * Serve from cache; on a miss, fetch and cache the result. CDN libs return an
 * *opaque* response (status 0, cross-origin) so we accept res.ok OR opaque. */
async function cacheFirst(req, cache) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) {
      const c = await caches.open(cache);
      c.put(req, res.clone());
    }
    return res;
  } catch (err) {
    return new Response('', { status: 503 });
  }
}

/* --- Strategy: CACHE-FIRST + BOUNDED EVICTION (for tiles) -------------------
 * Same as cache-first, but after every new write we trim the cache back to MAX.
 * This is the key to making offline maps safe: without the cap, a user panning
 * the whole city would store tens of thousands of tiles and hit the storage
 * quota, after which the browser would evict our *whole* cache. By keeping the
 * tile cache bounded we guarantee the app shell + data always survive.
 * LRU-ish: Cache.keys() returns entries in insertion order, so deleting from the
 * head drops the oldest tiles first — an O(n) approximation of least-recently-used
 * that needs no extra index. (At production scale you'd trim only every N writes.) */
async function cacheFirstBounded(req, cache, max) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) {
      const c = await caches.open(cache);
      await c.put(req, res.clone());
      await trimCache(c, max);
    }
    return res;
  } catch (err) {
    return new Response('', { status: 503 });
  }
}

/* --- Strategy: STALE-WHILE-REVALIDATE ---------------------------------------
 * Hand back the cached copy immediately (zero latency), and fire a background
 * fetch that updates the cache for next time. Best perceived performance. */
async function staleWhileRevalidate(req, cache) {
  const c = await caches.open(cache);
  const cached = await c.match(req);
  const network = fetch(req).then((res) => {
    if (res && (res.ok || res.type === 'opaque' || res.type === 'basic')) c.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || network;
}

/* Drop the oldest entries until the cache is at or below `max`. */
async function trimCache(c, max) {
  const keys = await c.keys();
  if (keys.length <= max) return;
  const drop = keys.length - max;
  for (let i = 0; i < drop; i++) await c.delete(keys[i]);
}
