// EcoClean Connect — admin panel logic (i18n aware)
const $ = (s) => document.querySelector(s);
let ADMIN_KEY = sessionStorage.getItem('ecoclean_admin') || '';

const escapeHtml = (s) =>
  (s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

async function fileToResizedDataUrl(file, maxDim = 1024, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showToast(m) {
  const x = $('#toast');
  x.textContent = m;
  x.classList.remove('hidden');
  setTimeout(() => x.classList.add('hidden'), 3000);
}

async function api(path, opts = {}) {
    opts.headers = { ...(opts.headers || {}) };
    if (ADMIN_KEY) opts.headers['x-admin-key'] = ADMIN_KEY;               // legacy super-admin
    if (window.EcoAuth && EcoAuth.getToken && EcoAuth.getToken()) opts.headers['Authorization'] = 'Bearer ' + EcoAuth.getToken(); // association admin (admin v2)
  const res = await fetch(path, opts);
  if (res.status === 401) {
    alert('Unauthorized — ' + t('admin_key'));
    throw new Error('unauth');
  }
  return res;
}

function cardHtml(r) {
  // Labeled Before/After thumbnails so the verification decision is unambiguous.
  const fig = (src, alt, label) =>
    `<figure class="ba" style="margin:0"><img src="${src}" class="thumb" alt="${alt}" /><figcaption style="margin:2px 0 0;font-size:.7rem;text-align:center;color:#6b7c74">${label}</figcaption></figure>`;
  if (r.status === 'verified') {
    const before = fig(r.beforePhoto, 'before', 'Before');
    const after = r.afterPhoto ? fig(r.afterPhoto, 'after', 'After ✅') : '';
    const reward = r.rewardIssued ? `<p class="reward">🎁 ${escapeHtml(r.rewardCode)}</p>` : '';
    return `<div class="card report"><div class="report-imgs">${before}${after}</div><div><b>${catLabel(r.category)}</b> <span class="badge green">${t('verified')}</span><p>${escapeHtml(r.description)}</p>${reward}<small>${new Date(r.verifiedAt).toLocaleString()}</small></div></div>`;
  }
  const before = fig(r.beforePhoto, 'before', 'Before');
  return `<div class="card report" data-id="${r.id}"><div class="report-imgs">${before}</div><div><b>${catLabel(r.category)}</b> <span class="badge red">${t('reported')}</span><p>${escapeHtml(r.description)}</p>
    <label class="field"><span data-i18n="after_photo">After photo</span><input type="file" class="afterPhoto" accept="image/*" /></label>
    <label class="field"><span data-i18n="notes">Notes</span><input type="text" class="notes" /></label>
    <label class="field"><span data-i18n="reward_code">Reward code (optional)</span><input type="text" class="rewardCode" placeholder="MARJANE-AB12" /></label>
    <button class="primary-btn verify-btn" data-i18n="verify_btn">Verify & issue reward</button></div></div>`;
}

function renderSummary(reports) {
  const panel = document.querySelector('#panel'); if (!panel) return;
  let bar = document.getElementById('ecoAdminSummary');
  if (!bar) { bar = document.createElement('div'); bar.id = 'ecoAdminSummary'; bar.className = 'eco-admin-summary'; const ctx = document.getElementById('ecoAdminCtx'); ctx ? ctx.insertAdjacentElement('afterend', bar) : panel.insertBefore(bar, panel.children[0] || null); }
  const pending = reports.filter((r) => r.status === 'reported').length;
  const verified = reports.filter((r) => r.status === 'verified').length;
  if (!reports.length) {
    bar.className = 'eco-admin-summary eco-admin-empty';
    bar.innerHTML = '<div class="eas-i">✅</div><p class="eas-t"></p>';
    bar.querySelector('.eas-t').textContent = t('admin_empty');
    return;
  }
  bar.className = 'eco-admin-summary';
  bar.innerHTML =
    '<div class="eas-stat"><b>' + reports.length + '</b><span class="eas-l-total"></span></div>' +
    '<div class="eas-stat red"><b>' + pending + '</b><span class="eas-l-pending"></span></div>' +
    '<div class="eas-stat green"><b>' + verified + '</b><span class="eas-l-verified"></span></div>';
  bar.querySelector('.eas-l-total').textContent = t('admin_sum_total');
  bar.querySelector('.eas-l-pending').textContent = t('admin_sum_pending');
  bar.querySelector('.eas-l-verified').textContent = t('admin_sum_verified');
}

async function load() {
  const res = await api('/api/reports');
  const reports = await res.json();
  const pending = reports.filter((r) => r.status === 'reported');
  const verified = reports.filter((r) => r.status === 'verified');
  renderSummary(reports);
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
      const af = card.querySelector('.afterPhoto').files[0];
      const notes = card.querySelector('.notes').value;
      const rc = card.querySelector('.rewardCode').value.trim();
      const payload = { notes: notes };
      if (rc) payload.rewardCode = rc;
      if (af) {
        try { payload.photo = await fileToResizedDataUrl(af); } catch (err) {}
      }
      const r = await fetch('/api/reports/' + id + '/verify', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, ADMIN_KEY ? { 'x-admin-key': ADMIN_KEY } : {}, (window.EcoAuth && EcoAuth.getToken && EcoAuth.getToken()) ? { 'Authorization': 'Bearer ' + EcoAuth.getToken() } : {}),
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        showToast(t('verified'));
        load();
      } else {
        alert('Verify failed');
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
  // admin v2: show the signed-in association admin which org/city they're scoped to
  // (and offer a one-tap Supabase sign-in so a partner can log in without the key).
  function loadAdminContext() {
    // admin v2 scope comes from /api/me (merged into the user by auth.js) — no extra
    // endpoint (keeps us at the 12-function Hobby cap). Legacy key = super admin.
    var c = null;
    if (ADMIN_KEY) c = { scope: 'all' };
    else { var u = window.EcoAuth && EcoAuth.getUser && EcoAuth.getUser(); c = u && u.admin ? u.admin : null; }
    if (!c) return;
    var panel = document.querySelector('#panel') || document.body;
    var b = document.getElementById('ecoAdminCtx');
    if (!b) { b = document.createElement('div'); b.id = 'ecoAdminCtx'; b.className = 'eco-admin-ctx'; panel.insertBefore(b, panel.firstChild); }
    var Lg = (typeof window.getLang === 'function') ? getLang() : 'en';
    if (c.scope === 'city') {
      b.innerHTML = '🏢 <b></b> · ' + ({ ar: 'النطاق: ', fr: 'périmètre : ', en: 'scope: ' }[Lg] || 'scope: ') + '<span></span>';
      b.querySelector('b').textContent = c.association_name || ''; b.querySelector('span').textContent = c.city || '';
    } else {
      b.textContent = '🛡️ ' + ({ ar: 'مشرف عام — وصول كامل', fr: 'Super admin — accès total', en: 'Super admin — full access' }[Lg] || 'Super admin — full access');
    }
  }
  function ensureAssocLogin() {
    if (document.getElementById('ecoAssocLogin')) return;
    var lf = document.querySelector('#loginMsg'); if (!lf || !lf.parentNode) return;
    var row = document.createElement('div'); row.id = 'ecoAssocLogin'; row.style.cssText = 'margin-top:10px;text-align:center;font-size:.82rem;color:#5d7268';
    row.innerHTML = '<button type="button" class="ghost-btn" id="ecoAssocBtn" style="font-size:.8rem"></button>';
    lf.parentNode.insertBefore(row, lf.nextSibling);
    var label = (typeof window.getLang === 'function' && getLang() === 'ar') ? 'أو: دخول كمسرف جمعية' : ((typeof window.getLang === 'function' && getLang() === 'fr') ? 'ou : connexion admin d’association' : 'or: sign in as an association admin');
    row.querySelector('#ecoAssocBtn').textContent = label;
    row.querySelector('#ecoAssocBtn').addEventListener('click', function () { if (window.EcoAuth && EcoAuth.signIn) EcoAuth.signIn(); });
  }
  if (!document.getElementById('eco-admin-ctx-style')) {
    var st = document.createElement('style'); st.id = 'eco-admin-ctx-style';
    st.textContent = '.eco-admin-ctx{background:var(--accent-soft,#e8f3ec);color:var(--accent-dark,#0a5c3f);border:1px solid var(--border-strong,#bfe0cd);border-radius:10px;padding:8px 12px;font-size:.82rem;font-weight:600;margin:0 0 12px;}' +
      '.eco-admin-summary{display:flex;gap:10px;margin:0 0 14px;}' +
      '.eco-admin-summary .eas-stat{flex:1;background:var(--surface,#fff);border:1px solid var(--border,#e3ece7);border-radius:12px;padding:12px 8px;text-align:center;}' +
      '.eco-admin-summary .eas-stat b{display:block;font-size:1.4rem;font-weight:800;color:var(--text,#14241d);}' +
      '.eco-admin-summary .eas-stat.red b{color:var(--red,#ef4444);}.eco-admin-summary .eas-stat.green b{color:var(--accent,#198754);}' +
      '.eco-admin-summary .eas-stat span{font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#5d7268);}' +
      '.eco-admin-summary.eco-admin-empty{display:block;text-align:center;background:var(--surface,#fff);border:1px solid var(--border,#e3ece7);border-radius:14px;padding:26px 18px;}' +
      '.eco-admin-summary.eco-admin-empty .eas-i{font-size:2rem;}.eco-admin-summary.eco-admin-empty .eas-t{margin:8px auto 0;max-width:420px;color:var(--muted,#5d7268);font-size:.9rem;line-height:1.5;}';
    document.head.appendChild(st);
  }
  ensureAssocLogin();
  // admin v2: a signed-in association admin (no demo key) goes straight to the panel;
  // the server still enforces role + city scope on every call. Re-checked on auth changes.
  function tryAssocEntry() {
    if (ADMIN_KEY) return; // legacy key path already handled
    var u = window.EcoAuth && EcoAuth.getUser && EcoAuth.getUser();
    if (u) { var l = document.getElementById('login'); if (l) l.classList.add('hidden'); var p = document.getElementById('panel'); if (p) p.classList.remove('hidden'); (EcoAuth.refresh ? EcoAuth.refresh() : Promise.resolve()).then(function () { loadAdminContext(); }); }
  }
  window.addEventListener('ecoclean:auth', tryAssocEntry);
  if (window.EcoAuth && EcoAuth.ready) EcoAuth.ready().then(tryAssocEntry);
  if (ADMIN_KEY) { enterPanel(); loadAdminContext(); }
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
