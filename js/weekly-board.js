/* ============================================================================
 * weekly-board.js — THIS-WEEK leaderboard card (retention / competition) (ADDITIVE)
 * ----------------------------------------------------------------------------
 * The dashboard already shows an ALL-TIME "Top citizens" board (by stored points,
 * from /api/leaderboard). All-time boards discourage newcomers — a veteran's
 * 500-point lead looks unbeatable. A WEEKLY board resets the race every Monday,
 * so a brand-new reporter can top it in their first week: that is the competition
 * loop that drives repeat visits. We rank by RAW REPORT COUNT this week
 * (server-aggregated in /api/leaderboard-weekly — tamper-proof, no client trust),
 * and highlight the signed-in user's row + their rank so it feels personal.
 * Inserted right after the all-time board (#lbBox) so the two read as a pair:
 * "legends" vs "this week's movers". Public (works logged-out, empty-state if no
 * signed-in reports yet); refreshes on data + on a 60s interval like the other.
 * ==========================================================================*/
(function () {
  'use strict';
  var L = {
    en: { title: 'This week’s movers', empty: 'No reports from signed-in citizens this week yet — be the first on the board!', err: 'Weekly board unavailable.', you: 'You', rank: 'Your rank this week' },
    fr: { title: 'Les actifs de la semaine', empty: 'Aucun signalement de citoyens connectés cette semaine — soyez le premier !', err: 'Classement hebdo indisponible.', you: 'Vous', rank: 'Votre rang cette semaine' },
    ar: { title: 'نشطو الأسبوع', empty: 'لا بلاغات من مواطنين مسجلين هذا الأسبوع بعد — كن الأول!', err: 'قائمة الأسبوع غير متاحة.', you: 'أنت', rank: 'ترتيبك هذا الأسبوع' },
  };
  var lang = function () { return (typeof window.getLang === 'function' ? getLang() : 'en'); };
  var t = function () { return L[lang()] || L.en; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
  var medal = function (i) { return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1); };

  var cardEl = null, bodyEl = null;
  function ensureCard() {
    if (cardEl) return;
    var after = document.getElementById('lbBox');
    if (!after) return;
    cardEl = document.createElement('section'); cardEl.className = 'card'; cardEl.id = 'eco-weekly';
    cardEl.innerHTML = '<h2></h2><div class="wb-body"></div>';
    after.parentNode.insertBefore(cardEl, after.nextSibling);
    bodyEl = cardEl.querySelector('.wb-body');
  }
  function render(list) {
    ensureCard(); if (!cardEl) return;
    cardEl.querySelector('h2').textContent = t().title;
    if (!list || !list.length) { bodyEl.innerHTML = '<p class="muted wb-empty"></p>'; bodyEl.querySelector('.wb-empty').textContent = t().empty; return; }
    var me = window.EcoAuth && EcoAuth.getUser ? EcoAuth.getUser() : null;
    var myUid = me && me.id;
    var myRank = -1;
    var rows = list.map(function (p, i) {
      var mine = myUid && p.uid === myUid;
      if (mine) myRank = i + 1;
      return '<li class="' + (mine ? 'wb-me' : '') + '"><span class="wb-rank">' + medal(i) + '</span><span class="wb-name">' + esc(p.name) + (mine ? ' ⭐' : '') + '</span><b>' + p.reports + '</b></li>';
    }).join('');
    var you = myRank > 0 ? '<p class="wb-you"></p>' : '';
    bodyEl.innerHTML = '<ol class="wb-list">' + rows + '</ol>' + you;
    if (myRank > 0) bodyEl.querySelector('.wb-you').textContent = t().rank + ': #' + myRank;
  }
  function load() {
    fetch('/api/leaderboard?range=week', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(render)
      .catch(function () { ensureCard(); if (bodyEl) { bodyEl.innerHTML = '<p class="muted"></p>'; bodyEl.querySelector('p').textContent = t().err; } });
  }
  document.addEventListener('ecoclean:data', load);
  document.addEventListener('ecoclean:auth', load);
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'langSelect') load(); });
  function boot() { ensureCard(); load(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setInterval(load, 60000);

  if (!document.getElementById('eco-weekly-style')) {
    var st = document.createElement('style'); st.id = 'eco-weekly-style';
    st.textContent =
      '.wb-list{list-style:none;margin:0;padding:0;}' +
      '.wb-list li{display:flex;align-items:center;gap:10px;padding:9px 6px;border-bottom:1px solid var(--border,#eef2ef);border-radius:8px;}' +
      '.wb-list li:last-child{border-bottom:none;}' +
      '.wb-list li.wb-me{background:var(--accent-soft,#e8f3ec);}' +
      '.wb-rank{width:26px;text-align:center;font-weight:800;flex:0 0 auto;}' +
      '.wb-name{flex:1;font-weight:600;color:var(--text,#14241d);}' +
      '.wb-list b{background:linear-gradient(135deg,var(--accent,#198754),var(--accent-2,#0d9488));-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:800;}' +
      '.wb-you{margin:8px 0 0;font-size:.8rem;font-weight:700;color:var(--accent-dark,#0a5c3f);}';
    document.head.appendChild(st);
  }
})();
