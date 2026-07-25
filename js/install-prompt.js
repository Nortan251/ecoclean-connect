/* ============================================================================
 * install-prompt.js — PWA installability + "Add to Home Screen" UX (ADDITIVE)
 * ----------------------------------------------------------------------------
 * Two jobs, both hooked into existing pages with NO layout edits:
 *
 *  (1) SERVICE-WORKER REGISTRATION ON EVERY PAGE.
 *      Before this module, only app.js (index.html) registered sw.js, so a user
 *      who bookmarked /dashboard.html directly would have NO offline support or
 *      installability. navigator.serviceWorker.register() is idempotent — calling
 *      it again with the same URL just returns the existing registration — so we
 *      register here on every page with zero downside.
 *
 *  (2) CUSTOM INSTALL PROMPT.
 *      When the browser decides the site is "installable" it fires the
 *      `beforeinstallprompt` event. We call preventDefault() to SUPPRESS the
 *      browser's default mini-infobar, stash the event, and show OUR themed pill
 *      instead (a better, on-brand UX that we fully control). On click we call
 *      deferredPrompt.prompt() to open the real native install dialog.
 *
 *      iOS SAFARI EXCEPTION: Apple never fires beforeinstallprompt, so there is
 *      no programmatic install. On iOS we instead show a small hint describing the
 *      manual steps (Share -> Add to Home Screen). Handling this edge is exactly
 *      what makes a PWA feel native on *both* the platforms this app targets.
 * ==========================================================================*/
(function () {
  'use strict';

  /* (1) Make the service worker active everywhere, not just on the landing page. */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () =>
      navigator.serviceWorker.register('sw.js').catch(() => {})
    );
  }

  /* Reuse the shared namespaced store if present; tiny fallback otherwise. */
  const store = window.EcoStore || {
    get(k, fb) { try { const v = localStorage.getItem('ecoclean:' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } },
    set(k, v) { localStorage.setItem('ecoclean:' + k, JSON.stringify(v)); },
  };
  const DISMISS_KEY = 'installDismissed';

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  // iOS incl. iPadOS 13+ which masquerades as "MacIntel" but has touch points.
  const isIOS = () =>
    /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  /* Tiny inline translations so we stay multilingual WITHOUT editing i18n.js. */
  const STR = {
    en: { title: 'Install EcoClean Connect', cta: 'Install', no: 'Not now',
          ios: 'Install: tap the Share button ⬆, then “Add to Home Screen”.' },
    fr: { title: 'Installer EcoClean Connect', cta: 'Installer', no: 'Plus tard',
          ios: 'Installer : touchez Partager ⬆ puis « Sur l’écran d’accueil ».' },
    ar: { title: 'ثبّت تطبيق EcoClean', cta: 'تثبيت', no: 'لاحقًا',
          ios: 'للتثبيت: اضغط مشاركة ⬆ ثم «إضافة إلى الشاشة الرئيسية».' },
  };
  const lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');
  const t = () => STR[lang()] || STR.en;

  let deferredPrompt = null;   // the captured BeforeInstallPromptEvent
  let banner = null;

  function injectStyles() {
    if (document.getElementById('eco-install-style')) return;
    const st = document.createElement('style');
    st.id = 'eco-install-style';
    st.textContent = `
      .eco-install-banner{position:fixed;left:50%;bottom:96px;transform:translateX(-50%) translateY(20px);
        z-index:1050;display:flex;align-items:center;gap:12px;max-width:92vw;
        background:#fff;color:#1f2d27;border-radius:16px;padding:12px 14px;
        box-shadow:0 8px 24px rgba(0,0,0,.22);opacity:0;transition:opacity .25s ease,transform .25s ease;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}
      .eco-install-banner.show{opacity:1;transform:translateX(-50%) translateY(0);}
      .eco-install-ico{font-size:1.5rem;line-height:1;}
      .eco-install-txt{font-size:.9rem;font-weight:600;white-space:nowrap;}
      .eco-install-ios{font-size:.82rem;font-weight:500;max-width:60vw;line-height:1.35;}
      .eco-install-cta{background:#198754;color:#fff;border:none;border-radius:10px;
        padding:9px 16px;font-size:.85rem;font-weight:700;cursor:pointer;white-space:nowrap;}
      .eco-install-cta:active{background:#0f5132;}
      .eco-install-no{background:none;border:none;color:#6b7c74;font-size:.8rem;cursor:pointer;white-space:nowrap;}
    `;
    document.head.appendChild(st);
  }

  function showBanner() {
    if (isStandalone() || store.get(DISMISS_KEY, false) || banner) return;
    injectStyles();
    banner = document.createElement('div');
    banner.className = 'eco-install-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', t().title);
    const s = t();

    if (deferredPrompt) {
      // Chromium / Edge / desktop: a real install dialog is available.
      banner.innerHTML =
        '<span class="eco-install-ico">🌱</span>' +
        '<span class="eco-install-txt"></span>' +
        '<button class="eco-install-cta"></button>' +
        '<button class="eco-install-no"></button>';
      banner.querySelector('.eco-install-txt').textContent = s.title;
      const cta = banner.querySelector('.eco-install-cta');
      cta.textContent = s.cta;
      cta.addEventListener('click', promptInstall);
      const no = banner.querySelector('.eco-install-no');
      no.textContent = s.no;
      no.addEventListener('click', dismiss);
    } else {
      // iOS: no programmatic install -> describe the manual steps.
      banner.innerHTML =
        '<span class="eco-install-ico">📲</span>' +
        '<span class="eco-install-ios"></span>' +
        '<button class="eco-install-no"></button>';
      banner.querySelector('.eco-install-ios').textContent = s.ios;
      const no = banner.querySelector('.eco-install-no');
      no.textContent = s.no;
      no.addEventListener('click', dismiss);
    }
    document.body.appendChild(banner);
    // double rAF so the transition from .show actually animates
    requestAnimationFrame(() => requestAnimationFrame(() => banner && banner.classList.add('show')));
  }

  function hideBanner() {
    if (!banner) return;
    const b = banner; banner = null;
    b.classList.remove('show');
    setTimeout(() => b.remove(), 300);
  }

  function dismiss() { store.set(DISMISS_KEY, true); hideBanner(); }

  /* Open the native install dialog and wait for the user's decision. The event
   * is one-shot: after userChoice resolves the browser won't refire until the
   * user is eligible again, so we null it out and hide the pill. */
  async function promptInstall() {
    if (!deferredPrompt) return 'unavailable';
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;   // { outcome: 'accepted' | 'dismissed' }
    deferredPrompt = null;
    hideBanner();
    return choice.outcome;
  }

  // Capture the event; preventDefault suppresses the default mini-infobar.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showBanner();
  });

  // Fires once the app is actually installed (via our button or the browser menu).
  window.addEventListener('appinstalled', () => { deferredPrompt = null; hideBanner(); });

  // iOS never fires beforeinstallprompt -> offer the manual hint after a short delay.
  window.addEventListener('load', () => {
    if (isIOS() && !isStandalone() && !store.get(DISMISS_KEY, false)) {
      setTimeout(showBanner, 4000);
    }
  });

  // Expose for manual triggering / tests (e.g. EcoInstall.show() from the console).
  window.EcoInstall = { promptInstall, isStandalone, isIOS, show: showBanner };
})();
