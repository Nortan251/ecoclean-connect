// EcoClean Connect — dashboard logic (i18n aware)
const $ = (s) => document.querySelector(s);

const escapeHtml = (s) =>
  (s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

async function load() {
  // Skeleton placeholders while the network resolves (perceived-performance polish).
  if (!document.getElementById('eco-dash-skel-style')) {
    const sk = document.createElement('style'); sk.id = 'eco-dash-skel-style';
    sk.textContent =
      '.skel{background:linear-gradient(90deg,#e7efe9 25%,#f1f6f3 37%,#e7efe9 63%);background-size:400% 100%;animation:eco-shimmer 1.2s ease infinite;border-radius:6px;}' +
      '.skel-b{height:1.5rem;width:55%;margin:0 auto 6px;}.skel-s{height:.7rem;width:65%;margin:0 auto;}' +
      '.skel-l{width:90px;height:.9rem;}.skel-fill{width:60%;height:100%;}' +
      '.skel-thumb{width:96px;height:72px;border-radius:8px;flex:0 0 auto;}' +
      '.skel-line{height:.85rem;width:80%;margin:6px 0;}.skel-line.short{width:45%;}' +
      '@keyframes eco-shimmer{0%{background-position:100% 0;}100%{background-position:0 0;}}';
    document.head.appendChild(sk);
  }
  $('#stats').innerHTML = '<div class="stat"><div class="skel skel-b"></div><div class="skel skel-s"></div></div><div class="stat"><div class="skel skel-b"></div><div class="skel skel-s"></div></div><div class="stat"><div class="skel skel-b"></div><div class="skel skel-s"></div></div>';
  $('#cats').innerHTML = '<div class="bar-row"><div class="skel skel-l"></div><div class="bar"><div class="skel skel-fill"></div></div></div>'.repeat(3);
  $('#recent').innerHTML = '<div class="card report"><div class="skel skel-thumb"></div><div style="flex:1"><div class="skel skel-line"></div><div class="skel skel-line short"></div></div></div>'.repeat(3);

  let stats, reports;
  try {
    [stats, reports] = await Promise.all([
      fetch('/api/stats').then((r) => r.json()),
      fetch('/api/reports').then((r) => r.json()),
    ]);
  } catch (e) {
    $('#stats').innerHTML = `<p class="muted">${t('no_activity')}</p>`;
    $('#cats').innerHTML = '';
    $('#recent').innerHTML = '';
    return;
  }

  $('#stats').innerHTML = `
    <div class="stat"><b>${stats.total}</b><span>${t('total_reports')}</span></div>
    <div class="stat red"><b>${stats.reported}</b><span>${t('reported_red')}</span></div>
    <div class="stat green"><b>${stats.verified}</b><span>${t('verified_green')}</span></div>`;

  const cats = Object.entries(stats.byCategory).filter(([, v]) => v > 0);
  $('#cats').innerHTML = cats.length
    ? cats
        .map(
          ([k, v]) => `<div class="bar-row"><span>${catLabel(k)}</span>
          <div class="bar"><div class="bar-fill" style="width:${Math.max(
            6,
            (v / stats.total) * 100
          )}%"></div></div><b>${v}</b></div>`
        )
        .join('')
    : `<p class="muted">${t('no_reports')}</p>`;

  const recent = reports.slice(0, 8);
  $('#recent').innerHTML = recent.length
    ? recent
        .map(
          (r) => `<div class="card report">
          <img src="${r.beforePhoto}" class="thumb" />
          <div><b>${catLabel(r.category)}</b> ${
            r.status === 'verified'
              ? '<span class="badge green">✓</span>'
              : '<span class="badge red">●</span>'
          }
          <p>${escapeHtml(r.description)}</p>
          <small>${new Date(r.createdAt).toLocaleString()}</small></div>
        </div>`
        )
        .join('')
    : `<p class="muted">${t('no_activity')}</p>`;
}

window.addEventListener('DOMContentLoaded', () => {
  applyI18n(document);
  const sel = $('#langSelect');
  if (sel) {
    sel.value = getLang();
    sel.addEventListener('change', (e) => {
      setLang(e.target.value);
      applyI18n(document);
      load();
    });
  }
  load();
});
