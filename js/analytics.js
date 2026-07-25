/* analytics.js — Chart.js widgets: category distribution, avg resolution time,
   and estimated waste volume removed. Reads from your existing /api/reports.
   The chart instance is updated in place (never re-created on the same canvas). */
(function () {
  let catChart = null;

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
    if (catCtx) {
      if (catChart) {
        catChart.data.labels = Object.keys(cats);
        catChart.data.datasets[0].data = Object.values(cats);
        catChart.update();
      } else {
        catChart = new Chart(catCtx, {
          type: 'bar',
          data: { labels: Object.keys(cats), datasets: [{ label: 'Reports', data: Object.values(cats), backgroundColor: '#198754' }] },
          options: { plugins: { title: { display: true, text: 'Category distribution' } } }
        });
      }
    }
    // Write into the child <div>s (NOT the parent card) so nothing is wiped.
    const resCtx = document.getElementById('resChart');
    if (resCtx) resCtx.innerHTML = '<p><b>Avg resolution:</b> ' + avgResolution(reports).toFixed(1) + ' days</p>';
    const volCtx = document.getElementById('volChart');
    if (volCtx) volCtx.innerHTML = '<p><b>Est. volume removed:</b> ~' + (reports.filter(r => r.status === 'verified').length * 25) + ' kg</p>';
  }

  window.EcoData.load().then(render);
  setInterval(render, 8000);
})();
