/* map-empty.js — a NON-blocking hint for the home map when there are no reports.
 * Earlier versions put a card dead-center over the map that the user couldn't
 * dismiss and that blocked the view — that read as "the map is broken". This
 * version is the opposite: a SMALL chip pinned to the top that (a) auto-hides the
 * instant the user interacts with the map (movestart/zoomstart), and (b) has a ✕
 * that dismisses it for good (remembered in localStorage). It never covers the
 * center, never blocks panning/zooming (pointer-events:none on the wrapper), and
 * hides itself the moment there's any data. Listens to ecoclean:data so it tracks
 * the live dataset without touching app.js. */
(function () {
  'use strict';
  var DISMISS_KEY = 'eco_map_hint_dismissed';
  var T = function (k) { return (typeof window.t === 'function') ? window.t(k) : k; };
  var el = null, hidden = false, mapRef = null;

  function dismissed() { try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; } }
  function remember() { try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {} }

  function ensure() {
    var map = document.getElementById('map'); if (!map) return null;
    if (!el) {
      el = document.createElement('div'); el.className = 'eco-map-empty'; el.id = 'ecoMapEmpty';
      el.innerHTML = '<div class="eme-chip"><span class="eme-t"></span><button type="button" class="eme-x" aria-label="Dismiss">&times;</button></div>';
      map.appendChild(el);
      el.querySelector('.eme-x').addEventListener('click', function (e) { e.stopPropagation(); remember(); hide(); });
    }
    return el;
  }
  function hide() { hidden = true; if (el) el.classList.remove('show'); }
  function bindMap(map) {
    if (mapRef === map) return; mapRef = map;
    // The first real interaction with the map clears the hint — the user is clearly
    // exploring, so the "no reports yet" note has done its job and should get gone.
    map.on('movestart zoomstart', hide);
  }
  function update() {
    var e = ensure(); if (!e) return;
    var n = (window.EcoClean && window.EcoClean.reports) ? window.EcoClean.reports.length : 0;
    var m = (window.EcoClean && window.EcoClean.maps && window.EcoClean.maps[0]) || null;
    if (m) bindMap(m);
    if (n === 0 && !hidden && !dismissed()) { e.querySelector('.eme-t').textContent = T('empty_map'); e.classList.add('show'); }
    else e.classList.remove('show');
  }
  document.addEventListener('ecoclean:data', update);
  document.addEventListener('ecoclean:mapready', update);
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'langSelect') update(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', update);

  if (!document.getElementById('eco-map-empty-style')) {
    var st = document.createElement('style'); st.id = 'eco-map-empty-style';
    st.textContent =
      '.eco-map-empty{position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:650;display:none;pointer-events:none;max-width:calc(100% - 24px);}' +
      '.eco-map-empty.show{display:block;}' +
      '.eco-map-empty .eme-chip{display:inline-flex;align-items:center;gap:10px;background:var(--surface,#fff);border:1px solid var(--border-strong,#cfe2d8);border-radius:999px;padding:7px 8px 7px 14px;box-shadow:0 6px 18px rgba(0,0,0,.18);pointer-events:auto;}' +
      '.eco-map-empty .eme-t{font-weight:600;color:var(--text,#14241d);font-size:.8rem;line-height:1.3;}' +
      '.eco-map-empty .eme-x{border:none;background:var(--surface-2,#eef7f2);color:var(--muted,#5d7268);width:22px;height:22px;border-radius:50%;font-size:1.05rem;line-height:1;cursor:pointer;display:grid;place-items:center;}' +
      '.eco-map-empty .eme-x:hover{background:var(--surface-3,#e6f3ef);color:var(--text,#14241d);}';
    document.head.appendChild(st);
  }
})();
