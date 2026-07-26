/* gamification.js — Weekly Quests + Neighborhood Leaderboard.
   ANTI-ABUSE MODEL: every quest now requires BOTH reporting AND verification to be
   claimable. A bad actor can't farm rewards by spamming reports, because the verify
   side only advances when clean-ups are actually confirmed (an admin action with an
   after-photo). Progress for both halves is read from the shared, server-verified
   dataset, so it's cooperative AND tamper-resistant. Points persist locally; the
   list also listens to ecoclean:data for live progress. (Quest copy is English-only
   — a known i18n gap that can be localized later.) */
(function () {
  const QUESTS = [
    { id: 'q1', icon: '🌊', text: 'Plastic Patrol — report 3 plastic/marine sites AND confirm 2 clean-ups → Eco Guardian +50 pts', repNeed: 3, repCat: 'plastic_marine', verNeed: 2, verCat: null, points: 50 },
    { id: 'q2', icon: '💧', text: 'Water Hero — report 2 water sites AND confirm 2 water clean-ups → +40 pts', repNeed: 2, repCat: 'water', verNeed: 2, verCat: 'water', points: 40 },
    { id: 'q3', icon: '🏆', text: 'Cleanup Champion — report 2 sites (any) AND confirm 3 clean-ups → +60 pts', repNeed: 2, repCat: null, verNeed: 3, verCat: null, points: 60 },
  ];
  function zoneOf(r) { return Math.round(r.lat * 100) / 100 + ',' + Math.round(r.lng * 100) / 100; }
  // kind='report' counts all reports (optionally of cat); kind='verify' counts verified only.
  function count(reports, kind, cat) { return reports.filter((r) => (kind === 'verify' ? r.status === 'verified' : true) && (!cat || r.category === cat)).length; }

  if (!document.getElementById('eco-quest-style')) {
    const st = document.createElement('style'); st.id = 'eco-quest-style';
    st.textContent =
      '.qrow{display:flex;align-items:center;gap:8px;margin:6px 0;font-size:.78rem;color:#5d7268;}' +
      '.qrow>span{width:132px;flex-shrink:0;font-weight:600;}' +
      '.qrow .bar{flex:1;}' +
      '.qlock{color:#9aa89f;font-size:.78rem;}';
    document.head.appendChild(st);
  }

  function render() {
    const qb = document.querySelector('#quests'); if (qb) {
      const reports = window.EcoClean.reports || [];
      qb.innerHTML = QUESTS.map((q) => {
        const repDone = count(reports, 'report', q.repCat);
        const verDone = count(reports, 'verify', q.verCat);
        const repPct = Math.min(100, (repDone / q.repNeed) * 100);
        const verPct = Math.min(100, (verDone / q.verNeed) * 100);
        const done = repDone >= q.repNeed && verDone >= q.verNeed;
        const claimed = EcoStore.get('questClaimed', {})[q.id];
        const repRow = '<div class="qrow"><span>📍 Report ' + Math.min(repDone, q.repNeed) + '/' + q.repNeed + '</span><div class="bar"><div class="bar-fill" style="width:' + repPct + '%"></div></div></div>';
        const verRow = '<div class="qrow"><span>✅ Verify ' + Math.min(verDone, q.verNeed) + '/' + q.verNeed + '</span><div class="bar"><div class="bar-fill" style="width:' + verPct + '%"></div></div></div>';
        const action = claimed ? '<span>✅ claimed</span>' : (done ? '<button data-q="' + q.id + '">Claim ' + q.points + ' pts</button>' : '<span class="qlock">🔒 complete both to claim</span>');
        return '<div class="quest"><b>' + (q.icon ? q.icon + ' ' : '') + q.text + '</b>' + repRow + verRow + action + '</div>';
      }).join('');
      qb.querySelectorAll('button[data-q]').forEach((b) => b.onclick = () => {
        const c = EcoStore.get('questClaimed', {}); c[b.dataset.q] = true; EcoStore.set('questClaimed', c);
        EcoStore.set('points', EcoStore.get('points', 0) + (QUESTS.find((q) => q.id === b.dataset.q).points));
        render();
        window.dispatchEvent(new CustomEvent('ecoclean:bonus')); // tell the rewards wallet to refresh
      });
    }
    const lb = document.querySelector('#leaderboard'); if (lb) {
      const zones = {};
      (window.EcoClean.reports || []).forEach((r) => { const z = zoneOf(r); zones[z] = (zones[z] || 0) + (r.status === 'verified' ? 1 : 0); });
      const ranked = Object.entries(zones).sort((a, b) => b[1] - a[1]).slice(0, 10);
      lb.innerHTML = '<ol>' + ranked.map(([z, n]) => '<li>Zone ' + z + ' — ' + n + ' verified</li>').join('') + '</ol>';
    }
  }
  window.addEventListener('ecoclean:data', render);
  window.EcoData.load().then(render);
  setInterval(render, 5000);
})();
