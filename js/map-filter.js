/* map-filter.js — category + verified-only filters behind a "Filter" button placed
 * ABOVE the zoom control (ADDITIVE). Tapping the pill opens a frosted chip panel;
 * while it is open the zoom (+/-) slides FURTHER DOWN so it is never covered, and
 * slides back to just-below-the-Filter when the panel closes. The pill shows a
 * count badge while any filter is active. Filtering is applied at render time
 * inside app.js loadReports (EcoFilter.apply), so the clustered pins reflect the
 * selection while EcoClean.reports (heatmap/quests/leaderboard) keeps the full
 * dataset. Localized; tapping the map closes the panel. */
(function () {
  'use strict';
  var CATS = ['illegal_dumping', 'water', 'air_smoke', 'plastic_marine', 'other'];
  var ICONS = { illegal_dumping: '🗑️', water: '💧', air_smoke: '💨', plastic_marine: '🌊', other: '📍' };
  var cats = {}; CATS.forEach(function (c) { cats[c] = false; });
  var onlyVerified = false;
  var anyCat = function () { return CATS.some(function (c) { return cats[c]; }); };
  var activeCount = function () { return CATS.filter(function (c) { return cats[c]; }).length + (onlyVerified ? 1 : 0); };
  var catLabel = function (k) { return (typeof window.catLabel === 'function' ? window.catLabel(k) : k); };
  function applyFilter(reports) { return (reports || []).filter(function (r) { return (!anyCat() || cats[r.category]) && (!onlyVerified || r.status === 'verified'); }); }
  function refresh() { if (typeof window.loadReports === 'function') window.loadReports(); }

  var wrap, toggle, panel, countEl, mapEl;
  // Central open/close: also slides the zoom control out from under the panel.
  function setOpen(open) {
    panel.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (mapEl) mapEl.classList.toggle('eco-filter-open', open);
  }
  function labels() {
    var Lg = (typeof window.getLang === 'function' ? getLang() : 'en');
    toggle.querySelector('.eco-filter-toggle-l').textContent = ({ en: 'Filter', fr: 'Filtrer', ar: 'تصفية' })[Lg] || 'Filter';
    panel.querySelector('[data-all]').textContent = ({ en: 'All', fr: 'Tous', ar: 'الكل' })[Lg] || 'All';
    panel.querySelector('[data-ver]').textContent = ({ en: '✅ Verified', fr: '✅ Vérifiés', ar: '✅ المتحققة' })[Lg] || '✅ Verified';
    panel.querySelectorAll('[data-cat]').forEach(function (b) { b.querySelector('.eco-fchip-l').textContent = catLabel(b.dataset.cat); });
  }
  function sync() {
    panel.querySelector('[data-all]').classList.toggle('on', !anyCat() && !onlyVerified);
    panel.querySelectorAll('[data-cat]').forEach(function (b) { b.classList.toggle('on', cats[b.dataset.cat]); });
    panel.querySelector('[data-ver]').classList.toggle('on', onlyVerified);
    var n = activeCount();
    toggle.classList.toggle('on', n > 0);
    if (n > 0) { countEl.textContent = n; countEl.hidden = false; } else { countEl.hidden = true; }
  }

  function build() {
    mapEl = document.getElementById('map'); if (!mapEl) return;
    wrap = document.createElement('div'); wrap.id = 'eco-filterwrap';
    toggle = document.createElement('button'); toggle.type = 'button'; toggle.id = 'eco-filter-toggle'; toggle.className = 'eco-filter-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span aria-hidden="true">⚙</span> <span class="eco-filter-toggle-l"></span> <span class="eco-fcount" hidden></span>';
    countEl = toggle.querySelector('.eco-fcount');
    panel = document.createElement('div'); panel.id = 'eco-filter-panel'; panel.className = 'eco-filter-panel';

    var all = document.createElement('button'); all.type = 'button'; all.className = 'eco-fchip'; all.dataset.all = '1'; panel.appendChild(all);
    CATS.forEach(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'eco-fchip'; b.dataset.cat = c;
      b.innerHTML = '<span aria-hidden="true">' + (ICONS[c] || '•') + '</span> <span class="eco-fchip-l"></span>';
      panel.appendChild(b);
    });
    var ver = document.createElement('button'); ver.type = 'button'; ver.className = 'eco-fchip'; ver.dataset.ver = '1'; panel.appendChild(ver);
    wrap.appendChild(toggle); wrap.appendChild(panel);
    mapEl.appendChild(wrap);

    toggle.addEventListener('click', function () { setOpen(!panel.classList.contains('open')); });
    all.addEventListener('click', function () { CATS.forEach(function (c) { cats[c] = false; }); onlyVerified = false; sync(); refresh(); });
    panel.querySelectorAll('[data-cat]').forEach(function (b) { b.addEventListener('click', function () { cats[b.dataset.cat] = !cats[b.dataset.cat]; sync(); refresh(); }); });
    ver.addEventListener('click', function () { onlyVerified = !onlyVerified; sync(); refresh(); });
    mapEl.addEventListener('click', function (e) { if (panel.classList.contains('open') && !wrap.contains(e.target)) setOpen(false); });
    labels(); sync();
  }

  window.EcoFilter = { apply: applyFilter };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'langSelect') labels(); });

  if (!document.getElementById('eco-filters-style')) {
    var st = document.createElement('style'); st.id = 'eco-filters-style';
    st.textContent =
      '#eco-filterwrap{position:absolute;top:10px;left:10px;right:10px;z-index:1100;display:flex;flex-direction:column;align-items:flex-start;gap:6px;pointer-events:none;}' +
      '#eco-filterwrap > *{pointer-events:auto;}' +
      '.eco-filter-toggle{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #cfe2d8;color:#0a5c3f;border-radius:999px;padding:7px 13px;font-size:.8rem;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(16,40,30,.18);font-family:inherit;}' +
      '.eco-filter-toggle.on{background:linear-gradient(135deg,#198754,#0d9488);color:#fff;border-color:transparent;}' +
      '.eco-fcount{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:rgba(255,255,255,.92);color:#0a5c3f;font-size:.7rem;font-weight:800;}' +
      '.eco-filter-panel{align-self:stretch;display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;max-height:0;opacity:0;overflow:hidden;transition:max-height .25s ease,opacity .2s ease,padding .2s ease;background:rgba(255,255,255,.95);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border:1px solid #cfe2d8;border-radius:14px;box-shadow:0 8px 24px rgba(16,40,30,.18);padding:0;}' +
      '.eco-filter-panel.open{max-height:120px;opacity:1;padding:8px;}' +
      '.eco-filter-panel::-webkit-scrollbar{height:0;}' +
      '.eco-fchip{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;border:1px solid #cfe2d8;background:#fff;color:#0a5c3f;border-radius:999px;padding:6px 12px;font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit;flex:0 0 auto;}' +
      '.eco-fchip.on{background:linear-gradient(135deg,#198754,#0d9488);color:#fff;border-color:transparent;}' +
      '.leaflet-top.leaflet-left{top:46px!important;transition:top .25s ease;}' +
      '#map.eco-filter-open .leaflet-top.leaflet-left{top:100px!important;}';
    document.head.appendChild(st);
  }
})();
