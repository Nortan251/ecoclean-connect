/* ============================================================================
 * streak.js — daily-activity STREAK (retention / habit loop)  [server v2]
 * ----------------------------------------------------------------------------
 * v1 was localStorage-only. v2 makes the SERVER the source of truth when signed
 * in (so the streak survives devices / logouts and feeds the tamper-proof point
 * multiplier in apply_streak_bonus), while keeping the LOCAL counter as (a) the
 * source of truth when logged OUT and (b) an optimistic layer so the flame ticks
 * instantly before the round-trip resolves. The two are reconciled on every
 * render: server values win when present.
 *
 * Data flow
 *   logged in  -> POST /api/streak/tick  (= server record_daily_activity, which
 *                 also runs automatically on every accepted report server-side).
 *                 The response {streak_cur,streak_best} is merged into EcoAuth.
 *   logged out -> local EcoStore counter (the v1 algorithm, unchanged).
 *
 * A dashboard VISIT ticks the streak (engagement). record_daily_activity is
 * idempotent per local-calendar-day, so visiting 10x/day still = +1; the date
 * math (continue on yesterday, reset after a gap, start at 1) lives in the RPC
 * for logged-in users and locally (below) for anonymous ones.
 *
 * Loss aversion is the whole point: the 🔥 number is the thing people refuse to
 * let drop to zero. Milestones at 3/7/14/30 fire a toast. The card states, in
 * plain language, whether it is synced to the server or local-only — honest UX.
 * ==========================================================================*/
