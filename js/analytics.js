/* analytics.js — richer Impact Analytics (Chart.js). Builds the chart layout ONCE
 * (so Chart instances are NOT recreated on the 8s refresh — that would leak memory
 * and flicker), then only updates data + KPI numbers. Replaces the old "basic"
 * single bar + two text lines with: a KPI chip row, a category bar chart, a status
 * doughnut, and a 14-day reported-vs-cleaned activity timeline. */
(function () {
  let built = false, catChart = null, statusChart = null, timelineChart = null;
  const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
  const GREEN = '#198754', RED = '#ef4444', AMBER = '#f59e0b', MUTED = '#5d7268';

  const dayKey = (d) => d.toISOString().slice(0, 10);
  function timeline(reports) {
    const days = [], now = new Date();
    for (let i = 13; i >= 0; i--) { const d = new Date(now); d.setDate(now.getDate() - i); days.push(dayKey(d)); }
    const rep = {}, ver = {}; days.forEach((k) => { rep[k] = 0; ver[k] = 0; });
    reports.forEach((r) => {
      if (r.createdAt) { const k = dayKey(new Date(r.createdAt)); if (k in rep) rep[k]++; }
      if (r.verifiedAt) { const k = dayKey(new Date(r.verifiedAt)); if (k in ver) ver[k]++; }
    });
    return { labels: days.map((k) => k.slice(5)), rep: days.map((k) => rep[k]), ver: days.map((k) => ver[k]) };
  }
  function avgResolution(reports) {
    const v = reports.filter((r) => r.verifiedAt && r.createdAt);
    if (!v.length) return 0;
    return v.reduce((s, r) => s + (new Date(r.verifiedAt) - new Date(r.createdAt)) / 86400000, 0) / v.length;
  }
  const kpiChip = (icon, val, label) => '<div class="kpi"><span class="kpi-ico">' + icon + '</span><b>' + val + '</b><span class="kpi-l">' + label + '</span></div>';

  function build(card) {
    const h2 = card.querySelector('h2');
    const title = h2 ? h2.textContent : 'Impact Analytics';
    card.innerHTML =
      '<h2>' + title + '</h2>' +
      '<div class="kpi-row" id="kpiRow"></div>' +
      '<div class="analytics-grid">' +
      '<div class="analytics-card"><div class="ac-title">Reports by category</div><div class="ac-canvas"><canvas id="catChart"></canvas></div></div>' +
      '<div class="analytics-card"><div class="ac-title">Status</div><div class="ac-canvas"><canvas id="statusChart"></canvas></div></div>' +
      '<div class="analytics-card analytics-card--wide"><div class="ac-title">Activity — last 14 days</div><div class="ac-canvas"><canvas id="timelineChart"></canvas></div></div>' +
      '</div>';
    Chart.defaults.font.family = FONT; Chart.defaults.color = MUTED;
    const ttip = { backgroundColor: '#14241d', padding: 10, cornerRadius: 10, titleFont: { weight: '700' }, displayColors: false };
    catChart = new Chart(card.querySelector('#catChart'), {
      type: 'bar', data: { labels: [], datasets: [{ label: 'Reports', data: [], backgroundColor: GREEN, borderRadius: 8, maxBarThickness: 34 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: ttip }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 } } }, y: { beginAtZero: true, grid: { color: 'rgba(20,36,29,.06)' }, ticks: { precision: 0 } } } },
    });
    statusChart = new Chart(card.querySelector('#statusChart'), {
      type: 'doughnut', data: { labels: ['Active', 'Cleaned'], datasets: [{ data: [0, 0], backgroundColor: [RED, GREEN], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, padding: 12 } }, tooltip: ttip } },
    });
    timelineChart = new Chart(card.querySelector('#timelineChart'), {
      type: 'line', data: { labels: [], datasets: [
        { label: 'Reported', data: [], borderColor: AMBER, backgroundColor: 'rgba(245,158,11,.15)', fill: true, tension: .35, pointRadius: 0, borderWidth: 2 },
        { label: 'Cleaned', data: [], borderColor: GREEN, backgroundColor: 'rgba(25,135,84,.15)', fill: true, tension: .35, pointRadius: 0, borderWidth: 2 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, padding: 12 } }, tooltip: ttip }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } }, y: { beginAtZero: true, grid: { color: 'rgba(20,36,29,.06)' }, ticks: { precision: 0 } } } },
    });
  }

  function update(reports) {
    const total = reports.length;
    const verified = reports.filter((r) => r.status === 'verified').length;
    const reported = total - verified;
    const cats = {}; reports.forEach((r) => { cats[r.category] = (cats[r.category] || 0) + 1; });
    catChart.data.labels = Object.keys(cats).map((c) => (typeof window.catLabel === 'function' ? catLabel(c) : c));
    catChart.data.datasets[0].data = Object.values(cats); catChart.update();
    statusChart.data.datasets[0].data = [reported, verified]; statusChart.update();
    const tl = timeline(reports);
    timelineChart.data.labels = tl.labels;
    timelineChart.data.datasets[0].data = tl.rep;
    timelineChart.data.datasets[1].data = tl.ver; timelineChart.update();
    const row = document.getElementById('kpiRow');
    if (row) row.innerHTML =
      kpiChip('📊', total, 'Reports') + kpiChip('🔴', reported, 'Active') + kpiChip('✅', verified, 'Cleaned') +
      kpiChip('⏱️', avgResolution(reports).toFixed(1), 'Avg days to clean') + kpiChip('♻️', '~' + (verified * 25), 'kg removed');
  }

  function render() {
    const card = document.getElementById('analytics'); if (!card || !window.Chart) return;
    const reports = window.EcoClean.reports || [];
    if (!built) { build(card); built = true; }   // build once -> reuse Chart instances
    update(reports);
  }

  if (!document.getElementById('eco-analytics-style')) {
    const st = document.createElement('style'); st.id = 'eco-analytics-style';
    st.textContent =
      '.kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:10px;margin:4px 0 14px;}' +
      '.kpi{background:linear-gradient(180deg,#eef7f2,#e6f3ef);border:1px solid #e3ece7;border-radius:14px;padding:12px 8px;text-align:center;}' +
      '.kpi-ico{font-size:1.05rem;}' +
      '.kpi b{display:block;font-size:1.35rem;font-weight:800;background:linear-gradient(135deg,#198754,#0d9488);-webkit-background-clip:text;background-clip:text;color:transparent;line-height:1.1;}' +
      '.kpi-l{font-size:.66rem;color:#5d7268;text-transform:uppercase;letter-spacing:.04em;font-weight:600;}' +
      '.analytics-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}' +
      '.analytics-card{background:#fff;border:1px solid #e3ece7;border-radius:14px;padding:12px;box-shadow:0 1px 2px rgba(16,40,30,.05);}' +
      '.analytics-card--wide{grid-column:1 / -1;}' +
      '.ac-title{font-size:.8rem;font-weight:700;color:#14241d;margin-bottom:8px;}' +
      '.ac-canvas{position:relative;height:180px;}' +
      '@media (max-width:520px){.analytics-grid{grid-template-columns:1fr;}}';
    document.head.appendChild(st);
  }

  window.addEventListener('ecoclean:data', render);
  if (window.EcoData && EcoData.load) EcoData.load().then(render);
  setInterval(render, 8000);
})();
