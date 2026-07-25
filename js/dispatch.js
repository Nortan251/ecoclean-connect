/* dispatch.js — clusters active pollution pins within 2km and emits a
   sequential route list (nearest-neighbour order) for cleanup teams. */
(function () {
  const RADIUS_KM = 2;

  function activeReports() {
    return window.EcoClean.reports.filter(r => {
      const st = window.EcoClean.statusOf ? window.EcoClean.statusOf(r.id) : 'active';
      return st === 'active' || st === 'review';
    });
  }
  // Greedy nearest-neighbour ordering for a route starting at the first site.
  function orderRoute(sites) {
    const route = [sites[0]], remaining = sites.slice(1);
    while (remaining.length) {
      const last = route[route.length - 1];
      remaining.sort((a, b) => EcoGeo.distanceKm(last, a) - EcoGeo.distanceKm(last, b));
      route.push(remaining.shift());
    }
    return route;
  }
  function cluster() {
    const acts = activeReports();
    const events = [], used = new Set();
    acts.forEach(a => {
      if (used.has(a.id)) return;
      const near = acts.filter(b => !used.has(b.id) && EcoGeo.distanceKm(a, b) <= RADIUS_KM);
      near.forEach(n => used.add(n.id));
      if (near.length) events.push(near);
    });
    const box = document.querySelector('#routeList'); if (!box) return;
    box.innerHTML = events.map((ev, i) =>
      '<h4>Cleanup Event ' + (i + 1) + ' (' + ev.length + ' sites)</h4><ol>' +
      orderRoute(ev).map(p => '<li>' + p.category + ' @ ' + p.lat.toFixed(4) + ',' + p.lng.toFixed(4) + '</li>').join('') +
      '</ol>'
    ).join('');
  }
  const btn = document.querySelector('#clusterBtn');
  if (btn) btn.addEventListener('click', cluster);
  window.EcoClean.tagMarkers();
})();
