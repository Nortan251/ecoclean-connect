/* ============================================================================
 * a11y.js — accessibility upgrades, injected additively on every page
 * ----------------------------------------------------------------------------
 * Inclusive design is both the right thing to do and a real differentiator. This
 * module makes a set of improvements with ZERO changes to the existing markup:
 *   1. Decorative brand logos are hidden from screen readers (alt="").
 *   2. Status/error messages become live regions so they are announced.
 *   3. A "Skip to content" control (visible only on keyboard focus).
 *   4. Report-modal focus management: focus the first field on open, restore the
 *      trigger on close, and a simple Tab focus-trap while open.
 *   5. A visible :focus-visible ring + respect for prefers-reduced-motion.
 * ==========================================================================*/
(function () {
  'use strict';

  const SKIP = { en: 'Skip to content', fr: 'Aller au contenu', ar: 'تخطٍّ إلى المحتوى' };

  // 1) Decorative brand icons shouldn't be announced as "icon.svg".
  document.querySelectorAll('img.brand-icon').forEach((i) => { if (!i.getAttribute('alt')) i.setAttribute('alt', ''); });

  // 2) Live regions for transient messages.
  const ARIA = { toast: ['status', 'polite'], formMsg: ['status', 'polite'], loginMsg: ['alert', 'assertive'] };
  Object.keys(ARIA).forEach((id) => { const el = document.getElementById(id); if (el) { el.setAttribute('role', ARIA[id][0]); el.setAttribute('aria-live', ARIA[id][1]); } });
  // #validationMsg is created lazily by validation.js; arm its ARIA when it appears.
  const form = document.getElementById('reportForm');
  if (form && !document.getElementById('validationMsg')) {
    const mo = new MutationObserver(() => {
      const v = document.getElementById('validationMsg');
      if (v) { v.setAttribute('role', 'alert'); v.setAttribute('aria-live', 'assertive'); mo.disconnect(); }
    });
    mo.observe(form, { childList: true, subtree: true });
  }

  // 3) Skip-to-content control.
  const target = document.querySelector('main') || document.querySelector('#landing') || document.querySelector('h1');
  if (target) {
    if (!target.id) target.id = 'eco-main-target';
    target.setAttribute('tabindex', '-1');
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'eco-skip';
    skip.textContent = SKIP[(typeof window.getLang === 'function' ? getLang() : 'en')] || SKIP.en;
    skip.addEventListener('click', () => { target.focus(); target.scrollIntoView(); });
    document.body.insertBefore(skip, document.body.firstChild);
  }

  // 4) Report-modal focus management + trap.
  const modal = document.getElementById('reportModal');
  if (modal) {
    let last = null;
    const focusables = () => modal.querySelectorAll('input:not([type="hidden"]),select,textarea,button:not([disabled]),[tabindex]:not([tabindex="-1"])');
    new MutationObserver(() => {
      const open = !modal.classList.contains('hidden');
      if (open) { last = document.activeElement; const f = focusables(); if (f.length) f[0].focus(); }
      else if (last && last.focus) { try { last.focus(); } catch (e) {} last = null; }
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    modal.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || modal.classList.contains('hidden')) return;
      const f = Array.prototype.filter.call(focusables(), (el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    });
  }

  // 5) Styles: skip link, focus ring, reduced-motion.
  const st = document.createElement('style');
  st.id = 'eco-a11y-style';
  st.textContent =
    '.eco-skip{position:absolute;left:8px;top:-52px;z-index:2000;background:#0f5132;color:#fff;border:none;border-radius:8px;padding:10px 14px;font-weight:700;cursor:pointer;transition:top .2s;}' +
    '.eco-skip:focus{top:8px;outline:3px solid #fff;}' +
    ':focus-visible{outline:3px solid #0f5132;outline-offset:2px;}' +
    '@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important;}}';
  document.head.appendChild(st);
})();
