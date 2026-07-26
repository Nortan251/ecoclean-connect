/* ============================================================================
 * push.js — Web Push zone alerts (retention: pull users BACK to the app) (ADDITIVE)
 * ----------------------------------------------------------------------------
 * A push notification ("a report 1 km from you was just verified ✅") is the only
 * channel that re-opens the app without the user remembering to — the retention
 * complement to the in-app streak. This module wires the browser side end-to-end:
 *   1. ask /api/push/vapid-public for the VAPID public key (503 => not configured);
 *   2. navigator.serviceWorker.ready -> pushManager.subscribe({userVisibleOnly,
 *      applicationServerKey}) — the key is the VAPID public key as a Uint8Array;
 *   3. POST the PushSubscription JSON to /api/push/subscribe (token-bound).
 * Unsubscribe reverses it. A "Send me a test alert" button hits /api/push/send so
 * the user can PROVE the pipe works (push is invisible until a notification
 * actually lands — testability matters).
 *
 * BASE64URL -> Uint8Array: the VAPID public key and the subscription keys are
 * base64url-encoded; pushManager + web-push expect raw bytes, so we decode
 * (padding fix + url->standard alphabet) without pulling in a library.
 *
 * GRACEFUL DEGRADATION (the whole point of gating on VAPID): if Push is
 * unsupported, permission denied, or the server has no VAPID keys yet, the card
 * explains exactly what's missing instead of showing a dead button — see the
 * PUSH_SETUP.md the user runs once to flip it on. The card is dashboard-only and
 * signed-in-only (a subscription is per-user on the server).
 * ==========================================================================*/
