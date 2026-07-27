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
  var MOROCCO = [31.7, -7.1];
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
    var vals = [stats.total || 0, stats.verified || 0, stats.kgRemoved || 0, stats.citizens || 0];
    var suffixes = ['', '', ' kg', ''];
    cards.forEach(function (c, i) {
      c.querySelector('.l').textContent = T(['kpi_total', 'kpi_cleaned', 'kpi_kg', 'kpi_citizens'][i]);
      countUp(c.querySelector('.n'), vals[i], suffixes[i]);
    });
    var m = document.getElementById('impMethod'); if (m) m.textContent = stats.kgMethod || '';
  }

  function renderCats() {
    var box = document.getElementById('impCats'); if (!box || !stats) return;
    var bc = stats.byCategory || {}, max = 1;
    Object.keys(bc).forEach(function (k) { if (bc[k] > max) max = bc[k]; });
    box.innerHTML = Object.keys(bc).map(function (k) {
      var pct = Math.round((bc[k] / max) * 100);
      return '<div class="imp-bar"><span class="imp-bar-l">' + (ICONS[k] || '') + ' ' + esc((typeof window.catLabel === 'function') ? window.catLabel(k) : k) + '</span>' +
        '<div class="imp-bar-track"><div class="imp-bar-fill" style="width:' + (reduce ? pct : 0) + '%"></div></div>' +
        '<b class="imp-bar-v">' + bc[k] + '</b></div>';
    }).join('');
    if (!reduce) requestAnimationFrame(function () {
      box.querySelectorAll('.imp-bar-fill').forEach(function (f, i) {
        var pct = Math.round((bc[Object.keys(bc)[i]] / max) * 100);
        setTimeout(function () { f.style.width = pct + '%'; }, 60 * i);
      });
    });
  }

  /* Inlined before/after slider (same DOM contract as compare.js) so the page
   * needs no other module. Drag = range input over a clipped before layer. */
  function slider(b, a) {
    return '<div class="ba-slider"><img class="ba-after" src="' + esc(a) + '" alt="after">' +
      '<div class="ba-before-wrap"><img class="ba-before" src="' + esc(b) + '" alt="before"></div>' +
      '<div class="ba-handle"></div><input type="range" min="0" max="100" value="50" class="ba-range" aria-label="compare"></div>';
  }
  function wireSlider(box) {
    var r = box.querySelector('.ba-range'), w = box.querySelector('.ba-before-wrap'), h = box.querySelector('.ba-handle');
    if (!r) return;
    var apply = function (v) { w.style.width = v + '%'; h.style.left = v + '%'; };
    r.addEventListener('input', function () { apply(r.value); }); apply(50);
  }
  function renderGallery() {
    var box = document.getElementById('impGallery'); if (!box) return;
    var items = reports.filter(function (r) { return r.status === 'verified' && r.beforePhoto && r.afterPhoto; }).slice(0, 12);
    if (!items.length) { box.innerHTML = '<p class="imp-empty"></p>'; box.querySelector('.imp-empty').textContent = T('impact_gal_empty'); return; }
    box.innerHTML = items.map(function (r) {
      return '<figure class="imp-gitem">' + slider(r.beforePhoto, r.afterPhoto) +
        '<figcaption>' + esc((typeof window.catLabel === 'function') ? window.catLabel(r.category) : r.category) + '</figcaption></figure>';
    }).join('');
    box.querySelectorAll('.ba-slider').forEach(wireSlider);
  }

  function tileUrl() {
    var dark = (window.EcoTheme && EcoTheme.get && EcoTheme.get() === 'dark');
    return dark ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  }
  function renderMap() {
    var el = document.getElementById('impMap'); if (!el || !window.L) return;
    if (!map) {
      map = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView(MOROCCO, 5);
      layer = L.tileLayer(tileUrl(), { maxZoom: 19, attribution: '© OpenStreetMap © CARTO' }).addTo(map);
    }
    if (window.EcoTheme && EcoTheme.setUrl) EcoTheme.setUrl(map);   // honour current theme
    var pts = reports.filter(function (r) { return r.status === 'verified' && r.lat != null && r.lng != null; });
    if (layer._impMarkers) layer._impMarkers.forEach(function (m) { map.removeLayer(m); });
    layer._impMarkers = pts.map(function (r) {
      var mk = L.circleMarker([r.lat, r.lng], { radius: 7, color: '#198754', fillColor: '#198754', fillOpacity: 0.9, weight: 2 });
      mk.bindPopup('<b>' + esc((typeof window.catLabel === 'function') ? window.catLabel(r.category) : r.category) + '</b> ✅');
      mk.addTo(map); return mk;
    });
    if (pts.length) {
      var b = L.latLngBounds(pts.map(function (r) { return [r.lat, r.lng]; }));
      if (b.isValid()) map.fitBounds(b.pad(0.25));
    }
    setTimeout(function () { map.invalidateSize(); }, 200);
  }

  function wirePartner() {
    var a = document.getElementById('impPartner'); if (!a) return;
    var subj = encodeURIComponent('Partnership — EcoClean Connect');
    var bodyTxt = encodeURIComponent('Hello,\n\nWe would like to bring EcoClean Connect to our city / association.\n\nOrganisation:\nCity:\nContact:\n\nThank you.');
    a.href = 'mailto:contact@ecoclean-connect.org?subject=' + subj + '&body=' + bodyTxt;
  }

  function renderStatic() { renderKPIs(); renderCats(); renderGallery(); }

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
  document.addEventListener('ecoclean:theme', function () { if (map && layer) { layer.setUrl(tileUrl()); } });

  if (!document.getElementById('eco-impact-style')) {
    var st = document.createElement('style'); st.id = 'eco-impact-style';
    st.textContent =
      '.impact{max-width:1000px;margin:0 auto;padding:22px 18px 60px;}' +
      '.imp-hero{text-align:center;padding:34px 14px 18px;}' +
      '.imp-badge{display:inline-block;background:var(--accent-soft,#e8f3ec);color:var(--accent-dark,#0a5c3f);font-weight:800;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;padding:6px 14px;border-radius:999px;}' +
      '.imp-hero h1{margin:14px 0 8px;font-size:clamp(1.6rem,5vw,2.6rem);font-weight:800;letter-spacing:-.02em;color:var(--text,#14241d);}' +
      '.imp-hero p{max-width:640px;margin:0 auto;color:var(--muted,#5d7268);font-size:1.02rem;line-height:1.6;}' +
      '.imp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:26px 0;}' +
      '.imp-kpi{background:var(--surface,#fff);border:1px solid var(--border,#e3ece7);border-radius:18px;padding:20px 12px;text-align:center;box-shadow:var(--shadow,0 6px 18px rgba(16,40,30,.06));}' +
      '.imp-kpi .n{font-size:clamp(1.5rem,5vw,2.3rem);font-weight:800;background:linear-gradient(135deg,var(--accent,#198754),var(--accent-2,#0d9488));-webkit-background-clip:text;background-clip:text;color:transparent;line-height:1.1;}' +
      '.imp-kpi .l{margin-top:6px;font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#5d7268);}' +
      '.skel-card{position:relative;overflow:hidden;}.skel-card .n,.skel-card .l{visibility:hidden;}' +
      '.skel-card::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(var(--accent-rgb,25,135,84),.10),transparent);transform:translateX(-100%);animation:imp-shim 1.2s infinite;}' +
      '@keyframes imp-shim{to{transform:translateX(100%);}}' +
      '.imp-block{margin:30px 0;}.imp-block h2{font-size:1.18rem;font-weight:800;color:var(--text,#14241d);margin:0 0 14px;}' +
      '.imp-cats{display:flex;flex-direction:column;gap:11px;}' +
      '.imp-bar{display:grid;grid-template-columns:130px 1fr 42px;align-items:center;gap:10px;}' +
      '.imp-bar-l{font-size:.82rem;font-weight:600;color:var(--text,#14241d);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.imp-bar-track{height:12px;background:var(--surface-2,#eef7f2);border-radius:99px;overflow:hidden;}' +
      '.imp-bar-fill{height:100%;background:linear-gradient(90deg,var(--accent,#198754),var(--accent-2,#0d9488));border-radius:99px;transition:width .9s cubic-bezier(.2,.8,.2,1);}' +
      '.imp-bar-v{font-weight:800;color:var(--text,#14241d);text-align:right;}' +
      '.imp-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;}' +
      '.imp-gitem{margin:0;background:var(--surface,#fff);border:1px solid var(--border,#e3ece7);border-radius:14px;overflow:hidden;box-shadow:var(--shadow,0 6px 18px rgba(16,40,30,.06));}' +
      '.imp-gitem .ba-slider{width:100%;height:160px;margin:0;border-radius:0;}' +
      '.imp-gitem figcaption{padding:8px 10px;font-size:.78rem;font-weight:700;color:var(--muted,#5d7268);}' +
      '.imp-empty{color:var(--muted,#5d7268);font-size:.9rem;}' +
      '.imp-map{height:380px;border-radius:16px;overflow:hidden;border:1px solid var(--border,#e3ece7);box-shadow:var(--shadow,0 6px 18px rgba(16,40,30,.06));}' +
      '.imp-cta{margin:40px 0 18px;text-align:center;background:var(--header-grad,linear-gradient(135deg,rgba(25,135,84,.92),rgba(13,148,136,.92)));color:var(--on-header,#fff);border-radius:22px;padding:34px 22px;}' +
      '.imp-cta h2{color:#fff;margin:0 0 8px;font-size:1.5rem;}.imp-cta p{color:rgba(255,255,255,.92);max-width:560px;margin:0 auto 18px;line-height:1.6;}' +
      '.imp-cta .primary-btn{background:#fff;color:var(--accent-dark,#0a5c3f);box-shadow:0 8px 22px rgba(0,0,0,.22);}' +
      '.imp-method{font-size:.72rem;color:var(--muted,#5d7268);text-align:center;margin-top:8px;line-height:1.5;}' +
      /* inlined compare-slider styles (standalone page) */
      '.ba-slider{position:relative;width:200px;height:130px;overflow:hidden;border-radius:8px;margin:6px auto;user-select:none;-webkit-user-select:none;}' +
      '.ba-slider img{position:absolute;top:0;left:0;height:100%;object-fit:cover;}.ba-after{width:100%;}' +
      '.ba-before-wrap{position:absolute;top:0;left:0;bottom:0;width:50%;overflow:hidden;}.ba-before-wrap img{width:200px;max-width:none;}' +
      '.ba-handle{position:absolute;top:0;bottom:0;left:50%;width:3px;margin-left:-1.5px;background:#fff;box-shadow:0 0 4px rgba(0,0,0,.45);pointer-events:none;}' +
      '.ba-handle::after{content:"\\21C4";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;color:#0a5c3f;border-radius:50%;width:22px;height:22px;display:grid;place-items:center;font-size:12px;box-shadow:0 1px 4px rgba(0,0,0,.3);}' +
      '.ba-range{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:ew-resize;}' +
      '@media (max-width:680px){.imp-kpis{grid-template-columns:repeat(2,1fr);}.imp-bar{grid-template-columns:96px 1fr 36px;}}' +
      '@media (prefers-reduced-motion: reduce){.skel-card::after{animation:none;}.imp-bar-fill{transition:none;}}';
    document.head.appendChild(st);
  }

  function boot() { load(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
