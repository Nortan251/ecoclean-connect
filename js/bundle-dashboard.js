/* Bundled automatically */

/* === js/account-ui.js === */
/* account-ui.js — dashboard extras (Module F part 2), trilingual: a "Your impact"
 * card (signed-in only) + a "Top citizens" leaderboard (public /api/leaderboard).
 * Additive; injects cards into the dashboard. User-supplied names are inserted as
 * text (never HTML) to avoid injection. */
(function () {
  'use strict';
  var host = document.querySelector('main.dash');
  if (!host) return;

  var L = {
    en: { impact_title: 'Your impact', leaders_title: 'Top citizens', s_points: 'points', s_reports: 'your reports', s_vouchers: 'vouchers', note_pre: 'Signed in as ', note_post: '. You earn points when clean-ups you reported get verified.', login_prompt: 'Log in to track your personal impact, points and vouchers.', login_btn: 'Log in / Sign up', leaders_empty: 'No citizens on the board yet — verify some clean-ups!', leaders_err: 'Leaderboard unavailable.' },
    fr: { impact_title: 'Votre impact', leaders_title: 'Meilleurs citoyens', s_points: 'points', s_reports: 'vos signalements', s_vouchers: 'bons', note_pre: 'Connecté en tant que ', note_post: '. Vous gagnez des points quand les nettoyages que vous avez signalés sont vérifiés.', login_prompt: 'Connectez-vous pour suivre votre impact, vos points et vos bons.', login_btn: 'Connexion / Inscription', leaders_empty: 'Personne au classement pour l’instant — vérifiez des nettoyages !', leaders_err: 'Classement indisponible.' },
    ar: { impact_title: 'أثرك', leaders_title: 'أفضل المواطنين', s_points: 'نقاط', s_reports: 'بلاغاتك', s_vouchers: 'قسائم', note_pre: 'مسجل الدخول باسم ', note_post: '. تكسب نقاطًا عندما تُتحقق عمليات التنظيف التي بلّغت عنها.', login_prompt: 'سجّل الدخول لتتبع أثرك ونقاطك وقسائمك.', login_btn: 'تسجيل الدخول / إنشاء حساب', leaders_empty: 'لا أحد في القائمة بعد — تحقّق من بعض عمليات التنظيف!', leaders_err: 'القائمة غير متاحة.' },
  };
  var lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');
  var t = (k) => { var d = L[lang()] || L.en; return (d && d[k] != null) ? d[k] : (L.en[k] != null ? L.en[k] : k); };

  function card(id, title) { var c = document.createElement('section'); c.className = 'card'; c.id = id; c.innerHTML = '<h2></h2><div class="acu-body"></div>'; c.querySelector('h2').textContent = title; return c; }

  var impactCard = card('eco-impact', t('impact_title'));
  var stats = document.getElementById('stats');
  if (stats && stats.nextSibling) stats.parentNode.insertBefore(impactCard, stats.nextSibling); else host.insertBefore(impactCard, host.firstChild);

  var lbCard = card('eco-leaders', t('leaders_title'));
  var analytics = document.getElementById('analytics');
  if (analytics) analytics.parentNode.insertBefore(lbCard, analytics); else host.appendChild(lbCard);

  function retitle() { impactCard.querySelector('h2').textContent = t('impact_title'); lbCard.querySelector('h2').textContent = t('leaders_title'); }

  function renderImpact() {
    var body = impactCard.querySelector('.acu-body');
    var u = window.EcoAuth && EcoAuth.getUser ? EcoAuth.getUser() : null;
    if (!u) {
      body.innerHTML = '<p class="muted acu-login-prompt"></p><button class="primary-btn" id="acu-login" style="max-width:240px"></button>';
      body.querySelector('.acu-login-prompt').textContent = t('login_prompt');
      var b = body.querySelector('#acu-login'); b.textContent = t('login_btn'); b.onclick = function () { EcoAuth.signIn(); };
      return;
    }
    body.innerHTML =
      '<div class="acu-stats">' +
        '<div class="acu-stat"><b>' + (u.points || 0) + '</b><span class="acu-l1"></span></div>' +
        '<div class="acu-stat"><b>' + (u.myReports || 0) + '</b><span class="acu-l2"></span></div>' +
        '<div class="acu-stat"><b>' + ((u.vouchers && u.vouchers.length) || 0) + '</b><span class="acu-l3"></span></div>' +
      '</div><p class="muted" style="margin:10px 0 0"><span class="acu-np"></span><b class="acu-dn"></b><span class="acu-ns"></span></p>';
    body.querySelector('.acu-l1').textContent = t('s_points');
    body.querySelector('.acu-l2').textContent = t('s_reports');
    body.querySelector('.acu-l3').textContent = t('s_vouchers');
    body.querySelector('.acu-np').textContent = t('note_pre');
    body.querySelector('.acu-dn').textContent = u.displayName || u.email || '';
    body.querySelector('.acu-ns').textContent = t('note_post');
  }

  function renderLeaders() {
    var body = lbCard.querySelector('.acu-body');
    fetch('/api/leaderboard', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
      if (!list || !list.length) { body.innerHTML = '<p class="muted acu-le"></p>'; body.querySelector('.acu-le').textContent = t('leaders_empty'); return; }
      body.innerHTML = '<ol class="acu-lb">' + list.map(function (p, i) { return '<li><span class="acu-rank">' + (i + 1) + '</span><span class="acu-name"></span><b>' + p.points + '</b></li>'; }).join('') + '</ol>';
      var names = body.querySelectorAll('.acu-name'); list.forEach(function (p, i) { if (names[i]) names[i].textContent = p.display_name || p.displayName || 'Guardian'; });
    }).catch(function () { body.innerHTML = '<p class="muted acu-le2"></p>'; body.querySelector('.acu-le2').textContent = t('leaders_err'); });
  }

  function renderAll() { retitle(); renderImpact(); renderLeaders(); }
  window.addEventListener('ecoclean:auth', renderImpact);
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'langSelect') renderAll(); });
  if (window.EcoAuth && EcoAuth.ready) EcoAuth.ready().then(renderImpact); else renderImpact();
  renderLeaders();
  setInterval(renderLeaders, 15000);

  if (!document.getElementById('eco-acu-style')) {
    var st = document.createElement('style'); st.id = 'eco-acu-style';
    st.textContent =
      '.acu-stats{display:flex;gap:10px;}.acu-stat{flex:1;background:linear-gradient(180deg,#eef7f2,#e6f3ef);border:1px solid #e3ece7;border-radius:14px;padding:12px 8px;text-align:center;}.acu-stat b{display:block;font-size:1.4rem;font-weight:800;background:linear-gradient(135deg,#198754,#0d9488);-webkit-background-clip:text;background-clip:text;color:transparent;}.acu-stat span{font-size:.68rem;color:#5d7268;text-transform:uppercase;letter-spacing:.04em;font-weight:600;}' +
      '.acu-lb{list-style:none;margin:0;padding:0;}.acu-lb li{display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid #eef2ef;}.acu-lb li:last-child{border-bottom:none;}.acu-rank{width:24px;height:24px;border-radius:50%;background:#eef5f1;color:#0a5c3f;display:grid;place-items:center;font-weight:800;font-size:.8rem;flex:0 0 auto;}.acu-name{flex:1;font-weight:600;color:#14241d;}.acu-lb b{background:linear-gradient(135deg,#198754,#0d9488);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:800;}';
    document.head.appendChild(st);
  }
})();


