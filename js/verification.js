/* verification.js — extends the admin panel with an "After Cleanup" photo and a
   Pending -> Verified -> Cleaned state machine. 'Verified' reuses your existing
   /api/reports/:id/verify endpoint; 'Cleaned' is net-new local state. */
(function () {
  // The top "After Cleanup photo / Mark Cleaned" card is an early, disconnected
  // prototype: its button has no .report ancestor, so markCleaned() never ran,
  // and it duplicates the real per-card verify flow in admin.js. Hide it so the
  // admin panel has one unambiguous verification path (after-photo -> /verify).
  const _ve = document.querySelector('#verifyExtras');
  if (_ve) _ve.classList.add('hidden');

  const CLEANED = 'cleanedStatus'; // localStorage map { [reportId]: true }

  function statusOf(id) { return EcoStore.get(CLEANED, {})[id] ? 'cleaned' : null; }

  async function markCleaned(id) {
    const st = EcoStore.get(CLEANED, {});
    st[id] = true;
    EcoStore.set(CLEANED, st);
    const badge = document.querySelector('[data-id="' + id + '"] .badge');
    if (badge) badge.textContent = 'Cleaned ✅';
    // Notify rewards.js (same-tab custom event) to award points.
    window.dispatchEvent(new CustomEvent('ecoclean:cleaned'));
  }

  const btn = document.querySelector('#markCleaned');
  if (btn) btn.addEventListener('click', () => {
    const card = btn.closest('.report');
    if (card && card.dataset.id) markCleaned(card.dataset.id);
  });

  window.EcoVerify = { markCleaned, statusOf };
})();
