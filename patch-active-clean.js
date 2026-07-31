const fs = require('fs');

// 1. HTML modifications
let html = fs.readFileSync('index.html', 'utf8');
if (!html.includes('eco-form-tabs')) {
  html = html.replace(
    '<form id="reportForm">',
    `<form id="reportForm">
        <div class="eco-form-tabs">
          <button type="button" class="eft-btn active" id="tabReport" data-i18n="tab_report">📍 I'm Reporting</button>
          <button type="button" class="eft-btn" id="tabClean" data-i18n="tab_clean">✅ I Cleaned It!</button>
        </div>`
  );
  html = html.replace(
    /<span data-i18n="photo">Photo \(required\)<\/span>/,
    `<span id="lblBeforePhoto" data-i18n="photo">Photo (required)</span>`
  );
  html = html.replace(
    /<input type="file" name="photo" accept="image\/\*" capture="environment" required \/>\s*<\/label>/,
    `<input type="file" name="photo" accept="image/*" capture="environment" required /></label>
        <label class="field hidden" id="fieldAfterPhoto">
          <span data-i18n="after_photo">After Photo (required)</span>
          <input type="file" name="afterPhoto" accept="image/*" capture="environment" />
        </label>`
  );
  fs.writeFileSync('index.html', html);
}

// 2. CSS modifications
let css = fs.readFileSync('css/styles.css', 'utf8');
if (!css.includes('.eco-form-tabs')) {
  css += `\n/* Active Cleaning Tabs */
.eco-form-tabs { display: flex; gap: 8px; margin-bottom: 16px; background: var(--surface-2); padding: 4px; border-radius: 12px; }
.eft-btn { flex: 1; border: none; background: transparent; padding: 10px; border-radius: 8px; font-weight: 700; color: var(--muted); cursor: pointer; transition: all 0.2s; font-size: .85rem; font-family: inherit; }
.eft-btn.active { background: var(--surface); color: var(--accent-dark); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
`;
  fs.writeFileSync('css/styles.css', css);
}

// 3. i18n modifications
let i18n = fs.readFileSync('js/i18n.js', 'utf8');
if (!i18n.includes('tab_report')) {
  i18n = i18n.replace(
    /photo: 'Photo \(required\)'/,
    `photo: 'Photo (required)', tab_report: '📍 I\\'m Reporting', tab_clean: '✅ I Cleaned It!', photo_before: 'Before Photo (req.)'`
  ).replace(
    /photo: 'Photo \(requise\)'/,
    `photo: 'Photo (requise)', tab_report: '📍 Signaler', tab_clean: '✅ J\\'ai Nettoyé !', photo_before: 'Photo Avant (req.)'`
  ).replace(
    /photo: 'الصورة \(مطلوب\)'/,
    `photo: 'الصورة (مطلوب)', tab_report: '📍 إبلاغ فقط', tab_clean: '✅ قمت بتنظيفه!', photo_before: 'صورة قبل التنظيف'`
  );
  fs.writeFileSync('js/i18n.js', i18n);
}

// 4. App.js modifications
let appJs = fs.readFileSync('js/app.js', 'utf8');
if (!appJs.includes('window.EcoReportMode')) {
  // Replace handleReport
  const handleReportRegex = /async function handleReport\(e\) \{[\s\S]*?msg\.textContent = t\('err_network'\);\n  \} finally \{\n    if \(btn\.disabled\) \{\n      btn\.disabled = false;\n      btn\.textContent = ogText;\n    \}\n  \}\n\}/;
  
  const newHandleReport = `
window.EcoReportMode = 'report';

async function handleReport(e) {
  e.preventDefault();
  const form = e.target;
  const msg = $('#formMsg');
  const btn = form.querySelector('button[type="submit"]');
  const file = form.photo.files[0];
  const afterFile = form.afterPhoto.files[0];
  
  if (!file || !form.lat.value || !form.lng.value || (window.EcoReportMode === 'clean' && !afterFile)) {
    msg.textContent = t('err_required');
    return;
  }
  msg.textContent = t('submitting');
  const ogText = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('submitting');
  try {
    const photo = await fileToResizedDataUrl(file);
    const payload = {
      photo,
      lat: form.lat.value,
      lng: form.lng.value,
      category: form.category.value,
      description: form.description.value,
      reporterName: form.reporterName.value,
      isSelfCleaned: window.EcoReportMode === 'clean'
    };
    if (window.EcoReportMode === 'clean') {
      payload.afterPhoto = await fileToResizedDataUrl(afterFile);
    }
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, (window.EcoAuth && EcoAuth.getToken()) ? { 'Authorization': 'Bearer ' + EcoAuth.getToken() } : {}),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      msg.textContent = '❌ ' + (err.error || t('err_fail'));
      btn.disabled = false;
      btn.textContent = ogText;
      return;
    }
    
    // Additive hook: tell the thank-you module what was just reported.
    window.dispatchEvent(new CustomEvent('ecoclean:reported', {
      detail: {
        category: form.category.value,
        reporterName: form.reporterName.value,
        lat: form.lat.value,
        lng: form.lng.value,
      },
    }));
    
    form.reset();
    resetTabs();
    populateCategories($('#categorySelect'));
    closeModal();
    
    // If they self-cleaned and are logged in, points were awarded. Refresh auth state.
    if (window.EcoReportMode === 'clean' && window.EcoAuth && EcoAuth.refresh) {
      EcoAuth.refresh();
      showToast('Hero! Clean-up Verified! ✅');
    } else {
      showToast(t('success'));
    }
    
    await loadReports();
  } catch (err) {
    msg.textContent = t('err_network');
  } finally {
    if (btn && btn.disabled) {
      btn.disabled = false;
      btn.textContent = ogText;
    }
  }
}

function resetTabs() {
  window.EcoReportMode = 'report';
  const tr = $('#tabReport'), tc = $('#tabClean'), fap = $('#fieldAfterPhoto'), lbl = $('#lblBeforePhoto');
  if (tr) tr.classList.add('active');
  if (tc) tc.classList.remove('active');
  if (fap) { fap.classList.add('hidden'); fap.querySelector('input').required = false; }
  if (lbl) lbl.textContent = t('photo');
}
`;
  appJs = appJs.replace(handleReportRegex, newHandleReport);

  // Hook up tab listeners
  appJs = appJs.replace(
    /\$\('#reportBtn'\)\.addEventListener\('click', openModal\);/,
    `$('#reportBtn').addEventListener('click', openModal);
  $('#tabReport').addEventListener('click', () => { window.EcoReportMode = 'report'; $('#tabReport').classList.add('active'); $('#tabClean').classList.remove('active'); $('#fieldAfterPhoto').classList.add('hidden'); $('#fieldAfterPhoto input').required = false; $('#lblBeforePhoto').textContent = t('photo'); });
  $('#tabClean').addEventListener('click', () => { window.EcoReportMode = 'clean'; $('#tabClean').classList.add('active'); $('#tabReport').classList.remove('active'); $('#fieldAfterPhoto').classList.remove('hidden'); $('#fieldAfterPhoto input').required = true; $('#lblBeforePhoto').textContent = t('photo_before'); });`
  );

  fs.writeFileSync('js/app.js', appJs);
}

