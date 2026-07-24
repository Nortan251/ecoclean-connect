// EcoClean Connect — dashboard logic
const $ = (s) => document.querySelector(s);

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

async function load() {
  const [stats, reports] = await Promise.all([
    fetch('/api/stats').then((r) => r.json()),
    fetch('/api/reports').then((r) => r.json()),
  ]);

  $('#stats').innerHTML = `
    <div class="stat"><b>${stats.total}</b><span>Total reports</span></div>
    <div class="stat red"><b>${stats.reported}</b><span>Reported (red)</span></div>
    <div class="stat green"><b>${stats.verified}</b><span>Verified (green)</span></div>`;

  const cats = Object.entries(stats.byCategory).filter(([, v]) => v > 0);
  $('#cats').innerHTML = cats.length
    ? cats
        .map(
          ([k, v]) => `<div class="bar-row"><span>${label(k)}</span>
          <div class="bar"><div class="bar-fill" style="width:${Math.max(
            6,
            (v / stats.total) * 100
          )}%"></div></div><b>${v}</b></div>`
        )
        .join('')
    : '<p class="muted">No reports yet</p>';

  const recent = reports.slice(0, 8);
  $('#recent').innerHTML = recent.length
    ? recent
        .map(
          (r) => `<div class="card report">
          <img src="${r.beforePhoto}" class="thumb" />
          <div><b>${label(r.category)}</b> ${
            r.status === 'verified'
              ? '<span class="badge green">✓</span>'
              : '<span class="badge red">●</span>'
          }
          <p>${escapeHtml(r.description)}</p>
          <small>${new Date(r.createdAt).toLocaleString()}</small></div>
        </div>`
        )
        .join('')
    : '<p class="muted">No activity yet</p>';
}

window.addEventListener('DOMContentLoaded', load);
