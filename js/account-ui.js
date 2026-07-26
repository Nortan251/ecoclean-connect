/* account-ui.js — dashboard extras for Module F part 2: a "Your impact" card
 * (signed-in only, from the session) and a "Top citizens" leaderboard (public,
 * from /api/leaderboard). Additive; injects cards into the dashboard. */
(function () {
  'use strict';
  var host = document.querySelector('main.dash');
  if (!host) return; // dashboard only

  function card(id, title) { var c = document.createElement('section'); c.className = 'card'; c.id = id; c.innerHTML = '<h2>' + title + '</h2><div class="acu-body"></div>'; return c; }

  var impactCard = card('eco-impact', 'Your impact');
  var stats = document.getElementById('stats');
  if (stats && stats.nextSibling) stats.parentNode.insertBefore(impactCard, stats.nextSibling); else host.insertBefore(impactCard, host.firstChild);

  var lbCard = card('eco-leaders', 'Top citizens');
  var analytics = document.getElementById('analytics');
  if (analytics) analytics.parentNode.insertBefore(lbCard, analytics); else host.appendChild(lbCard);

  function renderImpact() {
    var body = impactCard.querySelector('.acu-body');
    var u = window.EcoAuth && EcoAuth.getUser ? EcoAuth.getUser() : null;
    if (!u) {
      body.innerHTML = '<p class="muted">Log in to track your personal impact, points and vouchers.</p><button class="primary-btn" id="acu-login" style="max-width:240px">Log in / Sign up</button>';
      var b = document.getElementById('acu-login'); if (b) b.onclick = function () { EcoAuth.signIn(); };
      return;
    }
    body.innerHTML =
      '<div class="acu-stats">' +
        '<div class="acu-stat"><b>' + (u.points || 0) + '</b><span>points</span></div>' +
        '<div class="acu-stat"><b>' + (u.myReports || 0) + '</b><span>your reports</span></div>' +
        '<div class="acu-stat"><b>' + ((u.vouchers && u.vouchers.length) || 0) + '</b><span>vouchers</span></div>' +
      '</div>' +
      '<p class="muted" style="margin:10px 0 0">Signed in as <b class="acu-dn"></b>. You earn points when clean-ups you reported get verified.</p>';
    var dn = body.querySelector('.acu-dn'); if (dn) dn.textContent = u.displayName || u.email || '';
  }

  function renderLeaders() {
    var body = lbCard.querySelector('.acu-body');
    fetch('/api/leaderboard', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
      if (!list || !list.length) { body.innerHTML = '<p class="muted">No citizens on the board yet — verify some clean-ups!</p>'; return; }
      body.innerHTML = '<ol class="acu-lb">' + list.map(function (p, i) { return '<li><span class="acu-rank">' + (i + 1) + '</span><span class="acu-name"></span><b>' + p.points + '</b></li>'; }).join('') + '</ol>';
      var names = body.querySelectorAll('.acu-name'); list.forEach(function (p, i) { if (names[i]) names[i].textContent = p.display_name || p.displayName || 'Guardian'; });
    }).catch(function () { body.innerHTML = '<p class="muted">Leaderboard unavailable.</p>'; });
  }

  window.addEventListener('ecoclean:auth', renderImpact);
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
