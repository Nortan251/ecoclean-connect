/* ============================================================================
 * export-data.js — Open-Data Portal (CSV + GeoJSON) (ADDITIVE)
 * ----------------------------------------------------------------------------
 * Turns the platform into a civic-data tool. Designed as a premium developer
 * portal. Generates exports CLIENT-SIDE from /api/reports.
 * ==========================================================================*/
(function () {
  'use strict';

  const STR = {
    en: { title: 'Open Data Portal', csv: 'Download CSV', geo: 'Download GeoJSON', note: 'Export the live civic dataset. Free and open for researchers, journalists, and local municipalities.', empty: 'No reports to export yet.', records: 'Live records available', updated: 'Real-time sync active', copy_api: 'Copy API Link', copied: 'Copied!' },
    fr: { title: 'Portail Open Data', csv: 'Télécharger CSV', geo: 'Télécharger GeoJSON', note: 'Exportez le jeu de données civiques. Gratuit et ouvert pour les chercheurs, journalistes et communes.', empty: 'Aucun signalement à exporter.', records: 'Enregistrements disponibles', updated: 'Synchro temps réel active', copy_api: 'Copier le lien API', copied: 'Copié !' },
    ar: { title: 'بوابة البيانات المفتوحة', csv: 'تنزيل CSV', geo: 'تنزيل GeoJSON', note: 'قم بتصدير البيانات المدنية. مجاني ومفتوح للباحثين والصحفيين والبلديات.', empty: 'لا توجد بلاغات للتصدير بعد.', records: 'سجل متاح الآن', updated: 'مزامنة مباشرة نشطة', copy_api: 'نسخ رابط API', copied: 'تم النسخ!' },
  };
  const lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');
  const t = (k) => (STR[lang()] || STR.en)[k];

  function csvCell(v) { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function toCSV(rows) {
    const cols = ['id', 'category', 'status', 'lat', 'lng', 'description', 'reporterName', 'createdAt', 'verifiedAt', 'rewardIssued'];
    return cols.join(',') + '\n' + rows.map((r) => cols.map((c) => csvCell(r[c])).join(',')).join('\n');
  }
  function toGeoJSON(rows) {
    return {
      type: 'FeatureCollection',
      features: rows.map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Number(r.lng), Number(r.lat)] },
        properties: { id: r.id, category: r.category, status: r.status, description: r.description || '', reporterName: r.reporterName || '', createdAt: r.createdAt || null, verifiedAt: r.verifiedAt || null },
      })),
    };
  }
  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const stamp = () => new Date().toISOString().slice(0, 10);
  async function grab() {
    try { const r = await fetch('/api/reports'); if (!r.ok) throw 0; return (await r.json()) || []; }
    catch (e) { return (window.EcoClean && window.EcoClean.reports) || []; }
  }

  const host = document.querySelector('main.dash');
  if (!host) return;

  const card = document.createElement('section');
  card.className = 'card eco-data-portal';
  card.id = 'exportCard';
  
  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
      <div style="flex:1;">
        <h2 id="expTitle" style="margin-bottom: 6px; display:inline-block;"></h2>
        <p class="muted" id="expNote" style="font-size: 0.9rem; margin-top: 0; line-height: 1.5; padding-right: 15px;"></p>
      </div>
      <div style="font-size: 1.8rem; background: linear-gradient(135deg, var(--surface-2), var(--surface-3)); padding: 12px; border-radius: 16px; color: var(--accent-2); box-shadow: inset 0 2px 4px rgba(0,0,0,0.02), 0 4px 12px rgba(13,148,136,0.1); display:grid; place-items:center;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
      </div>
    </div>
    
    <div style="background: linear-gradient(to right, var(--surface-2), transparent); border-left: 3px solid var(--accent); border-radius: 0 12px 12px 0; padding: 12px 16px; margin: 16px 0; display: flex; align-items: center; justify-content: space-between;">
      <div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#10b981; box-shadow:0 0 8px #10b981; animation: pulse 2s infinite;"></span>
          <strong id="expCount" style="font-size:1.6rem; color:var(--text); line-height: 1; font-weight: 800;">0</strong>
        </div>
        <div id="expLabel" style="font-size:0.75rem; color:var(--muted); font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-top:4px;"></div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 0.75rem; color: var(--muted); display: flex; align-items: center; gap: 4px; justify-content: flex-end; margin-bottom: 6px;">
          <span style="color: var(--accent-2);">⚡</span> <span id="expUpdated"></span>
        </div>
        <button id="expApi" class="ghost-btn" style="width:auto; margin:0; padding:5px 12px; font-size:0.75rem; border-color:var(--border-strong); color:var(--text); font-weight: 600; border-radius: 8px; background: var(--surface);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
          <span class="exp-api-text">API</span>
        </button>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 20px;">
      <button class="primary-btn exp-dl-btn" id="expCsv" style="margin:0; padding:16px 12px; font-size:.9rem; background:var(--surface); border: 1px solid var(--border-strong); color:var(--text); box-shadow:0 4px 12px rgba(0,0,0,0.03); transition: all 0.2s; display:flex; flex-direction:column; align-items:center; gap:8px;">
        <div style="width:40px; height:40px; border-radius:10px; background:rgba(59,130,246,0.1); color:#3b82f6; display:grid; place-items:center;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        </div>
        <span class="btn-label-csv" style="font-weight: 700; font-size:.85rem;">CSV</span>
      </button>
      
      <button class="primary-btn exp-dl-btn" id="expGeo" style="margin:0; padding:16px 12px; font-size:.9rem; background:var(--surface); border: 1px solid var(--border-strong); color:var(--text); box-shadow:0 4px 12px rgba(0,0,0,0.03); transition: all 0.2s; display:flex; flex-direction:column; align-items:center; gap:8px;">
        <div style="width:40px; height:40px; border-radius:10px; background:rgba(16,185,129,0.1); color:#10b981; display:grid; place-items:center;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>
        </div>
        <span class="btn-label-geo" style="font-weight: 700; font-size:.85rem;">GeoJSON</span>
      </button>
    </div>
  `;
  
  const analytics = document.querySelector('#analytics');
  if (analytics) analytics.insertAdjacentElement('beforebegin', card); 
  else host.appendChild(card);

  // Add hover effects for the new buttons
  const st = document.createElement('style');
  st.textContent = `
    .exp-dl-btn:hover { transform: translateY(-3px); border-color: var(--accent-2); box-shadow: 0 8px 20px rgba(13,148,136,0.12); }
    #expCsv:hover > div { background: #3b82f6; color: #fff; }
    #expGeo:hover > div { background: #10b981; color: #fff; }
    html[data-theme="dark"] .exp-dl-btn { background: var(--surface-2); }
  `;
  document.head.appendChild(st);

  function updateLabels() { 
    card.querySelector('#expTitle').textContent = t('title'); 
    card.querySelector('#expNote').textContent = t('note'); 
    card.querySelector('#expLabel').textContent = t('records');
    card.querySelector('#expUpdated').textContent = t('updated');
    card.querySelector('.btn-label-csv').textContent = t('csv');
    card.querySelector('.btn-label-geo').textContent = t('geo');
    const apiText = card.querySelector('.exp-api-text');
    if (apiText && apiText.textContent !== t('copied')) apiText.textContent = t('copy_api');
  }
  updateLabels();
  
  // Live record count sync
  window.addEventListener('ecoclean:data', (e) => {
    const c = e.detail ? e.detail.length : 0;
    card.querySelector('#expCount').textContent = c;
  });

  const sel = document.querySelector('#langSelect'); 
  if (sel) sel.addEventListener('change', updateLabels);

  // Copy API Link
  card.querySelector('#expApi').addEventListener('click', async () => {
    const url = window.location.origin + '/api/reports';
    const apiBtn = card.querySelector('.exp-api-text');
    try {
      await navigator.clipboard.writeText(url);
      apiBtn.textContent = t('copied');
      setTimeout(() => apiBtn.textContent = t('copy_api'), 2000);
    } catch(e) { prompt('API Endpoint:', url); }
  });

  // Downloads
  const handleDownload = async (type) => {
    const rows = await grab(); 
    if (!rows.length) { alert(t('empty')); return; }
    
    if (type === 'csv') {
      download('ecoclean-reports-' + stamp() + '.csv', '﻿' + toCSV(rows), 'text/csv;charset=utf-8');
    } else if (type === 'geo') {
      download('ecoclean-reports-' + stamp() + '.geojson', JSON.stringify(toGeoJSON(rows), null, 2), 'application/geo+json');
    }
  };

  card.querySelector('#expCsv').addEventListener('click', () => handleDownload('csv'));
  card.querySelector('#expGeo').addEventListener('click', () => handleDownload('geo'));

})();
