/* heatmap.js — toggleable pollution-density heatmap from REAL citizen reports (ADDITIVE),
 * trilingual. A labelled "🔥 Density" pill toggles a Leaflet.heat layer (hot = denser).
 * A caption names the layer's source so the icon is never ambiguous on touch. */
(function () {
  'use strict';
  if (!window.L || !L.heatLayer) return;
  const L10N = {
    en: { btn: 'Density', cap: '🔥 Density from citizen reports' },
    fr: { btn: 'Densité', cap: '🔥 Densité selon les signalements citoyens' },
    ar: { btn: 'الكثافة', cap: '🔥 الكثافة حسب بلاغات المواطنين' },
  };
  const lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');
  const t = (k) => { const d = L10N[lang()] || L10N.en; return (d && d[k] != null) ? d[k] : L10N.en[k]; };
  let map = null, heat = null, on = false, caption = null, pillLabel = null;
  const GRAD = { 0.35: '#22c07e', 0.6: '#f59e0b', 0.85: '#ef4444' };
  const points = () => (window.EcoClean.reports || []).map((r) => [r.lat, r.lng, r.status === 'verified' ? 1 : 0.6]);
  function ensure() { if (!heat) heat = L.heatLayer(points(), { radius: 24, blur: 16, maxZoom: 17, max: 1.0, minOpacity: 0.35, gradient: GRAD }); }
  function updateCaption() { if (!caption) return; if (on) { caption.textContent = t('cap'); caption.style.display = ''; } else caption.style.display = 'none'; }
  function toggle() {
    if (!map) return;
    if (on) { map.removeLayer(heat); on = false; } else { ensure(); heat.setLatLngs(points()); map.addLayer(heat); on = true; }
    const b = document.querySelector('.eco-heat-pill'); if (b) { b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); }
    updateCaption();
  }
  const HeatCtl = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function () {
      const c = L.DomUtil.create('div', 'eco-heat-ctl');
      c.innerHTML = '<button type="button" class="eco-heat-pill" aria-pressed="false"><span aria-hidden="true">🔥</span> <span class="eco-heat-label"></span></button>';
      pillLabel = c.querySelector('.eco-heat-label'); if (pillLabel) pillLabel.textContent = t('btn');
      L.DomEvent.disableClickPropagation(c);   // toggling must never drop a pin
      c.querySelector('.eco-heat-pill').addEventListener('click', toggle);
      return c;
    },
  });
  window.addEventListener('ecoclean:mapready', (ev) => {
    map = ev.detail; if (!map) return;
    new HeatCtl().addTo(map);
    const host = document.getElementById('map') || document.getElementById('mapView');
    if (host) { caption = document.createElement('div'); caption.className = 'eco-heat-caption'; caption.style.display = 'none'; host.appendChild(caption); }
    if (!document.getElementById('eco-heat-style3')) {
      const st = document.createElement('style'); st.id = 'eco-heat-style3';
      st.textContent =
        '.eco-heat-ctl{display:flex;flex-direction:column;gap:6px;}' +
        '.eco-heat-pill{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(25,135,84,.18);background:#fff;color:#0a5c3f;border-radius:999px;padding:7px 12px;font-size:.8rem;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(16,40,30,.12);white-space:nowrap;font-family:inherit;}' +
        '.eco-heat-pill:active{transform:scale(.97);}' +
        '.eco-heat-pill.active{background:linear-gradient(135deg,#198754,#0d9488);color:#fff;border-color:transparent;}' +
        '.eco-heat-caption{position:absolute;left:10px;bottom:10px;z-index:800;background:rgba(255,255,255,.88);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border:1px solid rgba(25,135,84,.16);color:#14241d;padding:6px 12px;border-radius:999px;font-size:.72rem;font-weight:600;box-shadow:0 4px 12px rgba(16,40,30,.12);pointer-events:none;max-width:72vw;}';
      document.head.appendChild(st);
    }
  });
  window.addEventListener('ecoclean:data', () => { if (on && heat) heat.setLatLngs(points()); });
  document.addEventListener('change', (e) => { if (e.target && e.target.id === 'langSelect') { if (pillLabel) pillLabel.textContent = t('btn'); updateCaption(); } });
})();
