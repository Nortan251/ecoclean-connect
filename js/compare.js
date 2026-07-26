/* compare.js — before/after comparison slider in verified-report popups (ADDITIVE).
 * Swaps the side-by-side before/after thumbnails for a draggable slider so the
 * clean-up "transformation" reads instantly. Only verified reports WITH an
 * after-photo. Pure DOM swap on popupopen; never touches app.js. */
(function () {
  'use strict';
  var L10N = { en: { b: 'Before', a: 'After' }, fr: { b: 'Avant', a: 'Après' }, ar: { b: 'قبل', a: 'بعد' } };
  var lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');
  var t = (k) => { var d = L10N[lang()] || L10N.en; return d[k]; };
  var esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function slider(before, after) {
    return '<div class="ba-slider">' +
      '<img class="ba-after" src="' + esc(after) + '" alt="' + t('a') + '">' +
      '<div class="ba-before-wrap"><img class="ba-before" src="' + esc(before) + '" alt="' + t('b') + '"></div>' +
      '<div class="ba-handle"></div>' +
      '<span class="ba-lab b">' + t('b') + '</span><span class="ba-lab a">' + t('a') + '</span>' +
      '<input type="range" min="0" max="100" value="50" class="ba-range" aria-label="compare">' +
      '</div>';
  }
  function wire(box) {
    var range = box.querySelector('.ba-range'), wrap = box.querySelector('.ba-before-wrap'), handle = box.querySelector('.ba-handle');
    var apply = (v) => { wrap.style.width = v + '%'; handle.style.left = v + '%'; };
    range.addEventListener('input', () => apply(range.value));
    apply(50);
  }

  window.addEventListener('ecoclean:mapready', (ev) => {
    var map = ev.detail; if (!map) return;
    map.on('popupopen', (e) => {
      var marker = e.popup._source; var id = marker && marker._reportId; if (!id) return;
      var rep = (window.EcoClean.reports || []).filter((r) => r.id === id)[0];
      if (!rep || rep.status !== 'verified' || !rep.afterPhoto) return;
      var el = e.popup.getElement(); var box = el && el.querySelector('.pop-imgs'); if (!box) return;
      var imgs = box.querySelectorAll('.pop-img'); if (imgs.length < 2) return;
      box.innerHTML = slider(imgs[0].getAttribute('src'), imgs[1].getAttribute('src'));
      wire(box);
    });
  });

  if (!document.getElementById('eco-compare-style')) {
    var st = document.createElement('style'); st.id = 'eco-compare-style';
    st.textContent =
      '.ba-slider{position:relative;width:200px;height:130px;overflow:hidden;border-radius:8px;margin:6px auto;user-select:none;-webkit-user-select:none;}' +
      '.ba-slider img{position:absolute;top:0;left:0;height:100%;object-fit:cover;}' +
      '.ba-after{width:100%;}' +
      '.ba-before-wrap{position:absolute;top:0;left:0;bottom:0;width:50%;overflow:hidden;}' +
      '.ba-before-wrap img{width:200px;max-width:none;}' +
      '.ba-handle{position:absolute;top:0;bottom:0;left:50%;width:3px;margin-left:-1.5px;background:#fff;box-shadow:0 0 4px rgba(0,0,0,.45);pointer-events:none;}' +
      '.ba-handle::after{content:"\\21C4";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;color:#0a5c3f;border-radius:50%;width:22px;height:22px;display:grid;place-items:center;font-size:12px;box-shadow:0 1px 4px rgba(0,0,0,.3);}' +
      '.ba-range{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:ew-resize;}' +
      '.ba-lab{position:absolute;bottom:4px;font-size:9px;font-weight:700;color:#fff;background:rgba(0,0,0,.5);padding:1px 6px;border-radius:99px;pointer-events:none;}' +
      '.ba-lab.b{left:4px;}.ba-lab.a{right:4px;}';
    document.head.appendChild(st);
  }
})();
