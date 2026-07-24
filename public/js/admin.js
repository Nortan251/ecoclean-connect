// EcoClean Connect — admin panel logic
const $ = (s) => document.querySelector(s);
let ADMIN_KEY = sessionStorage.getItem('ecoclean_admin') || '';

const CATEGORY_LABELS = {
  illegal_dumping: 'Illegal Dumping',
  water: 'Water Pollution',
  air_smoke: 'Air / Smoke',
  plastic_marine: 'Plastic / Marine',
  other: 'Other',
};
const label = (c) => CATEGORY_LABELS[c] || c;
const escapeHtml = (s) =>
  (s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

function showToast(m) {
  const t = $('#toast');
  t.textContent = m;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

async function api(path, opts = {}) {
  opts.headers = { ...(opts.headers || {}), 'x-admin-key': ADMIN_KEY };
  const res = await fetch(path, opts);
  if (res.status === 401) {
    alert('Unauthorized — check your admin key.');
    throw new Error('unauth');
  }
  return res;
}

function cardHtml(r) {
  const before = `<img src="${r.beforePhoto}" class="thumb" alt="before" />`;
  if (r.status === 'verified') {
    const after = r.afterPhoto ? `<img src="${r.afterPhoto}" class="thumb" alt="after" />` : '';
    const reward = r.rewardIssued ? `<p class="reward">🎁 ${escapeHtml(r.rewardCode)}</p>` : '';
    return `<div class="card report">
      <div class="report-imgs">${before}${after}</div>
      <div><b>${label(r.category)}</b> <span class="badge green">Verified ✓</span>
      <p>${escapeHtml(r.description)}</p>${reward}
      <small>${new Date(r.verifiedAt).toLocaleString()}</small></div>
    </div>`;
  }
  return `<div class="card report" data-id="${r.id}">
    <div class="report-imgs">${before}</div>
    <div>
      <b>${label(r.category)}</b> <span class="badge red">Reported</span>
      <p>${escapeHtml(r.description)}</p>
      <label>After photo <input type="file" class="afterPhoto" accept="image/*" /></label>
      <label>Notes <input type="text" class="notes" placeholder="Verification notes" /></label>
      <label>Reward code (optional) <input type="text" class="rewardCode" placeholder="e.g. MARJANE-AB12" /></label>
      <button class="primary-btn verify-btn">Verify & issue reward</button>
    </div>
  </div>`;
}

async function load() {
  const res = await api('/api/reports');
  const reports = await res.json();
  const pending = reports.filter((r) => r.status === 'reported');
  const verified = reports.filter((r) => r.status === 'verified');
  $('#pending').innerHTML = pending.length
    ? pending.map(cardHtml).join('')
    : '<p class="muted">All caught up 🎉</p>';
  $('#verified').innerHTML = verified.length
    ? verified.map(cardHtml).join('')
    : '<p class="muted">None yet</p>';

  document.querySelectorAll('.verify-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const card = e.target.closest('.report');
      const id = card.dataset.id;
      const fd = new FormData();
      const af = card.querySelector('.afterPhoto').files[0];
      if (af) fd.append('afterPhoto', af);
      fd.append('notes', card.querySelector('.notes').value);
      const rc = card.querySelector('.rewardCode').value.trim();
      if (rc) fd.append('rewardCode', rc);
      const r = await api('/api/reports/' + id + '/verify', { method: 'POST', body: fd });
      if (r.ok) {
        showToast('✅ Verified & reward issued');
        load();
      }
    });
  });
}

async function postAlert() {
  const title = $('#alertTitle').value.trim();
  if (!title) return;
  const r = await api('/api/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body: $('#alertBody').value }),
  });
  if (r.ok) {
    $('#alertTitle').value = '';
    $('#alertBody').value = '';
    showToast('📢 Alert posted');
  }
}

function enterPanel() {
  $('#login').classList.add('hidden');
  $('#panel').classList.remove('hidden');
  load();
}

window.addEventListener('DOMContentLoaded', () => {
  if (ADMIN_KEY) enterPanel();
  $('#loginBtn').addEventListener('click', () => {
    ADMIN_KEY = $('#adminKey').value.trim();
    if (!ADMIN_KEY) {
      $('#loginMsg').textContent = 'Enter the key';
      return;
    }
    sessionStorage.setItem('ecoclean_admin', ADMIN_KEY);
    enterPanel();
  });
  $('#postAlert').addEventListener('click', postAlert);
});
