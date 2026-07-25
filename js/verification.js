/* verification.js — extends the admin panel with an "After Cleanup" photo and a
   Pending -> Verified -> Cleaned state machine. 'Verified' reuses your existing
   /api/reports/:id/verify endpoint; 'Cleaned' is net-new local state. */
(function () {
  const CLEANED = 'cleanedStatus'; // localStorage map { [reportId]: true }

  function statusOf(id) { return EcoStore.get(CLEANED, {})[id] ? 'cleaned' : null; }

  async function markCleaned(id) {
    const st = EcoStore.get(CLEANED, {});
    st[id] = true;
    EcoStore.set(CLEANED, st);
    const badge = document.querySelector('[data-id="' + id + '"] .badge');
    if (badge) badge.textContent = 'Cleaned ✅';
    // Notify rewards.js (storage event) to award points.
    localStorage.setItem('ecoclean:cleanedStatus', JSON.stringify(st));
  }

  const btn = document.querySelector('#markCleaned');
  if (btn) btn.addEventListener('click', () => {
    const card = btn.closest('.report');
    if (card && card.dataset.id) markCleaned(card.dataset.id);
  });

  window.EcoVerify = { markCleaned, statusOf };
})();
