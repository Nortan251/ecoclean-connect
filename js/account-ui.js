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