(function () {
  'use strict';
  var L = {
    en: { title: 'Alerts near you', on: 'On — we’ll ping you about nearby clean-ups.', off: 'Get a notification when a report near you is verified.', unsupported: 'Push notifications aren’t available in this browser.', needlogin: 'Log in to turn on alerts for your area.', needsetup: 'Alerts aren’t configured on the server yet (see PUSH_SETUP.md).', needperm: 'Notifications are blocked — allow them in site settings, then retry.', btn_on: '🔔 Turn on alerts', btn_off: '🔕 Turn off alerts', btn_test: 'Send me a test alert', sent: 'Test alert sent — check your notifications!', city: 'Zone' },
    fr: { title: 'Alertes près de vous', on: 'Activé — on vous prévient des nettoyages proches.', off: 'Recevez une notif quand un signalement près de chez vous est vérifié.', unsupported: 'Les notifications push ne sont pas dispo dans ce navigateur.', needlogin: 'Connectez-vous pour activer les alertes de votre zone.', needsetup: 'Les alertes ne sont pas configurées côté serveur (voir PUSH_SETUP.md).', needperm: 'Notifs bloquées — autorisez-les dans les réglages du site.', btn_on: '🔔 Activer les alertes', btn_off: '🔕 Désactiver les alertes', btn_test: 'M’envoyer une alerte test', sent: 'Alerte test envoyée — vérifiez vos notifs !', city: 'Zone' },
    ar: { title: 'تنبيهات بقربك', on: 'مفعَّلة — سننبّهك بعمليات التنظيف القريبة.', off: 'احصل على إشعار عند التحقق من بلاغ بقربك.', unsupported: 'الإشعارات الفورية غير متاحة في هذا المتصفح.', needlogin: 'سجّل الدخول لتفعيل تنبيهات منطقتك.', needsetup: 'التنبيهات غير مهيأة على الخادم بعد (راجع PUSH_SETUP.md).', needperm: 'الإشعارات محظورة — اسمح بها في إعدادات الموقع.', btn_on: '🔔 تفعيل التنبيهات', btn_off: '🔕 إيقاف التنبيهات', btn_test: 'أرسل لي تنبيهًا تجريبيًا', sent: 'أُرسل التنبيه التجريبي — راجع إشعاراتك!', city: 'المنطقة' },
  };
  var lang = function () { return (typeof window.getLang === 'function' ? getLang() : 'en'); };
  var t = function () { return L[lang()] || L.en; };
  var loggedIn = function () { var u = window.EcoAuth && EcoAuth.getUser && EcoAuth.getUser(); return !!(u && u.id); };
  var authHdr = function () { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + EcoAuth.getToken() }; };

  function b64urlToU8(b64) {
    var s = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function supported() { return 'PushManager' in window && 'Notification' in window && 'serviceWorker' in navigator; }
  function getSub() { return navigator.serviceWorker.ready.then(function (r) { return r.pushManager.getSubscription(); }); }

  function subscribe() {
    return fetch('/api/push/vapid-public').then(function (r) { return r.ok ? r.json() : Promise.reject({ status: r.status }); }).then(function (j) {
      return navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToU8(j.publicKey) });
      }).then(function (sub) {
        var city = (window.EcoCity && EcoCity.get) ? EcoCity.get().name : null;
        return fetch('/api/push/subscribe', { method: 'POST', headers: authHdr(), body: JSON.stringify({ subscription: sub.toJSON(), city: city }) });
      });
    });
  }
  function unsubscribe() {
    return getSub().then(function (sub) {
      var endpoint = sub ? sub.endpoint : null;
      if (sub) sub.unsubscribe().catch(function () {});
      return fetch('/api/push/unsubscribe', { method: 'POST', headers: authHdr(), body: JSON.stringify({ endpoint: endpoint }) });
    });
  }
  function sendTest() {
    var city = (window.EcoCity && EcoCity.get) ? EcoCity.get().name : null;
    return fetch('/api/push/send', { method: 'POST', headers: authHdr(), body: JSON.stringify({ title: 'EcoClean Connect 🌱', text: lang() === 'ar' ? 'تنبيه تجريبي من EcoClean' : (lang() === 'fr' ? 'Alerte test d’EcoClean' : 'Test alert from EcoClean'), city: city }) })
      .then(function (r) { return r.ok ? r.json() : Promise.reject({ status: r.status }); });
  }

  var cardEl = null, bodyEl = null;
  function ensureCard() {
    if (cardEl) return;
    var after = document.getElementById('eco-weekly') || document.getElementById('lbBox') || document.getElementById('wallet');
    if (!after) return;
    cardEl = document.createElement('section'); cardEl.className = 'card'; cardEl.id = 'eco-push';
    cardEl.innerHTML = '<h2></h2><div class="pu-body"></div>';
    after.parentNode.insertBefore(cardEl, after.nextSibling);
    bodyEl = cardEl.querySelector('.pu-body');
  }
  function stateLine() {
    if (!supported()) return { msg: t().unsupported, btn: null };
    if (!loggedIn()) return { msg: t().needlogin, btn: null };
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return { msg: t().needperm, btn: null };
    return null; // dynamic (need a vapid check + sub check)
  }
  function render() {
    ensureCard(); if (!cardEl) return;
    cardEl.querySelector('h2').textContent = t().title;
    var hard = stateLine();
    if (hard) { bodyEl.innerHTML = '<p class="pu-msg"></p>'; bodyEl.querySelector('.pu-msg').textContent = hard.msg; return; }
    // Need a server round-trip to know "configured?" + "subscribed?".
    bodyEl.innerHTML = '<p class="pu-msg">…</p>';
    Promise.all([
      fetch('/api/push/vapid-public').then(function (r) { return r.ok ? { ok: true } : r.json().then(function (j) { return { ok: false, missing: j.missing || [] }; }).catch(function () { return { ok: false, missing: [] }; }); }),
      getSub().then(function (s) { return !!s; }).catch(function () { return false; }),
    ]).then(function (arr) {
      var cfg = arr[0], isSub = arr[1];
      if (!cfg.ok) {
        var miss = cfg.missing && cfg.missing.length ? cfg.missing.join(', ') : 'VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT';
        bodyEl.innerHTML = '<p class="pu-msg"></p>';
        bodyEl.querySelector('.pu-msg').textContent = (lang() === 'ar' ? 'التنبيهات غير مهيأة: أضف ' : (lang() === 'fr' ? 'Alertes non configurées : ajoute ' : 'Alerts not live yet: add ')) + miss + (lang() === 'ar' ? ' في Vercel ثم أعد النشر.' : (lang() === 'fr' ? ' dans Vercel puis redéploie.' : ' in Vercel (Settings → Environment Variables, Production), then REDEPLOY from the Deployments tab — env vars only apply on a successful deploy.'));
        return;
      }
      var city = (window.EcoCity && EcoCity.get) ? EcoCity.get().name : null;
      bodyEl.innerHTML =
        '<p class="pu-msg ' + (isSub ? 'ok' : '') + '"></p>' +
        '<div class="pu-row"><button type="button" class="pu-btn primary"></button>' +
        (isSub ? '<button type="button" class="pu-btn ghost"></button>' : '') + '</div>' +
        (city ? '<p class="pu-zone"></p>' : '');
      bodyEl.querySelector('.pu-msg').textContent = isSub ? t().on : t().off;
      var btns = bodyEl.querySelectorAll('.pu-btn');
      btns[0].textContent = isSub ? t().btn_off : t().btn_on;
      btns[0].addEventListener('click', function () {
        btns[0].disabled = true;
        (isSub ? unsubscribe() : (Notification.permission === 'granted' ? Promise.resolve() : Notification.requestPermission()).then(function (p) { if (p !== 'granted') throw { perm: true }; return subscribe(); }))
          .then(function () { render(); })
          .catch(function (e) { render(); if (e && e.perm) { var m = bodyEl.querySelector('.pu-msg'); if (m) m.textContent = t().needperm; } });
      });
      if (btns[1]) { btns[1].textContent = t().btn_test; btns[1].addEventListener('click', function () { btns[1].disabled = true; sendTest().then(function () { toast(t().sent); btns[1].disabled = false; }).catch(function () { btns[1].disabled = false; }); }); }
      if (city) bodyEl.querySelector('.pu-zone').textContent = t().city + ': ' + city;
    }).catch(function () { bodyEl.innerHTML = '<p class="pu-msg"></p>'; bodyEl.querySelector('.pu-msg').textContent = t().needsetup; });
  }
  function toast(m) { var tt = document.querySelector('#toast'); if (!tt) return; tt.textContent = m; tt.classList.remove('hidden'); setTimeout(function () { tt.classList.add('hidden'); }, 3000); }

  window.addEventListener('ecoclean:auth', render);
  document.addEventListener('ecoclean:city', render);
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'langSelect') render(); });
  function boot() { ensureCard(); render(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  if (!document.getElementById('eco-push-style')) {
    var st = document.createElement('style'); st.id = 'eco-push-style';
    st.textContent =
      '.pu-msg{margin:0 0 8px;font-size:.86rem;color:var(--text,#14241d);}' +
      '.pu-msg.ok{color:var(--accent,#198754);font-weight:600;}' +
      '.pu-row{display:flex;gap:6px;}' +
      '.pu-btn{flex:1;border-radius:8px;padding:8px;font-size:.8rem;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid var(--border-strong,#bfe0cd);}' +
      '.pu-btn.primary{background:var(--accent-grad,linear-gradient(135deg,#198754,#0d9488));color:var(--on-accent,#fff);border-color:transparent;}' +
      '.pu-btn.ghost{background:var(--surface-2,#e8f3ec);color:var(--accent-dark,#0f5132);}' +
      '.pu-btn:disabled{opacity:.6;cursor:wait;}' +
      '.pu-zone{margin:8px 0 0;font-size:.74rem;color:var(--muted,#5d7268);}';
    document.head.appendChild(st);
  }
})();
