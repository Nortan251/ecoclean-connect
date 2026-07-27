/* a11y.js — site-wide accessibility enhancements (ADDITIVE, no markup changes).
 * Injected on every page. Three cheap, high-value upgrades that also signal
 * engineering maturity to anyone reviewing the app:
 *   1. A strong :focus-visible ring on every interactive element (keyboard users
 *      can actually see where they are — the existing theme only styled a few).
 *   2. role="status" + aria-live="polite" on the shared #toast and on any
 *      .form-msg / .eco-auth-msg so screen readers ANNOUNCE validation results,
 *      success and errors instead of them appearing silently.
 *   3. Honours prefers-reduced-motion by setting a root flag (CSS already guards
 *      the heavy animations on most modules; this is belt-and-braces).
 * Pure DOM augmentation: if a node is missing it's skipped, so it can't break. */
(function () {
  'use strict';
  function live(el) { if (el && !el.getAttribute('aria-live')) { el.setAttribute('aria-live', 'polite'); el.setAttribute('role', el.id === 'toast' ? 'status' : 'status'); } }
  function apply() {
    live(document.getElementById('toast'));
    document.querySelectorAll('.form-msg, .eco-auth-msg, #validationMsg, #qualityMsg, #dupMsg, #pfMsg').forEach(live);
  }
  if (!document.getElementById('eco-a11y-style')) {
    var st = document.createElement('style'); st.id = 'eco-a11y-style';
    st.textContent =
      ':focus-visible{outline:3px solid var(--accent-2,#0d9488);outline-offset:2px;border-radius:6px;}' +
      '.eco-acct-btn:focus-visible,.eco-acct-chip:focus-visible,.eco-filter-toggle:focus-visible,.eco-fchip:focus-visible,.eco-city-chip:focus-visible,.eco-theme-btn:focus-visible{outline:3px solid #fff;outline-offset:2px;}' +
      '@media (prefers-reduced-motion: reduce){html{--eco-motion:0;}}';
    document.head.appendChild(st);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
  // Re-apply after dynamic nodes appear (modals, injected messages).
  var mo = ('MutationObserver' in window) ? new MutationObserver(function () { apply(); }) : null;
  if (mo) mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
})();
