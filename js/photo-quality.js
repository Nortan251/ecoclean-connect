/* ============================================================================
 * photo-quality.js — blur / out-of-focus detection (ADDITIVE, no app.js edits)
 * ----------------------------------------------------------------------------
 * A blurry photo is the #1 reason a reviewer can't verify a clean-up: you can't
 * see the before/after difference. Instead of letting it fail silently at review
 * time, we warn the citizen ON SITE — "your photo looks out of focus, retake?" —
 * when the picture is still in their hand. This is a NON-BLOCKING advisory, like
 * dup-detect.js: a dim or artsy-but-valid photo must never be rejected outright.
 *
 * THE ALGORITHM — Variance of the Laplacian (focus measure)
 * ---------------------------------------------------------
 * Sharpness == high-frequency content. An in-focus edge produces large second
 * derivatives; a blurred image is smooth, so its second derivatives are tiny.
 * The classic, dependency-free focus metric is the VARIANCE of the Laplacian:
 *
 *     L(x,y) = I(x+1,y) + I(x-1,y) + I(x,y+1) + I(x,y-1) - 4*I(x,y)
 *     focus  = Var(L) = E[L^2] - (E[L])^2
 *
 * Big variance => crisp; small variance => blurry. We downsample the photo to a
 * small greyscale grid (BLUR_W px wide) FIRST — that makes it O(1) cheap and, as
 * a bonus, the downsample suppresses sensor noise that would otherwise inflate
 * the metric on a genuinely soft image. Greyscale via the standard luminance
 * weights 0.299R + 0.587G + 0.114B (rec.601). The threshold BLUR_THRESHOLD is a
 * heuristic tuned for "phone photo of a street scene"; it errs on the side of
 * NOT warning (false negatives are fine, false positives annoy users).
 *
 * We read pixels from an <canvas> via getImageData — no library, no network.
 * Runs on the `change` event AFTER validation.js has resolved EXIF, and writes
 * to its own dedicated #qualityMsg node (decoupled from app.js / validation).
 * ==========================================================================*/
(function () {
  'use strict';

  var BLUR_W = 128;          // downsample width for the focus measurement
  var BLUR_THRESHOLD = 90;   // Var(Laplacian) below this => "looks blurry"

  var STR = {
    en: { blur: 'This photo looks out of focus — a sharper shot verifies faster. Retake if you can.', ok: '' },
    fr: { blur: 'Cette photo paraît floue — une image nette se vérifie plus vite. Recommencez si possible.', ok: '' },
    ar: { blur: 'تبدو هذه الصورة غير واضحة — صورة أكثر حدة تتحقق أسرع. أعد الالتقاط إن أمكن.', ok: '' },
  };
  var lang = function () { return (typeof window.getLang === 'function' ? getLang() : 'en'); };
  var tset = function () { return STR[lang()] || STR.en; };

  /* Variance of the discrete Laplacian over a greyscale ImageData-like buffer
   * laid out as row-major bytes (one value per pixel). Pure arithmetic, no DOM. */
  function laplacianVariance(grey, w, h) {
    var sum = 0, sumSq = 0, n = 0;
    for (var y = 1; y < h - 1; y++) {
      var row = y * w;
      for (var x = 1; x < w - 1; x++) {
        var i = row + x;
        var L = grey[i - 1] + grey[i + 1] + grey[i - w] + grey[i + w] - 4 * grey[i];
        sum += L; sumSq += L * L; n++;
      }
    }
    if (n === 0) return 0;
    var mean = sum / n;
    return sumSq / n - mean * mean;
  }

  /* Load the File into a small greyscale canvas, return {focus, w, h} or null. */
  function measure(file) {
    return new Promise(function (resolve) {
      if (!file || !/^image\//.test(file.type || '')) return resolve(null);
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var w = BLUR_W, h = Math.max(2, Math.round(img.height * (BLUR_W / img.width)));
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          var ctx = c.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, w, h);
          var data = ctx.getImageData(0, 0, w, h).data;
          var grey = new Float32Array(w * h);
          for (var i = 0, p = 0; i < data.length; i += 4, p++) {
            grey[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          }
          resolve({ focus: laplacianVariance(grey, w, h), w: w, h: h });
        } catch (e) { resolve(null); } finally { URL.revokeObjectURL(url); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  var msgEl = null;
  function ensureMsgEl() {
    if (msgEl) return msgEl;
    var photoInput = document.querySelector('#reportForm input[name="photo"]');
    if (!photoInput) return null;
    msgEl = document.createElement('p');
    msgEl.className = 'form-msg';
    msgEl.id = 'qualityMsg';
    msgEl.style.color = '#b06b00';
    // Place right after the validation message if present, else after the field.
    var anchor = document.getElementById('validationMsg') || photoInput.closest('.field');
    anchor.insertAdjacentElement('afterend', msgEl);
    return msgEl;
  }
  function show(text) { var el = ensureMsgEl(); if (el) { el.textContent = text; el.hidden = !text; } }

  /* Run after validation.js's change handler resolves EXIF. capture=false so we
   * sit at the END of the change chain and never interfere with the gate. */
  document.addEventListener('change', function (e) {
    var input = e.target;
    if (!input || !input.form || input.form.id !== 'reportForm' || input.name !== 'photo') return;
    var file = input.files && input.files[0];
    if (!file) { show(''); return; }
    show(''); // clear while measuring
    measure(file).then(function (m) {
      if (!m) return;
      // Expose the metric for the trust panel / future analytics / essays.
      window.EcoQuality = window.EcoQuality || {};
      window.EcoQuality.lastFocus = Math.round(m.focus);
      window.EcoQuality.threshold = BLUR_THRESHOLD;
      show(m.focus < BLUR_THRESHOLD ? '⚠️ ' + tset().blur : '');
    });
  }, false);

  document.addEventListener('ecoclean:reported', function () { show(''); });
  window.EcoQuality = window.EcoQuality || {};
  window.EcoQuality.measure = measure;
  window.EcoQuality.BLUR_THRESHOLD = BLUR_THRESHOLD;
})();
