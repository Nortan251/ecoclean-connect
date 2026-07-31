/* ============================================================================
 * decay.js — The "Broken Window" Decay Algorithm
 * ----------------------------------------------------------------------------
 * Analyzes the age of unverified reports and applies visual "rot" to the map.
 * 
 * Logic:
 * 1. Checks how many hours old an 'active' report is.
 * 2. Stage 1 (>24 hours): The pin turns dark, rusty red.
 * 3. Stage 2 (>48 hours): A brown "pollution haze" begins spreading from the pin.
 * 4. Stage 3 (>72 hours): The haze expands massively and the pin pulses warning.
 * 
 * Drives visual urgency to clean up ignored areas before they "infect" the map.
 * ==========================================================================*/
(function () {
  'use strict';

  let decayLayer = null;
  let decayEnabled = true;

  // Custom colors for decay states
  const COLORS = {
    fresh: '#dc3545',      // Standard bright red (0-24h)
    rotting: '#991b1b',    // Dark crimson (24-48h)
    toxic: '#450a0a'       // Almost black/brown (>48h)
  };

  function getDecayStage(createdAt) {
    if (!createdAt) return 0;
    const hoursOld = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursOld > 72) return 3; // Severe Toxic
    if (hoursOld > 48) return 2; // Spreading Rot
    if (hoursOld > 24) return 1; // Aging
    return 0; // Fresh
  }

  function applyDecay() {
    const map = window.EcoMap && window.EcoMap.get ? window.EcoMap.get() : null;
    const reports = window.EcoClean && window.EcoClean.reports ? window.EcoClean.reports : [];
    
    if (!map || !reports.length) return;

    // Clean up old layer
    if (decayLayer) map.removeLayer(decayLayer);
    if (!decayEnabled) return;
    
    decayLayer = L.layerGroup().addTo(map);

    // Filter to only active reports
    const active = reports.filter(r => r.status !== 'verified' && r.status !== 'rejected');

    // Override the pinStyle dynamically in app.js
    window.EcoDecayPinStyle = function(r) {
      if (r.status === 'verified') return { color: '#10b981', fillColor: '#10b981' };
      const stage = getDecayStage(r.createdAt);
      if (stage >= 2) return { color: COLORS.toxic, fillColor: COLORS.toxic };
      if (stage === 1) return { color: COLORS.rotting, fillColor: COLORS.rotting };
      return { color: COLORS.fresh, fillColor: COLORS.fresh };
    };

    active.forEach(r => {
      const stage = getDecayStage(r.createdAt);
      if (stage < 2) return; // Only draw haze for Stage 2+

      const radius = stage === 3 ? 400 : 150; // Spread radius in meters
      const opacity = stage === 3 ? 0.4 : 0.2;
      
      const haze = L.circle([r.lat, r.lng], {
        color: 'transparent',
        fillColor: '#78350f', // Toxic brown
        fillOpacity: opacity,
        className: 'eco-decay-haze'
      }).addTo(decayLayer);

      // Add a subtle pulsing warning ring
      if (stage === 3) {
        L.circle([r.lat, r.lng], {
          color: '#ef4444',
          weight: 1,
          fillColor: 'transparent',
          className: 'eco-decay-pulse'
        }).addTo(decayLayer);
      }
    });
  }

  // Inject CSS for the decay animations
  const st = document.createElement('style');
  st.textContent = `
    .eco-decay-haze { animation: haze-breathe 4s infinite alternate ease-in-out; pointer-events: none; }
    @keyframes haze-breathe { 0% { fill-opacity: 0.1; } 100% { fill-opacity: 0.35; transform: scale(1.05); } }
    .eco-decay-pulse { animation: toxic-pulse 2s infinite; pointer-events: none; }
    @keyframes toxic-pulse { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(3); opacity: 0; } }
  `;
  document.head.appendChild(st);

  // Hook into data load
  window.addEventListener('ecoclean:data', applyDecay);
  window.addEventListener('ecoclean:mapready', () => setTimeout(applyDecay, 500));

})();
