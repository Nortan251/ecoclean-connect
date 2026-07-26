/* ============================================================================
 * dup-detect.js — near-duplicate report warning (ADDITIVE, no app.js edits)
 * ----------------------------------------------------------------------------
 * Crowdsourcing is healthiest when the SAME dirty site reported by three people
 * surfaces fast — but the SAME person re-submitting the same photo 5 m away, or a
 * stale re-report of a site that was cleaned yesterday, just creates noise and
 * wastes reviewer + storage budget. We can't (and shouldn't) BLOCK a second
 * report of a real problem, so this module is a NON-BLOCKING advisory: when the
 * pinned location is within DUP_RADIUS_M of an EXISTING report created in the
 * last DUP_WINDOW_DAYS, we show a friendly "a report already exists ~X m away"
 * note and let the user decide.
 *
 * HOW WE HOOK (the capture-phase pattern, same as validation.js)
 * --------------------------------------------------------------
 * We listen on `document` for `input`/`change` (location edits) and `submit`
 * with capture=true, so we run BEFORE app.js's bubble-phase handler and before
 * any native submit. We never call stopPropagation on submit — the warning is
 * purely informational, so the report still goes through. We own a dedicated
 * message node (#dupMsg) injected after the location row, fully decoupled from
 * app.js's #formMsg and validation.js's #validationMsg.
 *
 * THE ALGORITHM — Haversine great-circle distance
 * -----------------------------------------------
 * For each existing report we compute the surface distance between two
 * (lat,lng) points on a sphere of radius R=6371 km. Flat-earth Euclidean
 * distance would be wrong here because one degree of longitude shrinks toward
 * the poles; Haversine is exact enough for metres-scale work and branch-free
 * cheap. EcoClean.reports (kept by ecoclean-addons.js / map-sync.js) is the
 * in-memory mirror of /api/reports, so we compare against the live dataset
 * with ZERO extra network call. We scan the whole list (a few hundred reports
 * at most) — O(n) per check is fine; a spatial index would be over-engineering
 * at this scale.
 *
 * TIME WINDOW: we parse created_at (ISO 8601) and ignore reports older than
 * DUP_WINDOW_DAYS, because a site cleaned weeks ago is legitimately reportable
 * again if pollution returns.
 * ==========================================================================*/
(function () {
  'use strict';

  /* ---- policy constants (single source of truth) -------------------------- */
  var DUP_RADIUS_M   = 120;     // "same spot" radius in metres
  var DUP_WINDOW_DAYS = 14;     // only consider reports this recent
  var DUP_LS_KEY     = 'dupDismissedAt'; // not used to block, only to debounce

  /* ---- localized strings -------------------------------------------------- */
  var STR = {
    en: { near: 'A report already exists ~{m} m from here ({cat}, {d}d ago). You can still add yours if the situation is new or different.', none: '' },
    fr: { near: 'Un signalement existe déjà à ~{m} m d’ici ({cat}, il y a {d} j). Vous pouvez ajouter le vôtre si la situation est nouvelle ou différente.', none: '' },
    ar: { near: 'يوجد بلاغ بالفعل على بُعد ~{m} م من هنا ({cat}، قبل {d} يوم). يمكنك إضافة بلاغك إذا كانت الحالة جديدة أو مختلفة.', none: '' },
  };
  var lang = function () { return (typeof window.getLang === 'function' ? getLang() : 'en'); };
  var tset = function () { return STR[lang()] || STR.en; };
  var fill = function (s, o) { return String(s).replace(/\{(\w+)\}/g, function (_, k) { return (k in o ? o[k] : ''); }); };
  var catName = function (k) { return (typeof window.catLabel === 'function' ? window.catLabel(k) : k); };

  /* ---- Haversine distance in metres (essay reference implementation) ------ */
  function distanceM(lat1, lng1, lat2, lng2) {
    if (typeof window.EcoGeo === 'object' && typeof window.EcoGeo.distanceKm === 'function') {
      return window.EcoGeo.distanceKm(lat1, lng1, lat2, lng2) * 1000;
    }
    var R = 6371000, toRad = Math.PI / 180;
    var dLat = (lat2 - lat1) * toRad, dLng = (lng2 - lng1) * toRad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function ageDays(iso) {
    if (!iso) return Infinity;
    var t = Date.parse(iso);
    if (isNaN(t)) return Infinity;
    return (Date.now() - t) / 86400000;
  }

  /* Find the closest recent report within the radius, or null. */
  function findNear(lat, lng) {
    var list = (window.EcoClean && window.EcoClean.reports) || [];
    var best = null, bestD = DUP_RADIUS_M;
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (r.lat == null || r.lng == null) continue;
      if (ageDays(r.createdAt) > DUP_WINDOW_DAYS) continue; // too old to count
      var d = distanceM(lat, lng, +r.lat, +r.lng);
      if (d < bestD) { bestD = d; best = r; }
    }
    return best ? { report: best, meters: Math.round(bestD) } : null;
  }

  /* ---- dedicated message node (additive DOM, decoupled) ------------------- */
  var msgEl = null;
  function ensureMsgEl() {
    if (msgEl) return msgEl;
    var locRow = document.querySelector('#reportForm .loc-row');
    if (!locRow) return null;
    msgEl = document.createElement('p');
    msgEl.className = 'form-msg';
    msgEl.id = 'dupMsg';
    msgEl.style.color = '#b06b00'; // amber-ish advisory, never red (non-blocking)
    locRow.insertAdjacentElement('afterend', msgEl);
    return msgEl;
  }
  function show(text) { var el = ensureMsgEl(); if (el) { el.textContent = text; el.hidden = !text; } }

  function recheck() {
    var form = document.getElementById('reportForm');
    if (!form) return;
    var lat = parseFloat(form.lat && form.lat.value), lng = parseFloat(form.lng && form.lng.value);
    if (!isFinite(lat) || !isFinite(lng)) { show(''); return; }
    var hit = findNear(lat, lng);
    if (!hit) { show(''); return; }
    var d = Math.max(1, Math.round(hit.report.createdAt ? ageDays(hit.report.createdAt) : 0));
    show('ℹ️ ' + fill(tset().near, { m: hit.meters, cat: catName(hit.report.category), d: d }));
  }

  /* Listen for any location change (manual entry OR "use my location"). */
  document.addEventListener('input', function (e) {
    if (e.target && e.target.form && e.target.form.id === 'reportForm' &&
        (e.target.name === 'lat' || e.target.name === 'lng')) recheck();
  }, true);
  /* camera-location.js / map-place.js write .value then dispatch 'change'. */
  document.addEventListener('change', function (e) {
    if (e.target && e.target.form && e.target.form.id === 'reportForm' &&
        (e.target.name === 'lat' || e.target.name === 'lng')) recheck();
  }, true);
  /* Re-run once the in-memory report list (re)loads, so a freshly synced report
   * is reflected even if the user typed the coords before the data arrived. */
  document.addEventListener('ecoclean:data', recheck);

  /* On submit: refresh the note (informational only — we do NOT block). */
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'reportForm') recheck();
  }, true);

  /* Clear the note when the modal closes / form resets. */
  document.addEventListener('ecoclean:reported', function () { show(''); });

  window.EcoDup = { findNear: findNear, distanceM: distanceM, DUP_RADIUS_M: DUP_RADIUS_M, DUP_WINDOW_DAYS: DUP_WINDOW_DAYS };
})();
