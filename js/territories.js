/* ============================================================================
 * territories.js — "Adopt a Spot" / Zone Guardians (Turf Wars)
 * ----------------------------------------------------------------------------
 * A viral gamification feature. Calculates "Zone Guardians" entirely on the 
 * frontend without needing a new SQL table. It groups the map into 1km grids, 
 * counts the verified clean-ups per citizen, and crowns the top cleaner of 
 * each area. Draws glowing gold polygons over their claimed turf.
 * ==========================================================================*/
(function () {
  'use strict';

  let mapInstance = null;
  let turfLayer = null;

  const L10N = {
    en: { toggle: '🛡️ Impact Zones', guardian: 'Lead Contributor', cleanups: 'verified clean-ups' },
    fr: { toggle: '🛡️ Zones d\'Impact', guardian: 'Contributeur Principal', cleanups: 'nettoyages vérifiés' },
    ar: { toggle: '🛡️ مناطق التأثير', guardian: 'المساهم الرئيسي', cleanups: 'تنظيفات مؤكدة' }
  };
  const lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');
  const t = (k) => (L10N[lang()] || L10N.en)[k];

  function drawTurfs() {
    if (!mapInstance || !window.EcoClean || !window.EcoClean.reports) return;
    
    if (turfLayer) mapInstance.removeLayer(turfLayer);
    turfLayer = L.layerGroup().addTo(mapInstance);

    const verified = window.EcoClean.reports.filter(r => r.status === 'verified' && r.lat && r.lng && r.reporterName && r.reporterName.toLowerCase() !== 'anonymous');
    
    // Group by ~1km grid cells (rounding lat/lng to 2 decimal places)
    const grids = {};
    verified.forEach(r => {
      const gLat = Math.round(r.lat * 100) / 100;
      const gLng = Math.round(r.lng * 100) / 100;
      const key = `${gLat},${gLng}`;
      if (!grids[key]) grids[key] = { lat: gLat, lng: gLng, users: {} };
      const name = r.reporterName;
      grids[key].users[name] = (grids[key].users[name] || 0) + 1;
    });

    Object.values(grids).forEach(grid => {
      // Find the user with the most verified cleanups in this grid
      let topUser = null;
      let maxCleans = 0;
      for (const [user, count] of Object.entries(grid.users)) {
        if (count > maxCleans) { maxCleans = count; topUser = user; }
      }

      // Must have at least 2 cleanups to "claim" a turf
      if (maxCleans >= 2) {
        // Draw a golden glowing polygon for the turf
        const bounds = [
          [grid.lat - 0.005, grid.lng - 0.005],
          [grid.lat + 0.005, grid.lng + 0.005]
        ];
        
        const rect = L.rectangle(bounds, {
          color: '#10b981', // Professional emerald green
          weight: 2,
          fillColor: '#10b981',
          fillOpacity: 0.1,
          className: 'eco-turf-pulse'
        }).addTo(turfLayer);

        rect.bindTooltip(`
          <div style="font-family:'Plus Jakarta Sans',sans-serif; text-align:center;">
            <strong style="color:#10b981; font-size:.85rem; text-transform:uppercase; letter-spacing:.05em;">⭐ ${t('guardian')}</strong>
            <div style="font-size:1.1rem; font-weight:800; color:#14241d; margin:4px 0;">${topUser}</div>
            <div style="font-size:.75rem; color:#5d7268;"><b>${maxCleans}</b> ${t('cleanups')}</div>
          </div>
        `, { permanent: true, direction: 'center', className: 'eco-turf-tt' });
      }
    });
  }

  const st = document.createElement('style');
  st.textContent = `
    .eco-turf-pulse { transition: fill-opacity 0.3s; }
    .eco-turf-tt { background: rgba(255,255,255,0.95); border: 1px solid #10b981; border-radius: 12px; box-shadow: 0 4px 16px rgba(16,185,129,0.15); padding: 8px 12px; }
    html[data-theme="dark"] .eco-turf-tt { background: rgba(22,32,27,0.95); border-color: #10b981; }
    html[data-theme="dark"] .eco-turf-tt div { color: #e7f1ea !important; }
  `;
  document.head.appendChild(st);

  let isEnabled = false;

  window.addEventListener('ecoclean:mapready', (e) => {
    mapInstance = e.detail;
    
    // Inject Toggle
    const filterWrap = document.getElementById('eco-filterwrap');
    if (!filterWrap) return;

    const btn = document.createElement('button');
    btn.className = 'eco-filter-toggle';
    btn.style.marginTop = '6px';
    btn.innerHTML = t('toggle');
    
    btn.onclick = () => {
      isEnabled = !isEnabled;
      if (isEnabled) {
        btn.classList.add('on');
        drawTurfs();
      } else {
        btn.classList.remove('on');
        if (turfLayer) mapInstance.removeLayer(turfLayer);
      }
    };
    filterWrap.appendChild(btn);
  });

  window.addEventListener('ecoclean:data', () => {
    if (isEnabled) drawTurfs();
  });

})();
