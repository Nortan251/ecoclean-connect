/* ============================================================================
 * offline-submit.js — make report submission work with NO signal (ADDITIVE)
 * ----------------------------------------------------------------------------
 * Problem: app.js submits a report with a plain fetch(). Offline, that fetch
 * throws and the user just sees "network error" — their on-site report is lost.
 * map-sync.js already ships an offline queue (window.EcoOffline) that drains on
 * the 'online' event, but nothing ever *feeds* it. We bridge that gap WITHOUT
 * editing app.js by wrapping window.fetch:
 *
 *   - If the request is POST /api/reports AND navigator.onLine is false, we DO
 *     NOT let the fetch fail. Instead we push the payload into EcoOffline.queue
 *     and hand the caller a SYNTHETIC 201 response. Because app.js only checks
 *     res.ok on the success path (it never reads the body there), the existing
 *     flow runs unchanged: the form resets, the modal closes, the success toast
 *     shows. The user gets instant "captured!" feedback even in a dead zone.
 *   - Every other request (GETs, other endpoints, online POSTs) passes straight
 *     through to the real fetch, so the service worker still owns offline *reads*.
 *
 * We also retry the queue on pageshow / visibilitychange, not only 'online', so
 * a report queued in a flaky moment drains as soon as the tab regains focus —
 * belt-and-braces on top of map-sync.js's own 'online' listener.
 *
 * Essay point: this is the *Offline-First / optimistic-UI* pattern. The client
 * treats the local queue as the source of truth at capture time and reconciles
 * with the server later, which is exactly how resilient field-data apps behave.
 * ==========================================================================*/
(function () {
  'use strict';

  const origFetch = window.fetch.bind(window);   // capture native fetch once

  function isReportPost(url, method) {
    try {
      const u = new URL(url, location.href);
      return (method || '').toUpperCase() === 'POST' && u.pathname === '/api/reports';
    } catch (e) { return false; }
  }

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = (init && init.method) || (typeof input === 'object' && input && input.method) || 'GET';

    if (isReportPost(url, method) && !navigator.onLine) {
      let payload = null;
      try { payload = JSON.parse((init && init.body) || '{}'); } catch (e) { payload = null; }
      if (payload && window.EcoOffline) window.EcoOffline.queue(payload);
      // Synthetic success: status 201, ok === true. app.js's success branch runs.
      return Promise.resolve(new Response(
        JSON.stringify({ queuedOffline: true, id: 'offline-' + Date.now() }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      ));
    }
    return origFetch(input, init);               // everything else is untouched
  };

  // Drain the queue on any sign that connectivity/UI has returned.
  const retry = () => { if (navigator.onLine && window.EcoOffline) window.EcoOffline.flush(); };
  window.addEventListener('online', retry);
  window.addEventListener('pageshow', retry);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) retry(); });
})();
