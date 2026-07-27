/* map-empty.js — friendly overlay on the home map when there are no reports yet
 * (ADDITIVE). After a clean reset / fresh deploy the map would otherwise look
 * empty and broken; this shows a calm "be the first to report" prompt instead,
 * and hides itself the moment any report exists. Listens to ecoclean:data so it
 * tracks the live dataset without touching app.js. */
(function () {
  'use strict';
  var T = function (k) { return (typeof window.t === 'function') ? window.t(k) : k; };
  var el = null;
  function ensure() {
    var map = document.getElementById('map'); if (!map) return null;
    if (!el) {
      el = document.createElement('div'); el.className = 'eco-map-empty'; el.id = 'ecoMapEmpty';
      el.innerHTML = '<div class="eme-card"><div class="eme-i">📍</div><p class="eme-t"></p></div>';
      map.appendChild(el);
    }
    return el;
  }
  function update() {
    var e = ensure(); if (!e) return;
    var n = (window.EcoClean && window.EcoClean.reports) ? window.EcoClean.reports.length : 0;
    e.classList.toggle('show', n === 0);
    e.querySelector('.eme-t').textContent = T('empty_map');
  }
  document.addEventListener('ecoclean:data', update);
  document.addEventListener('ecoclean:mapready', update);
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'langSelect') update(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', update);

  if (!document.getElementById('eco-map-empty-style')) {
    var st = document.createElement('style'); st.id = 'eco-map-empty-style';
    st.textContent =
      '.eco-map-empty{position:absolute;inset:0;z-index:600;display:none;align-items:center;justify-content:center;pointer-events:none;}' +
      '.eco-map-empty.show{display:flex;}' +
      /* A small floating card instead of a full-map veil, so the real map tiles stay
       * visible underneath — an empty map must still LOOK like a working map. */
      '.eco-map-empty .eme-card{display:flex;flex-direction:column;align-items:center;gap:6px;background:var(--surface,#fff);border:1px solid var(--border-strong,#cfe2d8);border-radius:14px;padding:14px 20px;box-shadow:0 10px 30px rgba(0,0,0,.22);max-width:300px;text-align:center;}' +
      '.eco-map-empty .eme-i{font-size:1.9rem;line-height:1;}.eco-map-empty .eme-t{margin:0;font-weight:700;color:var(--text,#14241d);font-size:.9rem;line-height:1.45;}';
    document.head.appendChild(st);
  }
})();
