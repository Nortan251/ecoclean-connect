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
      el.innerHTML = '<div class="eme-i">📍</div><p class="eme-t"></p>';
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
      '.eco-map-empty{position:absolute;inset:0;z-index:600;display:none;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:20px;background:linear-gradient(180deg,rgba(var(--surface-rgb,255,255,255),.78),rgba(var(--surface-rgb,255,255,255),.6));-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);pointer-events:none;}' +
      '.eco-map-empty.show{display:flex;}' +
      '.eco-map-empty .eme-i{font-size:2.2rem;}.eco-map-empty .eme-t{margin:0;font-weight:700;color:var(--text,#14241d);max-width:300px;font-size:.95rem;line-height:1.5;}';
    document.head.appendChild(st);
  }
})();
