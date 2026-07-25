/* analytics.js — Chart.js widgets: category distribution, avg resolution time,
   and estimated waste volume removed. Reads from your existing /api/reports. */
(function () {
  function avgResolution(reports) {
    const verified = reports.filter(r => r.verifiedAt && r.createdAt);
    if (!verified.length) return 0;
    const days = verified.reduce((s, r) =>
      s + (new Date(r.verifiedAt) - new Date(r.createdAt)) / 86400000, 0);
    return days / verified.length;
  }
  function render() {
    const reports = window.EcoClean.reports;
    if (!reports.length || !window.Chart) return;
    const cats = {};
    reports.forEach(r => { cats[r.category] = (cats[r.category] || 0) + 1; });
    const catCtx = document.getElementById('catChart');
    if (catCtx) new Chart(catCtx, {
      type: 'bar',
      data: { labels: Object.keys(cats), datasets: [{ label: 'Reports', data: Object.values(cats), backgroundColor: '#198754' }] },
      options: { plugins: { title: { display: true, text: 'Category distribution' } } }
    });
    const resCtx = document.getElementById('resChart');
    if (resCtx) resCtx.parentElement.innerHTML =
      '<p><b>Avg resolution:</b> ' + avgResolution(reports).toFixed(1) + ' days</p>';
    const volCtx = document.getElementById('volChart');
    if (volCtx) volCtx.parentElement.innerHTML =
      '<p><b>Est. volume removed:</b> ~' + (reports.filter(r => r.status === 'verified').length * 25) + ' kg</p>';
  }
  window.EcoData.load().then(render);
  setInterval(render, 8000);
})();
