/* ============================================================================
 * share.js — civic sharing: Web Share API with a clipboard fallback (ADDITIVE)
 * ----------------------------------------------------------------------------
 * Two jobs:
 *   (1) Expose window.EcoShare.share({title,text,url}) so any module (the
 *       thank-you dialog) can offer a "share this" action. Uses the native
 *       Web Share sheet on mobile/desktop where available, and falls back to
 *       copying a link to the clipboard (with a toast) elsewhere.
 *   (2) Inject a "Share this cleanup" button into the pop-up of every VERIFIED
 *       (cleaned) pin, so a confirmed clean-up becomes something the community
 *       can broadcast — turning civic action into social proof / growth.
 * Both are additive: sharing hooks the existing pop-up via 'popupopen', the same
 * non-destructive pattern the voting module uses.
 * ==========================================================================*/
(function () {
  'use strict';

  function toast(msg) {
    const t = document.querySelector('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 2500);
  }

  async function share(opts) {
    opts = opts || {};
    const data = { title: opts.title || 'EcoClean Connect', text: opts.text || '', url: opts.url || location.href };
    try {
      if (navigator.share) { await navigator.share(data); return true; }   // native share sheet
    } catch (e) { /* cancelled or unsupported -> fall through to clipboard */ }
    const payload = (data.text ? data.text + ' ' : '') + data.url;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(payload);
        toast('Link copied — share it with your neighborhood!');
      } else {
        window.prompt('Copy this link to share:', data.url);
      }
    } catch (e) {
      window.prompt('Copy this link to share:', data.url);
    }
    return false;
  }
  window.EcoShare = { share: share };

  // Inject a Share button into the pop-up of verified (cleaned) reports.
  window.addEventListener('ecoclean:mapready', (ev) => {
    const map = ev.detail;
    if (!map) return;
    map.on('popupopen', (e) => {
      const marker = e.popup && e.popup._source;
      const id = marker && marker._reportId;
      if (!id) return;
      const rep = (window.EcoClean.reports || []).find((r) => r.id === id);
      if (!rep || rep.status !== 'verified') return;            // only share resolved clean-ups
      const el = e.popup.getElement();
      if (!el || el.querySelector('.eco-share-row')) return;
      const row = document.createElement('div');
      row.className = 'eco-share-row';
      row.innerHTML = '<button type="button" class="eco-share-btn">🌱 Share this cleanup</button>';
      el.appendChild(row);
      row.querySelector('.eco-share-btn').addEventListener('click', () => {
        const cat = typeof window.catLabel === 'function' ? catLabel(rep.category) : rep.category;
        share({
          title: 'A cleanup happened on EcoClean Connect',
          text: 'A ' + cat + ' site was just cleaned in my neighborhood. Report pollution and track clean-ups:',
          url: location.href,
        });
      });
    });
  });

  const st = document.createElement('style');
  st.id = 'eco-share-style';
  st.textContent =
    '.eco-share-row{margin-top:8px;}' +
    '.eco-share-btn{width:100%;background:#e8f3ec;color:#0f5132;border:1px solid #bfe0cd;border-radius:8px;padding:7px;font-size:.8rem;font-weight:600;cursor:pointer;}';
  document.head.appendChild(st);
})();
