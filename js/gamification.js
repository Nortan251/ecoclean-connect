/* gamification.js — Weekly Quests + Neighborhood Leaderboard.
   Progress/points persist in localStorage. Neighborhood is derived from a
   coarse lat/lng grid (replace with a real geocoded field when available).
   Quests now have a `type`: 'report' tracks reports of a category (as before),
   'verify' tracks VERIFIED clean-ups (optionally per category) — so confirming
   an after-photo in the admin panel progresses quests too, not just reporting.
   Both read the shared server dataset (cooperative milestones), which is why the
   progress is tamper-resistant. (Quest copy is English-only for now — a known
   i18n gap that can be localized later.) */
(function () {
  const QUESTS = [
    { id: 'q1', type: 'report', icon: '📍', text: 'Report 3 plastic/marine sites → Eco Guardian badge + 50 pts', need: 3, cat: 'plastic_marine', points: 50 },
    { id: 'q2', type: 'report', icon: '📍', text: 'Report 2 water-pollution sites + 30 pts', need: 2, cat: 'water', points: 30 },
    { id: 'q3', type: 'verify', icon: '✅', text: 'Confirm 3 clean-ups (verify with an after-photo) → Cleanup Champion + 60 pts', need: 3, points: 60 },
    { id: 'q4', type: 'verify', icon: '✅', text: 'Confirm 2 water clean-ups → Water Hero + 40 pts', need: 2, cat: 'water', points: 40 },
  ];
  function zoneOf(r) { return Math.round(r.lat * 100) / 100 + ',' + Math.round(r.lng * 100) / 100; }

  function render() {
    const qb = document.querySelector('#quests'); if (qb) {
      const reports = window.EcoClean.reports || [];
      qb.innerHTML = QUESTS.map(q => {
        // Verify quests count confirmed clean-ups; report quests count reports.
        const done = q.type === 'verify'
          ? reports.filter(r => r.status === 'verified' && (!q.cat || r.category === q.cat)).length
          : reports.filter(r => r.category === q.cat).length;
        const pct = Math.min(100, (done / q.need) * 100);
        const claimed = EcoStore.get('questClaimed', {})[q.id];
        return '<div class="quest"><b>' + (q.icon ? q.icon + ' ' : '') + q.text + '</b><div class="bar"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
          (claimed ? '<span>✅ claimed</span>' : (done >= q.need ? '<button data-q="' + q.id + '">Claim ' + q.points + ' pts</button>' : '<span>' + done + '/' + q.need + '</span>')) + '</div>';
      }).join('');
      qb.querySelectorAll('button[data-q]').forEach(b => b.onclick = () => {
        const c = EcoStore.get('questClaimed', {}); c[b.dataset.q] = true; EcoStore.set('questClaimed', c);
        EcoStore.set('points', EcoStore.get('points', 0) + (QUESTS.find(q => q.id === b.dataset.q).points));
        render();
        window.dispatchEvent(new CustomEvent('ecoclean:bonus')); // tell the rewards wallet to refresh
      });
    }
    const lb = document.querySelector('#leaderboard'); if (lb) {
      const zones = {};
      (window.EcoClean.reports || []).forEach(r => { const z = zoneOf(r); zones[z] = (zones[z] || 0) + (r.status === 'verified' ? 1 : 0); });
      const ranked = Object.entries(zones).sort((a, b) => b[1] - a[1]).slice(0, 10);
      lb.innerHTML = '<ol>' + ranked.map(([z, n]) => '<li>Zone ' + z + ' — ' + n + ' verified</li>').join('') + '</ol>';
    }
  }
  // Re-render as reports load/update (incl. live via the ecoclean:data event).
  window.addEventListener('ecoclean:data', render);
  window.EcoData.load().then(render);
  setInterval(render, 5000);
})();
