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
      '@keyframes eco-shimmer{0%{background-position:100% 0;}100%{background-position:0 0;}}' +
      '.eco-empty-dash{grid-column:1/-1;text-align:center;background:var(--surface,#fff);border:1px solid var(--border,#e3ece7);border-radius:18px;padding:30px 20px;box-shadow:var(--shadow,0 6px 18px rgba(16,40,30,.06));}' +
      '.eco-empty-dash .eed-i{font-size:2.4rem;}.eco-empty-dash .eed-t{margin:8px 0 6px;font-size:1.2rem;font-weight:800;color:var(--text,#14241d);}' +
      '.eco-empty-dash .eed-s{margin:0 auto 16px;max-width:440px;color:var(--muted,#5d7268);font-size:.92rem;line-height:1.55;}' +
      '.eco-empty-dash .eed-btn{display:inline-block;text-decoration:none;}';
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

  // Honest empty state: with no reports yet (e.g. after a clean reset, or a fresh
  // deployment), don't show a wall of zeros — show a warm "ready when you are" card
  // with the one action that matters. The personal cards (wallet/quests/streak/
  // account-ui) still render below, so the page never feels broken.
  if (!stats.total) {
    $('#stats').innerHTML =
      '<div class="eco-empty-dash">' +
        '<div class="eed-i">🌱</div>' +
        '<h3 class="eed-t"></h3><p class="eed-s"></p>' +
        '<a class="primary-btn eed-btn" href="index.html#map"></a>' +
      '</div>';
    $('#stats').querySelector('.eed-t').textContent = t('empty_dash_title');
    $('#stats').querySelector('.eed-s').textContent = t('empty_dash_sub');
    $('#stats').querySelector('.eed-btn').textContent = t('empty_dash_btn');
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
