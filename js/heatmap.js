/* heatmap.js — two clearly-labelled, provenance-honest heatmap layers (ADDITIVE).
 *
 *  [🔥 Density]  -> heat from REAL citizen reports (the truthful core of a
 *                  crowdsourcing app). Green->amber->red.
 *  [🗺️ Context]  -> a SEPARATE illustrative "regional context" layer built from
 *                  real Moroccan city coordinates with ILLUSTRATIVE weights (rough
 *                  relative metro size / industrial activity) — NOT measured
 *                  pollution. It is kept on its own layer, its own colour ramp
 *                  (blue->purple) and its own caption so its provenance is never
 *                  confused with citizen reports. In production, swap CONTEXT for
 *                  a real open-data feed (e.g. OpenAQ for air quality).
 *
 * We deliberately do NOT blend fabricated city statistics into the citizen heat —
 * preserving data provenance is the honest choice and reads well in an essay.
 * A caption on the map names the source of whichever layer(s) are on, so the bare
 * icons are never ambiguous (important on touch, where hover tooltips don't show).
 * Graceful no-op if the plugin or the map is missing. */
(function () {
  'use strict';
  if (!window.L || !L.heatLayer) return;
  let map = null, citizenHeat = null, ctxHeat = null, citizenOn = false, ctxOn = false, caption = null;

  const CITIZEN_GRAD = { 0.35: '#22c07e', 0.6: '#f59e0b', 0.85: '#ef4444' };
  const CONTEXT_GRAD = { 0.3: '#38bdf8', 0.6: '#6366f1', 1: '#a855f7' };

  // Real city coordinates; the 3rd value is an ILLUSTRATIVE weight (placeholder).
  const CONTEXT = [
    [33.5731, -7.5898, 1.0],   // Casablanca
    [34.0209, -6.8416, 0.5],   // Rabat
    [31.6295, -7.9811, 0.45],  // Marrakech
    [34.0181, -5.0078, 0.4],   // Fes
    [35.7595, -5.8340, 0.4],   // Tangier
    [30.4278, -9.5981, 0.35],  // Agadir
    [33.8935, -5.5473, 0.3],   // Meknes
    [34.6814, -1.9086, 0.28],  // Oujda
    [34.2610, -6.5802, 0.25],  // Kenitra
    [35.5889, -5.3626, 0.22],  // Tetouan
    [32.2994, -9.2372, 0.2],   // Safi
  ];
  const citizenPoints = () => (window.EcoClean.reports || []).map((r) => [r.lat, r.lng, r.status === 'verified' ? 1 : 0.6]);
  const ensureCitizen = () => { if (!citizenHeat) citizenHeat = L.heatLayer(citizenPoints(), { radius: 24, blur: 16, maxZoom: 17, max: 1.0, minOpacity: 0.35, gradient: CITIZEN_GRAD }); };
  const ensureCtx = () => { if (!ctxHeat) ctxHeat = L.heatLayer(CONTEXT, { radius: 34, blur: 22, maxZoom: 9, max: 1.0, minOpacity: 0.3, gradient: CONTEXT_GRAD }); };

  function updateCaption() {
    if (!caption) return;
    const parts = [];
    if (citizenOn) parts.push('🔥 Density from citizen reports');
    if (ctxOn) parts.push('🗺️ Regional context (illustrative reference)');
    if (parts.length) { caption.textContent = parts.join('   •   '); caption.style.display = ''; }
    else caption.style.display = 'none';
  }
  function toggleCitizen() {
    if (!map) return;
    if (citizenOn) { map.removeLayer(citizenHeat); citizenOn = false; }
    else { ensureCitizen(); citizenHeat.setLatLngs(citizenPoints()); map.addLayer(citizenHeat); citizenOn = true; }
    const b = document.querySelector('.eco-heat-pill[data-k="citizen"]'); if (b) { b.classList.toggle('active', citizenOn); b.setAttribute('aria-pressed', String(citizenOn)); }
    updateCaption();
  }
  function toggleCtx() {
    if (!map) return;
    if (ctxOn) { map.removeLayer(ctxHeat); ctxOn = false; }
    else { ensureCtx(); map.addLayer(ctxHeat); ctxOn = true; }
    const b = document.querySelector('.eco-heat-pill[data-k="ctx"]'); if (b) { b.classList.toggle('active', ctxOn); b.setAttribute('aria-pressed', String(ctxOn)); }
    updateCaption();
  }

  const HeatCtl = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function () {
      const c = L.DomUtil.create('div', 'eco-heat-ctl');
      c.innerHTML =
        '<button type="button" class="eco-heat-pill" data-k="citizen" aria-pressed="false"><span aria-hidden="true">🔥</span> Density</button>' +
        '<button type="button" class="eco-heat-pill" data-k="ctx" aria-pressed="false" title="Regional context — illustrative reference"><span aria-hidden="true">🗺️</span> Context</button>';
      L.DomEvent.disableClickPropagation(c);     // toggling must never drop a pin
      c.querySelector('[data-k="citizen"]').addEventListener('click', toggleCitizen);
      c.querySelector('[data-k="ctx"]').addEventListener('click', toggleCtx);
      return c;
    },
  });

  window.addEventListener('ecoclean:mapready', (ev) => {
    map = ev.detail; if (!map) return;
    new HeatCtl().addTo(map);
    const host = document.getElementById('map') || document.getElementById('mapView');
    if (host) { caption = document.createElement('div'); caption.className = 'eco-heat-caption'; caption.style.display = 'none'; host.appendChild(caption); }
    if (!document.getElementById('eco-heat-style2')) {
      const st = document.createElement('style'); st.id = 'eco-heat-style2';
      st.textContent =
        '.eco-heat-ctl{display:flex;flex-direction:column;gap:6px;}' +
        '.eco-heat-pill{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(25,135,84,.18);background:#fff;color:#0a5c3f;border-radius:999px;padding:7px 12px;font-size:.8rem;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(16,40,30,.12);white-space:nowrap;font-family:inherit;}' +
        '.eco-heat-pill:active{transform:scale(.97);}' +
        '.eco-heat-pill.active[data-k="citizen"]{background:linear-gradient(135deg,#198754,#0d9488);color:#fff;border-color:transparent;}' +
        '.eco-heat-pill.active[data-k="ctx"]{background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;border-color:transparent;}' +
        '.eco-heat-caption{position:absolute;left:10px;bottom:10px;z-index:800;background:rgba(255,255,255,.88);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border:1px solid rgba(25,135,84,.16);color:#14241d;padding:6px 12px;border-radius:999px;font-size:.72rem;font-weight:600;box-shadow:0 4px 12px rgba(16,40,30,.12);pointer-events:none;max-width:72vw;}';
      document.head.appendChild(st);
    }
  });

  window.addEventListener('ecoclean:data', () => { if (citizenOn && citizenHeat) citizenHeat.setLatLngs(citizenPoints()); });
})();
