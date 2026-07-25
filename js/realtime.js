/* ============================================================================
 * realtime.js — live updates via Supabase Realtime (ADDITIVE)
 * ----------------------------------------------------------------------------
 * Opens a WebSocket subscription to Postgres changes on `reports` and `alerts`
 * so that when ANY device/admin writes, every other open tab updates within a
 * second — no polling, no reload. This is the "real-time" half of the backend.
 *
 * SECURITY MODEL (the important bit)
 * ----------------------------------
 * The browser connects with the PUBLIC anon key (fetched from /api/config). A
 * public key in client code is only safe because we enabled Row-Level Security
 * with READ-ONLY policies for the anon role (supabase/realtime-rls.sql). So even
 * though anyone can read the anon key, the worst they can do is read/subscribe —
 * they CANNOT write, because there is no write policy for anon. All writes still
 * go through our /api functions using the server-only service-role key (which
 * bypasses RLS and runs our validation). Realtime events are only delivered for
 * rows the anon role is allowed to SELECT, which is all of them (USING (true)).
 *
 * HOW IT PLUGS IN (no edits to app.js / dashboard.js / admin.js)
 * --------------------------------------------------------------
 * Those files are classic scripts, so their top-level functions (loadReports,
 * loadAlerts, the dashboard/admin `load`) are GLOBALS. On every change event we
 * simply re-run them (debounced) to re-render from the fresh server state — an
 * "invalidate & refetch" pattern that reuses the existing render pipeline,
 * including the clustering proxy. If /api/config or the plugin is unavailable we
 * do nothing and the existing 5s poll in map-sync.js keeps things eventually
 * consistent (graceful degradation).
 * ==========================================================================*/
(function () {
  'use strict';

  let refreshTimer = null;

  // Coalesce a burst of change events (e.g. an admin verifying several reports)
  // into a single re-render, so we don't hammer the API or thrash the map.
  function scheduleRefresh() {
    if (refreshTimer) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      const render = () => {
        if (typeof loadReports === 'function') loadReports();   // index.html map
        if (typeof loadAlerts === 'function') loadAlerts();     // index.html alerts
        // dashboard / admin live refresh. Admin's load() needs an admin session,
        // so only call it when the panel is actually shown (logged in).
        if (typeof load === 'function') {
          const panel = document.getElementById('panel');
          if (!panel || !panel.classList.contains('hidden')) {
            try { load(); } catch (e) { /* ignore */ }
          }
        }
      };
      // Refresh the shared reports cache FIRST so freshly-rendered markers get
      // tagged with their id (for the voting UI / recoloring), then render.
      if (window.EcoData && EcoData.load) EcoData.load().then(render).catch(render);
      else render();
    }, 300);
  }

  function subscribe(client, table) {
    client
      .channel('ecoclean-' + table)
      .on('postgres_changes', { event: '*', schema: 'public', table: table }, scheduleRefresh)
      .subscribe();
  }

  function boot(cfg) {
    if (!window.supabase || !cfg || !cfg.url || !cfg.anonKey) return; // inactive -> poll fallback
    let client;
    try { client = window.supabase.createClient(cfg.url, cfg.anonKey); }
    catch (e) { return; }
    subscribe(client, 'reports');
    subscribe(client, 'alerts');
  }

  function start() {
    fetch('/api/config', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(boot)
      .catch(() => {}); // config unreachable -> realtime off, polling still works
  }

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', start);
  else start();

  window.EcoRealtime = { refresh: scheduleRefresh };
})();
