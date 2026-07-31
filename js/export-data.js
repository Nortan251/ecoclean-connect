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
      <div>
        <h2 id="expTitle" style="margin-bottom: 4px;"></h2>
        <p class="muted" id="expNote" style="font-size: 0.85rem; margin-top: 0; max-width: 95%; line-height: 1.5;"></p>
      </div>
      <div style="font-size: 1.8rem; background: var(--surface-2); padding: 10px; border-radius: 14px; color: var(--accent-2); box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);">🗄️</div>
    </div>
    
    <div style="background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: 12px; padding: 16px; margin: 16px 0; display: flex; flex-direction: column; gap: 12px;">
      <div style="display:flex; align-items:center; justify-content: space-between;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:#10b981; box-shadow:0 0 10px #10b981; animation: pulse 2s infinite;"></span>
          <strong id="expCount" style="font-size:1.4rem; color:var(--text); line-height: 1;">0</strong>
          <span id="expLabel" style="font-size:0.85rem; color:var(--muted); font-weight:700; text-transform:uppercase; letter-spacing:0.05em;"></span>
        </div>
        <button id="expApi" class="ghost-btn" style="width:auto; margin:0; padding:6px 14px; font-size:0.75rem; border-color:var(--accent-2); color:var(--accent-2); font-weight: 800; border-radius: 8px;">🔗 <span class="exp-api-text">API</span></button>
      </div>
      <div style="height: 1px; background: var(--border-strong); width: 100%;"></div>
      <div style="font-size: 0.75rem; color: var(--muted); display: flex; align-items: center; gap: 6px;">
        <span style="color: var(--accent-2);">⚡</span> <span id="expUpdated"></span>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
      <button class="primary-btn" id="expCsv" style="margin:0; padding:12px; font-size:.9rem; background:var(--surface); border: 1.5px solid var(--border-strong); color:var(--text); box-shadow:var(--shadow); transition: all 0.2s;">
        <div style="font-size: 1.4rem; margin-bottom: 4px;">📊</div>
        <span class="btn-label-csv" style="font-weight: 800;">CSV</span>
      </button>
      <button class="primary-btn" id="expGeo" style="margin:0; padding:12px; font-size:.9rem; background:var(--surface); border: 1.5px solid var(--border-strong); color:var(--text); box-shadow:var(--shadow); transition: all 0.2s;">
        <div style="font-size: 1.4rem; margin-bottom: 4px;">🌍</div>
        <span class="btn-label-geo" style="font-weight: 800;">GeoJSON</span>
      </button>
    </div>
  `;
  
  const analytics = document.querySelector('#analytics');
  if (analytics) analytics.insertAdjacentElement('beforebegin', card); 
  else host.appendChild(card);

  // Add hover effects for the new buttons
  const st = document.createElement('style');
  st.textContent = `
    #expCsv:hover { border-color: #3b82f6; color: #3b82f6; transform: translateY(-2px); box-shadow: 0 8px 16px rgba(59,130,246,0.15); }
    #expGeo:hover { border-color: #10b981; color: #10b981; transform: translateY(-2px); box-shadow: 0 8px 16px rgba(16,185,129,0.15); }
    html[data-theme="dark"] #expCsv, html[data-theme="dark"] #expGeo { background: var(--surface-2); }
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
