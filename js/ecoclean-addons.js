/* ecoclean-addons.js — shared utilities + non-destructive Leaflet map capture.
   Monkeypatches L.Map.initialize so every map instance is registered on
   window.EcoClean.maps (no edit to app.js). All new feature state lives in
   localStorage under the "ecoclean:" namespace, layered on your Supabase data. */
(function () {
  window.EcoClean = window.EcoClean || { maps: [], reports: [] };
  const NS = 'ecoclean:';

  // Additive key/value store (JSON serialized) — NOW USER-SCOPED.
  // ----------------------------------------------------------------------------
  // BUG FIX (per-account isolation): the old store used ONE global namespace, so
  // on a shared device every account saw the SAME local quest claims / local
  // points / local vouchers / streak fallback ("same data for everyone"). Server
  // data was always per-user, but this local layer was not. Now, when someone is
  // signed in, keys are namespaced by their user id (ecoclean:u:<uid>:<key>) so
  // each account gets a clean, independent local state — exactly like "a real
  // account". When signed out, keys stay global (ecoclean:<key>) = the anonymous
  // cooperative wallet. auth.js calls setUserScope(id) on login / null on logout.
  //
  // GLOBAL_KEYS are the EXCEPTIONS: values that are genuinely device- / app-level
  // and must NOT differ per account — theme, language, one-time onboarding, the
  // anti-spam cooldown (rate-limit is per-device on purpose), and the local
  // "cleaned" cache (a device-side mirror of verified status). Everything else is
  // per-account by default, which is the safe direction (a new key is isolated
  // unless you explicitly opt it into sharing).
  const GLOBAL_KEYS = { eco_theme: 1, ecoclean_lang: 1, eco_onboarded: 1, lastReportAt: 1, cleanedStatus: 1, dupDismissedAt: 1 };
  let _uid = null;
  function _prefix(k) { return (_uid && !GLOBAL_KEYS[k]) ? NS + 'u:' + _uid + ':' : NS; }
  window.EcoStore = {
    get(k, fb) { try { const v = localStorage.getItem(_prefix(k) + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } },
    set(k, v) { try { localStorage.setItem(_prefix(k) + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(_prefix(k) + k); } catch (e) {} },
    // (Re)scope the store to a user (pass null/undefined for anonymous). Called by
    // auth.js whenever the session changes so reads/writes hit the right bucket.
    setUserScope(id) { _uid = id || null; },
    uid() { return _uid; },
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
    }
  }

  // Backend status -> map status. A verified (after-photo confirmed) cleanup is
  // "cleaned" => GREEN on the map. (An earlier version mapped verified to a
  // "review"/yellow state that nothing ever produced; green is the intuitive
  // "problem resolved" colour and also keeps cleaned sites out of dispatch routes.)
  window.EcoClean.statusOf = function (id) {
    if (EcoStore.get('cleanedStatus', {})[id]) return 'cleaned';
    const r = window.EcoClean.reports.find(x => x.id === id);
    if (!r) return 'active';
    return r.status === 'verified' ? 'cleaned' : 'active';
  };

  // Spatial index "lat,lng" -> report id, rebuilt whenever reports change. This is
  // the single biggest map-perf win: the old tagMarkers() re-scanned EVERY report
  // for EVERY marker (O(markers * reports)) on a timer, which is what made the map
  // lag as the dataset grew. With the index, tagging is O(markers).
  window.EcoClean._idx = new Map();
  window.EcoClean.buildIndex = function () {
    const m = new Map();
    (window.EcoClean.reports || []).forEach((r) => m.set(r.lat.toFixed(6) + ',' + r.lng.toFixed(6), r.id));
    window.EcoClean._idx = m;
  };
  window.EcoClean.tagMarkers = function () {
    const idx = window.EcoClean._idx;
    window.EcoClean.maps.forEach(map => {
      map.eachLayer(l => {
        if (l.getLatLng && typeof l.setStyle === 'function' && !l._reportId) {
          const ll = l.getLatLng();
          const id = idx.get(ll.lat.toFixed(6) + ',' + ll.lng.toFixed(6));
          if (id) l._reportId = id;
        }
      });
    });
  };

  // Read-only fetch of core reports. Rebuilds the spatial index, then fires a
  // single "ecoclean:data" event so every piece of derived UI (wallet, quests,
  // analytics) refreshes from one source of truth instead of polling separately.
  window.EcoData = {
    async load() {
      try {
        const d = await (await fetch('/api/reports')).json();
        window.EcoClean.reports = d || [];
      } catch (e) { /* keep last-known reports so the UI never blanks offline */ }
      window.EcoClean.buildIndex();
      window.dispatchEvent(new CustomEvent('ecoclean:data', { detail: window.EcoClean.reports }));
      return window.EcoClean.reports;
    }
  };

  window.addEventListener('ecoclean:mapready', () => setTimeout(window.EcoClean.tagMarkers, 800));
  window.EcoData.load().then(() => setTimeout(window.EcoClean.tagMarkers, 800));
})();

// Shared EXIF Date Parser
window.EcoClean.parseExifDate = function(raw) {
  if (!raw) return null;
  const m = String(raw).match(/(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
};

// Badge Tier System
window.EcoClean.getBadge = function(points) {
  const p = points || 0;
  if (p >= 1000) return { label: 'Forest Guardian', icon: '👑', color: '#f59e0b', id: 'tier-4' };
  if (p >= 500) return { label: 'Tree', icon: '🌳', color: '#10b981', id: 'tier-3' };
  if (p >= 100) return { label: 'Sprout', icon: '🌿', color: '#34d399', id: 'tier-2' };
  return { label: 'Seedling', icon: '🌱', color: '#6ee7b7', id: 'tier-1' };
};

// Trilingual Badge Titles
window.EcoClean.getBadgeLabel = function(id, lang) {
  const dict = {
    'tier-4': { en: 'Forest Guardian', fr: 'Gardien de la Forêt', ar: 'حارس الغابة' },
    'tier-3': { en: 'Tree', fr: 'Arbre', ar: 'شجرة' },
    'tier-2': { en: 'Sprout', fr: 'Pousse', ar: 'برعم' },
    'tier-1': { en: 'Seedling', fr: 'Jeune pousse', ar: 'بذرة' }
  };
  return dict[id][lang] || dict[id].en;
};
