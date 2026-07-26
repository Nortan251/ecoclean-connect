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
    // "Survivor" drain: only drop an item once the server actually ACKs it.
    // A thrown fetch() means the network was unreachable, so we KEEP that item
    // for the next attempt — this gives at-least-once delivery with zero silent
    // data loss (the old version cleared the whole queue unconditionally, which
    // could delete reports if a retry ran against a dead/captive-portal link).
    const survivors = [];
    for (const item of q) {
      // Queued items may be {body, auth} (signed-in offline reports) or a bare
      // payload (legacy). Re-attach the Bearer token so attribution survives offline.
      const payload = item && item.body ? item.body : item;
      const auth = item && item.auth ? item.auth : null;
      const headers = { 'Content-Type': 'application/json' }; if (auth) headers['Authorization'] = auth;
      try {
        await fetch('/api/reports', { method: 'POST', headers, body: JSON.stringify(payload) });
        // resolved (any HTTP status) => server received it; do not re-queue
      } catch (e) { survivors.push(item); }      // unreachable => keep for later
    }
    EcoStore.set(QUEUE, survivors);
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
