/* ============================================================================
 * impact.js — the PUBLIC IMPACT page (the committee / association-facing view)
 * ----------------------------------------------------------------------------
 * This is the page you put in front of a funding committee or a partner
 * association: live, OPEN proof that the platform works at a civic scale. It is
 * deliberately a STANDALONE page (no accounts, no report form) that reads only
 * public endpoints (/api/stats + /api/reports), so it is safe to share as a link
 * and trivial to embed in a deck. It reuses the shared theme (theme.js) and the
 * shared trilingual dictionary (i18n.js) so it matches the rest of the app and
 * flips EN/FR/AR + light/dark with zero extra work.
 *
 * Sections, top to bottom:
 *   1. animated KPI counters (count-up, honouring prefers-reduced-motion);
 *   2. a pure-CSS horizontal bar chart of reports by category (no chart lib —
 *      keeps the page dependency-light and fast on Moroccan 4G);
 *   3. a before/after GALLERY of verified clean-ups (reuses the .ba-slider markup
 *      + drag wiring from compare.js, inlined so the page stays standalone);
 *   4. a read-only Leaflet map (CARTO light tiles; dark tiles in dark mode) of
 *      verified sites — proof on a map, not just numbers;
 *   5. a PARTNER call-to-action (mailto, prefilled) — the actual "ask".
 * The kg-removed figure is an ESTIMATE; we print its methodology verbatim from
 * /api/stats (transparency > false precision when you're asking for trust).
 * ==========================================================================*/
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lang = function () { return (typeof window.getLang === 'function' ? getLang() : 'en'); };
  var T = function (k) { return (typeof window.t === 'function') ? window.t(k) : k; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
  var ICONS = { illegal_dumping: '🗑️', water: '💧', air_smoke: '💨', plastic_marine: '🌊', other: '📍' };
  // Fixed, intentional framing on Agadir (the demo city). We deliberately do NOT
  // fitBounds: with a small, tight point set + a container that finishes sizing
  // late, Leaflet's auto-zoom can jump to a wrong region (it once showed Marrakesh).
  // A fixed city view is deterministic and reads as "this is Agadir's data" — which
  // is exactly the story an association needs to see.
  var AGADIR = [30.421, -9.598];
  var stats = null, reports = [], map = null, layer = null;

  function countUp(el, to, suffix) {
    suffix = suffix || '';
    if (reduce || to <= 0) { el.textContent = to + suffix; return; }
    var dur = 1100, t0 = performance.now();
    (function step(t) {
      var k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))) + suffix;
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  function renderKPIs() {
    var box = document.getElementById('impKpis'); if (!box || !stats) return;
    var cards = box.querySelectorAll('.imp-kpi');
    cards.forEach(function (c) { c.classList.remove('skel-card'); });
    // Empty (post-reset / fresh deploy): turn the counter row into an honest
    // "this is a live demo, here's what it'll show" banner. The how-it-works +
    // network + map sections below still render, so the page keeps its value.
    if (!(stats.total || 0)) {
      box.className = 'imp-kpis imp-empty-hero';
      box.innerHTML = '<div class="ieh-i">🌍</div><h3 class="ieh-t"></h3><p class="ieh-s"></p>';
      box.querySelector('.ieh-t').textContent = T('empty_impact_title');
      box.querySelector('.ieh-s').textContent = T('empty_impact_sub');
      var m = document.getElementById('impMethod'); if (m) m.textContent = stats.kgMethod || '';
      return;
    }
    box.className = 'imp-kpis';
    var vals = [stats.total || 0, stats.verified || 0, stats.kgRemoved || 0, stats.citizens || 0];
    var suffixes = ['', '', ' kg', ''];
    cards.forEach(function (c, i) {
      c.querySelector('.l').textContent = T(['kpi_total', 'kpi_cleaned', 'kpi_kg', 'kpi_citizens'][i]);
      countUp(c.querySelector('.n'), vals[i], suffixes[i]);
    });
    var m = document.getElementById('impMethod'); if (m) m.textContent = stats.kgMethod || '';
    var u = document.getElementById('impUpdated'); if (u) u.textContent = new Date().toLocaleString();
  }

  function renderCats() {
    var box = document.getElementById('impCats'); if (!box || !stats) return;
    var bc = stats.byCategory || {};
    // Only draw categories that actually have reports — zero-bars read as clutter /
    // "broken" when the dataset is thin. Fall back to a single honest line otherwise.
    var rows = Object.keys(bc).filter(function (k) { return bc[k] > 0; });
    if (!rows.length) { box.innerHTML = '<p class="imp-empty">' + esc(T('no_reports')) + '</p>'; return; }
    var max = Math.max.apply(null, rows.map(function (k) { return bc[k]; }));
    box.innerHTML = rows.map(function (k) {
      var pct = Math.round((bc[k] / max) * 100);
      return '<div class="imp-bar"><span class="imp-bar-l">' + (ICONS[k] || '') + ' ' + esc((typeof window.catLabel === 'function') ? window.catLabel(k) : k) + '</span>' +
        '<div class="imp-bar-track"><div class="imp-bar-fill" style="width:' + (reduce ? pct : 0) + '%"></div></div>' +
        '<b class="imp-bar-v">' + bc[k] + '</b></div>';
    }).join('');
    if (!reduce) requestAnimationFrame(function () {
      box.querySelectorAll('.imp-bar-fill').forEach(function (f, i) {
        var pct = Math.round((bc[rows[i]] / max) * 100);
        setTimeout(function () { f.style.width = pct + '%'; }, 60 * i);
      });
    });
  }

  /* "How it works" — the operating MODEL an association needs to understand
   * (citizen reports -> association verifies -> city sees impact). Replaces the
   * before/after gallery, which is parked until the platform runs with real photos. */
  function renderHow() {
    var box = document.getElementById('impHow'); if (!box) return;
    var steps = [
      ['📍', T('impact_step1_t'), T('impact_step1_d')],
      ['✅', T('impact_step2_t'), T('impact_step2_d')],
      ['📈', T('impact_step3_t'), T('impact_step3_d')],
    ];
    box.innerHTML = steps.map(function (s, i) {
      return '<div class="imp-step"><div class="imp-step-n">' + (i + 1) + '</div><div class="imp-step-i">' + s[0] + '</div><h3>' + esc(s[1]) + '</h3><p>' + esc(s[2]) + '</p></div>';
    }).join('');
  }

  function tileUrl() {
    var dark = (window.EcoTheme && EcoTheme.get && EcoTheme.get() === 'dark');
    return dark ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  }
  function renderMap() {
    var el = document.getElementById('impMap'); if (!el || !window.L) return;
    if (!map) {
      map = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView(AGADIR, 12);
      layer = L.tileLayer(tileUrl(), { maxZoom: 19, attribution: '© OpenStreetMap © CARTO' }).addTo(map);
      // Container may report 0 size before CSS layout settles; invalidate so tiles +
      // view compute against the real box (the usual cause of a mis-zoomed map).
      setTimeout(function () { if (map) map.invalidateSize(); }, 0);
      setTimeout(function () { if (map) map.invalidateSize(); }, 250);
    }
    var pts = reports.filter(function (r) { return r.status === 'verified' && r.lat != null && r.lng != null; });
    if (layer._impMarkers) layer._impMarkers.forEach(function (m) { map.removeLayer(m); });
    layer._impMarkers = pts.map(function (r) {
      var mk = L.circleMarker([r.lat, r.lng], { radius: 7, color: '#198754', fillColor: '#2fd089', fillOpacity: 0.95, weight: 2 });
      mk.bindPopup('<b>' + esc((typeof window.catLabel === 'function') ? window.catLabel(r.category) : r.category) + '</b> ✅');
      mk.addTo(map); return mk;
    });
    map.setView(AGADIR, 12, { animate: false });   // deterministic city view every render
    setTimeout(function () { if (map) map.invalidateSize(); }, 200);
  }
  // Rebuild the tile layer on theme change so dark tiles actually load (setUrl alone
  // can leave a half-swapped layer on some WebViews).
  function applyThemeTiles() {
    if (!map) return;
    if (layer) { map.removeLayer(layer); }
    layer = L.tileLayer(tileUrl(), { maxZoom: 19, attribution: '© OpenStreetMap © CARTO' }).addTo(map);
  }

  function wirePartner() {
    var a = document.getElementById('impPartner'); if (!a) return;
    var subj = encodeURIComponent('Partnership — EcoClean Connect');
    var bodyTxt = encodeURIComponent('Hello,\n\nWe would like to bring EcoClean Connect to our city / association.\n\nOrganisation:\nCity:\nContact:\n\nThank you.');
    a.href = 'mailto:contact@ecoclean-connect.org?subject=' + subj + '&body=' + bodyTxt;
  }

  function renderNet() {
    var el = document.getElementById('impNet'); if (!el) return;
    // Bulletproof: ALWAYS fill the strip (even before/without stats) so it can never
    // render as an empty, invisible box. With zero partners we hide the "0 · 0"
    // count (which looked broken) and show a clean prompt instead.
    var link = '<span class="imp-net-lk">' + esc(T('impact_net_link')) + '</span>';
    var orgs = stats ? (stats.associations || []).length : 0;
    if (orgs > 0) {
      var cities = new Set((stats.associations || []).map(function (a) { return a.city; })).size || orgs;
      el.innerHTML = esc(T('impact_net').replace('{cities}', cities).replace('{orgs}', orgs)) + ' ' + link;
    } else {
      el.innerHTML = esc(T('impact_net_none')) + ' ' + link;
    }
  }

  function renderStatic() { renderKPIs(); renderCats(); renderHow(); renderNet(); }

  function load() {
    var base = (typeof window.getLang === 'function') ? getLang() : 'en';
    if (typeof window.applyI18n === 'function') window.applyI18n(document);
    Promise.all([
      fetch('/api/stats', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }),
      fetch('/api/reports', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : []; }),
    ]).then(function (res) {
      stats = res[0] || { total: 0, reported: 0, verified: 0, byCategory: {}, kgRemoved: 0, citizens: 0 };
      reports = res[1] || [];
      renderStatic(); renderMap(); wirePartner();
    }).catch(function () { renderStatic(); });
  }

  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'langSelect') { if (typeof window.setLang === 'function') window.setLang(e.target.value); load(); } });
  document.addEventListener('ecoclean:theme', function () { applyThemeTiles(); });

  if (!document.getElementById('eco-impact-style')) {
    var st = document.createElement('style'); st.id = 'eco-impact-style';
    st.textContent =
      '.impact{max-width:1000px;margin:0 auto;padding:22px 18px 60px;}' +
      '.imp-hero{text-align:center;padding:34px 14px 18px;}' +
      '.imp-badge{display:inline-block;background:var(--accent-soft,#e8f3ec);color:var(--accent-dark,#0a5c3f);font-weight:800;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;padding:6px 14px;border-radius:999px;}' +
      '.imp-hero h1{margin:14px 0 8px;font-size:clamp(1.6rem,5vw,2.6rem);font-weight:800;letter-spacing:-.02em;color:var(--text,#14241d);}' +
      '.imp-hero p{max-width:640px;margin:0 auto;color:var(--muted,#5d7268);font-size:1.02rem;line-height:1.6;}' +
      '.imp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:26px 0;}' +
      '.imp-empty-hero{display:block!important;text-align:center;background:var(--surface,#fff);border:1px solid var(--border,#e3ece7);border-radius:18px;padding:30px 20px;box-shadow:var(--shadow,0 6px 18px rgba(16,40,30,.06));}' +
      '.imp-empty-hero .ieh-i{font-size:2.4rem;}.imp-empty-hero .ieh-t{margin:8px 0 6px;font-size:1.3rem;font-weight:800;color:var(--text,#14241d);}' +
      '.imp-empty-hero .ieh-s{margin:0 auto;max-width:560px;color:var(--muted,#5d7268);font-size:.95rem;line-height:1.6;}' +
      '.imp-kpi{background:var(--surface,#fff);border:1px solid var(--border,#e3ece7);border-radius:18px;padding:20px 12px;text-align:center;box-shadow:var(--shadow,0 6px 18px rgba(16,40,30,.06));}' +
      '.imp-kpi .n{font-size:clamp(1.5rem,5vw,2.3rem);font-weight:800;background:linear-gradient(135deg,var(--accent,#198754),var(--accent-2,#0d9488));-webkit-background-clip:text;background-clip:text;color:transparent;line-height:1.1;}' +
      '.imp-kpi .l{margin-top:6px;font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#5d7268);}' +
      '.skel-card{position:relative;overflow:hidden;}.skel-card .n,.skel-card .l{visibility:hidden;}' +
      '.skel-card::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(var(--accent-rgb,25,135,84),.10),transparent);transform:translateX(-100%);animation:imp-shim 1.2s infinite;}' +
      '@keyframes imp-shim{to{transform:translateX(100%);}}' +
      '.imp-net{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;text-align:center;margin:4px 0 18px;padding:13px 16px;min-height:24px;background:var(--accent-grad,linear-gradient(135deg,#198754,#0d9488));border:1px solid transparent;border-radius:14px;color:#fff;font-weight:700;font-size:.9rem;text-decoration:none;box-shadow:0 6px 16px rgba(13,148,136,.28);transition:transform .15s,box-shadow .15s;}' +
      '.imp-net:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(13,148,136,.36);}.imp-net .imp-net-lk{color:#fff;font-weight:800;text-decoration:underline;text-underline-offset:3px;}' +
      '.imp-block{margin:30px 0;}.imp-block h2{font-size:1.18rem;font-weight:800;color:var(--text,#14241d);margin:0 0 14px;}' +
      '.imp-cats{display:flex;flex-direction:column;gap:11px;}' +
      '.imp-bar{display:grid;grid-template-columns:130px 1fr 42px;align-items:center;gap:10px;}' +
      '.imp-bar-l{font-size:.82rem;font-weight:600;color:var(--text,#14241d);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.imp-bar-track{height:12px;background:var(--surface-2,#eef7f2);border-radius:99px;overflow:hidden;}' +
      '.imp-bar-fill{height:100%;background:linear-gradient(90deg,var(--accent,#198754),var(--accent-2,#0d9488));border-radius:99px;transition:width .9s cubic-bezier(.2,.8,.2,1);}' +
      '.imp-bar-v{font-weight:800;color:var(--text,#14241d);text-align:right;}' +
      '.imp-how{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}' +
      '.imp-step{position:relative;background:var(--surface,#fff);border:1px solid var(--border,#e3ece7);border-radius:16px;padding:20px 16px 16px;box-shadow:var(--shadow,0 6px 18px rgba(16,40,30,.06));}' +
      '.imp-step-n{position:absolute;top:-12px;left:16px;width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,var(--accent,#198754),var(--accent-2,#0d9488));color:#fff;display:grid;place-items:center;font-weight:800;font-size:.82rem;box-shadow:0 4px 10px rgba(13,148,136,.4);}' +
      '.imp-step-i{font-size:1.7rem;margin:6px 0 8px;}' +
      '.imp-step h3{margin:0 0 6px;font-size:1rem;font-weight:800;color:var(--text,#14241d);}' +
      '.imp-step p{margin:0;font-size:.85rem;color:var(--muted,#5d7268);line-height:1.55;}' +
      '.imp-demo-note{margin:14px 0 0;font-size:.78rem;color:var(--muted,#5d7268);background:var(--surface-2,#eef7f2);border:1px dashed var(--border-strong,#cfe2d8);border-radius:12px;padding:10px 14px;line-height:1.5;}' +
      '.imp-map{height:380px;border-radius:16px;overflow:hidden;border:1px solid var(--border,#e3ece7);box-shadow:var(--shadow,0 6px 18px rgba(16,40,30,.06));}' +
      /* dark-mode map polish: Leaflet ships the attribution + zoom as white boxes;
       * force them to the dark surfaces so the embedded map matches the theme. */
      'html[data-theme="dark"] .imp-map .leaflet-control-attribution{background:rgba(13,21,18,.82)!important;color:var(--muted,#93a89c)!important;}' +
      'html[data-theme="dark"] .imp-map .leaflet-control-attribution a{color:var(--accent-2,#22b8a6)!important;}' +
      'html[data-theme="dark"] .imp-map .leaflet-control-zoom a{background:var(--surface-2,#1d2a23)!important;color:var(--text,#e7f1ea)!important;border-color:var(--border,#2a3a31)!important;}' +
      'html[data-theme="dark"] .imp-map .leaflet-control-zoom a:hover{background:var(--surface-3,#24342b)!important;}' +
      'html[data-theme="dark"] .imp-map .leaflet-bar{box-shadow:0 1px 4px rgba(0,0,0,.5)!important;}' +
      '.imp-cta{margin:40px 0 18px;text-align:center;background:var(--header-grad,linear-gradient(135deg,rgba(25,135,84,.92),rgba(13,148,136,.92)));color:var(--on-header,#fff);border-radius:22px;padding:34px 22px;}' +
      '.imp-cta h2{color:#fff;margin:0 0 8px;font-size:1.5rem;}.imp-cta p{color:rgba(255,255,255,.92);max-width:560px;margin:0 auto 18px;line-height:1.6;}' +
      '.imp-cta .primary-btn{background:#fff;color:var(--accent-dark,#0a5c3f);box-shadow:0 8px 22px rgba(0,0,0,.22);}' +
      '.imp-method{font-size:.72rem;color:var(--muted,#5d7268);text-align:center;margin-top:8px;line-height:1.5;}' +
      '.imp-updated{font-size:.72rem;color:var(--muted,#5d7268);text-align:center;margin:4px 0 0;}' +
      /* inlined compare-slider styles (standalone page) */
      '.ba-slider{position:relative;width:200px;height:130px;overflow:hidden;border-radius:8px;margin:6px auto;user-select:none;-webkit-user-select:none;}' +
      '.ba-slider img{position:absolute;top:0;left:0;height:100%;object-fit:cover;}.ba-after{width:100%;}' +
      '.ba-before-wrap{position:absolute;top:0;left:0;bottom:0;width:50%;overflow:hidden;}.ba-before-wrap img{width:200px;max-width:none;}' +
      '.ba-handle{position:absolute;top:0;bottom:0;left:50%;width:3px;margin-left:-1.5px;background:#fff;box-shadow:0 0 4px rgba(0,0,0,.45);pointer-events:none;}' +
      '.ba-handle::after{content:"\\21C4";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;color:#0a5c3f;border-radius:50%;width:22px;height:22px;display:grid;place-items:center;font-size:12px;box-shadow:0 1px 4px rgba(0,0,0,.3);}' +
      '.ba-range{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:ew-resize;}' +
      '@media (max-width:680px){.imp-kpis{grid-template-columns:repeat(2,1fr);}.imp-bar{grid-template-columns:96px 1fr 36px;}.imp-how{grid-template-columns:1fr;}}' +
      '@media (max-width:400px){.imp-kpis{grid-template-columns:1fr;}}' +
      '@media (prefers-reduced-motion: reduce){.skel-card::after{animation:none;}.imp-bar-fill{transition:none;}}';
    document.head.appendChild(st);
  }

  function boot() { load(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
