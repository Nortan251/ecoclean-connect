/* map-place.js — click/tap the map to drop a pin & set the report location (ADDITIVE).
 * An alternative to "Use my location": tap the map to choose the exact spot. A
 * manual placement raises a global EcoManualPin flag so the GPS/EXIF auto-logic in
 * camera-location.js will NOT overwrite the chosen point — explicit user intent
 * wins over sensors. A pulsing temporary marker shows the chosen point and a hint
 * chip invites the action. Both clear after a successful submit. Clicks on existing
 * markers / popups / controls are ignored (only empty map tiles place a pin). */
(function () {
  'use strict';
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
    if (!temp) { temp = L.marker(latlng, { icon: placeIcon(), riseOnHover: true, zIndexOffset: 1000 }); temp.bindPopup('📍 Report here'); temp.addTo(map); }
    else temp.setLatLng(latlng);
    showHint(false);
  }
  function clearPin() { window.EcoManualPin = false; if (temp) { map.removeLayer(temp); temp = null; } showHint(!modalOpen()); }
  const isInteractive = (t) => t && t.closest && t.closest('.leaflet-interactive, .leaflet-marker-icon, .leaflet-popup, .leaflet-control, .eco-pin, .eco-cluster, .eco-place-pin, .eco-attr');

  window.addEventListener('ecoclean:mapready', (ev) => {
    map = ev.detail; if (!map) return;
    const host = document.getElementById('map') || document.getElementById('mapView');
    if (host) { hint = document.createElement('div'); hint.className = 'eco-place-hint'; hint.textContent = '📍 Tap the map to drop a pin'; host.appendChild(hint); }

    map.on('click', (e) => { if (modalOpen()) return; if (isInteractive(e.originalEvent && e.originalEvent.target)) return; placePin(e.latlng); });

    // "Use my location" is also explicit intent -> mark manual so EXIF won't override it.
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
})();
