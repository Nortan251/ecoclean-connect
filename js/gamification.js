/* gamification.js — Quests + leaderboards (Module F part 2), trilingual. Every quest
 * needs BOTH a report target AND a verify target (anti-abuse). ANONYMOUS: progress +
 * claimed state local. SIGNED IN: claiming validated + recorded server-side via
 * /api/quest-claim (real server points; double-claims / unmet conditions blocked). */
(function () {
  const L10N = {
    en: { q1: 'Plastic Patrol — 3 plastic/marine reports AND 2 confirmed clean-ups → +50 pts', q2: 'Water Hero — 2 water reports AND 2 confirmed water clean-ups → +40 pts', q3: 'Cleanup Champion — 2 reports (any) AND 3 confirmed clean-ups → +60 pts', row_report: '📍 Report {a}/{b}', row_verify: '✅ Verify {a}/{b}', claimed: 'claimed', lock: '🔒 complete both to claim', claim_btn: 'Claim {n} pts', claiming: 'Claiming…', claim_err: 'Quest not complete yet, or already claimed.', zone: 'Zone {z} — {n} verified' },
    fr: { q1: 'Patrouille plastique — 3 signalements plastique/marin ET 2 nettoyages confirmés → +50 pts', q2: 'Héros de l’eau — 2 signalements eau ET 2 nettoyages eau confirmés → +40 pts', q3: 'Champion du nettoyage — 2 signalements (tous) ET 3 nettoyages confirmés → +60 pts', row_report: '📍 Signaler {a}/{b}', row_verify: '✅ Vérifier {a}/{b}', claimed: 'réclamé', lock: '🔒 complétez les deux pour réclamer', claim_btn: 'Réclamer {n} pts', claiming: 'Réclamation…', claim_err: 'Quête non terminée ou déjà réclamée.', zone: 'Zone {z} — {n} vérifié(s)' },
    ar: { q1: 'دورية البلاستيك — 3 بلاغات بلاستيك/بحر وتأكيد عمليتَي تنظيف → +50 نقطة', q2: 'بطل المياه — بلاغا مياه وتأكيد عمليتَي تنظيف مياه → +40 نقطة', q3: 'بطل التنظيف — بلاغان (أي نوع) وتأكيد 3 عمليات تنظيف → +60 نقطة', row_report: '📍 بلّغ {a}/{b}', row_verify: '✅ تحقّق {a}/{b}', claimed: 'تم الاستلام', lock: '🔒 أكمل الشرطين للاستلام', claim_btn: 'استلم {n} نقطة', claiming: 'جارٍ الاستلام…', claim_err: 'المهمة غير مكتملة أو تم استلامها.', zone: 'منطقة {z} — {n} متحققة' },
  };
  const lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');
  const t = (k) => { const d = L10N[lang()] || L10N.en; return (d && d[k] != null) ? d[k] : L10N.en[k]; };
  const fill = (k, o) => String(t(k)).replace(/\{(\w+)\}/g, (_, x) => (o && o[x] != null ? o[x] : ''));

  const QUESTS = [
    { id: 'q1', icon: '🌊', textKey: 'q1', repNeed: 3, repCat: 'plastic_marine', verNeed: 2, verCat: null, points: 50 },
    { id: 'q2', icon: '💧', textKey: 'q2', repNeed: 2, repCat: 'water', verNeed: 2, verCat: 'water', points: 40 },
    { id: 'q3', icon: '🏆', textKey: 'q3', repNeed: 2, repCat: null, verNeed: 3, verCat: null, points: 60 },
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
      btn.disabled = true; const old = btn.textContent; btn.textContent = t('claiming');
      fetch('/api/quest-claim', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ questId: id }) })
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then(() => { 
          if (EcoAuth.refresh) return EcoAuth.refresh(); 
        })
        .then(() => render())
        .catch(() => { btn.disabled = false; btn.textContent = old; alert(t('claim_err')); });
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
        const repRow = '<div class="qrow"><span>' + fill('row_report', { a: Math.min(repDone, q.repNeed), b: q.repNeed }) + '</span><div class="bar"><div class="bar-fill" style="width:' + repPct + '%"></div></div></div>';
        const verRow = '<div class="qrow"><span>' + fill('row_verify', { a: Math.min(verDone, q.verNeed), b: q.verNeed }) + '</span><div class="bar"><div class="bar-fill" style="width:' + verPct + '%"></div></div></div>';
        const action = isClaimed ? '<span>✅ ' + t('claimed') + '</span>' : (done ? '<button data-q="' + q.id + '">' + fill('claim_btn', { n: q.points }) + '</button>' : '<span class="qlock">' + t('lock') + '</span>');
        return '<div class="quest"><b>' + (q.icon ? q.icon + ' ' : '') + t(q.textKey) + '</b>' + repRow + verRow + action + '</div>';
      }).join('');
      qb.querySelectorAll('button[data-q]').forEach((b) => { b.onclick = () => claim(b.dataset.q, b); });
    }
    const lb = document.querySelector('#leaderboard'); if (lb) {
      const zones = {}; (window.EcoClean.reports || []).forEach((r) => { const z = zoneOf(r); zones[z] = (zones[z] || 0) + (r.status === 'verified' ? 1 : 0); });
      const ranked = Object.entries(zones).sort((a, b) => b[1] - a[1]).slice(0, 10);
      lb.innerHTML = '<ol>' + ranked.map((e) => '<li>' + fill('zone', { z: e[0], n: e[1] }) + '</li>').join('') + '</ol>';
    }
  }

  window.addEventListener('ecoclean:data', render);
  window.addEventListener('ecoclean:auth', render);
  document.addEventListener('change', (e) => { if (e.target && e.target.id === 'langSelect') render(); });
  if (window.EcoData && EcoData.load) EcoData.load().then(render);
  if (window.EcoAuth && EcoAuth.ready) EcoAuth.ready().then(render);
  setInterval(render, 6000);
  render();
})();
