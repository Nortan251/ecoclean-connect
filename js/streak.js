/* ============================================================================
 * streak.js — daily-activity STREAK tracker (retention / habit loop) (ADDITIVE)
 * ----------------------------------------------------------------------------
 * A streak is the single most powerful retention mechanic in civic apps: it
 * turns "report when you remember" into "don't break the chain" (loss aversion).
 * We track CONSECUTIVE CALENDAR DAYS on which the user took an action (submit a
 * report OR claim a quest) and surface 🔥 current + 🏆 longest on a dashboard
 * card, with a motivational line and milestone celebrations at 3/7/14/30 days.
 *
 * v1 is CLIENT-SIDE (localStorage, namespaced via EcoStore). Rationale: it ships
 * with ZERO schema migration and follows the project's "fix when fully working"
 * rule. The honest trade-off is written INTO the card ("server sync + a streak
 * point-multiplier come in phase 2") so nothing reads as broken. v2 will mirror
 * the streak into profiles (jsonb) server-side and award a bonus via the same
 * award_points RPC that verified clean-ups use, so the server stays the source
 * of truth for points.
 *
 * DATE MATH — the only subtle part
 * --------------------------------
 * We compare *local calendar days*, not 24h windows: diffDays = floor((todayMidnight
 * - lastMidnight)/86400000). diff 0 = already active today (no change); diff 1 =
 * yesterday, so the chain continues (+1); diff > 1 = a day was missed, reset to 1;
 * null last = first ever action, start at 1. Using local midnight (not UTC) means
 * a user in Agadir who reports at 23:50 and again at 00:10 correctly gets a 2-day
 * streak across the date boundary.
 * ==========================================================================*/
(function () {
  'use strict';
  var K = { last: 'streak_last', cur: 'streak_cur', best: 'streak_best' };
  var MILESTONES = [3, 7, 14, 30, 100];
  var L = {
    en: { title: 'Your streak', cur: 'day streak', best: 'best', zero: 'Report or complete a quest today to start your streak!', keep: 'One action a day keeps the 🔥 alive — don’t break the chain!', go: 'Start a {n}-day streak to earn your next badge.', ms: '🔥 {n}-day streak! The neighborhood notices.' },
    fr: { title: 'Votre série', cur: 'jours d’affilée', best: 'record', zero: 'Signalez ou complétez une quête aujourd’hui pour lancer votre série !', keep: 'Une action par jour garde la 🔥 — ne cassez pas la chaîne !', go: 'Atteignez {n} jours pour votre prochain badge.', ms: '🔥 Série de {n} jours ! Le quartier remarque.' },
    ar: { title: 'سلسلتك', cur: 'أيام متتالية', best: 'الأفضل', zero: 'بلّغ أو أنجز مهمة اليوم لبدء سلسلتك!', keep: 'إجراء واحد يوميًا يُبقي 🔥 مشتعلة — لا تكسر السلسلة!', go: 'ابدأ سلسلة من {n} يومًا لكسب شارتك التالية.', ms: '🔥 سلسلة {n} يومًا! الحيّ يلاحظ.' },
  };
  var lang = function () { return (typeof window.getLang === 'function' ? getLang() : 'en'); };
  var t = function () { return L[lang()] || L.en; };
  var fill = function (s, n) { return String(s).replace('{n}', n); };

  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function midnight(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).getTime(); }
  function diffDays(a, b) { return Math.round((midnight(a) - midnight(b)) / 86400000); }

  function read() {
    return {
      last: EcoStore.get(K.last, null),
      cur: EcoStore.get(K.cur, 0) || 0,
      best: EcoStore.get(K.best, 0) || 0,
    };
  }
  /* Apply an "I did something today" tick. Idempotent within a day. Returns the
   * new state + whether a milestone was just crossed (for celebration). */
  function recordActivity() {
    var s = read(), now = todayStr(), milestone = 0;
    if (s.last === now) return { state: s, milestone: 0 };        // already counted today
    var d = s.last ? diffDays(now, s.last) : 99;
    s.cur = (d === 1) ? (s.cur + 1) : 1;                           // continue or reset
    if (s.cur > s.best) s.best = s.cur;
    s.last = now;
    EcoStore.set(K.last, s.last); EcoStore.set(K.cur, s.cur); EcoStore.set(K.best, s.best);
    if (MILESTONES.indexOf(s.cur) !== -1) milestone = s.cur;
    if (milestone) {
      window.dispatchEvent(new CustomEvent('ecoclean:streak', { detail: { streak: s.cur } }));
      var tt = document.querySelector('#toast');
      if (tt) { tt.textContent = fill(t().ms, milestone); tt.classList.remove('hidden'); setTimeout(function () { tt.classList.add('hidden'); }, 3200); }
    }
    return { state: s, milestone: milestone };
  }
  window.EcoStreak = { get: read, record: recordActivity, MILESTONES: MILESTONES };

  // Tick on every civic action. 'ecoclean:reported' = a submit succeeded (app.js);
  // 'ecoclean:bonus' = a quest was claimed (gamification.js). Both = "active day".
  window.addEventListener('ecoclean:reported', function () { recordActivity(); render(); });
  window.addEventListener('ecoclean:bonus', function () { recordActivity(); render(); });

  var cardEl = null, bodyEl = null;
  function ensureCard() {
    if (cardEl) return;
    var anchor = document.getElementById('questsBox') || document.getElementById('wallet');
    if (!anchor) return;
    cardEl = document.createElement('section'); cardEl.className = 'card'; cardEl.id = 'eco-streak';
    cardEl.innerHTML = '<h2></h2><div class="sk-body"></div>';
    anchor.parentNode.insertBefore(cardEl, anchor);   // streak sits just above quests
    bodyEl = cardEl.querySelector('.sk-body');
  }
  function nextMilestone(cur) { for (var i = 0; i < MILESTONES.length; i++) if (MILESTONES[i] > cur) return MILESTONES[i]; return MILESTONES[MILESTONES.length - 1] + 30; }
  function render() {
    ensureCard(); if (!cardEl) return;
    cardEl.querySelector('h2').textContent = t().title;
    var s = read(), tt = t();
    var line = s.cur > 0 ? (s.cur >= 3 ? tt.keep : fill(tt.go, nextMilestone(s.cur))) : tt.zero;
    bodyEl.innerHTML =
      '<div class="sk-top"><span class="sk-flame">🔥</span><span class="sk-num">' + s.cur + '</span><span class="sk-lbl"></span><span class="sk-best">🏆 <b>' + s.best + '</b> <i></i></span></div>' +
      '<p class="sk-line"></p>' +
      '<p class="sk-note"></p>';
    bodyEl.querySelector('.sk-lbl').textContent = tt.cur;
    bodyEl.querySelector('.sk-best i').textContent = tt.best;
    bodyEl.querySelector('.sk-line').textContent = line;
    bodyEl.querySelector('.sk-note').textContent = lang() === 'ar' ? 'مزامنة الخادم ومضاعِف النقاط للسلسلة قريبًا.' : (lang() === 'fr' ? 'Synchronisation serveur + multiplicateur de points bientôt.' : 'Server sync + a streak point-multiplier are coming in phase 2.');
  }
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'langSelect') render(); });
  function boot() { recordActivity(); render(); }   // visiting the dashboard = see your streak (does NOT inflate it: recordActivity is idempotent per day)
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
      '.sk-note{margin:0;font-size:.7rem;color:var(--muted,#5d7268);opacity:.85;}';
    document.head.appendChild(st);
  }
})();
