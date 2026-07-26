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
