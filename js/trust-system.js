/* trust-system.js — popup up/down votes + TrustScore + auto-hide on 3+ flags.
   Trust = (VerifiedReports * 10) / (TotalReports + Flagged).
   Votes & per-reporter tallies persist in localStorage (additive state). */
(function () {
  const VOTES = 'votes';        // { [reportId]: 'up' | 'down' }
  const REPORTER = 'reporterTrust'; // { [name]: {verified,total,flagged} }

  function trustScore(t) { return t ? (t.verified * 10) / (t.total + t.flagged) : 0; }
  function getVotes() { return EcoStore.get(VOTES, {}); }

  function injectButtons(popupEl, reportId) {
    if (!popupEl || popupEl.querySelector('.vote-row')) return;
    const row = document.createElement('div');
    row.className = 'vote-row';
    row.innerHTML = '<button data-v="up">▲</button><span class="vs"></span><button data-v="down">▼</button>';
    popupEl.appendChild(row);
    const votes = getVotes();
    row.querySelector('.vs').textContent = votes[reportId] ? votes[reportId] : '—';
    row.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
      votes[reportId] = btn.dataset.v;
      EcoStore.set(VOTES, votes);
      row.querySelector('.vs').textContent = votes[reportId];
      evaluateFlags();
    }));
  }

  // Per-report flag count: hide ONLY the marker that reaches 3+ downvotes.
  function evaluateFlags() {
    const votes = getVotes();
    const counts = {};
    Object.entries(votes).forEach(([id, v]) => { if (v === 'down') counts[id] = (counts[id] || 0) + 1; });
    Object.entries(counts).forEach(([id, n]) => {
      if (n >= 3) {
        window.EcoClean.maps.forEach(map =>
          map.eachLayer(l => { if (l._reportId === id) map.removeLayer(l); }));
      }
    });
  }

  window.addEventListener('ecoclean:mapready', map => {
    map.on('popupopen', e => {
      const marker = e.popup._source;           // Leaflet stores the opener on _source
      const id = marker && marker._reportId;
      if (id) injectButtons(e.popup.getElement(), id);
    });
  });
  // Re-tag markers whenever reports change.
  window.EcoData.load().then(() => window.EcoClean.tagMarkers());
  window.EcoTrust = { trustScore, getTrust: () => EcoStore.get(REPORTER, {}) };
})();
