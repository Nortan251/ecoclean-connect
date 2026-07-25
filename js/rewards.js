/* ============================================================================
 * rewards.js — Civic Rewards Wallet (Module E)
 * ----------------------------------------------------------------------------
 * Points are EARNED FROM VERIFIED CLEAN-UPS. Crucially the balance is DERIVED
 * from the server's verified reports, not stored as a naked integer: you cannot
 * fake a verified clean-up, because it only becomes "verified" when an admin
 * confirms it with an after-photo via the server. Local quest bonuses
 * (gamification.js) add on top as an engagement flourish. Redeeming points mints
 * a LOCAL QR voucher — an honor-system code a neighbourhood partner scans.
 *
 *   total     = (verified clean-ups * POINTS_PER_VERIFY) + local quest bonuses
 *   available = total - value of vouchers already minted
 *
 * The wallet refreshes on the shared "ecoclean:data" event (fired by EcoData.load
 * after every poll / realtime push) and on "ecoclean:bonus" (a quest claim), so
 * it stays in sync with no extra polling of its own.
 * ==========================================================================*/
(function () {
  'use strict';
  const POINTS_PER_VERIFY = 20;
  const VOUCHER_COST = 50;

  const verifiedCount = () => (window.EcoClean.reports || []).filter((r) => r.status === 'verified').length;
  const derivedPoints = () => verifiedCount() * POINTS_PER_VERIFY;     // server-authoritative
  const bonus = () => EcoStore.get('points', 0) || 0;                  // local quest bonuses
  const total = () => derivedPoints() + bonus();
  const vouchers = () => EcoStore.get('vouchers', []);
  const available = () => Math.max(0, total() - vouchers().length * VOUCHER_COST);

  function mint() {
    if (available() < VOUCHER_COST) {
      alert('Earn more points from verified clean-ups first (' + VOUCHER_COST + ' pts per voucher).');
      return;
    }
    const token = 'ECO-' + Math.random().toString(36).slice(2, 10).toUpperCase();
    const list = vouchers();
    list.push({ token: token, pts: VOUCHER_COST, issued: new Date().toISOString() });
    EcoStore.set('vouchers', list);
    render();
  }

  function render() {
    const p = document.querySelector('#points');
    if (p) {
      p.innerHTML = total() + ' pts <small style="display:block;color:#6b7c74;font-weight:400;font-size:.75rem">' +
        verifiedCount() + ' verified clean-up(s) · ' + available() + ' pts redeemable</small>';
    }
    const box = document.querySelector('#vouchers');
    if (box) {
      const list = vouchers();
      box.innerHTML = list.length
        ? list.map((v) => '<div class="voucher"><div class="tok">' + v.token + '</div><div class="qr" id="qr-' + v.token + '"></div></div>').join('')
        : '<p class="muted">No vouchers yet — verified clean-ups earn points you can redeem here.</p>';
      list.forEach((v) => { if (window.QRCode) new QRCode(document.getElementById('qr-' + v.token), v.token); });
    }
    // Create the mint button exactly once, then enable/disable by affordability.
    const w = document.querySelector('#wallet');
    if (w && !w.querySelector('#mintBtn')) {
      const b = document.createElement('button');
      b.id = 'mintBtn'; b.className = 'primary-btn';
      b.textContent = 'Mint voucher (' + VOUCHER_COST + ' pts)';
      b.onclick = mint;
      w.appendChild(b);
    }
    const mb = w && w.querySelector('#mintBtn');
    if (mb) mb.disabled = available() < VOUCHER_COST;
  }

  window.addEventListener('ecoclean:data', render);   // verified clean-ups changed
  window.addEventListener('ecoclean:bonus', render);  // a quest bonus was claimed
  if (window.EcoData && EcoData.load) EcoData.load().then(render);
  render();
})();
