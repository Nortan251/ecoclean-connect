/* rewards.js — award points when a report becomes Cleaned, and mint a QR
   voucher card (unique token) for local Moroccan partners. Uses qrcodejs CDN. */
(function () {
  const POINTS_PER_CLEAN = 20;

  function addPoints(n) {
    const p = EcoStore.get('points', 0) + n;
    EcoStore.set('points', p);
    const el = document.querySelector('#points'); if (el) el.textContent = p + ' pts';
  }
  function mintVoucher() {
    const pts = EcoStore.get('points', 0);
    if (pts < 50) return alert('Need 50 pts to mint a voucher');
    const token = 'ECO-' + Math.random().toString(36).slice(2, 10).toUpperCase();
    const vouchers = EcoStore.get('vouchers', []);
    vouchers.push({ token, pts: 50, issued: new Date().toISOString() });
    EcoStore.set('vouchers', vouchers);
    EcoStore.set('points', pts - 50);
    render();
  }
  function render() {
    const box = document.querySelector('#vouchers'); if (!box) return;
    const vouchers = EcoStore.get('vouchers', []);
    box.innerHTML = vouchers.map(v =>
      '<div class="voucher"><div class="tok">' + v.token + '</div><div class="qr" id="qr-' + v.token + '"></div></div>'
    ).join('');
    vouchers.forEach(v => { if (window.QRCode) new QRCode(document.getElementById('qr-' + v.token), v.token); });
    const p = document.querySelector('#points'); if (p) p.textContent = EcoStore.get('points', 0) + ' pts';
  }
  // Award points when verification.js flips a report to Cleaned.
  window.addEventListener('storage', e => { if (e.key === 'ecoclean:cleanedStatus') addPoints(POINTS_PER_CLEAN); });

  const w = document.querySelector('#wallet');
  if (w) {
    const mint = document.createElement('button');
    mint.textContent = 'Mint voucher (50 pts)';
    mint.className = 'primary-btn';
    mint.onclick = mintVoucher;
    w.appendChild(mint);
  }
  render();
})();
