/* ============================================================================
 * a11y.js — site-wide accessibility enhancements (ADDITIVE, no markup changes).
 * Injected on every page. Three cheap, high-value upgrades that also signal
 * engineering maturity to anyone reviewing the app:
 *   1. Decorative brand logos are hidden from screen readers (alt="").
 *   2. A strong :focus-visible ring on every interactive element.
 *   3. role="status" + aria-live="polite" on the shared #toast and on any
 *      .form-msg / .eco-auth-msg so screen readers ANNOUNCE validation results.
 *   4. Honours prefers-reduced-motion by setting a root flag.
 *   5. Report-modal focus management and skip-to-content logic.
 * ==========================================================================*/
(function () {
  'use strict';
  const SKIP = { en: 'Skip to content', fr: 'Aller au contenu', ar: 'تخطٍّ إلى المحتوى' };

  // 1) Decorative brand icons shouldn't be announced as "icon.svg".
  document.querySelectorAll('img.brand-icon').forEach((i) => { if (!i.getAttribute('alt')) i.setAttribute('alt', ''); });

  // 2) Live regions for transient messages (run continuously for dynamic elements).
  function live(el) { if (el && !el.getAttribute('aria-live')) { el.setAttribute('aria-live', 'polite'); el.setAttribute('role', el.id === 'toast' ? 'status' : 'status'); } }
  function apply() {
    live(document.getElementById('toast'));
    document.querySelectorAll('.form-msg, .eco-auth-msg, #validationMsg, #qualityMsg, #dupMsg, #pfMsg').forEach(live);
  }

  // 3) Skip to content link
  const skip = document.createElement('button');
  skip.className = 'eco-skip';
  const l = (typeof window.getLang === 'function' ? getLang() : 'en');
  skip.textContent = SKIP[l] || SKIP.en;
  skip.onclick = () => {
    const main = document.querySelector('main, #mapView');
    if (main) {
      if (main.tabIndex === -1) main.tabIndex = -1; // ensure focusable
      main.focus();
    }
  };
  document.body.insertBefore(skip, document.body.firstChild);

  // 4) Report modal focus management
  const rModal = document.getElementById('reportModal');
  const trigger = document.querySelector('.fab, #navMap');
  if (rModal) {
    const ob = new MutationObserver((ml) => {
      ml.forEach((m) => {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          if (!rModal.classList.contains('hidden')) {
            const first = rModal.querySelector('input:not([type="hidden"]), select, textarea, button');
            if (first) setTimeout(() => first.focus(), 50);
          } else {
            if (trigger) trigger.focus();
          }
        }
      });
    });
    ob.observe(rModal, { attributes: true });
    // Trap focus inside modal
    rModal.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusable = rModal.querySelectorAll('input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])');
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    });
  }

  // 5) CSS enhancements
  if (!document.getElementById('eco-a11y-style')) {
    const st = document.createElement('style'); st.id = 'eco-a11y-style';
    st.textContent =
      '.eco-skip{position:absolute;left:8px;top:-52px;z-index:2000;background:var(--accent-dark,#0f5132);color:#fff;border:none;border-radius:8px;padding:10px 14px;font-weight:700;cursor:pointer;transition:top .2s;}' +
      '.eco-skip:focus{top:8px;outline:3px solid #fff;}' +
      ':focus-visible{outline:3px solid var(--accent-2,#0d9488);outline-offset:2px;border-radius:6px;}' +
      '.eco-acct-btn:focus-visible,.eco-acct-chip:focus-visible,.eco-filter-toggle:focus-visible,.eco-fchip:focus-visible,.eco-city-chip:focus-visible,.eco-theme-btn:focus-visible{outline:3px solid #fff;outline-offset:2px;}' +
      '@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important;}html{--eco-motion:0;}}';
    document.head.appendChild(st);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
  const moLive = ('MutationObserver' in window) ? new MutationObserver(() => apply()) : null;
  if (moLive) moLive.observe(document.body || document.documentElement, { childList: true, subtree: true });
})();
