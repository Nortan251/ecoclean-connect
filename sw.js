/* ============================================================================
 * sw.js — EcoClean Connect service worker (robust offline + performance layer)
 * ----------------------------------------------------------------------------
 * This worker decides, request-by-request, HOW to serve each resource. Picking
 * the right *caching strategy* per resource type is the core of offline-first
 * engineering. We use these strategies, chosen by what the resource is:
 *
 *   NETWORK-FIRST   -> live data (/api/*) AND same-origin app assets (css/js/
 *                      images). We learned the hard way that stale-while-
 *                      revalidate for app code can leave a tab showing OLD code
 *                      (e.g. a half-translated UI) for several loads after a
 *                      deploy; network-first guarantees the latest code on the
 *                      next load, while still falling back to the cache offline.
 *
 *   CACHE-FIRST     -> versioned CDN libraries (Leaflet, chart.js, exif-js ...).
 *                      These URLs never change, so we serve the cached copy and
 *                      only hit the network on the very first visit.
 *
 *   BOUNDED CACHE   -> map tiles. Cache-first so a panned area still shows
 *                      offline, BUT capped to MAX_TILES with oldest-first eviction
 *                      so the tile cache can't exhaust the storage quota.
 *
 * We also call skipWaiting() + clients.claim() so a new deploy takes control of
 * already-open tabs quickly (a single reload then shows the fresh code).
 * ==========================================================================*/

const SHELL = 'ecoclean-shell-v12';   // same-origin app shell (pre-cached on install)
const RUNTIME = 'ecoclean-runtime-v12'; // CDN libs + live-data cache + misc runtime gets
const TILES = 'ecoclean-tiles-v11';   // map tiles, size-bounded
const MAX_TILES = 400;               // cap so offline map tiles can't blow the quota

// Pre-cache the whole same-origin app shell (every module => complete offline-first).
// IMPORTANT: only same-origin URLs go here, because addAll() is all-or-nothing — a
// single unreachable CDN file at install time would abort the whole installation.
// CDN libs (incl. markercluster and the Supabase realtime client) are cached lazily
// at runtime by the cache-first rule.
const SHELL_ASSETS = [
  './', './index.html', './dashboard.html', './admin.html',
  './css/styles.css', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png',
  './js/i18n.js', './js/ecoclean-addons.js', './js/app.js',
  './js/camera-location.js', './js/validation.js', './js/photo-trust.js', './js/photo-quality.js', './js/dup-detect.js', './js/trust-system.js',
  './js/map-sync.js', './js/cluster.js', './js/heatmap.js', './js/map-place.js',
  './js/compare.js', './js/map-filter.js', './js/realtime.js', './js/install-prompt.js',
  './js/offline-submit.js', './js/opening.js', './js/landing-fx.js', './js/thankyou.js',
  './js/share.js', './js/offline-banner.js', './js/a11y.js', './js/auth.js',
  './js/account-ui.js', './js/static-i18n.js', './js/export-data.js',
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
  if (url.hostname.includes('tile.openstreetmap.org') || url.hostname.includes('basemaps.cartocdn.com'))
                                                        return e.respondWith(cacheFirstBounded(req, TILES, MAX_TILES));
  if (url.hostname === 'unpkg.com' || url.hostname.endsWith('.jsdelivr.net'))
                                                        return e.respondWith(cacheFirst(req, RUNTIME));
  if (req.mode === 'navigate')                          return e.respondWith(networkFirst(req, SHELL, './index.html'));
  e.respondWith(networkFirst(req, RUNTIME));            // same-origin assets: fresh online, cache offline
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
 * After every new write we trim the cache back to MAX. Without the cap, panning
 * the whole city would store tens of thousands of tiles and hit the storage
 * quota, after which the browser would evict our *whole* cache. Bounding it
 * guarantees the app shell + data always survive. Cache.keys() is insertion
 * order, so deleting from the head drops the oldest tiles first (LRU-ish). */
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

/* Drop the oldest entries until the cache is at or below `max`. */
async function trimCache(c, max) {
  const keys = await c.keys();
  if (keys.length <= max) return;
  const drop = keys.length - max;
  for (let i = 0; i < drop; i++) await c.delete(keys[i]);
}
