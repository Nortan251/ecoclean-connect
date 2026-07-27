/* compression-info.js — show the report photo's compression win, live (ADDITIVE).
 * The app already downscales + re-encodes uploads in app.js (long edge 1280,
 * JPEG q0.78) to keep submissions light on Moroccan mobile data. That work was
 * invisible, so the user never saw the payoff. This module adds a tiny, honest
 * estimate under the photo field — "5.7 MB → ~210 KB after compression" — using
 * the SAME geometry math as the encoder (so the figure tracks reality) and a
 * conservative bytes-per-pixel model for q0.78. It is purely informational: it
 * never touches the File, the form, or the upload path, so it can't affect
 * submission. Trilingual; updates on every photo selection. */
(function () {
  'use strict';
  var MAX_DIM = 1280, BPP = 0.16; // bytes/pixel approx for JPEG q0.78 (photos)
  var L = {
    en: '📷 {orig} → about {comp} after compression (lighter & faster to upload)',
    fr: '📷 {orig} → environ {comp} après compression (plus léger et rapide à envoyer)',
    ar: '📷 {orig} ← نحو {comp} بعد الضغط (أخف وأسرع في الرفع)',
  };
  var lang = function () { return (typeof window.getLang === 'function' ? getLang() : 'en'); };
  function fmt(bytes) { return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB'; }
  function estComp(origBytes, w, h) {
    var max = Math.max(w, h), dim = max > MAX_DIM ? MAX_DIM : max;
    var scale = max > MAX_DIM ? (MAX_DIM / max) : 1;
    var nw = Math.round(w * scale), nh = Math.round(h * scale);
    var comp = nw * nh * BPP;
    return Math.min(origBytes * 0.92, comp); // never claim bigger than ~original
  }
  var el = null;
  function ensure() {
    if (el) return el;
    var input = document.querySelector('#reportForm input[name="photo"]'); if (!input) return null;
    el = document.createElement('p'); el.className = 'form-msg eco-comp'; el.id = 'compInfo';
    el.style.cssText = 'color:var(--muted,#5d7268);font-size:.74rem;margin:4px 0 0;';
    input.closest('.field').insertAdjacentElement('afterend', el);
    return el;
  }
  document.addEventListener('change', function (e) {
    var input = e.target;
    if (!input || !input.form || input.form.id !== 'reportForm' || input.name !== 'photo') return;
    var f = input.files && input.files[0]; var node = ensure(); if (!node) return;
    if (!f) { node.textContent = ''; return; }
    var orig = f.size;
    var img = new Image(); var url = URL.createObjectURL(f);
    img.onload = function () {
      var c = estComp(orig, img.naturalWidth || 1, img.naturalHeight || 1);
      var tmpl = L[lang()] || L.en;
      node.textContent = tmpl.replace('{orig}', fmt(orig)).replace('{comp}', fmt(c));
      URL.revokeObjectURL(url);
    };
    img.onerror = function () { node.textContent = tmpl0(orig); URL.revokeObjectURL(url); };
    function tmpl0(o) { return (L[lang()] || L.en).replace('{orig}', fmt(o)).replace('{comp}', '—'); }
    img.src = url;
  }, true);
})();
