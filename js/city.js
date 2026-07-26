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
  function set(name, lat, lng) {
    EcoStore.set(LS.name, name || null);
    if (isFinite(lat)) EcoStore.set(LS.lat, String(lat));
    if (isFinite(lng)) EcoStore.set(LS.lng, String(lng));
    window.dispatchEvent(new CustomEvent('ecoclean:city', { detail: get() }));
    render();
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
    return geolocate().then(function (g) { return g ? reverse(g.lat, g.lng) : null; }).then(function (c) { if (c) set(c.name, c.lat, c.lng); return get(); });
  }
  function manualSet() {
    var name = window.prompt(t().prompt, get().name || '');
    if (name === null) return;                 // cancelled
    name = name.trim();
    if (!name) return;
    var g = get();
    set(name, g.lat, g.lng);                   // keep existing coords if any
    if (!isFinite(g.lat)) geolocate().then(function (p) { if (p) { EcoStore.set(LS.lat, String(p.lat)); EcoStore.set(LS.lng, String(p.lng)); render(); } });
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
    chip.innerHTML = '<span aria-hidden="true">🏙️</span> <span class="ec-name"></span>' + (c != null ? ' <span class="ec-count"></span>' : '');
    chip.querySelector('.ec-name').textContent = label;
    if (c != null) chip.querySelector('.ec-count').textContent = '· ' + fill(t().count, c);
    chip.title = t().detect + (g.name ? ': ' + g.name : '');
  }

  document.addEventListener('ecoclean:data', render);     // recount when reports load
  document.addEventListener('ecoclean:city', render);
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'langSelect') render(); });
  function boot() { render(); autoDetect(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.EcoCity = { get: get, set: set, detect: autoDetect, countNear: countNear, reverse: reverse, CITY_RADIUS_KM: CITY_RADIUS_KM };

  if (!document.getElementById('eco-city-style')) {
    var st = document.createElement('style'); st.id = 'eco-city-style';
    st.textContent =
      '.eco-city-chip{display:inline-flex;align-items:center;gap:5px;background:var(--surface-2,rgba(255,255,255,.16));color:var(--text,#fff);border:1px solid var(--border-strong,rgba(255,255,255,.28));border-radius:999px;padding:5px 11px;font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit;margin-left:2px;white-space:nowrap;}' +
      '.eco-city-chip .ec-count{color:var(--muted,#cfe);font-weight:600;font-size:.72rem;}';
    document.head.appendChild(st);
  }
})();
