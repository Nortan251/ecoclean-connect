/* ============================================================================
 * export-data.js — Open-Data Portal (CSV + JSON + GeoJSON) (ADDITIVE)
 * ----------------------------------------------------------------------------
 * Turns the platform into a civic-data tool. Completely redesigned to look like 
 * a premium developer portal. Generates exports CLIENT-SIDE from /api/reports.
 * ==========================================================================*/
(function () {
  'use strict';

  const STR = {
    en: { title: 'Open Data Portal', csv: 'CSV', geo: 'GeoJSON', json: 'JSON', note: 'Export the live civic dataset for researchers, journalists, and local NGOs.', empty: 'No reports to export yet.', records: 'live records available', copy_api: 'Copy API Link', copied: 'Copied!' },
    fr: { title: 'Portail Open Data', csv: 'CSV', geo: 'GeoJSON', json: 'JSON', note: 'Exportez le jeu de données civiques pour les chercheurs, journalistes et ONG.', empty: 'Aucun signalement à exporter.', records: 'enregistrements disponibles', copy_api: 'Copier le lien API', copied: 'Copié !' },
    ar: { title: 'بوابة البيانات المفتوحة', csv: 'CSV', geo: 'GeoJSON', json: 'JSON', note: 'قم بتصدير البيانات المدنية للباحثين والصحفيين والجمعيات المحلية.', empty: 'لا توجد بلاغات للتصدير بعد.', records: 'سجل متاح', copy_api: 'نسخ رابط API', copied: 'تم النسخ!' },
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
        <p class="muted" id="expNote" style="font-size: 0.85rem; margin-top: 0; max-width: 90%;"></p>
      </div>
      <div style="font-size: 2rem; background: var(--surface-2); padding: 10px; border-radius: 14px; color: var(--accent-2);">🗄️</div>
    </div>
    
    <div style="background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: 12px; padding: 12px; margin: 12px 0; display: flex; align-items: center; justify-content: space-between;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#10b981; box-shadow:0 0 8px #10b981; animation: pulse 2s infinite;"></span>
        <strong id="expCount" style="font-size:1.1rem; color:var(--text);">0</strong>
        <span id="expLabel" style="font-size:0.8rem; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:0.05em;"></span>
      </div>
      <button id="expApi" class="ghost-btn" style="width:auto; margin:0; padding:6px 12px; font-size:0.75rem; border-color:var(--accent-2); color:var(--accent-2);">🔗 <span class="exp-api-text">API</span></button>
    </div>

    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
      <button class="primary-btn" id="expCsv" style="margin:0; padding:10px; font-size:.85rem; background:linear-gradient(135deg, #3b82f6, #2563eb); box-shadow:0 4px 12px rgba(59,130,246,.3);">📊 CSV</button>
      <button class="primary-btn" id="expJson" style="margin:0; padding:10px; font-size:.85rem; background:linear-gradient(135deg, #f59e0b, #d97706); box-shadow:0 4px 12px rgba(245,158,11,.3);">{ } JSON</button>
      <button class="primary-btn" id="expGeo" style="margin:0; padding:10px; font-size:.85rem; background:linear-gradient(135deg, #10b981, #059669); box-shadow:0 4px 12px rgba(16,185,129,.3);">🌍 GeoJSON</button>
    </div>
  `;
  
  const analytics = document.querySelector('#analytics');
  if (analytics) analytics.insertAdjacentElement('beforebegin', card); 
  else host.appendChild(card);

  function updateLabels() { 
    card.querySelector('#expTitle').textContent = t('title'); 
    card.querySelector('#expNote').textContent = t('note'); 
    card.querySelector('#expLabel').textContent = t('records');
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
    } else if (type === 'json') {
      download('ecoclean-reports-' + stamp() + '.json', JSON.stringify(rows, null, 2), 'application/json');
    } else if (type === 'geo') {
      download('ecoclean-reports-' + stamp() + '.geojson', JSON.stringify(toGeoJSON(rows), null, 2), 'application/geo+json');
    }
  };

  card.querySelector('#expCsv').addEventListener('click', () => handleDownload('csv'));
  card.querySelector('#expJson').addEventListener('click', () => handleDownload('json'));
  card.querySelector('#expGeo').addEventListener('click', () => handleDownload('geo'));

})();