(function () {
  'use strict';
  var K = { last: 'streak_last', cur: 'streak_cur', best: 'streak_best' };
  var MILESTONES = [3, 7, 14, 30, 100];
  var L = {
    en: { title: 'Your streak', cur: 'day streak', best: 'best', zero: 'Report or complete a quest today to start your streak!', keep: 'One action a day keeps the 🔥 alive — don’t break the chain!', go: 'Reach a {n}-day streak to earn your next badge.', ms: '🔥 {n}-day streak! The neighborhood notices.', synced: 'Synced to your account', local: 'Local only — log in to keep it across devices' },
    fr: { title: 'Votre série', cur: 'jours d’affilée', best: 'record', zero: 'Signalez ou complétez une quête aujourd’hui pour lancer votre série !', keep: 'Une action par jour garde la 🔥 — ne cassez pas la chaîne !', go: 'Atteignez {n} jours pour votre prochain badge.', ms: '🔥 Série de {n} jours ! Le quartier remarque.', synced: 'Synchronisé à votre compte', local: 'Local uniquement — connectez-vous pour la garder' },
    ar: { title: 'سلسلتك', cur: 'أيام متتالية', best: 'الأفضل', zero: 'بلّغ أو أنجز مهمة اليوم لبدء سلسلتك!', keep: 'إجراء واحد يوميًا يُبقي 🔥 مشتعلة — لا تكسر السلسلة!', go: 'ابدأ سلسلة من {n} يومًا لكسب شارتك التالية.', ms: '🔥 سلسلة {n} يومًا! الحيّ يلاحظ.', synced: 'متزامنة مع حسابك', local: 'محلية فقط — سجّل الدخول لحفظها عبر الأجهزة' },
  };
  var lang = function () { return (typeof window.getLang === 'function' ? getLang() : 'en'); };
  var t = function () { return L[lang()] || L.en; };
  var fill = function (s, n) { return String(s).replace('{n}', n); };
  var loggedIn = function () { var u = window.EcoAuth && EcoAuth.getUser && EcoAuth.getUser(); return !!(u && u.id); };

  /* ---------- local counter (anonymous / optimistic) ---------- */
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function midnight(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).getTime(); }
  function diffDays(a, b) { return Math.round((midnight(a) - midnight(b)) / 86400000); }
  function localRead() { return { last: EcoStore.get(K.last, null), cur: EcoStore.get(K.cur, 0) || 0, best: EcoStore.get(K.best, 0) || 0 }; }
  function localTick() {
    var s = localRead(), now = todayStr(), ms = 0;
    if (s.last === now) return { cur: s.cur, best: s.best, milestone: 0, changed: false };
    var d = s.last ? diffDays(now, s.last) : 99;
    s.cur = (d === 1) ? (s.cur + 1) : 1;
    if (s.cur > s.best) s.best = s.cur;
    s.last = now;
    EcoStore.set(K.last, s.last); EcoStore.set(K.cur, s.cur); EcoStore.set(K.best, s.best);
    if (MILESTONES.indexOf(s.cur) !== -1) ms = s.cur;
    return { cur: s.cur, best: s.best, milestone: ms, changed: true };
  }

  /* ---------- merged read: server wins when logged in ---------- */
  function read() {
    if (loggedIn()) {
      var u = EcoAuth.getUser();
      return { cur: u.streakCur || 0, best: u.streakBest || 0, synced: true };
    }
    var s = localRead();
    return { cur: s.cur, best: s.best, synced: false };
  }

  /* ---------- server tick (logged in) ---------- */
  function serverTick() {
    if (!loggedIn()) return Promise.resolve(null);
    return fetch('/api/streak/tick', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, { Authorization: 'Bearer ' + EcoAuth.getToken() }),
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (d && EcoAuth.getUser()) {
        var u = EcoAuth.getUser();
        u.streakCur = d.streak_cur || 0; u.streakBest = d.streak_best || 0;
        // mirror into local too, so a later logged-out visit shows a sane number
        EcoStore.set(K.cur, u.streakCur); EcoStore.set(K.best, u.streakBest); EcoStore.set(K.last, todayStr());
        return d;
      }
      return d;
    }).catch(function () { return null; });
  }

  function celebrate(n) {
    window.dispatchEvent(new CustomEvent('ecoclean:streak', { detail: { streak: n } }));
    var tt = document.querySelector('#toast');
    if (tt) { tt.textContent = fill(t().ms, n); tt.classList.remove('hidden'); setTimeout(function () { tt.classList.add('hidden'); }, 3200); }
  }
  function nextMilestone(cur) { for (var i = 0; i < MILESTONES.length; i++) if (MILESTONES[i] > cur) return MILESTONES[i]; return MILESTONES[MILESTONES.length - 1] + 30; }

  /* Public surface. `record()` = "I did something / I'm here today": optimistic
   * local tick + (if logged in) a server tick, then re-render. */
  function record() {
    var lt = localTick();
    if (lt.milestone) celebrate(lt.milestone);
    render();
    if (loggedIn()) {
      serverTick().then(function (d) {
        // server milestone celebration (only when the day actually changed server-side)
        if (d && d.changed && MILESTONES.indexOf(d.streak_cur) !== -1 && d.streak_cur !== lt.cur) celebrate(d.streak_cur);
        render();
      });
    }
  }
  window.EcoStreak = { get: read, record: record, serverTick: serverTick, MILESTONES: MILESTONES };

  window.addEventListener('ecoclean:reported', record);   // submit succeeded
  window.addEventListener('ecoclean:bonus', record);      // quest claimed
  window.addEventListener('ecoclean:auth', render);       // login state / server streak arrived

  var cardEl = null, bodyEl = null;
  function ensureCard() {
    if (cardEl) return;
    var anchor = document.getElementById('questsBox') || document.getElementById('wallet');
    if (!anchor) return;
    cardEl = document.createElement('section'); cardEl.className = 'card'; cardEl.id = 'eco-streak';
    cardEl.innerHTML = '<h2></h2><div class="sk-body"></div>';
    anchor.parentNode.insertBefore(cardEl, anchor);
    bodyEl = cardEl.querySelector('.sk-body');
  }
  function render() {
    ensureCard(); if (!cardEl) return;
    var s = read(), tt = t();
    cardEl.querySelector('h2').textContent = tt.title;
    var line = s.cur > 0 ? (s.cur >= 3 ? tt.keep : fill(tt.go, nextMilestone(s.cur))) : tt.zero;
    bodyEl.innerHTML =
      '<div class="sk-top"><span class="sk-flame">🔥</span><span class="sk-num">' + s.cur + '</span><span class="sk-lbl"></span><span class="sk-best">🏆 <b>' + s.best + '</b> <i></i></span></div>' +
      '<p class="sk-line"></p>' +
      '<p class="sk-note ' + (s.synced ? 'ok' : '') + '"></p>';
    bodyEl.querySelector('.sk-lbl').textContent = tt.cur;
    bodyEl.querySelector('.sk-best i').textContent = tt.best;
    bodyEl.querySelector('.sk-line').textContent = line;
    bodyEl.querySelector('.sk-note').textContent = s.synced ? '🔒 ' + tt.synced : '🔓 ' + tt.local;
  }
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'langSelect') render(); });
  function boot() {
    render();                                  // show local / last-known immediately
    if (loggedIn()) serverTick().then(render); // reconcile with server (also ticks today)
    else { localTick(); render(); }            // anonymous: a visit counts (local only)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  if (!document.getElementById('eco-streak-style')) {
    var st = document.createElement('style'); st.id = 'eco-streak-style';
    st.textContent =
      '.sk-top{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}' +
      '.sk-flame{font-size:1.9rem;line-height:1;}' +
      '.sk-num{font-size:2.1rem;font-weight:800;background:linear-gradient(135deg,var(--accent,#198754),var(--accent-2,#0d9488));-webkit-background-clip:text;background-clip:text;color:transparent;}' +
      '.sk-lbl{font-size:.8rem;font-weight:700;color:var(--muted,#5d7268);text-transform:uppercase;letter-spacing:.04em;}' +
      '.sk-best{margin-left:auto;font-size:.82rem;color:var(--muted,#5d7268);font-weight:600;}' +
      '.sk-best b{color:var(--text,#14241d);}' +
      '.sk-line{margin:10px 0 4px;font-size:.86rem;color:var(--text,#14241d);}' +
      '.sk-note{margin:0;font-size:.7rem;color:var(--muted,#5d7268);opacity:.85;}' +
      '.sk-note.ok{color:var(--accent,#198754);}';
    document.head.appendChild(st);
  }
})();
