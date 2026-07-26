/* gamification.js — Quests + leaderboards (Module F part 2). Every quest needs BOTH
 * a report target AND a verify target (anti-abuse: a lone actor can't farm them).
 *   * ANONYMOUS: progress + claimed state are local (cooperative / honour system).
 *   * SIGNED IN: progress still reads the shared data, but claiming is validated +
 *     recorded SERVER-SIDE via /api/quest-claim (real server points; double-claims
 *     and unmet conditions are blocked). The neighbourhood (zones) board stays. */
(function () {
  const QUESTS = [
    { id: 'q1', icon: '🌊', text: 'Plastic Patrol — 3 plastic/marine reports AND 2 confirmed clean-ups → +50 pts', repNeed: 3, repCat: 'plastic_marine', verNeed: 2, verCat: null, points: 50 },
    { id: 'q2', icon: '💧', text: 'Water Hero — 2 water reports AND 2 confirmed water clean-ups → +40 pts', repNeed: 2, repCat: 'water', verNeed: 2, verCat: 'water', points: 40 },
    { id: 'q3', icon: '🏆', text: 'Cleanup Champion — 2 reports (any) AND 3 confirmed clean-ups → +60 pts', repNeed: 2, repCat: null, verNeed: 3, verCat: null, points: 60 },
  ];
  const isAuthed = () => !!(window.EcoAuth && EcoAuth.getUser && EcoAuth.getUser());
  const count = (reports, kind, cat) => reports.filter((r) => (kind === 'verify' ? r.status === 'verified' : true) && (!cat || r.category === cat)).length;
  const zoneOf = (r) => Math.round(r.lat * 100) / 100 + ',' + Math.round(r.lng * 100) / 100;
  const claimedList = () => { if (isAuthed()) { const u = EcoAuth.getUser(); return (u && u.claimedQuests) || []; } const c = EcoStore.get('questClaimed', {}); return Object.keys(c).filter((k) => c[k]); };

  if (!document.getElementById('eco-quest-style')) {
    const st = document.createElement('style'); st.id = 'eco-quest-style';
    st.textContent =
      '.qrow{display:flex;align-items:center;gap:8px;margin:6px 0;font-size:.78rem;color:#5d7268;}' +
      '.qrow>span{width:132px;flex-shrink:0;font-weight:600;}' +
      '.qrow .bar{flex:1;}' +
      '.qlock{color:#9aa89f;font-size:.78rem;}';
    document.head.appendChild(st);
  }

  function claim(id, btn) {
    if (isAuthed()) {
      const tok = EcoAuth.getToken(); if (!tok) return;
      btn.disabled = true; const old = btn.textContent; btn.textContent = 'Claiming…';
      fetch('/api/quest-claim', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ questId: id }) })
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then(() => { if (EcoAuth.refresh) EcoAuth.refresh(); render(); })
        .catch(() => { btn.disabled = false; btn.textContent = old; alert('Quest not complete yet, or already claimed.'); });
    } else {
      const c = EcoStore.get('questClaimed', {}); c[id] = true; EcoStore.set('questClaimed', c);
      EcoStore.set('points', EcoStore.get('points', 0) + (QUESTS.find((q) => q.id === id).points));
      render(); window.dispatchEvent(new CustomEvent('ecoclean:bonus'));
    }
  }

  function render() {
    const qb = document.querySelector('#quests'); if (qb) {
      const reports = window.EcoClean.reports || [];
      const claimed = claimedList();
      qb.innerHTML = QUESTS.map((q) => {
        const repDone = count(reports, 'report', q.repCat), verDone = count(reports, 'verify', q.verCat);
        const repPct = Math.min(100, (repDone / q.repNeed) * 100), verPct = Math.min(100, (verDone / q.verNeed) * 100);
        const done = repDone >= q.repNeed && verDone >= q.verNeed;
        const isClaimed = claimed.indexOf(q.id) >= 0;
        const repRow = '<div class="qrow"><span>📍 Report ' + Math.min(repDone, q.repNeed) + '/' + q.repNeed + '</span><div class="bar"><div class="bar-fill" style="width:' + repPct + '%"></div></div></div>';
        const verRow = '<div class="qrow"><span>✅ Verify ' + Math.min(verDone, q.verNeed) + '/' + q.verNeed + '</span><div class="bar"><div class="bar-fill" style="width:' + verPct + '%"></div></div></div>';
        const action = isClaimed ? '<span>✅ claimed</span>' : (done ? '<button data-q="' + q.id + '">Claim ' + q.points + ' pts</button>' : '<span class="qlock">🔒 complete both to claim</span>');
        return '<div class="quest"><b>' + (q.icon ? q.icon + ' ' : '') + q.text + '</b>' + repRow + verRow + action + '</div>';
      }).join('');
      qb.querySelectorAll('button[data-q]').forEach((b) => { b.onclick = () => claim(b.dataset.q, b); });
    }
    const lb = document.querySelector('#leaderboard'); if (lb) {
      const zones = {}; (window.EcoClean.reports || []).forEach((r) => { const z = zoneOf(r); zones[z] = (zones[z] || 0) + (r.status === 'verified' ? 1 : 0); });
      const ranked = Object.entries(zones).sort((a, b) => b[1] - a[1]).slice(0, 10);
      lb.innerHTML = '<ol>' + ranked.map((e) => '<li>Zone ' + e[0] + ' — ' + e[1] + ' verified</li>').join('') + '</ol>';
    }
  }

  window.addEventListener('ecoclean:data', render);
  window.addEventListener('ecoclean:auth', render);
  if (window.EcoData && EcoData.load) EcoData.load().then(render);
  if (window.EcoAuth && EcoAuth.ready) EcoAuth.ready().then(render);
  setInterval(render, 6000);
  render();
})();
