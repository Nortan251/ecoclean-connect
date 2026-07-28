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
  return `<div class="card report" data-id="${r.id}"><div class="report-imgs">${before}</div><div style="flex:1;"><b>${catLabel(r.category)}</b> <span class="badge red">${t('reported')}</span><p>${escapeHtml(r.description)}</p>
    <label class="field"><span data-i18n="after_photo">After photo</span><input type="file" class="afterPhoto" accept="image/*" /></label>
    <label class="field"><span data-i18n="notes">Notes</span><input type="text" class="notes" /></label>
    <label class="field"><span data-i18n="reward_code">Reward code (optional)</span><input type="text" class="rewardCode" placeholder="MARJANE-AB12" /></label>
    <div style="display:flex;gap:8px;margin-top:10px;">
      <button class="primary-btn verify-btn" style="flex:1;margin-top:0;" data-i18n="verify_btn">Verify & issue reward</button>
      <button class="ghost-btn escalate-btn" style="flex:0 0 auto;margin-top:0;padding:13px 14px;border-color:#d97706;color:#d97706;" title="Escalate to Authorities">🏛️</button>
      <button class="ghost-btn reject-btn" style="flex:0 0 auto;margin-top:0;padding:13px 14px;border-color:#dc3545;color:#dc3545;" title="Reject fake/spam report">✖</button>
    </div></div></div>`;
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
  renderAssociationStats(reports);
  $('#pending').innerHTML = pending.length
    ? pending.map(cardHtml).join('')
    : `<p class="muted">${t('all_caught')}</p>`;
  $('#verified').innerHTML = verified.length
    ? verified.map(cardHtml).join('')
    : `<p class="muted">${t('none_yet')}</p>`;
  applyI18n(document);
  document.querySelectorAll('.escalate-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.report');
      const id = card.dataset.id;
      const rep = reports.find(r => r.id === id);
      showEscalateModal(rep);
    });
  });

  document.querySelectorAll('.reject-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      if (!confirm('Reject this report as spam or invalid? It will be hidden from the map.')) return;
      const card = e.target.closest('.report');
      const id = card.dataset.id;
      const notes = card.querySelector('.notes').value || 'Rejected as spam';
      const r = await fetch('/api/reports/' + id + '/verify', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, ADMIN_KEY ? { 'x-admin-key': ADMIN_KEY } : {}, (window.EcoAuth && EcoAuth.getToken && EcoAuth.getToken()) ? { 'Authorization': 'Bearer ' + EcoAuth.getToken() } : {}),
        body: JSON.stringify({ action: 'reject', notes: notes }),
      });
      if (r.ok) {
        showToast('Report rejected');
        load();
      } else {
        showToast('Error rejecting report');
      }
    });
  });

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
    var apps = [];
    if (ADMIN_KEY) c = { scope: 'all' };
    else { var u = window.EcoAuth && EcoAuth.getUser && EcoAuth.getUser(); c = u && u.admin ? u.admin : null; apps = u && u.applications ? u.applications : []; }
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
      
      let demoBtn = document.getElementById('eco-demo-btn');
      if (!demoBtn) {
        demoBtn = document.createElement('button');
        demoBtn.id = 'eco-demo-btn';
        demoBtn.className = 'ghost-btn';
        demoBtn.style.marginTop = '10px';
        demoBtn.textContent = '🧪 Simulate Data (AI Demo)';
        demoBtn.onclick = async () => {
          demoBtn.textContent = 'Generating...';
          const headers = { 'Content-Type': 'application/json' };
          if (ADMIN_KEY) headers['x-admin-key'] = ADMIN_KEY;
          if (window.EcoAuth && EcoAuth.getToken && EcoAuth.getToken()) headers['Authorization'] = 'Bearer ' + EcoAuth.getToken();
          const r = await fetch('/api/stats', { method: 'POST', headers });
          if (r.ok) location.reload();
          else { alert('Simulation failed.'); demoBtn.textContent = '🧪 Simulate Data (AI Demo)'; }
        };
        b.appendChild(demoBtn);
      }

      renderPartnerApplications(apps, panel);
    }
  }

  function renderPartnerApplications(apps, panel) {
    if (!apps || !apps.length) return;
    let box = document.getElementById('ecoPartnerApps');
    if (!box) {
      box = document.createElement('div'); box.id = 'ecoPartnerApps';
      box.innerHTML = '<h2 style="margin-top: 30px;">🤝 Partner Applications</h2><div id="ecoPartnerList" class="report-list"></div>';
      panel.appendChild(box);
    }
    const list = box.querySelector('#ecoPartnerList');
    list.innerHTML = apps.map(a => `
      <div class="card" style="font-size: .9rem;">
        <b>${escapeHtml(a.org_name)}</b> (${escapeHtml(a.city)})<br/>
        <span class="muted">${escapeHtml(a.org_type || 'Unknown type')}</span><br/>
        Contact: ${escapeHtml(a.contact_name || 'N/A')} &lt;<a href="mailto:${escapeHtml(a.email)}">${escapeHtml(a.email)}</a>&gt;<br/>
        ${a.message ? `<p style="margin: 8px 0 0; background: var(--surface-2); padding: 8px; border-radius: 8px; font-style: italic;">"${escapeHtml(a.message)}"</p>` : ''}
        <small class="muted" style="display:block; margin-top: 6px;">${new Date(a.created_at).toLocaleString()}</small>
      </div>
    `).join('');
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

function renderAssociationStats(reports) {
  var u = window.EcoAuth && EcoAuth.getUser && EcoAuth.getUser();
  var c = u && u.admin ? u.admin : null;
  if (!c || c.scope !== 'city') return; // Only show for association admins
  
  const panel = document.querySelector('#panel'); if (!panel) return;
  let box = document.getElementById('ecoAssocStats');
  if (!box) {
    box = document.createElement('div'); box.id = 'ecoAssocStats';
    const dispatchNode = document.getElementById('dispatch');
    if (dispatchNode && dispatchNode.nextSibling) {
      dispatchNode.parentNode.insertBefore(box, dispatchNode.nextSibling);
    } else {
      panel.appendChild(box);
    }
  }
  
  const cleaners = {};
  reports.forEach(r => {
    const name = r.reporterName || 'Anonymous';
    if (!cleaners[name]) cleaners[name] = { reported: 0, verified: 0 };
    cleaners[name].reported++;
    if (r.status === 'verified') cleaners[name].verified++;
  });
  
  const sorted = Object.entries(cleaners).sort((a, b) => b[1].verified - a[1].verified || b[1].reported - a[1].reported);
  
  const Lg = (typeof window.getLang === 'function') ? getLang() : 'en';
  const title = { ar: 'متطوعو مجتمعنا', fr: 'Nos nettoyeurs', en: 'Our Community Cleaners' }[Lg] || 'Our Community Cleaners';
  const thRep = { ar: 'مبلَّغ', fr: 'Signalés', en: 'Reported' }[Lg] || 'Reported';
  const thVer = { ar: 'منظَّف', fr: 'Nettoyés', en: 'Verified' }[Lg] || 'Verified';
  
  let html = `<div class="card" style="margin-bottom: 20px;"><h2>👥 ${title}</h2>`;
  if (sorted.length === 0) {
    html += `<p class="muted">No reports yet in your area.</p>`;
  } else {
    html += `<div style="overflow-x:auto;"><table style="width:100%; border-collapse: collapse; font-size:.9rem; text-align: left;" dir="${Lg === 'ar' ? 'rtl' : 'ltr'}">
      <tr style="border-bottom: 1px solid var(--border); color: var(--muted);">
        <th style="padding: 8px;">Name</th>
        <th style="padding: 8px; text-align:center;">${thRep}</th>
        <th style="padding: 8px; text-align:center;">${thVer} ✅</th>
      </tr>`;
    sorted.forEach(([name, stats]) => {
      html += `<tr style="border-bottom: 1px solid var(--border-strong);">
        <td style="padding: 8px; font-weight:600;">${escapeHtml(name)}</td>
        <td style="padding: 8px; text-align:center;">${stats.reported}</td>
        <td style="padding: 8px; text-align:center; color: var(--accent); font-weight: 700;">${stats.verified}</td>
      </tr>`;
    });
    html += `</table></div>`;
  }
  html += `</div>`;
  box.innerHTML = html;
}

function showEscalateModal(rep) {
  const m = document.createElement('div');
  m.className = 'modal';
  m.style.display = 'flex'; // override hidden class just in case
  m.innerHTML = `
    <div class="modal-card">
      <div class="modal-head"><h2>🏛️ Escalate Report</h2><button class="icon-btn cls">&times;</button></div>
      <p class="muted" style="font-size:.85rem; margin-bottom: 12px;">Draft a formal email to local authorities regarding this severe pollution.</p>
      <label class="field"><span>Recipient Email</span><input type="email" id="escEmail" value="contact@commune.gov.ma"></label>
      <label class="field"><span>Language</span>
        <select id="escLang">
          <option value="fr">Français</option>
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </select>
      </label>
      <button class="primary-btn" id="escSend" style="margin-top:20px;">Draft Email</button>
    </div>
  `;
  document.body.appendChild(m);
  
  // Slide up animation
  setTimeout(() => m.classList.remove('hidden'), 10);

  const close = () => {
    m.classList.add('hidden');
    setTimeout(() => m.remove(), 300);
  };
  m.querySelector('.cls').onclick = close;
  m.addEventListener('click', (e) => { if (e.target === m) close(); });

  m.querySelector('#escSend').onclick = () => {
    const to = m.querySelector('#escEmail').value || 'contact@commune.gov.ma';
    const lang = m.querySelector('#escLang').value;
    const lat = Number(rep.lat).toFixed(5);
    const lng = Number(rep.lng).toFixed(5);
    const link = location.origin + '?rally=' + rep.id;
    const cat = typeof catLabel === 'function' ? catLabel(rep.category) : rep.category;
    
    let subject, body;
    if (lang === 'fr') {
      subject = `[URGENT] Signalement de pollution - Intervention requise (${lat}, ${lng})`;
      body = `Madame, Monsieur,\n\nJe vous contacte via la plateforme EcoClean Connect pour signaler un cas de pollution nécessitant l'intervention des services municipaux.\n\nNature du problème : ${cat}\nCoordonnées GPS : ${lat}, ${lng}\nLien vers la carte : ${link}\nPhoto : ${rep.beforePhoto || 'N/A'}\nDescription : ${rep.description || 'N/A'}\n\nEn vous remerciant d'avance pour votre réactivité.\n\nCordialement,`;
    } else if (lang === 'ar') {
      subject = `[عاجل] بلاغ عن تلوث بيئي - طلب تدخل (${lat}, ${lng})`;
      body = `السيد رئيس المجلس الجماعي،\n\nأتواصل معكم عبر منصة EcoClean Connect للإبلاغ عن حالة تلوث تتطلب تدخل المصالح البلدية.\n\nنوع المشكل: ${cat}\nالإحداثيات: ${lat}, ${lng}\nرابط الخريطة: ${link}\nالصورة: ${rep.beforePhoto || 'N/A'}\nالوصف: ${rep.description || 'N/A'}\n\nشكراً لجهودكم وتفاعلكم السريع.\n\nمع خالص التحيات،`;
    } else {
      subject = `[URGENT] Pollution Report - Intervention Required (${lat}, ${lng})`;
      body = `To the City Council,\n\nI am contacting you via EcoClean Connect to report a pollution site that requires municipal intervention.\n\nCategory: ${cat}\nGPS Coordinates: ${lat}, ${lng}\nMap Link: ${link}\nPhoto: ${rep.beforePhoto || 'N/A'}\nDescription: ${rep.description || 'N/A'}\n\nThank you for your swift action.\n\nSincerely,`;
    }
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    close();
  };
}