// 5. Backend modifications
let reportsJs = fs.readFileSync('api/reports.js', 'utf8');
if (!reportsJs.includes('isSelfCleaned')) {
  reportsJs = `const { supabase } = require('./_lib/supabase');
const { REPORT_SELECT, readJson, uploadPhoto, friendlyDbError, adminContextOrNull, inCityBounds } = require('./_lib/helpers');
const { verifyUser } = require('./_lib/auth');
const push = require('./_lib/push');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const ac = await adminContextOrNull(req, res);
    if (ac && !ac.ok) return; 
    let q = supabase.from('reports').select(REPORT_SELECT).neq('status', 'rejected').order('created_at', { ascending: false });
    if (ac && ac.kind === 'assoc' && ac.ctx) {
      const c = ac.ctx, dLat = c.radius_km / 111.0, dLng = c.radius_km / Math.max(1, 111.0 * Math.cos(c.lat * Math.PI / 180));
      q = q.gte('lat', c.lat - dLat).lte('lat', c.lat + dLat).gte('lng', c.lng - dLng).lte('lng', c.lng + dLng);
    }
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: friendlyDbError(error.message) });
    let list = data || [];
    if (ac && ac.kind === 'assoc' && ac.ctx) list = list.filter((r) => inCityBounds(r, ac.ctx));
    return res.status(200).json(list);
  }

  if (req.method === 'POST') {
    let body;
    try { body = await readJson(req); } catch (e) { return res.status(400).json({ error: 'invalid json' }); }
    
    if (!body.photo || !body.lat || !body.lng) {
      return res.status(400).json({ error: 'photo and location required' });
    }
    const isSelfCleaned = !!body.isSelfCleaned;
    if (isSelfCleaned && !body.afterPhoto) {
      return res.status(400).json({ error: 'after photo required for self-cleaned reports' });
    }

    const user = await verifyUser(req);
    try {
      const before = await uploadPhoto(body.photo);
      let after = null;
      if (isSelfCleaned) after = await uploadPhoto(body.afterPhoto);

      const status = isSelfCleaned ? 'verified' : 'reported';
      const verifiedAt = isSelfCleaned ? new Date().toISOString() : null;

      const { data, error } = await supabase
        .from('reports')
        .insert({
          reporter_name: body.reporterName || 'Anonymous',
          category: body.category || 'other',
          description: body.description || '',
          lat: parseFloat(body.lat),
          lng: parseFloat(body.lng),
          before_photo: before,
          after_photo: after,
          status: status,
          verified_at: verifiedAt,
          rewarded: isSelfCleaned,
          reporter_user_id: user ? user.id : null,
        })
        .select(REPORT_SELECT)
        .single();
      if (error) return res.status(500).json({ error: friendlyDbError(error.message) });
      
      const bgTasks = [];
      if (user && user.id) {
        bgTasks.push(supabase.rpc('record_daily_activity', { uid: user.id }).catch(() => {}));
        // Award points instantly if they self-cleaned it!
        if (isSelfCleaned) {
          bgTasks.push(supabase.rpc('award_points', { uid: user.id, amt: 20 }).catch(() => {}));
          bgTasks.push(supabase.rpc('apply_streak_bonus', { uid: user.id }).catch(() => {}));
        }
      }
      
      // Only ping admins if it requires verification (not self-cleaned)
      if (!isSelfCleaned) {
        bgTasks.push(push.toAdmins({
          title: 'New report 📍',
          body: 'A ' + (body.category || 'pollution') + ' report was just submitted and needs verification.',
          url: '/admin.html',
          icon: '/icon-192.png',
        }).catch(() => {}));
      }
      
      await Promise.allSettled(bgTasks);
      return res.status(201).json(data);
    } catch (e) {
      return res.status(500).json({ error: friendlyDbError(e && e.message ? e.message : String(e)) });
    }
  }
  res.status(405).end();
};
`;
  fs.writeFileSync('api/reports.js', reportsJs);
}

