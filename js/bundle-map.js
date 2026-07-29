/* Bundled automatically */

/* === js/map-sync.js === */
/* map-sync.js — status-driven pin colors + offline report queue.
   Colors: Red = Active, Yellow = In Review, Green = Cleaned.
   Offline submissions are queued in localStorage and flushed on 'online'. */
(function () {
  const QUEUE = 'offlineQueue';
  const COLOR = { active: '#dc3545', review: '#ffc107', cleaned: '#198754' };

  function refreshMarkers() {
    window.EcoClean.maps.forEach(map =>
      map.eachLayer(l => {
        if (l._reportId && typeof l.setStyle === 'function') {
          const c = COLOR[window.EcoClean.statusOf(l._reportId)] || COLOR.active;
          l.setStyle({ color: c, fillColor: c });
        }
      })
    );
  }
  async function flush() {
    const q = EcoStore.get(QUEUE, []);
    if (!q.length) return;
    // "Survivor" drain: only drop an item once the server actually ACKs it.
    // A thrown fetch() means the network was unreachable, so we KEEP that item
    // for the next attempt — this gives at-least-once delivery with zero silent
    // data loss (the old version cleared the whole queue unconditionally, which
    // could delete reports if a retry ran against a dead/captive-portal link).
    const survivors = [];
    for (const item of q) {
      // Queued items may be {body, auth} (signed-in offline reports) or a bare
      // payload (legacy). Re-attach the Bearer token so attribution survives offline.
      const payload = item && item.body ? item.body : item;
      const auth = item && item.auth ? item.auth : null;
      const headers = { 'Content-Type': 'application/json' }; if (auth) headers['Authorization'] = auth;
      try {
        await fetch('/api/reports', { method: 'POST', headers, body: JSON.stringify(payload) });
        // resolved (any HTTP status) => server received it; do not re-queue
      } catch (e) { survivors.push(item); }      // unreachable => keep for later
    }
    EcoStore.set(QUEUE, survivors);
    await window.EcoData.load();
    window.EcoClean.tagMarkers();
    refreshMarkers();
  }
  // Expose queue so your existing submit handler can call it when offline.
  window.EcoOffline = {
    queue(item) { const q = EcoStore.get(QUEUE, []); q.push(item); EcoStore.set(QUEUE, q); },
    flush
  };
  window.addEventListener('online', flush);
  // Keep colors fresh after every report load.
  window.EcoData.load().then(() => { window.EcoClean.tagMarkers(); refreshMarkers(); });
  // Periodic safety net only — realtime + the ecoclean:data event handle live
  // updates now, and index-based tagging makes this cheap, so run it less often.
  setInterval(() => { window.EcoClean.tagMarkers(); refreshMarkers(); }, 15000);
})();


/* === js/cluster.js === */
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


/* === js/heatmap.js === */
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
    
    // Move Density button out of Leaflet native controls and into eco-special-tools stack
    const container = document.getElementById('map');
    if (container) {
      let wrap = document.getElementById('eco-special-tools');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'eco-special-tools';
        wrap.style.cssText = 'position: absolute; top: 16px; right: 16px; z-index: 1000; display:flex; flex-direction:column; gap:8px; pointer-events:none; align-items: flex-end;';
        container.appendChild(wrap);
      }
      
      const btn = document.createElement('button');
      btn.className = 'eco-filter-toggle eco-heat-pill'; 
      btn.type = 'button';
      btn.innerHTML = '<span aria-hidden="true">🔥</span> <span class="eco-heat-label"></span>';
      pillLabel = btn.querySelector('.eco-heat-label'); 
      if (pillLabel) pillLabel.textContent = t('btn');
      btn.style.pointerEvents = 'auto';
      btn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
      btn.style.background = 'var(--surface)';
      btn.style.color = '#198754';
      btn.style.borderColor = '#198754';
      
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggle();
        if (on) {
          btn.style.background = '#198754';
          btn.style.color = '#fff';
        } else {
          btn.style.background = 'var(--surface)';
          btn.style.color = '#198754';
        }
      });
      
      // Ensure it's the very first button in the stack
      wrap.insertBefore(btn, wrap.firstChild);
    }

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


/* === js/map-place.js === */
/* map-place.js — click/tap the map to drop a pin & set the report location (ADDITIVE),
 * trilingual. A manual placement raises EcoManualPin so GPS/EXIF auto-logic won't
 * overwrite the chosen point. A pulsing temp marker + a hint chip guide the action;
 * both clear after submit. Clicks on markers/popups/controls are ignored. */
