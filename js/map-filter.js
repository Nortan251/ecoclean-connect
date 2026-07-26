/* map-filter.js — category + verified-only filter chips for the map (ADDITIVE).
 * Filtering is applied at render time inside app.js loadReports (EcoFilter.apply),
 * so the clustered pins reflect the selection while EcoClean.reports (heatmap,
 * quests, leaderboard) keeps the FULL dataset. Localized; horizontal-scroll row. */
(function () {
  'use strict';
  var CATS = ['illegal_dumping', 'water', 'air_smoke', 'plastic_marine', 'other'];
  var ICONS = { illegal_dumping: '🗑️', water: '💧', air_smoke: '💨', plastic_marine: '🌊', other: '📍' };
  var cats = {}; CATS.forEach((c) => { cats[c] = false; });   // none selected => show all
  var onlyVerified = false;
  var anyCat = () => CATS.some((c) => cats[c]);
  var catLabel = (k) => (typeof window.catLabel === 'function' ? window.catLabel(k) : k);
  function apply(reports) { return (reports || []).filter((r) => (!anyCat() || cats[r.category]) && (!onlyVerified || r.status === 'verified')); }
  function refresh() { if (typeof window.loadReports === 'function') window.loadReports(); }

  function build() {
    var host = document.getElementById('mapView'); var map = document.getElementById('map');
    if (!host || !map) return;
    var bar = document.createElement('div'); bar.id = 'eco-filters'; bar.className = 'eco-filters';
    var all = document.createElement('button'); all.type = 'button'; all.className = 'eco-fchip on'; all.dataset.all = '1'; bar.appendChild(all);
    CATS.forEach((c) => {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'eco-fchip'; b.dataset.cat = c;
      b.innerHTML = '<span aria-hidden="true">' + (ICONS[c] || '•') + '</span> <span class="eco-fchip-l"></span>';
      bar.appendChild(b);
    });
    var ver = document.createElement('button'); ver.type = 'button'; ver.className = 'eco-fchip eco-fchip-ver'; ver.dataset.ver = '1'; bar.appendChild(ver);
    host.insertBefore(bar, map);

    function labels() {
      var L = (typeof window.getLang === 'function' ? getLang() : 'en');
      all.textContent = ({ en: 'All', fr: 'Tous', ar: 'الكل' })[L] || 'All';
      ver.textContent = ({ en: '✅ Verified only', fr: '✅ Vérifiés', ar: '✅ المتحققة فقط' })[L] || '✅ Verified only';
      bar.querySelectorAll('[data-cat]').forEach((b) => { b.querySelector('.eco-fchip-l').textContent = catLabel(b.dataset.cat); });
    }
    function sync() {
      all.classList.toggle('on', !anyCat() && !onlyVerified);
      bar.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('on', cats[b.dataset.cat]));
      ver.classList.toggle('on', onlyVerified);
    }
    all.addEventListener('click', () => { CATS.forEach((c) => { cats[c] = false; }); onlyVerified = false; sync(); refresh(); });
    bar.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => { cats[b.dataset.cat] = !cats[b.dataset.cat]; sync(); refresh(); }));
    ver.addEventListener('click', () => { onlyVerified = !onlyVerified; sync(); refresh(); });
    document.addEventListener('change', (e) => { if (e.target && e.target.id === 'langSelect') labels(); });
    labels(); sync();
  }

  window.EcoFilter = { apply: apply };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();

  if (!document.getElementById('eco-filters-style')) {
    var st = document.createElement('style'); st.id = 'eco-filters-style';
    st.textContent =
      '.eco-filters{display:flex;gap:6px;overflow-x:auto;padding:8px 12px 4px;-webkit-overflow-scrolling:touch;}' +
      '.eco-filters::-webkit-scrollbar{height:0;}' +
      '.eco-fchip{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;border:1px solid #cfe2d8;background:#fff;color:#0a5c3f;border-radius:999px;padding:6px 12px;font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit;flex:0 0 auto;transition:background .15s,color .15s;}' +
      '.eco-fchip.on{background:linear-gradient(135deg,#198754,#0d9488);color:#fff;border-color:transparent;}' +
      '.eco-fchip-ver{margin-left:4px;}';
    document.head.appendChild(st);
  }
})();
