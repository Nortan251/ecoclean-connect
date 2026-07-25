/* ============================================================================
 * offline-banner.js — a clear, persistent "you're offline" status bar (ADDITIVE)
 * ----------------------------------------------------------------------------
 * A PWA can keep working offline (thanks to the service worker), but the user
 * must be TOLD that, or stale data looks like a bug. This module listens to the
 * browser's online/offline events and slides up a slim amber bar that explains
 * exactly what's happening: cached data is shown, and new reports will sync on
 * reconnect (which offline-submit.js guarantees). Trilingual, injected at the
 * bottom so it never fights the sticky header or the map. Purely additive.
 * ==========================================================================*/
(function () {
  'use strict';

  const STR = {
    en: 'You’re offline — showing cached data. New reports will sync when you reconnect.',
    fr: 'Vous êtes hors ligne — données en cache affichées. Les nouveaux signalements se synchroniseront à la reconnexion.',
    ar: 'أنت غير متصل — تظهر البيانات المخزنة. ستُزامن البلاغات الجديدة عند عودتك للإنترنت.',
  };
  const txt = () => STR[(typeof window.getLang === 'function' ? getLang() : 'en')] || STR.en;

  let bar = null;
  function build() {
    bar = document.createElement('div');
    bar.className = 'eco-offline';
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<span class="eco-offline-dot" aria-hidden="true"></span><span class="eco-offline-txt"></span>';
    document.body.appendChild(bar);
  }
  function show() {
    if (bar) return;
    build();
    bar.querySelector('.eco-offline-txt').textContent = txt();
    requestAnimationFrame(() => bar.classList.add('show'));
  }
  function hide() {
    if (!bar) return;
    const b = bar; bar = null;
    b.classList.remove('show');
    setTimeout(() => b.remove(), 300);
  }
  function sync() { if (!navigator.onLine) show(); else hide(); }

  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
  // Keep the wording in sync if the language is switched while the bar is up.
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'langSelect' && bar) bar.querySelector('.eco-offline-txt').textContent = txt();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  else sync();

  const st = document.createElement('style');
  st.id = 'eco-offline-style';
  st.textContent =
    '.eco-offline{position:fixed;left:0;right:0;bottom:0;z-index:1050;display:flex;align-items:center;gap:8px;' +
    'background:#b45309;color:#fff;padding:10px 14px;padding-inline-end:92px;font-size:.82rem;font-weight:600;' +
    'box-shadow:0 -2px 10px rgba(0,0,0,.2);transform:translateY(100%);transition:transform .3s ease;}' +
    '.eco-offline.show{transform:translateY(0);}' +
    '.eco-offline-dot{width:9px;height:9px;border-radius:50%;background:#fff;flex:0 0 auto;animation:eco-offline-pulse 1.2s infinite;}' +
    '@keyframes eco-offline-pulse{0%,100%{opacity:1;}50%{opacity:.35;}}';
  document.head.appendChild(st);
})();
