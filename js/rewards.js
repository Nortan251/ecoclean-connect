/* rewards.js — Civic Rewards Wallet (Module F part 2). Two modes:
 *  * SIGNED IN  -> server-authoritative wallet: points + vouchers come from the
 *    user's account (/api/me), and minting calls /api/mint (server deducts + mints
 *    inside a security-definer function, so it can't be spoofed).
 *  * ANONYMOUS  -> the original cooperative wallet: points derived from verified
 *    clean-ups in the shared data; vouchers stored locally (honour system).
 * Re-renders on data changes and on auth changes. */
(function () {
  'use strict';
  var VOUCHER_COST = 50, POINTS_PER_VERIFY = 20, mintBtn = null;
  var isAuthed = () => !!(window.EcoAuth && EcoAuth.getUser && EcoAuth.getUser());

  function ensureMint() {
    var w = document.querySelector('#wallet'); if (!w) return null;
    if (!mintBtn) { mintBtn = document.createElement('button'); mintBtn.className = 'primary-btn'; mintBtn.id = 'mintBtn'; w.appendChild(mintBtn); }
    return mintBtn;
  }
  function qrInto(box, list) {
    if (!box) return;
    box.innerHTML = list.length ? list.map((v) => { const t = v.code || v.token; return '<div class="voucher"><div class="tok">' + t + '</div><div class="qr" id="qr-' + t + '"></div></div>'; }).join('') : '<p class="muted">No vouchers yet — earn points from verified clean-ups, then redeem here.</p>';
    list.forEach((v) => { const t = v.code || v.token; if (window.QRCode) new QRCode(document.getElementById('qr-' + t), t); });
  }

  function renderAnonymous() {
    const reports = window.EcoClean.reports || [];
    const verified = reports.filter((r) => r.status === 'verified').length;
    const points = verified * POINTS_PER_VERIFY + (EcoStore.get('points', 0) || 0);
    const vouchers = EcoStore.get('vouchers', []);
    const available = Math.max(0, points - vouchers.length * VOUCHER_COST);
    const p = document.querySelector('#points');
    if (p) p.innerHTML = points + ' pts <small style="display:block;color:#6b7c74;font-weight:400;font-size:.75rem">' + verified + ' verified clean-up(s) · ' + available + ' redeemable · local wallet</small>';
    qrInto(document.querySelector('#vouchers'), vouchers.map((v) => ({ token: v.token })));
    const b = ensureMint(); if (b) { b.textContent = 'Mint voucher (' + VOUCHER_COST + ' pts)'; b.disabled = available < VOUCHER_COST; b.onclick = () => {
      if (available < VOUCHER_COST) { alert('Earn more points from verified clean-ups first (' + VOUCHER_COST + ' pts per voucher).'); return; }
      const token = 'ECO-' + Math.random().toString(36).slice(2, 10).toUpperCase();
      const list = EcoStore.get('vouchers', []); list.push({ token: token, pts: VOUCHER_COST, issued: new Date().toISOString() }); EcoStore.set('vouchers', list);
      render();
    }; }
  }

  function renderAuthed() {
    const u = EcoAuth.getUser();
    const points = u.points || 0, vouchers = u.vouchers || [];
    const p = document.querySelector('#points');
    if (p) p.innerHTML = points + ' pts <small style="display:block;color:#6b7c74;font-weight:400;font-size:.75rem">server wallet · ' + (u.displayName || u.email || '') + '</small>';
    qrInto(document.querySelector('#vouchers'), vouchers);
    const b = ensureMint(); if (b) { b.textContent = 'Mint voucher (' + VOUCHER_COST + ' pts)'; b.disabled = points < VOUCHER_COST; b.onclick = () => {
      const tok = EcoAuth.getToken(); if (!tok) return;
      b.disabled = true; const old = b.textContent; b.textContent = 'Minting…';
      fetch('/api/mint', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' } })
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then(() => { if (EcoAuth.refresh) EcoAuth.refresh().then(render); else render(); })
        .catch(() => { b.disabled = false; b.textContent = old; alert('Not enough points yet (' + VOUCHER_COST + ' needed per voucher).'); });
    }; }
  }

  function render() { if (!document.querySelector('#wallet')) return; (isAuthed() ? renderAuthed : renderAnonymous)(); }

  window.addEventListener('ecoclean:data', render);
  window.addEventListener('ecoclean:auth', render);
  window.addEventListener('ecoclean:bonus', render);
  if (window.EcoData && EcoData.load) EcoData.load().then(render);
  if (window.EcoAuth && EcoAuth.ready) EcoAuth.ready().then(render);
  setInterval(render, 6000);
  render();
})();
