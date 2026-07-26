/* ============================================================================
 * landing-fx.js — progressive-enhancement polish for the "opening" (ADDITIVE)
 * ----------------------------------------------------------------------------
 * Adds the cinematic touches to the landing hero WITHOUT touching the HTML:
 * floating eco-leaves, a rotating localized impact word, a live impact stat strip
 * with count-up, and scroll-reveal for the cards. It adds an `eco-fx` class to
 * <html> so the CSS reveal hooks only apply when JS is on — if JS fails or is
 * disabled, all content stays fully visible (graceful degradation). Honours
 * prefers-reduced-motion (no particles / no count-up animation). Each block is
 * isolated in try/catch so one failure can't break the others.
 * ==========================================================================*/
(function () {
  'use strict';
  document.documentElement.classList.add('eco-fx');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');

  // --- floating leaves in the hero -----------------------------------------
  try {
    const hero = document.querySelector('.hero');
    if (hero && !reduce) {
      const EMO = ['🍃', '', '🌱', '💧', '♻️'];
      const wrap = document.createElement('div');
      wrap.className = 'eco-leaves'; wrap.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 12; i++) {
        const s = document.createElement('span');
        s.className = 'eco-leaf'; s.textContent = EMO[i % EMO.length];
        s.style.left = (Math.random() * 100) + '%';
        s.style.top = (Math.random() * 100) + '%';
        s.style.fontSize = (12 + Math.random() * 18) + 'px';
        s.style.setProperty('--d', (6 + Math.random() * 8) + 's');
        s.style.setProperty('--delay', (-Math.random() * 8) + 's');
        s.style.opacity = (0.10 + Math.random() * 0.16).toFixed(2);
        wrap.appendChild(s);
      }
      hero.insertBefore(wrap, hero.firstChild);
    }
  } catch (e) {}

  // --- rotating localized impact word --------------------------------------
  try {
    const hero = document.querySelector('.hero');
    if (hero) {
      const SETS = {
        en: { pre: 'Making your city', words: ['cleaner.', 'safer.', 'greener.', 'healthier.', 'heard.'] },
        fr: { pre: 'Rendre votre ville', words: ['plus propre.', 'plus sûre.', 'plus verte.', 'plus saine.', 'écoutée.'] },
        ar: { pre: 'لنجعل مدينتك', words: ['أنظف.', 'أكثر أمانًا.', 'أخضر.', 'أصح.', 'مسموعة.'] },
      };
      const set = SETS[lang()] || SETS.en;
      const p = document.createElement('p');
      p.className = 'hero-rotate';
      p.innerHTML = '<span class="hero-rotate-pre">' + set.pre + ' </span><span class="eco-rotate-word">' + set.words[0] + '</span>';
      const h1 = hero.querySelector('h1');
      if (h1) h1.insertAdjacentElement('afterend', p);
      if (!reduce) {
        const w = p.querySelector('.eco-rotate-word'); let i = 0;
        setInterval(() => {
          i = (i + 1) % set.words.length;
          w.classList.add('out');
          setTimeout(() => { w.textContent = set.words[i]; w.classList.remove('out'); }, 280);
        }, 2200);
      }
    }
  } catch (e) {}

  // --- live impact stat strip — REMOVED (v2) --------------------------------
  // The count-up "reports / active / cleaned" chips that used to render under
  // the hero CTA were cut on purpose: they duplicated the Dashboard KPIs and
  // crowded the landing page. /api/stats still powers the Dashboard analytics;
  // if we ever want a single live counter back, re-add one chip here.

    // --- scroll reveal --------------------------------------------------------
  try {
    const io = ('IntersectionObserver' in window)
      ? new IntersectionObserver((ents) => { ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.12 })
      : null;
    document.querySelectorAll('.feature-card, .features h2, .hero-cta').forEach((el, idx) => {
      el.classList.add('reveal');
      el.style.transitionDelay = (Math.min(idx, 6) * 0.07) + 's';
      if (io) io.observe(el); else el.classList.add('in');
    });
  } catch (e) {}
})();
