/* ecoclean-addons.js — shared utilities + non-destructive Leaflet map capture.
   Monkeypatches L.Map.initialize so every map instance is registered on
   window.EcoClean.maps (no edit to app.js). All new feature state lives in
   localStorage under the "ecoclean:" namespace, layered on your Supabase data. */
(function () {
  window.EcoClean = window.EcoClean || { maps: [], reports: [] };
  const NS = 'ecoclean:';

  // Additive key/value store (JSON serialized).
  window.EcoStore = {
    get(k, fb) { try { const v = localStorage.getItem(NS + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } },
    set(k, v) { localStorage.setItem(NS + k, JSON.stringify(v)); }
  };

  // Haversine great-circle distance (km) — used by dispatch clustering.
  window.EcoGeo = {
    distanceKm(a, b) {
      const R = 6371, r = d => (d * Math.PI) / 180;
      const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
      const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    }
  };

  // Capture Leaflet map instances (installed BEFORE app.js creates the map).
  if (window.L && L.Map && L.Map.prototype.initialize) {
    const orig = L.Map.prototype.initialize;
    L.Map.prototype.initialize = function (id, opts) {
      const ret = orig.apply(this, arguments);
      window.EcoClean.maps.push(this);
      window.dispatchEvent(new CustomEvent('ecoclean:mapready', { detail: this }));
      return ret;
    };
  }

  // Backend status (reported/verified) -> spec status (active/review/cleaned).
  // "cleaned" is a net-new local flag stored in localStorage.
  window.EcoClean.statusOf = function (id) {
    if (EcoStore.get('cleanedStatus', {})[id]) return 'cleaned';
    const r = window.EcoClean.reports.find(x => x.id === id);
    if (!r) return 'active';
    return r.status === 'verified' ? 'review' : 'active';
  };

  // Tag Leaflet circleMarkers with their report id by matching coordinates.
  window.EcoClean.tagMarkers = function () {
    window.EcoClean.maps.forEach(map => {
      map.eachLayer(l => {
        if (l.getLatLng && typeof l.setStyle === 'function' && !l._reportId) {
          const ll = l.getLatLng();
          const rep = window.EcoClean.reports.find(r => Math.abs(r.lat - ll.lat) < 1e-6 && Math.abs(r.lng - ll.lng) < 1e-6);
          if (rep) l._reportId = rep.id;
        }
      });
    });
  };

  // Read-only fetch of core reports from your existing API.
  window.EcoData = {
    async load() {
      try { const d = await (await fetch('/api/reports')).json(); window.EcoClean.reports = d || []; return d || []; }
      catch (e) { return []; }
    }
  };

  window.addEventListener('ecoclean:mapready', () => setTimeout(window.EcoClean.tagMarkers, 800));
  window.EcoData.load().then(() => setTimeout(window.EcoClean.tagMarkers, 800));
})();