/* === js/static-i18n.js === */
/* static-i18n.js — localize leftover hardcoded strings (dashboard + admin) that were
 * never wired to data-i18n, so FR/AR switches fully translate the page. The Open
 * Data card is included here too (via stable selectors) because its own module's
 * language listener was not reliably re-firing on every language change — routing
 * it through this proven, always-firing path guarantees it translates in AR/FR.
 * Self-contained (no edit to the shared i18n dictionary); applies on load + on
 * every language change. The analytics card title is owned by analytics.js. */
(function () {
  'use strict';
  var L = {
    en: { wallet: 'Reward Wallet', quests: 'Weekly Quests', leaders: 'Neighborhood Leaderboard', open_title: 'Open data', open_note: 'Export every report as open data for journalists, NGOs or your municipality.', open_csv: 'Download CSV', open_geo: 'Download GeoJSON', admin_panel: 'Admin Panel', after_cleanup: 'After Cleanup photo', dispatch: 'Cleanup Dispatch', group: 'Group active (2km)', after_photo: 'After photo' },
    fr: { wallet: 'Portefeuille de récompenses', quests: 'Quêtes hebdomadaires', leaders: 'Classement du quartier', open_title: 'Données ouvertes', open_note: 'Exportez tous les signalements en données ouvertes pour journalistes, ONG ou municipalité.', open_csv: 'Télécharger CSV', open_geo: 'Télécharger GeoJSON', admin_panel: 'Panneau admin', after_cleanup: 'Photo après nettoyage', dispatch: 'Affectation de nettoyage', group: 'Grouper actifs (2km)', after_photo: 'Photo après' },
    ar: { wallet: 'محفظة المكافآت', quests: 'مهام أسبوعية', leaders: 'ترتيب الحي', open_title: 'بيانات مفتوحة', open_note: 'صدّر كل البلاغات كبيانات مفتوحة للصحفيين أو الجمعيات أو البلدية.', open_csv: 'تنزيل CSV', open_geo: 'تنزيل GeoJSON', admin_panel: 'لوحة الإدارة', after_cleanup: 'صورة بعد التنظيف', dispatch: 'توزيع التنظيف', group: 'تجميع النشط (٢ كم)', after_photo: 'صورة بعد' },
  };
  var lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');
  var dash = [
    ['#wallet > h2', 'wallet'], ['#questsBox > h2', 'quests'], ['#lbBox > h2', 'leaders'],
    ['#exportCard > h2', 'open_title'], ['#exportCard > p', 'open_note'], ['#expCsv', 'open_csv'], ['#expGeo', 'open_geo'],
  ];
  var admin = [['.app-header h1', 'admin_panel'], ['#verifyExtras > h2', 'after_cleanup'], ['#dispatch > h2', 'dispatch'], ['#clusterBtn', 'group'], ['#verifyExtras label span', 'after_photo']];
  function apply() {
    var d = L[lang()] || L.en;
    dash.forEach(function (p) { var el = document.querySelector(p[0]); if (el) el.textContent = d[p[1]]; });
    if (document.querySelector('.admin-main')) admin.forEach(function (p) { var el = document.querySelector(p[0]); if (el) el.textContent = d[p[1]]; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'langSelect') apply(); });
})();


