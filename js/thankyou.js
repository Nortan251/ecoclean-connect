/* ============================================================================
 * thankyou.js — A warm, accessible "thank you" moment after every report (ADDITIVE)
 * ----------------------------------------------------------------------------
 * app.js emits a single 'ecoclean:reported' event on a successful submit (with
 * the category / name / coords, captured before the form resets). We listen for
 * it and show a celebratory, accessible dialog: an animated checkmark, a short
 * burst of confetti, a category-specific impact line, a live community stat, and
 * two actions — jump to the new pin on the map, or report another. It is fully
 * self-contained (injects its own styles + markup), trilingual (EN/FR/AR), and
 * keyboard/screen-reader friendly (role=dialog, focus management, Esc to close).
 * It also detects the offline case and reassures the user their report is queued.
 * ==========================================================================*/
(function () {
  'use strict';

  const STR = {
    en: {
      thanksName: 'Thank you, {name}!', thanks: 'Thank you, Guardian!',
      sub: 'Your report is now live on the map.',
      offline: 'You’re offline — we saved it and will publish it the moment you reconnect.',
      verifiedLine: '{n} site(s) already cleaned thanks to people like you. 🌍',
      view: 'See it on the map', another: 'Report another', close: 'Close',
    },
    fr: {
      thanksName: 'Merci, {name} !', thanks: 'Merci, Gardien(ne) !',
      sub: 'Votre signalement est maintenant visible sur la carte.',
      offline: 'Vous êtes hors ligne — nous l’avons enregistré et le publierons dès la reconnexion.',
      verifiedLine: '{n} site(s) déjà nettoyé(s) grâce à des gens comme vous. 🌍',
      view: 'Voir sur la carte', another: 'Signaler autre chose', close: 'Fermer',
    },
    ar: {
      thanksName: 'شكرًا لك يا {name}!', thanks: 'شكرًا لك أيها الحارس!',
      sub: 'بلاغك ظاهر الآن على الخريطة.',
      offline: 'أنت غير متصل — حفظناه وسننشره فور عودتك للإنترنت.',
      verifiedLine: 'تم تنظيف {n} موقع بفضل أشخاص مثلك. 🌍',
      view: 'عرضه على الخريطة', another: 'بلاغ آخر', close: 'إغلاق',
    },
  };
  const IMPACT = {
    en: {
      illegal_dumping: 'You flagged an illegal dump — cleanup crews can now be routed to clear it.',
      water: 'You raised the alarm on water pollution. Cleaner water starts with reports like this.',
      air_smoke: 'You reported air / smoke pollution. That data helps hold polluters accountable.',
      plastic_marine: 'You spotted plastic / marine litter. The coastline thanks you.',
      other: 'You reported a pollution site. Every pin moves your neighborhood forward.',
    },
    fr: {
      illegal_dumping: 'Vous avez signalé un dépôt sauvage — les équipes peuvent maintenant intervenir.',
      water: 'Vous avez alerté sur la pollution de l’eau. Une eau plus propre commence par des signalements comme le vôtre.',
      air_smoke: 'Vous avez signalé une pollution de l’air / fumée. Ces données aident à responsabiliser les pollueurs.',
      plastic_marine: 'Vous avez repéré des déchets plastiques / marins. Le littoral vous remercie.',
      other: 'Vous avez signalé un site pollué. Chaque point fait avancer votre quartier.',
    },
    ar: {
      illegal_dumping: 'أبلغت عن مكب عشوائي — يمكن لفرق التنظيف الآن التوجه لإزالته.',
      water: 'نبهت إلى تلوث المياه. المياه الأنظف تبدأ ببلاغات مثل بلاغك.',
      air_smoke: 'أبلغت عن تلوث هواء/دخان. هذه البيانات تساعد في محاسبة الملوثين.',
      plastic_marine: 'رصدت نفايات بلاستيكية/بحرية. الساحل يشكرك.',
      other: 'أبلغت عن موقع ملوث. كل علامة تحرّك حيّك إلى الأمام.',
    },
  };
  const CONFETTI_COLORS = ['#198754', '#ffc107', '#dc3545', '#0f5132', '#20c997', '#ffffff'];

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => (k in o ? esc(o[k]) : ''));
  const lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');

  function confetti() {
    let html = '';
    for (let i = 0; i < 18; i++) {
      const left = Math.round(Math.random() * 100);
      const delay = (Math.random() * 0.3).toFixed(2);
      const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      html += '<span style="left:' + left + '%;background:' + color + ';animation-delay:' + delay + 's"></span>';
    }
    return html;
  }

  let overlay = null, escHandler = null, prevOverflow = '';

  function close() {
    if (overlay) { overlay.remove(); overlay = null; }
    if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
    document.body.style.overflow = prevOverflow;
  }

  function openMapAt(d) {
    if (typeof showMap === 'function') showMap();           // global from app.js
    if (typeof map !== 'undefined' && map && d && d.lat != null && d.lng != null) {
      setTimeout(() => { try { map.setView([parseFloat(d.lat), parseFloat(d.lng)], 16); } catch (e) {} }, 300);
    }
  }

  function show(detail) {
    close();
    detail = detail || {};
    const s = STR[lang()] || STR.en;
    const imp = ((IMPACT[lang()] || IMPACT.en)[detail.category]) || (IMPACT[lang()] || IMPACT.en).other;
    const name = (detail.reporterName || '').trim();
    const verified = (window.EcoClean && EcoClean.reports || []).filter((r) => r.status === 'verified').length;
    const offline = !navigator.onLine;

    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    overlay = document.createElement('div');
    overlay.className = 'eco-ty';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', name ? fill(s.thanksName, { name: name }) : s.thanks);
    overlay.innerHTML =
      '<div class="eco-ty-back" data-close></div>' +
      '<div class="eco-ty-confetti" aria-hidden="true">' + confetti() + '</div>' +
      '<div class="eco-ty-card">' +
        '<button class="eco-ty-x" data-close aria-label="' + esc(s.close) + '">&times;</button>' +
        '<svg class="eco-ty-svg" viewBox="0 0 52 52" aria-hidden="true"><circle class="eco-ty-circle" cx="26" cy="26" r="24"/><path class="eco-ty-tick" d="M14 27 l8 8 l16 -18"/></svg>' +
        '<h2>' + (name ? fill(s.thanksName, { name: name }) : esc(s.thanks)) + '</h2>' +
        '<p class="eco-ty-impact">' + esc(imp) + '</p>' +
        '<p class="eco-ty-sub">' + esc(offline ? s.offline : s.sub) +
          (verified > 0 ? ' ' + fill(s.verifiedLine, { n: verified }) : '') + '</p>' +
        '<div class="eco-ty-actions">' +
          '<button class="primary-btn" data-act="view">' + esc(s.view) + '</button>' +
          '<button class="ghost-btn" data-act="another">' + esc(s.another) + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    const viewBtn = overlay.querySelector('[data-act="view"]');
    if (viewBtn) viewBtn.focus();
    overlay.querySelectorAll('[data-close]').forEach((n) => n.addEventListener('click', close));
    overlay.querySelector('[data-act="view"]').addEventListener('click', () => { close(); openMapAt(detail); });
    overlay.querySelector('[data-act="another"]').addEventListener('click', () => {
      close();
      if (typeof openModal === 'function') openModal();      // global from app.js
    });
    escHandler = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', escHandler);

    requestAnimationFrame(() => overlay && overlay.classList.add('show'));
    setTimeout(() => { const c = overlay && overlay.querySelector('.eco-ty-confetti'); if (c) c.remove(); }, 1500);
  }

  function injectStyles() {
    if (document.getElementById('eco-ty-style')) return;
    const st = document.createElement('style');
    st.id = 'eco-ty-style';
    st.textContent =
      '.eco-ty{position:fixed;inset:0;z-index:1400;display:flex;align-items:center;justify-content:center;padding:16px;}' +
      '.eco-ty-back{position:absolute;inset:0;background:rgba(15,81,50,.55);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);opacity:0;transition:opacity .25s;}' +
      '.eco-ty.show .eco-ty-back{opacity:1;}' +
      '.eco-ty-card{position:relative;background:#fff;border-radius:20px;max-width:420px;width:100%;padding:26px 22px 20px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.3);transform:scale(.85);opacity:0;transition:transform .3s cubic-bezier(.2,1.3,.4,1),opacity .3s;}' +
      '.eco-ty.show .eco-ty-card{transform:scale(1);opacity:1;}' +
      '.eco-ty-x{position:absolute;top:8px;right:12px;background:none;border:none;font-size:1.5rem;color:#6b7c74;cursor:pointer;line-height:1;}' +
      '.eco-ty h2{margin:6px 0 8px;font-size:1.25rem;color:#0f5132;}' +
      '.eco-ty-impact{margin:0 0 6px;font-size:.95rem;color:#1f2d27;line-height:1.45;}' +
      '.eco-ty-sub{margin:0 0 16px;font-size:.82rem;color:#6b7c74;line-height:1.4;}' +
      '.eco-ty-actions{display:flex;gap:10px;}' +
      '.eco-ty-actions .primary-btn,.eco-ty-actions .ghost-btn{flex:1;width:auto;margin-top:0;}' +
      '.eco-ty-svg{width:64px;height:64px;margin:0 auto;display:block;}' +
      '.eco-ty-circle{fill:none;stroke:#198754;stroke-width:3;stroke-dasharray:151;stroke-dashoffset:151;animation:eco-ty-draw .5s ease forwards;}' +
      '.eco-ty-tick{fill:none;stroke:#198754;stroke-width:4;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:40;stroke-dashoffset:40;animation:eco-ty-draw .35s .4s ease forwards;}' +
      '@keyframes eco-ty-draw{to{stroke-dashoffset:0;}}' +
      '.eco-ty-confetti{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:1401;}' +
      '.eco-ty-confetti span{position:absolute;top:-14px;width:9px;height:14px;border-radius:2px;opacity:.95;animation:eco-ty-fall 1.3s ease-in forwards;}' +
      '@keyframes eco-ty-fall{0%{transform:translateY(0) rotate(0);opacity:1;}100%{transform:translateY(105vh) rotate(540deg);opacity:0;}}';
    document.head.appendChild(st);
  }

  injectStyles();
  window.addEventListener('ecoclean:reported', (e) => show(e && e.detail));
  window.EcoThankYou = { show: show, close: close };
})();
