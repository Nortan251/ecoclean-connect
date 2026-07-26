/* heatmap.js — toggleable pollution-density heatmap (ADDITIVE, feature #11).
 * Adds a Leaflet.heat layer built from the live reports, with a small toggle
 * control (top-right). "Hot" (red) = denser reports, cooling to green. It rebuilds
 * on the shared ecoclean:data event so it stays live, and coexists with the
 * clustered pins (independent layer). Graceful no-op if the plugin/map is absent. */
(function () {
  'use strict';
  if (!window.L || !L.heatLayer) return;
  let map = null, heat = null, on = false;

  // Weight verified clean-ups a touch more so resolved clusters still read on the map.
  const points = () => (window.EcoClean.reports || []).map((r) => [r.lat, r.lng, r.status === 'verified' ? 1 : 0.6]);
  function build() {
    heat = L.heatLayer(points(), {
      radius: 24, blur: 16, maxZoom: 17, max: 1.0, minOpacity: 0.35,
      gradient: { 0.35: '#22c07e', 0.6: '#f59e0b', 0.85: '#ef4444' },
    });
  }
  function toggle() {
    if (!map) return;
    if (on) { if (heat) map.removeLayer(heat); on = false; }
    else { if (!heat) build(); heat.setLatLngs(points()); map.addLayer(heat); on = true; }
    const a = document.querySelector('.eco-heat-ctl a'); if (a) a.classList.toggle('active', on);
  }

  const HeatCtl = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function () {
      const c = L.DomUtil.create('div', 'leaflet-bar eco-heat-ctl');
      const a = L.DomUtil.create('a', '', c);
      a.href = '#'; a.title = 'Toggle pollution heatmap'; a.innerHTML = '🔥';
      a.setAttribute('role', 'button'); a.setAttribute('aria-label', 'Toggle pollution heatmap');
      L.DomEvent.disableClickPropagation(c);           // so toggling never drops a pin
      L.DomEvent.on(a, 'click', function (ev) { L.DomEvent.preventDefault(ev); toggle(); });
      return c;
    },
  });

  window.addEventListener('ecoclean:mapready', (ev) => {
    map = ev.detail; if (!map) return;
    new HeatCtl().addTo(map);
    if (!document.getElementById('eco-heat-style')) {
      const st = document.createElement('style'); st.id = 'eco-heat-style';
      st.textContent =
        '.eco-heat-ctl a{display:block;width:34px;height:34px;line-height:34px;text-align:center;font-size:16px;color:#0a5c3f;background:#fff;cursor:pointer;}' +
        '.eco-heat-ctl a.active{background:linear-gradient(135deg,#198754,#0d9488);color:#fff;}';
      document.head.appendChild(st);
    }
  });

  window.addEventListener('ecoclean:data', () => { if (on && heat) heat.setLatLngs(points()); });
})();