/* === js/my-reports.js === */
/* my-reports.js — a "My reports" panel on the dashboard for SIGNED-IN users
 * (ADDITIVE). Lists the reports the logged-in user submitted, with live status
 * (reported / verified) and any reward code, fetched via /api/me (server filters
 * by the verified token, so a user only ever sees their own). Anonymous visitors
 * get a friendly "log in" prompt. Localized; re-renders on auth changes. */
(function () {
  'use strict';
  var host = document.querySelector('main.dash'); if (!host) return;
  var L10N = {
    en: { title: 'My reports', empty: 'You haven’t reported anything yet — open the map to report your first site.', login: 'Log in to see the reports you’ve submitted and their status.', loginBtn: 'Log in / Sign up', goMap: 'Open the map', reported: 'Reported', verified: 'Verified', noDesc: 'No description' },
    fr: { title: 'Mes signalements', empty: 'Vous n’avez encore rien signalé — ouvrez la carte pour signaler votre premier site.', login: 'Connectez-vous pour voir les signalements que vous avez envoyés et leur statut.', loginBtn: 'Connexion / Inscription', goMap: 'Ouvrir la carte', reported: 'Signalé', verified: 'Vérifié', noDesc: 'Aucune description' },
    ar: { title: 'بلاغاتي', empty: 'لم تبلّغ عن شيء بعد — افتح الخريطة للإبلاغ عن أول موقع.', login: 'سجّل الدخول لرؤية البلاغات التي أرسلتها وحالتها.', loginBtn: 'تسجيل الدخول / إنشاء حساب', goMap: 'فتح الخريطة', reported: 'تم الإبلاغ', verified: 'تم التحقق', noDesc: 'لا وصف' },
  };
  var lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');
  var t = (k) => { var d = L10N[lang()] || L10N.en; return d[k] != null ? d[k] : (L10N.en[k] != null ? L10N.en[k] : k); };
  var esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  var catLabel = (k) => (typeof window.catLabel === 'function' ? window.catLabel(k) : k);

  var card = document.createElement('section'); card.className = 'card'; card.id = 'eco-myreports';
  var wallet = document.getElementById('wallet');
  if (wallet && wallet.nextSibling) wallet.parentNode.insertBefore(card, wallet.nextSibling);
  else { var st = document.getElementById('stats'); if (st && st.nextSibling) st.parentNode.insertBefore(card, st.nextSibling); else host.appendChild(card); }

  function render() {
    var u = window.EcoAuth && window.EcoAuth.getUser ? window.EcoAuth.getUser() : null;
    var head = '<h2>' + esc(t('title')) + '</h2>';
    if (!u) {
      card.innerHTML = head + '<p class="muted">' + esc(t('login')) + '</p><button class="primary-btn" id="eco-mr-login" style="max-width:240px">' + esc(t('loginBtn')) + '</button>';
      var b = card.querySelector('#eco-mr-login'); if (b) b.onclick = function () { window.EcoAuth.signIn(); };
      return;
    }
    var list = u.myReportsList || [];
    if (!list.length) {
      card.innerHTML = head + '<p class="muted">' + esc(t('empty')) + '</p><a class="ghost-btn" href="index.html" style="display:inline-block;max-width:240px;text-align:center;text-decoration:none">' + esc(t('goMap')) + '</a>';
      return;
    }
    card.innerHTML = head + '<div class="report-list">' + list.map(function (r) {
      var badge = r.status === 'verified' ? '<span class="badge green">' + esc(t('verified')) + '</span>' : '<span class="badge red">' + esc(t('reported')) + '</span>';
      var reward = r.rewardIssued && r.rewardCode ? '<p class="reward">🎁 ' + esc(r.rewardCode) + '</p>' : '';
      var desc = r.description ? esc(r.description) : '<i>' + esc(t('noDesc')) + '</i>';
      return '<div class="report">' + (r.beforePhoto ? '<img src="' + esc(r.beforePhoto) + '" class="thumb" alt="">' : '') +
        '<div><b>' + esc(catLabel(r.category)) + '</b> ' + badge + '<p>' + desc + '</p>' + reward +
        '<small>' + esc(new Date(r.createdAt).toLocaleString()) + '</small></div></div>';
    }).join('') + '</div>';
  }

  window.addEventListener('ecoclean:auth', render);
  render();
})();


/* === js/streak.js === */
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


/* === js/weekly-board.js === */
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


