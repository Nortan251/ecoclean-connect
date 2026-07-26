/* rewards.js — Civic Rewards Wallet (Module F part 2), trilingual. Two modes:
 *  * SIGNED IN  -> server-authoritative wallet (/api/me); mint via /api/mint
 *    (server deducts + mints inside mint_voucher -> spoof-proof).
 *  * ANONYMOUS  -> cooperative wallet: points from verified clean-ups in shared
 *    data; vouchers local (honour system).
 * User-supplied names are inserted as text (never HTML). */
(function () {
  'use strict';
  var VOUCHER_COST = 50, POINTS_PER_VERIFY = 20, mintBtn = null;
  var isAuthed = () => !!(window.EcoAuth && EcoAuth.getUser && EcoAuth.getUser());
  var L = {
    en: { server: 'server wallet', local: 'local wallet', verified: '{n} verified clean-up(s)', redeemable: '{n} redeemable', no_vouchers: 'No vouchers yet — earn points from verified clean-ups, then redeem here.', mint: 'Mint voucher ({n} pts)', minting: 'Minting…', need_more: 'Earn more points from verified clean-ups first ({n} pts per voucher).', not_enough: 'Not enough points yet ({n} needed per voucher).' },
    fr: { server: 'portefeuille serveur', local: 'portefeuille local', verified: '{n} nettoyage(s) vérifié(s)', redeemable: '{n} utilisable(s)', no_vouchers: 'Aucun bon pour l’instant — gagnez des points via des nettoyages vérifiés, puis échangez-les ici.', mint: 'Créer un bon ({n} pts)', minting: 'Création…', need_more: 'Gagnez d’abord plus de points ({n} pts par bon).', not_enough: 'Pas assez de points ({n} nécessaires par bon).' },
    ar: { server: 'محفظة الخادم', local: 'محفظة محلية', verified: '{n} عملية تنظيف متحققة', redeemable: '{n} قابل للاستبدال', no_vouchers: 'لا قسائم بعد — اكسب نقاطًا من عمليات تنظيف متحققة ثم استبدلها هنا.', mint: 'إصدار قسيمة ({n} نقطة)', minting: 'جارٍ الإصدار…', need_more: 'اكسب مزيدًا من النقاط أولًا ({n} نقطة لكل قسيمة).', not_enough: 'نقاط غير كافية بعد ({n} مطلوبة لكل قسيمة).' },
  };
  var lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');
  var t = (k) => { var d = L[lang()] || L.en; return (d && d[k] != null) ? d[k] : (L.en[k] != null ? L.en[k] : k); };
  var fill = (k, o) => String(t(k)).replace(/\{(\w+)\}/g, function (_, x) { return o && o[x] != null ? o[x] : ''; });

  function ensureMint() {
    var w = document.querySelector('#wallet'); if (!w) return null;
    if (!mintBtn) { mintBtn = document.createElement('button'); mintBtn.className = 'primary-btn'; mintBtn.id = 'mintBtn'; w.appendChild(mintBtn); }
    return mintBtn;
  }
  function qrInto(box, list) {
    if (!box) return;
    box.innerHTML = list.length ? list.map(function (v) { var tk = v.code || v.token; return '<div class="voucher"><div class="tok">' + tk + '</div><div class="qr" id="qr-' + tk + '"></div></div>'; }).join('') : '<p class="muted acu-nv"></p>';
    if (!list.length) { var nv = box.querySelector('.acu-nv'); if (nv) nv.textContent = t('no_vouchers'); }
    list.forEach(function (v) { var tk = v.code || v.token; if (window.QRCode) new QRCode(document.getElementById('qr-' + tk), tk); });
  }

  function renderAnonymous() {
    var reports = window.EcoClean.reports || [];
    var verified = reports.filter(function (r) { return r.status === 'verified'; }).length;
    var points = verified * POINTS_PER_VERIFY + (EcoStore.get('points', 0) || 0);
    var vouchers = EcoStore.get('vouchers', []);
    var available = Math.max(0, points - vouchers.length * VOUCHER_COST);
    var p = document.querySelector('#points');
    if (p) p.innerHTML = points + ' pts <small style="display:block;color:#6b7c74;font-weight:400;font-size:.75rem">' + fill('verified', { n: verified }) + ' · ' + fill('redeemable', { n: available }) + ' · ' + t('local') + '</small>';
    qrInto(document.querySelector('#vouchers'), vouchers.map(function (v) { return { token: v.token }; }));
    var b = ensureMint(); if (b) { b.textContent = fill('mint', { n: VOUCHER_COST }); b.disabled = available < VOUCHER_COST; b.onclick = function () {
      if (available < VOUCHER_COST) { alert(fill('need_more', { n: VOUCHER_COST })); return; }
      var token = 'ECO-' + Math.random().toString(36).slice(2, 10).toUpperCase();
      var list = EcoStore.get('vouchers', []); list.push({ token: token, pts: VOUCHER_COST, issued: new Date().toISOString() }); EcoStore.set('vouchers', list);
      render();
    }; }
  }

  function renderAuthed() {
    var u = EcoAuth.getUser();
    var points = u.points || 0, vouchers = u.vouchers || [];
    var p = document.querySelector('#points');
    if (p) { p.innerHTML = points + ' pts <small style="display:block;color:#6b7c74;font-weight:400;font-size:.75rem">' + t('server') + ' · <span class="rw-id"></span></small>'; p.querySelector('.rw-id').textContent = u.displayName || u.email || ''; }
    qrInto(document.querySelector('#vouchers'), vouchers);
    var b = ensureMint(); if (b) { b.textContent = fill('mint', { n: VOUCHER_COST }); b.disabled = points < VOUCHER_COST; b.onclick = function () {
      var tok = EcoAuth.getToken(); if (!tok) return;
      b.disabled = true; var old = b.textContent; b.textContent = t('minting');
      fetch('/api/mint', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
        .then(function () { if (EcoAuth.refresh) EcoAuth.refresh().then(render); else render(); })
        .catch(function () { b.disabled = false; b.textContent = old; alert(fill('not_enough', { n: VOUCHER_COST })); });
    }; }
  }

  function render() { if (!document.querySelector('#wallet')) return; (isAuthed() ? renderAuthed : renderAnonymous)(); }

  window.addEventListener('ecoclean:data', render);
  window.addEventListener('ecoclean:auth', render);
  window.addEventListener('ecoclean:bonus', render);
  if (window.EcoData && EcoData.load) EcoData.load().then(render);
  if (window.EcoAuth && EcoAuth.ready) EcoAuth.ready().then(render);
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'langSelect') render(); });
  setInterval(render, 6000);
  render();
})();
