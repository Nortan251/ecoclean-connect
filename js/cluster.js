/* ============================================================================
 * cluster.js — Marker clustering + lightweight SVG vector pins (ADDITIVE)
 * ----------------------------------------------------------------------------
 * Goal: group dense pollution pins so the map stays fast with hundreds of
 * reports, and render every pin as a tiny inline-SVG vector (crisp at any zoom,
 * zero image requests) instead of a raster marker.
 *
 * THE ADDITIVE PROBLEM
 * --------------------
 * app.js owns marker creation: loadReports() builds L.circleMarkers and drops
 * them into a plain L.layerGroup ("markerLayer"). All the add-on modules were
 * written against that: map-sync.js recolors via setStyle(), the trust/voting
 * system reads marker._reportId on popup-open, and ecoclean-addons.js tags
 * markers by coordinate. Rewriting app.js to use a cluster group would break
 * that contract. So instead we install a TRANSPARENT PROXY on the existing
 * layer group: we replace its addLayer()/clearLayers() so that every
 * circleMarker app.js tries to add is silently converted into a clustered
 * L.marker with an SVG divIcon. app.js and the report pipeline are untouched,
 * yet the renderer is now a MarkerClusterGroup.
 *
 * COMPATIBILITY SHIMS
 * -------------------
 * Clustered L.marker objects have getLatLng() but NOT setStyle() (that is a
 * path/circleMarker method). We add a setStyle() shim that rebuilds the SVG
 * icon in the requested colour, so map-sync.js's recoloring "just works". We
 * also tag _reportId at creation (coordinate match) and forward the popup that
 * app.js binds *after* addTo() (chain order), so the voting UI keeps working.
 *
 * GRACEFUL DEGRADATION
 * --------------------
 * The markercluster plugin is injected at runtime (and cached by the SW). If it
 * is not available when the map opens (e.g. first-ever offline load), we simply
 * do nothing and app.js's original circleMarkers render as normal — the map
 * never breaks, it just isn't clustered that session.
 *
 * Essay points: spatial grid-clustering turns O(n) DOM nodes into O(clusters);
 * the proxy/decorator pattern lets us swap the renderer without forking the
 * core; SVG divIcons beat PNGs on memory, sharpness, and request count.
 * ==========================================================================*/