(function () {
  'use strict';
  const L10N = {
    en: { hint: '📍 Tap the map to drop a pin', here: '📍 Report here' },
    fr: { hint: '📍 Touchez la carte pour placer un repère', here: '📍 Signaler ici' },
    ar: { hint: '📍 المس الخريطة لوضع علامة', here: '📍 بلّغ هنا' },
  };
  const lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');
  const t = (k) => { const d = L10N[lang()] || L10N.en; return (d && d[k] != null) ? d[k] : L10N.en[k]; };
  let map = null, temp = null, hint = null;
  const modal = () => document.getElementById('reportModal');
  const modalOpen = () => { const m = modal(); return m && !m.classList.contains('hidden'); };
  const setInputs = (lat, lng) => { const a = document.getElementById('latInput'), o = document.getElementById('lngInput'); if (a) a.value = lat.toFixed(6); if (o) o.value = lng.toFixed(6); };
  const showHint = (v) => { if (hint) hint.style.display = v ? '' : 'none'; };

  function placeIcon() {
    return L.divIcon({
      className: 'eco-place-pin',
      html: '<svg width="30" height="38" viewBox="0 0 30 38"><path d="M15 0C7 0 0 7 0 15c0 11 15 23 15 23s15-12 15-23C30 7 23 0 15 0z" fill="#2563eb" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#fff"/></svg><span class="eco-place-ring"></span>',
      iconSize: [30, 38], iconAnchor: [15, 38],
    });
  }
  function placePin(latlng) {
    window.EcoManualPin = true;
    setInputs(latlng.lat, latlng.lng);
    if (!temp) { temp = L.marker(latlng, { icon: placeIcon(), riseOnHover: true, zIndexOffset: 1000 }); temp.bindPopup(t('here')); temp.addTo(map); }
    else temp.setLatLng(latlng);
    showHint(false);
  }
  function clearPin() { window.EcoManualPin = false; if (temp) { map.removeLayer(temp); temp = null; } showHint(!modalOpen()); }
  const isInteractive = (tg) => tg && tg.closest && tg.closest('.leaflet-interactive, .leaflet-marker-icon, .leaflet-popup, .leaflet-control, .eco-pin, .eco-cluster, .eco-place-pin, .eco-attr');

  window.addEventListener('ecoclean:mapready', (ev) => {
    map = ev.detail; if (!map) return;
    const host = document.getElementById('map') || document.getElementById('mapView');
    if (host) { hint = document.createElement('div'); hint.className = 'eco-place-hint'; hint.textContent = t('hint'); host.appendChild(hint); }

    map.on('click', (e) => { if (modalOpen()) return; if (isInteractive(e.originalEvent && e.originalEvent.target)) return; placePin(e.latlng); });

    const useLoc = document.getElementById('useLoc');
    if (useLoc) useLoc.addEventListener('click', () => { window.EcoManualPin = true; if (temp) { map.removeLayer(temp); temp = null; } showHint(false); });

    const m = modal();
    if (m) new MutationObserver(() => showHint(!window.EcoManualPin && !modalOpen())).observe(m, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('ecoclean:reported', clearPin);

    if (!document.getElementById('eco-place-style')) {
      const st = document.createElement('style'); st.id = 'eco-place-style';
      st.textContent =
        '.eco-place-hint{position:absolute;left:50%;bottom:78px;transform:translateX(-50%);z-index:800;background:rgba(20,36,29,.86);color:#fff;padding:8px 14px;border-radius:999px;font-size:.78rem;font-weight:600;box-shadow:0 6px 18px rgba(0,0,0,.25);pointer-events:none;white-space:nowrap;}' +
        '.eco-place-pin{position:relative;}' +
        '.eco-place-ring{position:absolute;left:50%;top:15px;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(37,99,235,.35);animation:eco-place-pulse 1.6s ease-out infinite;}' +
        '@keyframes eco-place-pulse{0%{transform:scale(.6);opacity:.8;}100%{transform:scale(2.4);opacity:0;}}';
      document.head.appendChild(st);
    }
  });
  document.addEventListener('change', (e) => { if (e.target && e.target.id === 'langSelect' && hint) hint.textContent = t('hint'); });
})();


/* === js/compare.js === */
/* compare.js — before/after comparison slider in verified-report popups (ADDITIVE).
 * Swaps the side-by-side before/after thumbnails for a draggable slider so the
 * clean-up "transformation" reads instantly. Only verified reports WITH an
 * after-photo. Pure DOM swap on popupopen; never touches app.js. */
(function () {
  'use strict';
  var L10N = { en: { b: 'Before', a: 'After' }, fr: { b: 'Avant', a: 'Après' }, ar: { b: 'قبل', a: 'بعد' } };
  var lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');
  var t = (k) => { var d = L10N[lang()] || L10N.en; return d[k]; };
  var esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function slider(before, after) {
    return '<div class="ba-slider">' +
      '<img class="ba-after" src="' + esc(after) + '" alt="' + t('a') + '">' +
      '<div class="ba-before-wrap"><img class="ba-before" src="' + esc(before) + '" alt="' + t('b') + '"></div>' +
      '<div class="ba-handle"></div>' +
      '<span class="ba-lab b">' + t('b') + '</span><span class="ba-lab a">' + t('a') + '</span>' +
      '<input type="range" min="0" max="100" value="50" class="ba-range" aria-label="compare">' +
      '</div>';
  }
  function wire(box) {
    var range = box.querySelector('.ba-range'), wrap = box.querySelector('.ba-before-wrap'), handle = box.querySelector('.ba-handle');
    var apply = (v) => { wrap.style.width = v + '%'; handle.style.left = v + '%'; };
    range.addEventListener('input', () => apply(range.value));
    apply(50);
  }

  window.addEventListener('ecoclean:mapready', (ev) => {
    var map = ev.detail; if (!map) return;
    map.on('popupopen', (e) => {
      var marker = e.popup._source; var id = marker && marker._reportId; if (!id) return;
      var rep = (window.EcoClean.reports || []).filter((r) => r.id === id)[0];
      if (!rep || rep.status !== 'verified' || !rep.afterPhoto) return;
      var el = e.popup.getElement(); var box = el && el.querySelector('.pop-imgs'); if (!box) return;
      var imgs = box.querySelectorAll('.pop-img'); if (imgs.length < 2) return;
      box.innerHTML = slider(imgs[0].getAttribute('src'), imgs[1].getAttribute('src'));
      wire(box);
    });
  });

  if (!document.getElementById('eco-compare-style')) {
    var st = document.createElement('style'); st.id = 'eco-compare-style';
    st.textContent =
      '.ba-slider{position:relative;width:200px;height:130px;overflow:hidden;border-radius:8px;margin:6px auto;user-select:none;-webkit-user-select:none;}' +
      '.ba-slider img{position:absolute;top:0;left:0;height:100%;object-fit:cover;}' +
      '.ba-after{width:100%;}' +
      '.ba-before-wrap{position:absolute;top:0;left:0;bottom:0;width:50%;overflow:hidden;}' +
      '.ba-before-wrap img{width:200px;max-width:none;}' +
      '.ba-handle{position:absolute;top:0;bottom:0;left:50%;width:3px;margin-left:-1.5px;background:#fff;box-shadow:0 0 4px rgba(0,0,0,.45);pointer-events:none;}' +
      '.ba-handle::after{content:"\\21C4";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;color:#0a5c3f;border-radius:50%;width:22px;height:22px;display:grid;place-items:center;font-size:12px;box-shadow:0 1px 4px rgba(0,0,0,.3);}' +
      '.ba-range{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:ew-resize;}' +
      '.ba-lab{position:absolute;bottom:4px;font-size:9px;font-weight:700;color:#fff;background:rgba(0,0,0,.5);padding:1px 6px;border-radius:99px;pointer-events:none;}' +
      '.ba-lab.b{left:4px;}.ba-lab.a{right:4px;}';
    document.head.appendChild(st);
  }
})();


/* === js/map-filter.js === */
/* map-filter.js — category + verified-only filters behind a "Filter" button placed
 * ABOVE the zoom control (ADDITIVE). Tapping the pill opens a frosted chip panel;
 * while it is open the zoom (+/-) slides FURTHER DOWN so it is never covered, and
 * slides back to just-below-the-Filter when the panel closes. The pill shows a
 * count badge while any filter is active. Filtering is applied at render time
 * inside app.js loadReports (EcoFilter.apply), so the clustered pins reflect the
 * selection while EcoClean.reports (heatmap/quests/leaderboard) keeps the full
 * dataset. Localized; tapping the map closes the panel.
 * Theming: injected colours are written as var(--token, lightFallback), so the
 * pill/panel/chips follow html[data-theme="dark"] via the custom-property
 * cascade with no duplicate dark-mode CSS. */
(function () {
  'use strict';
  var CATS = ['illegal_dumping', 'water', 'air_smoke', 'plastic_marine', 'other'];
  var ICONS = { illegal_dumping: '🗑️', water: '💧', air_smoke: '💨', plastic_marine: '🌊', other: '📍' };
  var cats = {}; CATS.forEach(function (c) { cats[c] = false; });
  var onlyVerified = false;
  var cityGeo = null; // {lat,lng,km} optional spatial constraint set by the city chip
  var anyCat = function () { return CATS.some(function (c) { return cats[c]; }); };
  var activeCount = function () { return CATS.filter(function (c) { return cats[c]; }).length + (onlyVerified ? 1 : 0); };
  var catLabel = function (k) { return (typeof window.catLabel === 'function' ? window.catLabel(k) : k); };
  var inCity = function (r) {
    if (!cityGeo || r.lat == null || r.lng == null) return true;
    var d = (window.EcoGeo && EcoGeo.distanceKm) ? EcoGeo.distanceKm(cityGeo.lat, cityGeo.lng, +r.lat, +r.lng) : 0;
    return d <= cityGeo.km;
  };
  function applyFilter(reports) { return (reports || []).filter(function (r) { return inCity(r) && (!anyCat() || cats[r.category]) && (!onlyVerified || r.status === 'verified'); }); }
  // City is a *spatial view*, not a category filter, so it intentionally does NOT
  // raise the pill's count badge — but it DOES narrow the rendered pins (loadReports
  // calls EcoFilter.apply). setCity/clearCity are driven by js/city.js.
  function setCity(lat, lng, km) { cityGeo = { lat: +lat, lng: +lng, km: +km }; }
  function clearCity() { cityGeo = null; }
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

  window.EcoFilter = { apply: applyFilter, setCity: setCity, clearCity: clearCity };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'langSelect') labels(); });

  if (!document.getElementById('eco-filters-style')) {
    var st = document.createElement('style'); st.id = 'eco-filters-style';
    st.textContent =
      '#eco-filterwrap{position:absolute;top:10px;left:10px;right:10px;z-index:1100;display:flex;flex-direction:column;align-items:flex-start;gap:6px;pointer-events:none;}' +
      '#eco-filterwrap > *{pointer-events:auto;}' +
      /* Theme-aware styling: every colour reads a :root design token with a
       * light-mode fallback — var(--surface,#fff) etc. When theme.js flips
       * html[data-theme="dark"] and redefines the tokens, this runtime-injected
       * UI re-themes with ZERO extra CSS, because custom properties cascade into
       * styles appended at any point in <head> (unlike hard-coded #fff). */
      '.eco-filter-toggle{display:inline-flex;align-items:center;gap:6px;background:var(--surface,#fff);border:1px solid var(--border-strong,#cfe2d8);color:var(--accent-dark,#0a5c3f);border-radius:999px;padding:7px 13px;font-size:.8rem;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(16,40,30,.18);font-family:inherit;}' +
      '.eco-filter-toggle.on{background:var(--accent-grad,linear-gradient(135deg,#198754,#0d9488));color:var(--on-accent,#fff);border-color:transparent;}' +
      '.eco-fcount{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:var(--surface,#fff);color:var(--accent-dark,#0a5c3f);font-size:.7rem;font-weight:800;}' +
      /* [hidden] must win: an explicit `display` above would otherwise beat the
       * UA [hidden]{display:none} rule (authored CSS > UA at equal specificity),
       * leaving an empty white dot. !important keeps the toggle clean when idle. */
      '.eco-fcount[hidden]{display:none!important;}' +
      '.eco-filter-panel{align-self:stretch;display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;max-height:0;opacity:0;overflow:hidden;transition:max-height .25s ease,opacity .2s ease,padding .2s ease;background:rgba(var(--surface-rgb,255,255,255),.95);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border:1px solid var(--border-strong,#cfe2d8);border-radius:14px;box-shadow:0 8px 24px rgba(16,40,30,.18);padding:0;}' +
      '.eco-filter-panel.open{max-height:120px;opacity:1;padding:8px;}' +
      '.eco-filter-panel::-webkit-scrollbar{height:0;}' +
      '.eco-fchip{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;border:1px solid var(--border-strong,#cfe2d8);background:var(--surface,#fff);color:var(--accent-dark,#0a5c3f);border-radius:999px;padding:6px 12px;font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit;flex:0 0 auto;}' +
      '.eco-fchip.on{background:var(--accent-grad,linear-gradient(135deg,#198754,#0d9488));color:var(--on-accent,#fff);border-color:transparent;}' +
      '.leaflet-top.leaflet-left{top:46px!important;transition:top .25s ease;}' +
      '#map.eco-filter-open .leaflet-top.leaflet-left{top:100px!important;}';
    document.head.appendChild(st);
  }
})();


/* === js/map-empty.js === */
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


