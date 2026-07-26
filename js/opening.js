/* opening.js — app opening experience (index only), trilingual: a branded splash
 * (self-hiding via CSS fallback so it never traps users) + a one-time onboarding
 * overlay (report -> verify -> earn). The splash tagline is localized immediately. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var L10N = {
    en: { splash_tag: 'Report pollution. Mobilize your community.', skip: 'Skip', next: 'Next', done: 'Get started',
      steps: [ { emoji: '📍', t: 'Report in seconds', d: 'Open the map and tap where you see pollution — or use your location. Add a photo and a category.' }, { emoji: '✅', t: 'Clean-ups get verified', d: 'Community leaders confirm the fix with an after-photo. Watch the pins turn green in real time.' }, { emoji: '🎁', t: 'Earn civic rewards', d: 'Verified clean-ups earn points you can redeem for local reward vouchers. Every report counts.' } ] },
    fr: { splash_tag: 'Signalez la pollution. Mobilisez votre communauté.', skip: 'Passer', next: 'Suivant', done: 'Commencer',
      steps: [ { emoji: '📍', t: 'Signalez en quelques secondes', d: 'Ouvrez la carte et touchez l’endroit pollué — ou utilisez votre position. Ajoutez une photo et une catégorie.' }, { emoji: '✅', t: 'Les nettoyages sont vérifiés', d: 'Des responsables confirment la correction avec une photo après. Regardez les repères devenir verts en direct.' }, { emoji: '🎁', t: 'Gagnez des récompenses', d: 'Les nettoyages vérifiés rapportent des points échangeables contre des bons locaux. Chaque signalement compte.' } ] },
    ar: { splash_tag: 'بلّغ عن التلوث. حرّك مجتمعك.', skip: 'تخطٍّ', next: 'التالي', done: 'ابدأ',
      steps: [ { emoji: '📍', t: 'بلّغ في ثوانٍ', d: 'افتح الخريطة والمس مكان التلوث — أو استخدم موقعك. أضف صورة وفئة.' }, { emoji: '✅', t: 'التحقق من التنظيف', d: 'يؤكد القادة الإصلاح بصورة بعد التنظيف. راقب العلامات تتحول إلى الأخضر مباشرة.' }, { emoji: '🎁', t: 'اكسب مكافآت', d: 'عمليات التنظيف المتحققة تكسبك نقاطًا تستبدلها بقسائم محلية. كل بلاغ يُحدث فرقًا.' } ] },
  };
  var lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');
  var S = () => L10N[lang()] || L10N.en;

  var stag = document.querySelector('#eco-splash .es-tag'); if (stag) stag.textContent = S().splash_tag;

  if (!document.getElementById('eco-onb-style')) {
    var st = document.createElement('style'); st.id = 'eco-onb-style';
    st.textContent =
      '.eco-onb{position:fixed;inset:0;z-index:2500;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(8,28,20,.55);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);opacity:0;transition:opacity .3s;}' +
      '.eco-onb-show{opacity:1;}.eco-onb-hide{opacity:0;}' +
      '.eco-onb-card{background:#fff;border-radius:22px;max-width:380px;width:100%;padding:26px 22px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.3);transform:translateY(10px) scale(.96);transition:transform .3s cubic-bezier(.2,1.2,.4,1);}' +
      '.eco-onb-show .eco-onb-card{transform:none;}' +
      '.eco-onb-emoji{font-size:2.6rem;line-height:1;margin-bottom:8px;}' +
      '.eco-onb-card h2{margin:0 0 8px;font-size:1.25rem;font-weight:800;color:#0f5132;}' +
      '.eco-onb-card p{margin:0 0 16px;color:#5d7268;font-size:.92rem;line-height:1.5;}' +
      '.eco-onb-dots{display:flex;gap:6px;justify-content:center;margin-bottom:18px;}' +
      '.eco-onb-dots span{width:8px;height:8px;border-radius:50%;background:#d6e3dc;transition:background .2s,width .2s;}' +
      '.eco-onb-dots span.on{background:linear-gradient(135deg,#198754,#0d9488);width:18px;border-radius:99px;}' +
      '.eco-onb-actions{display:flex;gap:10px;align-items:center;}' +
      '.eco-onb-skip{background:none;border:none;color:#9aa89f;font-weight:600;cursor:pointer;padding:10px;font-size:.85rem;}' +
      '.eco-onb-actions .primary-btn{flex:1;margin-top:0;}';
    document.head.appendChild(st);
  }

  function hideSplash() {
    var el = document.getElementById('eco-splash'); if (!el || el.dataset.hiding) return; el.dataset.hiding = '1';
    el.style.animation = 'none';
    if (reduce) { if (el.parentNode) el.parentNode.removeChild(el); return; }
    el.style.transition = 'opacity .45s ease, visibility .45s ease';
    requestAnimationFrame(function () { el.style.opacity = '0'; el.style.visibility = 'hidden'; });
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 520);
  }
  var minShow = 900, t0 = Date.now();
  function readyHide() { setTimeout(hideSplash, Math.max(0, minShow - (Date.now() - t0))); }
  if (document.readyState === 'complete') readyHide(); else window.addEventListener('load', readyHide);
  setTimeout(hideSplash, 4000);

  function onboard() {
    try { if (localStorage.getItem('eco_onboarded')) return; } catch (e) { return; }
    var steps = S().steps; var i = 0;
    var ov = document.createElement('div'); ov.className = 'eco-onb';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'EcoClean Connect');
    function draw() {
      var s = steps[i]; var tx = S();
      ov.innerHTML = '<div class="eco-onb-card">' +
        '<div class="eco-onb-emoji" aria-hidden="true">' + s.emoji + '</div>' +
        '<h2>' + s.t + '</h2><p>' + s.d + '</p>' +
        '<div class="eco-onb-dots" aria-hidden="true">' + steps.map(function (_, k) { return '<span class="' + (k === i ? 'on' : '') + '"></span>'; }).join('') + '</div>' +
        '<div class="eco-onb-actions"><button class="eco-onb-skip" type="button">' + tx.skip + '</button>' +
        '<button class="eco-onb-next primary-btn" type="button">' + (i === steps.length - 1 ? tx.done : tx.next) + '</button></div>' +
      '</div>';
      ov.querySelector('.eco-onb-skip').addEventListener('click', done);
      ov.querySelector('.eco-onb-next').addEventListener('click', function () { if (i < steps.length - 1) { i++; draw(); } else done(); });
    }
    function done() { try { localStorage.setItem('eco_onboarded', '1'); } catch (e) {} ov.classList.add('eco-onb-hide'); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, reduce ? 0 : 300); }
    draw(); document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('eco-onb-show'); });
  }
  var ob = setInterval(function () { if (!document.getElementById('eco-splash')) { clearInterval(ob); onboard(); } }, 120);
  setTimeout(function () { clearInterval(ob); onboard(); }, 4200);
})();
