// EcoClean Connect — admin panel logic (i18n aware)
const $ = (s) => document.querySelector(s);
let ADMIN_KEY = sessionStorage.getItem('ecoclean_admin') || '';

const escapeHtml = (s) =>
  (s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

function showToast(m) {
  const x = $('#toast');
  x.textContent = m;
  x.classList.remove('hidden');
  setTimeout(() => x.classList.add('hidden'), 3000);
}

async function api(path, opts = {}) {
  opts.headers = { ...(opts.headers || {}), 'x-admin-key': ADMIN_KEY };
  const res = await fetch(path, opts);
  if (res.status === 401) {
    alert('Unauthorized — ' + t('admin_key'));
    throw new Error('unauth');
  }
  return res;
}

function cardHtml(r) {
  const before = `<img src="${r.beforePhoto}" class="thumb" alt="before" />`;
  if (r.status === 'verified') {
    const after = r.afterPhoto ? `<img src="${r.afterPhoto}" class="thumb" alt="after" />` : '';
    const reward = r.rewardIssued ? `<p class="reward">🎁 ${escapeHtml(r.rewardCode)}</p>` : '';
    return `<div class="card report"><div class="report-imgs">${before}${after}</div><div><b>${catLabel(r.category)}</b> <span class="badge green">${t('verified')}</span><p>${escapeHtml(r.description)}</p>${reward}<small>${new Date(r.verifiedAt).toLocaleString()}</small></div></div>`;
  }
  return `<div class="card report" data-id="${r.id}"><div class="report-imgs">${before}</div><div><b>${catLabel(r.category)}</b> <span class="badge red">${t('reported')}</span><p>${escapeHtml(r.description)}</p>
    <label class="field"><span data-i18n="after_photo">After photo</span><input type="file" class="afterPhoto" accept="image/*" /></label>
    <label class="field"><span data-i18n="notes">Notes</span><input type="text" class="notes" /></label>
    <label class="field"><span data-i18n="reward_code">Reward code (optional)</span><input type="text" class="rewardCode" placeholder="MARJANE-AB12" /></label>
    <button class="primary-btn verify-btn" data-i18n="verify_btn">Verify & issue reward</button></div></div>`;
}

async function load() {
  const res = await api('/api/reports');
  const reports = await res.json();
  const pending = reports.filter((r) => r.status === 'reported');
  const verified = reports.filter((r) => r.status === 'verified');
  $('#pending').innerHTML = pending.length
    ? pending.map(cardHtml).join('')
    : `<p class="muted">${t('all_caught')}</p>`;
  $('#verified').innerHTML = verified.length
    ? verified.map(cardHtml).join('')
    : `<p class="muted">${t('none_yet')}</p>`;
  applyI18n(document);
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
        showToast(t('verified'));
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
    showToast(t('post_alert_btn'));
  }
}

function enterPanel() {
  $('#login').classList.add('hidden');
  $('#panel').classList.remove('hidden');
  load();
}

window.addEventListener('DOMContentLoaded', () => {
  applyI18n(document);
  const sel = $('#langSelect');
  if (sel) {
    sel.value = getLang();
    sel.addEventListener('change', (e) => {
      setLang(e.target.value);
      applyI18n(document);
      if ($('#panel') && !$('#panel').classList.contains('hidden')) load();
    });
  }
  if (ADMIN_KEY) enterPanel();
  $('#loginBtn').addEventListener('click', () => {
    ADMIN_KEY = $('#adminKey').value.trim();
    if (!ADMIN_KEY) {
      $('#loginMsg').textContent = t('err_required');
      return;
    }
    sessionStorage.setItem('ecoclean_admin', ADMIN_KEY);
    enterPanel();
  });
  $('#postAlert').addEventListener('click', postAlert);
});
