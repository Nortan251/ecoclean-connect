/* ============================================================================
 * export-data.js — open-data export (CSV + GeoJSON) of every report (ADDITIVE)
 * ----------------------------------------------------------------------------
 * Turns the platform into a civic-data tool: journalists, NGOs and city services
 * can take the live dataset with them. Everything is generated CLIENT-SIDE from
 * /api/reports, so no new backend is needed — a small but real "open data" feature
 * that reads beautifully in an essay (data as a public good). Adds one card to the
 * dashboard. (No-ops on pages without <main class="dash">.)
 * ==========================================================================*/
(function () {
  'use strict';

  const STR = {
    en: { title: 'Open data', csv: 'Download CSV', geo: 'Download GeoJSON', note: 'Export every report as open data for journalists, NGOs or your municipality.', empty: 'No reports to export yet.' },
    fr: { title: 'Données ouvertes', csv: 'Télécharger CSV', geo: 'Télécharger GeoJSON', note: 'Exportez tous les signalements en données ouvertes pour journalistes, ONG ou municipalité.', empty: 'Aucun signalement à exporter.' },
    ar: { title: 'بيانات مفتوحة', csv: 'تنزيل CSV', geo: 'تنزيل GeoJSON', note: 'صدّر كل البلاغات كبيانات مفتوحة للصحفيين أو الجمعيات أو البلدية.', empty: 'لا توجد بلاغات للتصدير بعد.' },
  };
  const t = () => STR[(typeof window.getLang === 'function' ? getLang() : 'en')] || STR.en;

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
    catch (e) { return (window.EcoClean && EcoClean.reports) || []; }
  }

  const host = document.querySelector('main.dash');
  if (!host) return;                                  // dashboard only

  const card = document.createElement('section');
  card.className = 'card'; card.id = 'exportCard';
  card.innerHTML = '<h2></h2><p class="muted"></p><div style="display:flex;gap:10px">' +
    '<button class="primary-btn" id="expCsv" style="flex:1"></button>' +
    '<button class="ghost-btn" id="expGeo" style="flex:1"></button></div>';
  const analytics = document.querySelector('#analytics');
  if (analytics) analytics.insertAdjacentElement('beforebegin', card); else host.appendChild(card);

  function label() { const s = t(); card.querySelector('h2').textContent = s.title; card.querySelector('p').textContent = s.note; card.querySelector('#expCsv').textContent = s.csv; card.querySelector('#expGeo').textContent = s.geo; }
  label();
  const sel = document.querySelector('#langSelect'); if (sel) sel.addEventListener('change', label);

  card.querySelector('#expCsv').addEventListener('click', async () => {
    const rows = await grab(); if (!rows.length) { alert(t().empty); return; }
    download('ecoclean-reports-' + stamp() + '.csv', '﻿' + toCSV(rows), 'text/csv;charset=utf-8'); // BOM for Excel
  });
  card.querySelector('#expGeo').addEventListener('click', async () => {
    const rows = await grab(); if (!rows.length) { alert(t().empty); return; }
    download('ecoclean-reports-' + stamp() + '.geojson', JSON.stringify(toGeoJSON(rows), null, 2), 'application/geo+json');
  });
})();
