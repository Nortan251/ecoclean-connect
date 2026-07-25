/* map-sync.js — status-driven pin colors + offline report queue.
   Colors: Red = Active, Yellow = In Review, Green = Cleaned.
   Offline submissions are queued in localStorage and flushed on 'online'. */
(function () {
  const QUEUE = 'offlineQueue';
  const COLOR = { active: '#dc3545', review: '#ffc107', cleaned: '#198754' };

  function refreshMarkers() {
    window.EcoClean.maps.forEach(map =>
      map.eachLayer(l => {
        if (l._reportId && typeof l.setStyle === 'function') {
          const c = COLOR[window.EcoClean.statusOf(l._reportId)] || COLOR.active;
          l.setStyle({ color: c, fillColor: c });
        }
      })
    );
  }
  async function flush() {
    const q = EcoStore.get(QUEUE, []);
    if (!q.length) return;
    for (const item of q) {
      try {
        await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
      } catch (e) { continue; }
    }
    EcoStore.set(QUEUE, []);
    await window.EcoData.load();
    window.EcoClean.tagMarkers();
    refreshMarkers();
  }
  // Expose queue so your existing submit handler can call it when offline.
  window.EcoOffline = {
    queue(item) { const q = EcoStore.get(QUEUE, []); q.push(item); EcoStore.set(QUEUE, q); },
    flush
  };
  window.addEventListener('online', flush);
  // Keep colors fresh after every report load.
  window.EcoData.load().then(() => { window.EcoClean.tagMarkers(); refreshMarkers(); });
  setInterval(() => { window.EcoClean.tagMarkers(); refreshMarkers(); }, 5000);
})();
