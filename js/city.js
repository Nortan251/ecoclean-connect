/* ============================================================================
 * city.js — multi-city FOUNDATION (reverse-geocode + city chip + per-city count)
 * ----------------------------------------------------------------------------
 * EcoClean started as "for Morocco"; to grow nationally it must know WHICH city
 * a user is in. Full multi-tenancy (a city column + RLS per zone + per-city admin)
 * is a schema project we defer; this module lays the groundwork that all of it
 * stands on, with NO schema change:
 *   - detect the user's city once via reverse-geocoding their GPS (Nominatim /
 *     OpenStreetMap, the same open-data family as our map tiles), cache it;
 *   - let the user override the city by tapping the chip (manual name + we keep
 *     the detected coords, or re-detect);
 *   - compute a live "reports in this city" count client-side by Haversine over
 *     EcoClean.reports within CITY_RADIUS_KM of the city anchor (so the chip
 *     shows local momentum without a per-city server aggregation yet).
 * The chip is injected into .topnav (additive), theme-aware, localized. We never
 * BLOCK on geolocation: if the user denies it, the chip offers manual entry and
 * the app works exactly as before. Reusing EcoGeo.distanceKm keeps one distance
 * implementation in the codebase.
 * ==========================================================================*/
(function () {
  'use strict';
  var CITY_RADIUS_KM = 15;     // "in this city" radius for the live count
  var LS = { name: 'eco_city_name', lat: 'eco_city_lat', lng: 'eco_city_lng' };
  var L = {
    en: { detect: 'Your city', prompt: 'Type your city name:', none: 'Set city', count: '{n} near you' },
    fr: { detect: 'Votre ville', prompt: 'Nom de votre ville :', none: 'Choisir la ville', count: '{n} près de vous' },
    ar: { detect: 'مدينتك', prompt: 'اكتب اسم مدينتك:', none: 'اختر المدينة', count: '{n} بقربك' },
  };
  var lang = function () { return (typeof window.getLang === 'function' ? getLang() : 'en'); };
  var t = function () { return L[lang()] || L.en; };
  var fill = function (s, n) { return String(s).replace('{n}', n); };
  var dist = function (a, b, c, d) { return (window.EcoGeo && EcoGeo.distanceKm) ? EcoGeo.distanceKm(a, b, c, d) : 99999; };

  function get() {
    var name = EcoStore.get(LS.name, null);
    var lat = parseFloat(EcoStore.get(LS.lat, NaN));
    var lng = parseFloat(EcoStore.get(LS.lng, NaN));
    return { name: name, lat: isFinite(lat) ? lat : null, lng: isFinite(lng) ? lng : null };
  }
  function set(name, lat, lng, noFly, noFilter) {
    EcoStore.set(LS.name, name || null);
    if (isFinite(lat)) EcoStore.set(LS.lat, String(lat));
    if (isFinite(lng)) EcoStore.set(LS.lng, String(lng));
    // Drive the MAP: constrain the rendered pins to this city's radius (EcoFilter)
    // and fly the view to it. This is what makes the chip useful — the city is now
    // a real spatial filter, not a label. noFly/noFilter=true for silent detect &
    // boot (pre-fill the chip without yanking the camera or hiding pins).
    if (!noFilter) {
      if (name && isFinite(lat) && window.EcoFilter && EcoFilter.setCity) EcoFilter.setCity(lat, lng, CITY_RADIUS_KM);
      else if (window.EcoFilter && EcoFilter.clearCity) EcoFilter.clearCity();
    }
    window.dispatchEvent(new CustomEvent('ecoclean:city', { detail: get(), noFly: !!noFly }));
    if (!noFly && !noFilter && name && isFinite(lat) && window.EcoMap && EcoMap.flyTo) EcoMap.flyTo(lat, lng, 12);
    if (!noFilter && window.loadReports) window.loadReports();   // re-filter pins to the city
    render();
  }

  /* Forward-geocode a typed city name -> coords (Nominatim search). */
  function forward(name) {
    var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(name) + '&accept-language=' + lang();
    return fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (arr) { return (arr && arr[0]) ? { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) } : null; })
      .catch(function () { return null; });
  }
  /* Reverse-geocode lat/lng -> city name via Nominatim. Returns {name,lat,lng}. */
  function reverse(lat, lng) {
    var url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=10&accept-language=' + lang();
    return fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.address) return null;
        var a = j.address;
        var name = a.city || a.town || a.village || a.municipality || a.county || a.state || null;
        return name ? { name: name, lat: lat, lng: lng } : null;
      }).catch(function () { return null; });
  }
  function geolocate() {
    return new Promise(function (res) {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(function (p) { res({ lat: p.coords.latitude, lng: p.coords.longitude }); }, function () { res(null); }, { timeout: 8000, maximumAge: 600000 });
    });
  }
  /* Auto-detect if we have no city yet. Silent: never prompts, never blocks UI. */
  function autoDetect() {
    if (get().name) return Promise.resolve(get());
    return geolocate().then(function (g) { return g ? reverse(g.lat, g.lng) : null; }).then(function (c) { if (c) set(c.name, c.lat, c.lng, true, true); return get(); });  // detect = pre-fill only
  }
  function manualSet() {
    var cur = get();
    var name = window.prompt(t().prompt, cur.name || '');
    if (name === null) return;                 // cancelled -> no change
    name = name.trim();
    if (!name) { set(null, null, null); if (window.EcoMap && EcoMap.get && EcoMap.get()) { var m = EcoMap.get(); if (m && m._ecoHome) m.flyTo(m._ecoHome.c, m._ecoHome.z); } return; } // cleared -> drop filter
    // Remember the first (home) view so "clear" can return to it.
    var m0 = window.EcoMap && EcoMap.get && EcoMap.get();
    if (m0 && !m0._ecoHome) m0._ecoHome = { c: m0.getCenter(), z: m0.getZoom() };
    forward(name).then(function (g) {
      if (g) set(name, g.lat, g.lng);
      else { set(name, cur.lat, cur.lng); }    // unknown name: keep label + old coords
    });
  }

  /* Count reports within CITY_RADIUS_KM of the city anchor (client-side). */
  function countNear() {
    var g = get(); if (!isFinite(g.lat)) return null;
    var list = (window.EcoClean && window.EcoClean.reports) || [], n = 0;
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (r.lat != null && r.lng != null && dist(g.lat, g.lng, +r.lat, +r.lng) <= CITY_RADIUS_KM) n++;
    }
    return n;
  }

  var chip = null;
  function ensureChip() {
    if (chip) return chip;
    var nav = document.querySelector('.topnav');
    var langSel = document.getElementById('langSelect');
    if (!nav) return null;
    chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'eco-city-chip'; chip.id = 'ecoCityChip';
    chip.setAttribute('aria-label', t().detect);
    nav.insertBefore(chip, langSel);           // sits just before the language selector
    chip.addEventListener('click', manualSet);
    return chip;
  }
  function render() {
    if (!ensureChip()) return;
    var g = get(), c = countNear();
    var label = g.name || t().none;
    var active = !!(g.name && isFinite(g.lat));
    chip.classList.toggle('ec-active', active);
    chip.innerHTML = '<span aria-hidden="true">🏙️</span> <span class="ec-name"></span>' + (active ? ' <span class="ec-fx">⛶</span>' : '') + (c != null ? ' <span class="ec-count"></span>' : '');
    chip.querySelector('.ec-name').textContent = label;
    if (c != null) chip.querySelector('.ec-count').textContent = '· ' + fill(t().count, c);
    chip.title = active ? (t().detect + ': ' + g.name + ' — ' + (lang() === 'ar' ? 'اضغط للتغيير أو المسح' : (lang() === 'fr' ? 'toucher pour changer/effacer' : 'tap to change / clear'))) : t().detect;
  }

  document.addEventListener('ecoclean:data', render);     // recount when reports load
  document.addEventListener('ecoclean:city', render);
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'langSelect') render(); });
  function boot() {
    var g = get();
    if (g.name && isFinite(g.lat) && window.EcoFilter && EcoFilter.setCity) EcoFilter.setCity(g.lat, g.lng, CITY_RADIUS_KM); // re-apply a city the user previously CONFIRMED
    render();
    autoDetect();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.EcoCity = { get: get, set: set, detect: autoDetect, countNear: countNear, reverse: reverse, CITY_RADIUS_KM: CITY_RADIUS_KM };

  if (!document.getElementById('eco-city-style')) {
    var st = document.createElement('style'); st.id = 'eco-city-style';
    st.textContent =
      '.eco-city-chip{display:inline-flex;align-items:center;gap:5px;background:var(--surface-2,rgba(255,255,255,.16));color:var(--text,#fff);border:1px solid var(--border-strong,rgba(255,255,255,.28));border-radius:999px;padding:5px 11px;font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit;margin-left:2px;white-space:nowrap;}' +
      '.eco-city-chip .ec-count{color:var(--muted,#cfe);font-weight:600;font-size:.72rem;}' +
      '.eco-city-chip.ec-active{background:var(--accent-grad,linear-gradient(135deg,#198754,#0d9488));color:var(--on-accent,#fff);border-color:transparent;}' +
      '.eco-city-chip.ec-active .ec-count{color:rgba(255,255,255,.85);}' +
      '.eco-city-chip .ec-fx{font-size:.7rem;opacity:.9;}';
    document.head.appendChild(st);
  }
})();
