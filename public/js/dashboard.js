// EcoClean Connect — dashboard logic (i18n aware)
const $ = (s) => document.querySelector(s);

const escapeHtml = (s) =>
  (s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

async function load() {
  const [stats, reports] = await Promise.all([
    fetch('/api/stats').then((r) => r.json()),
    fetch('/api/reports').then((r) => r.json()),
  ]);

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