(function () {
  'use strict';
  if (!window.L) return;

  /* (1) Inject the clustering plugin + its CSS on demand, so index.html only
        needs a single <script src="js/cluster.js">. The service worker's
        cache-first rule for unpkg.com caches these after the first fetch. */
  (function loadPlugin() {
    if (L.markerClusterGroup) return;
    if (!document.getElementById('eco-mc-css')) {
      const link = document.createElement('link');
      link.id = 'eco-mc-css'; link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
      document.head.appendChild(link);
    }
    if (!document.getElementById('eco-mc-js')) {
      const s = document.createElement('script');
      s.id = 'eco-mc-js';
      s.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
      document.head.appendChild(s);
    }
  })();

  /* Neutralize Leaflet's default .leaflet-div-icon white box for our icons. */
  if (!document.getElementById('eco-cluster-style')) {
    const st = document.createElement('style');
    st.id = 'eco-cluster-style';
    st.textContent =
      '.eco-pin,.eco-cluster{background:none!important;border:none!important;}' +
      '.eco-cluster svg{filter:drop-shadow(0 1px 2px rgba(0,0,0,.35));}';
    document.head.appendChild(st);
  }

  const COLOR2STATUS = { '#dc3545': 'active', '#ffc107': 'review', '#198754': 'cleaned' };
  const STATUS2COLOR = { active: '#dc3545', review: '#ffc107', cleaned: '#198754' };
  const colorToStatus = (c) => COLOR2STATUS[(c || '').toLowerCase()] || 'active';

  /* Lightweight inline-SVG teardrop pin. Being a vector, it stays sharp at every
     zoom level and costs no network request (unlike a PNG icon). */
  function svgIcon(color) {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">' +
      '<path d="M13 0C6 0 0 6 0 13c0 9 13 21 13 21s13-12 13-21C26 6 20 0 13 0z" fill="' + color + '" stroke="#fff" stroke-width="2"/>' +
      '<circle cx="13" cy="13" r="5" fill="#fff"/></svg>';
    return L.divIcon({ className: 'eco-pin', html: svg, iconSize: [26, 34], iconAnchor: [13, 34], popupAnchor: [0, -30] });
  }

  /* Cluster bubble: radius scales with the count; colour = the "worst" status
     among the children, so a single glance at a cluster tells you whether it
     still hides active, un-cleaned sites. Pure SVG => hundreds stay cheap. */
  function clusterIcon(cluster) {
    const kids = cluster.getAllChildMarkers();
    const n = kids.length;
    let status = 'cleaned';
    for (let i = 0; i < kids.length; i++) {
      const s = kids[i]._status || 'active';
      if (s === 'active') { status = 'active'; break; }
      if (s === 'review') status = 'review';
    }
    const color = STATUS2COLOR[status];
    const size = n < 10 ? 38 : n < 50 ? 46 : 54;
    const html =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 40 40">' +
      '<circle cx="20" cy="20" r="18" fill="' + color + '" fill-opacity="0.9" stroke="#fff" stroke-width="3"/>' +
      '<text x="20" y="25" text-anchor="middle" font-size="14" font-weight="700" fill="#fff" font-family="Arial,sans-serif">' + n + '</text></svg>';
    return L.divIcon({ className: 'eco-cluster', html: html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
  }

  function installProxy(map, appLayer) {
    map._ecoProxied = true;
    let cluster;
    try {
      cluster = L.markerClusterGroup({
        maxClusterRadius: 55,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 18,    // at street level, show individual pins
        chunkedLoading: true,           // add markers in chunks -> keeps the UI responsive
        iconCreateFunction: clusterIcon,
      });
    } catch (e) { return; }              // plugin not ready -> leave default pins
    map.addLayer(cluster);
    map._ecoCluster = cluster;

    const origAdd = appLayer.addLayer.bind(appLayer);
    const origClear = appLayer.clearLayers.bind(appLayer);

    appLayer.clearLayers = function () { cluster.clearLayers(); return origClear(); };

    appLayer.addLayer = function (cm) {
      try {
        const ll = cm.getLatLng();
        const color = (cm.options && (cm.options.fillColor || cm.options.color)) || '#dc3545';
        const m = L.marker(ll, { icon: svgIcon(color), riseOnHover: true, keyboard: true });
        m._color = color;
        m._status = colorToStatus(color);

        // setStyle() shim: add-on modules recolor circleMarkers via setStyle();
        // for a divIcon marker we rebuild the SVG icon in the new colour instead,
        // so map-sync.js's existing recolor loop keeps working unchanged.
        m.setStyle = function (st) {
          const c = (st && (st.fillColor || st.color)) || m._color;
          if (c && c !== m._color) { m._color = c; m._status = colorToStatus(c); m.setIcon(svgIcon(c)); }
          return m;
        };

        // Tag the id via the spatial index (O(1)) instead of scanning every report
        // (O(n)) — this runs once per marker on every render, so it matters a lot.
        const idx = window.EcoClean && EcoClean._idx;
        const id = idx ? idx.get(ll.lat.toFixed(6) + ',' + ll.lng.toFixed(6)) : null;
        if (id) m._reportId = id;

        cluster.addLayer(m);

        // app.js chains .bindPopup(html) AFTER .addTo(); forward it to our marker
        // so the rich before/after popup (and vote buttons) still appear.
        cm.bindPopup = function (content, opts) { m.bindPopup(content, opts); return cm; };
      } catch (e) {
        try { return origAdd(cm); } catch (_) {}   // safety net: never lose a pin
      }
      return cm;
    };

    // When a cluster opens or settles, newly-revealed markers need tagging.
    cluster.on('spiderfied animationend', () => {
      if (window.EcoClean && EcoClean.tagMarkers) EcoClean.tagMarkers();
    });
  }

  /* Hook in via the existing event, then watch for the core layer group to
     appear (it is created a moment after the map) and proxy it transparently. */
  window.addEventListener('ecoclean:mapready', (ev) => {
    const map = ev.detail;
    if (!map || map._ecoHooked || !L.markerClusterGroup) return;  // no plugin => default render
    map._ecoHooked = true;
    const origAddLayer = map.addLayer.bind(map);
    map.addLayer = function (layer) {
      const ret = origAddLayer(layer);
      // The first plain LayerGroup added after the tile layer is app.js's markerLayer.
      if (!map._ecoProxied && layer && (layer instanceof L.LayerGroup) && !(layer instanceof L.MarkerClusterGroup)) {
        installProxy(map, layer);
      }
      return ret;
    };
  });
})();
