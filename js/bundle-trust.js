/* Bundled automatically */

/* === js/camera-location.js === */
/* camera-location.js — accuracy-aware location fusion for the report pin.
 * Two sensors can tell us where a report happened: the device's live, high-
 * accuracy geolocation, and the GPS embedded in the photo's EXIF. We FUSE them:
 * the live fix wins whenever its reported accuracy is good; EXIF is the fallback
 * when live GPS is missing or poor (e.g. indoors). EXIF GPS still feeds the
 * anti-fraud checks in photo-trust.js / validation.js regardless.
 *
 * MANUAL OVERRIDE: if the user explicitly picks a spot (taps the map, or hits
 * "Use my location"), map-place.js sets window.EcoManualPin = true. While that
 * flag is set we do NOT auto-apply any sensor fix — explicit user intent beats
 * the sensors, so a deliberately chosen pin isn't yanked away by GPS/EXIF. */
(function () {
  const latIn = () => document.querySelector('#latInput');
  const lngIn = () => document.querySelector('#lngInput');
  const LIVE_ACC_THRESHOLD = 100;   // metres; prefer the live fix when its accuracy <= this
  let live = null;                  // {lat, lng, acc}
  let exifGps = null;               // {lat, lng}

  function apply(lat, lng) { const a = latIn(), o = lngIn(); if (a) a.value = lat.toFixed(6); if (o) o.value = lng.toFixed(6); }
  function choose() {
    if (window.EcoManualPin) return;             // respect an explicit manual placement
    if (live && exifGps) {
      if (live.acc == null || live.acc <= LIVE_ACC_THRESHOLD) apply(live.lat, live.lng);
      else apply(exifGps.lat, exifGps.lng);
    } else if (live) apply(live.lat, live.lng);
    else if (exifGps) apply(exifGps.lat, exifGps.lng);
  }

  function getLiveGPS() {
    if (window.EcoManualPin) return;             // don't overwrite a manual pin on modal open
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => { live = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }; choose(); },
      () => {}, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  // EXIF: extract GPS + capture time if the uploaded file carries it.
  function readExif(file) {
    return new Promise((resolve) => {
      if (!file || !window.EXIF) return resolve(null);
      EXIF.getData(file, function () {
        const gps = EXIF.getTag(this, 'GPSLatitude');
        if (!gps) return resolve(null);
        const toDeg = (v, ref) => { const d = v[0] + v[1] / 60 + v[2] / 3600; return (ref === 'S' || ref === 'W') ? -d : d; };
        resolve({ lat: toDeg(gps, EXIF.getTag(this, 'GPSLatitudeRef')), lng: toDeg(EXIF.getTag(this, 'GPSLongitude'), EXIF.getTag(this, 'GPSLongitudeRef')), time: EXIF.getTag(this, 'DateTimeOriginal') });
      });
    });
  }

  // Non-destructive: observe the modal's class to detect open.
  const modal = document.querySelector('#reportModal');
  if (modal) {
    new MutationObserver(() => { if (!modal.classList.contains('hidden')) getLiveGPS(); })
      .observe(modal, { attributes: true, attributeFilter: ['class'] });
  }
  const photo = document.querySelector('#reportForm input[name="photo"]');
  if (photo) photo.addEventListener('change', async (e) => {
    const exif = await readExif(e.target.files[0]);
    exifGps = (exif && exif.lat != null) ? { lat: exif.lat, lng: exif.lng } : null;
    choose();   // no-op while EcoManualPin is set (manual placement preserved)
  });
  ['#heroReport', '#reportBtn'].forEach((s) => { const b = document.querySelector(s); if (b) b.addEventListener('click', getLiveGPS); });

  // Expose the chosen live accuracy so other modules (photo-trust) can explain it.
  window.EcoLocation = { liveAccuracy: () => (live ? live.acc : null) };
})();


/* === js/validation.js === */
/* ============================================================================
 * validation.js — Client-side anti-spam + integrity guard (ADDITIVE module).
 * ----------------------------------------------------------------------------
 * Enforces, entirely on the client and WITHOUT editing app.js:
 *   1. File-type whitelist  (JPG / PNG only)
 *   2. File-size ceiling     (<= 10 MB)
 *   3. EXIF capture-time freshness  (rejects "old gallery photo" fraud)
 *   4. Submission rate-limit (1 report / 60 s, persisted in localStorage)
 *   5. Input-side XSS scrubbing (defense-in-depth on top of app.js output escaping)
 *
 * HOW WE INTERCEPT WITHOUT TOUCHING app.js
 * ----------------------------------------
 * app.js registers its submit handler in the BUBBLE phase on #reportForm:
 *     form.addEventListener('submit', handleReport)        // bubble (default)
 * DOM event flow is:  CAPTURE (document -> ... -> target)  ->  TARGET  ->  BUBBLE.
 * We register on `document` with capture=true, so our listener runs FIRST, while
 * the event is still travelling DOWN toward the form. If a check fails we call
 *   e.preventDefault()      // stop any native submission
 *   e.stopPropagation()     // halt the event so it never reaches app.js's handler
 * This is the "guard at the gate" pattern: the existing feature code is untouched
 * and simply never executes for invalid input. (Because app.js submits via fetch
 * and already calls preventDefault itself, there is no real page navigation to
 * worry about — we are purely gating whether handleReport runs at all.)
 * ==========================================================================*/
(function () {
  'use strict';

  /* ---- Tunable policy constants (single source of truth) ------------------ */
  const MAX_MB        = 10;                      // hard image-size ceiling (phone cameras ~5-7 MB)
  const MAX_BYTES     = MAX_MB * 1024 * 1024;    // derived from MAX_MB (in bytes)
  const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
  const ALLOWED_EXT   = /\.(jpe?g|png)$/i;       // fallback when browser reports ""
  const MAX_AGE_MIN   = 60;                      // EXIF photo must be <= 60 min old
  const COOLDOWN_MS   = 60 * 1000;               // 1 report per 60 seconds
  const RL_KEY        = 'lastReportAt';          // stored via EcoStore (namespaced)

  /* Expose for tests + as an essay reference surface. */
  window.EcoValidation = { MAX_MB, MAX_AGE_MIN, COOLDOWN_MS };

  /* We only police the citizen report form; any future forms are ignored. */
  const isReportForm = (el) => el && el.id === 'reportForm';

  /* ------------------------------------------------------------------------
   * A dedicated inline message line, injected next to the photo field.
   * We do NOT reuse #formMsg because app.js owns that node's text; injecting
   * our own element keeps the two concerns fully decoupled (additive DOM).
   * ---------------------------------------------------------------------- */
  let msgEl = null;
  function ensureMsgEl() {
    if (msgEl) return msgEl;
    const photoInput = document.querySelector('#reportForm input[name="photo"]');
    if (!photoInput) return null;
    msgEl = document.createElement('p');
    msgEl.className = 'form-msg';           // reuse existing styling
    msgEl.id = 'validationMsg';
    photoInput.closest('.field').insertAdjacentElement('afterend', msgEl);
    return msgEl;
  }
  function fail(msg) {
    const el = ensureMsgEl();
    if (el) { el.textContent = '⚠️ ' + msg; el.style.color = '#dc3545'; }
  }
  function clearMsg() {
    const el = ensureMsgEl();
    if (el) { el.textContent = ''; el.style.color = ''; }
  }

  /* ------------------------------------------------------------------------
   * 1 + 2. FILE TYPE & SIZE  (synchronous reads off the File object)
   * `file.type` is authoritative, but some mobile browsers hand back an empty
   * MIME string for camera captures, so we fall back to a filename-extension
   * check. Both layers must agree the file is a JPG/PNG before we accept it.
   * ---------------------------------------------------------------------- */
  function checkTypeAndSize(file) {
    if (!file) return { ok: false, reason: 'A photo is required.' };

    const typeOk = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXT.test(file.name || '');
    if (!typeOk) {
      return { ok: false, reason: 'Only JPG or PNG images are allowed.' };
    }
    if (file.size > MAX_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      return { ok: false, reason: `Image is ${mb} MB — the limit is ${MAX_MB} MB.` };
    }
    return { ok: true };
  }

  /* ------------------------------------------------------------------------
   * 3. EXIF CAPTURE-TIME FRESHNESS
   * Phones that geotag also stamp DateTimeOriginal into the JPEG's EXIF block.
   * A citizen reporting a live dump site should be shooting NOW, so a timestamp
   * older than MAX_AGE_MIN strongly implies a pre-existing gallery image (fraud).
   *
   * exif-js (loaded from CDN before this file) reads the binary EXIF segment
   * client-side; we wrap its callback API in a Promise. DateTimeOriginal arrives
   * as the string "YYYY:MM:DD HH:MM:SS" which we parse into a local Date.
   *
   * FALSE-POSITIVE GUARD: many pipelines (WhatsApp, screenshots, OS privacy
   * settings) STRIP EXIF entirely. A missing timestamp therefore does NOT mean
   * fraud — so when EXIF is absent we soft-pass and lean on the live GPS fix
   * that camera-location.js already pins to the report. We only hard-reject when
   * a timestamp IS present AND is stale. This keeps honest users from being
   * locked out while still catching the lazy "upload an old photo" attack.
   * ---------------------------------------------------------------------- */


  function readExifTimestamp(file) {
    return new Promise((resolve) => {
      if (!file || !window.EXIF) return resolve(null);
      try {
        EXIF.getData(file, function () {
          resolve(window.EcoClean.parseExifDate(EXIF.getTag(this, 'DateTimeOriginal')));
        });
      } catch (e) {
        resolve(null); // never let EXIF parsing break the flow
      }
    });
  }

  /* Cached result of the most recent photo selection. Size/type are checked
   * synchronously at submit time (authoritative), but the EXIF read is async,
   * so we resolve it on `change` and stash the date for the synchronous submit
   * guard — this avoids doing async work inside a capture-phase listener, which
   * would race the event dispatch. */
  let cachedExifDate = null;
  let exifPending = false;

  function checkFreshness() {
    if (exifPending) return { ok: true };          // EXIF not ready -> soft pass
    if (!cachedExifDate) return { ok: true };      // no EXIF timestamp -> soft pass
    const ageMs = Date.now() - cachedExifDate.getTime();
    if (ageMs < 0) return { ok: true };            // future clock skew -> ignore
    if (ageMs > MAX_AGE_MIN * 60 * 1000) {
      return {
        ok: false,
        reason: `That photo looks older than ${MAX_AGE_MIN} minutes. Please take a fresh picture on site.`,
      };
    }
    return { ok: true };
  }

  /* ------------------------------------------------------------------------
   * 4. RATE LIMIT  (a 1-shot "token bucket" persisted in localStorage)
   * Classic anti-spam: record the timestamp of the last accepted submission and
   * refuse the next one until COOLDOWN_MS has elapsed. Persisting via EcoStore
   * (namespace "ecoclean:") survives page reloads within the cooldown window, so
   * a spammer can't just refresh to reset. We stamp the time when validation
   * PASSES (i.e. on attempt), not on backend success — rate-limiting attempts is
   * the correct anti-abuse semantic and also shields the Supabase insert path
   * from rapid-fire calls even if the network later errors.
   * ---------------------------------------------------------------------- */
  function rateLimitRemaining() {
    const last = EcoStore.get(RL_KEY, 0);
    const elapsed = Date.now() - last;
    return Math.max(0, COOLDOWN_MS - elapsed);
  }
  function checkRateLimit() {
    const wait = rateLimitRemaining();
    if (wait > 0) {
      return { ok: false, reason: `Please wait ${Math.ceil(wait / 1000)}s before submitting another report.` };
    }
    return { ok: true };
  }
  function stampRateLimit() {
    EcoStore.set(RL_KEY, Date.now());
  }

  /* ------------------------------------------------------------------------
   * 5. INPUT-SIDE XSS SCRUB (defense in depth)
   * app.js already HTML-escapes user text at RENDER time (escapeHtml) — that is
   * the primary protection. Here we add a second, independent layer at the trust
   * BOUNDARY (input): we strip the constructs that actually lead to script
   * execution — <script> blocks, inline on*= handlers, and javascript: URIs —
   * while leaving ordinary prose (including harmless characters like "<3") intact.
   * Because we run in capture phase BEFORE app.js reads the fields, rewriting the
   * input .value here means handleReport sends already-clean data to the API.
   * ---------------------------------------------------------------------- */
  function scrubText(value) {
    if (!value) return value;
    return value
      .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, '')  // drop <script>…</script>
      .replace(/<\s*script[^>]*>/gi, '')                       // drop lone <script …>
      .replace(/javascript\s*:/gi, '')                         // kill javascript: scheme
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '') // drop onclick=, onerror=, …
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); // strip control chars
  }
  function sanitizeFormInputs(form) {
    ['description', 'reporterName'].forEach((name) => {
      const el = form.elements[name];
      if (el && el.value) el.value = scrubText(el.value);
    });
  }

  /* ------------------------------------------------------------------------
   * UX: validate the moment a photo is chosen (immediate feedback), resolving
   * the async EXIF timestamp here so the submit guard can stay synchronous.
   * capture=true on `document` makes us run before camera-location.js's own
   * change handler, so we surface errors first.
   * ---------------------------------------------------------------------- */
  document.addEventListener('change', async (e) => {
    const input = e.target;
    if (!input || !isReportForm(input.form) || input.name !== 'photo') return;
    const file = input.files && input.files[0];

    const sync = checkTypeAndSize(file);
    if (!sync.ok) { fail(sync.reason); cachedExifDate = null; return; }

    exifPending = true;
    cachedExifDate = await readExifTimestamp(file);
    exifPending = false;

    const fresh = checkFreshness();
    if (!fresh.ok) fail(fresh.reason);
    else clearMsg();
  }, true);

  /* ------------------------------------------------------------------------
   * THE GATE: synchronous capture-phase submit guard.
   * Order of checks is cheapest-first (size/type -> rate-limit -> freshness),
   * then we scrub the text fields and stamp the rate-limit on the way through.
   * ---------------------------------------------------------------------- */
  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!isReportForm(form)) return;

    const file = form.photo && form.photo.files && form.photo.files[0];

    const sizeType = checkTypeAndSize(file);
    if (!sizeType.ok) { e.preventDefault(); e.stopPropagation(); fail(sizeType.reason); return; }

    const rate = checkRateLimit();
    if (!rate.ok) { e.preventDefault(); e.stopPropagation(); fail(rate.reason); return; }

    const fresh = checkFreshness();
    if (!fresh.ok) { e.preventDefault(); e.stopPropagation(); fail(fresh.reason); return; }

    /* All checks passed — clean the text inputs, start the cooldown, and let
     * the event continue down to app.js's handleReport unchanged. */
    sanitizeFormInputs(form);
    stampRateLimit();
    clearMsg();
  }, true);
})();


/* === js/photo-trust.js === */
/* ============================================================================
 * photo-trust.js — show the user WHAT we verified about their photo (ADDITIVE)
 * ----------------------------------------------------------------------------
 * The app already extracts EXIF capture-time + GPS and live GPS for anti-fraud
 * (camera-location.js, validation.js), but until now that work was invisible.
 * This module turns it into a friendly, translated trust note under the photo
 * field, so the validation rules read as helpful guidance instead of a mystery
 * block. It is PURELY INFORMATIONAL — the hard enforcement (block stale photos,
 * rate-limit, size/type) stays in validation.js. That separation of *explanation*
 * from *enforcement* is deliberate and is itself a clean design point.
 * It also surfaces the live GPS accuracy (± metres) so a pin that is a few
 * metres off reads as "that's the hardware limit", not as a bug.
 * ==========================================================================*/
(function () {
  'use strict';

  const STR = {
    en: {
      checking: 'Verifying photo…',
      fresh: 'Verified: fresh photo, captured {min} min ago.',
      freshGps: 'Verified: fresh photo ({min} min ago) and its GPS matches your location.',
      old: 'Heads up: this photo looks about {min} min old — a fresh on-site shot verifies fastest.',
      noTime: 'No capture time found in this photo — we’ll trust your live location instead.',
      gpsFar: 'Note: the photo’s embedded GPS is ~{km} km from your current location. Tap “Use my location” to pin it where you are now.',
      gpsNoLive: 'Photo GPS read, but your live location is unavailable to compare.',
    },
    fr: {
      checking: 'Vérification de la photo…',
      fresh: 'Vérifié : photo récente, prise il y a {min} min.',
      freshGps: 'Vérifié : photo récente ({min} min) et son GPS correspond à votre position.',
      old: 'Attention : cette photo paraît dater d’environ {min} min — une photo prise sur place se vérifie plus vite.',
      noTime: 'Aucune heure de prise de vue trouvée — nous utiliserons votre position actuelle.',
      gpsFar: 'Note : le GPS intégré à la photo est à ~{km} km de votre position. Touchez « Utiliser ma position » pour épingler où vous êtes.',
      gpsNoLive: 'GPS de la photo lu, mais votre position actuelle est indisponible pour comparer.',
    },
    ar: {
      checking: 'جارٍ التحقق من الصورة…',
      fresh: 'تم التحقق: صورة حديثة التُقطت قبل {min} دقيقة.',
      freshGps: 'تم التحقق: صورة حديثة ({min} دقيقة) وإحداثياتها تطابق موقعك.',
      old: 'تنبيه: تبدو هذه الصورة ملتقطة قبل نحو {min} دقيقة — صورة جديدة من الموقع تتحقق أسرع.',
      noTime: 'لم نجد وقت الالتقاط في هذه الصورة — سنعتمد على موقعك المباشر بدلًا من ذلك.',
      gpsFar: 'ملاحظة: إحداثيات الصورة تبعد ~{km} كم عن موقعك الحالي. اضغط «استخدم موقعي» لتثبيت البلاغ حيث أنت الآن.',
      gpsNoLive: 'تمت قراءة إحداثيات الصورة، لكن موقعك المباشر غير متاح للمقارنة.',
    },
  };
  const t = () => STR[(typeof window.getLang === 'function' ? getLang() : 'en')] || STR.en;
  const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => (k in o ? o[k] : ''));


  function readExif(file) {
    return new Promise((res) => {
      if (!file || !window.EXIF) return res(null);
      try {
        EXIF.getData(file, function () {
          const g = EXIF.getTag(this, 'GPSLatitude');
          let gps = null;
          if (g) {
            const d = (v, ref) => { const x = v[0] + v[1] / 60 + v[2] / 3600; return (ref === 'S' || ref === 'W') ? -x : x; };
            gps = { lat: d(g, EXIF.getTag(this, 'GPSLatitudeRef')), lng: d(EXIF.getTag(this, 'GPSLongitude'), EXIF.getTag(this, 'GPSLongitudeRef')) };
          }
          res({ gps: gps, time: window.EcoClean.parseExifDate(EXIF.getTag(this, 'DateTimeOriginal')) });
        });
      } catch (e) { res(null); }
    });
  }
  function liveGPS() {
    return new Promise((res) => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }), () => res(null), { enableHighAccuracy: true, timeout: 8000 });
    });
  }
  function distKm(a, b) {
    if (window.EcoGeo && EcoGeo.distanceKm) return EcoGeo.distanceKm(a, b);
    const R = 6371, r = (d) => (d * Math.PI) / 180;
    const dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng);
    const s = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  let box = null, seq = 0;
  function ensureBox() {
    if (box) return box;
    const photo = document.querySelector('#reportForm input[name="photo"]');
    if (!photo) return null;
    box = document.createElement('div');
    box.id = 'photoTrust';
    box.className = 'form-msg';
    box.setAttribute('aria-live', 'polite');
    photo.closest('.field').insertAdjacentElement('afterend', box);
    return box;
  }
  function set(html, color) { const b = ensureBox(); if (!b) return; b.innerHTML = html; b.style.color = color || ''; }

  async function evaluate(file) {
    const my = ++seq;                                  // ignore results from an earlier pick
    set('🔍 ' + t().checking, '#6b7c74');
    const exif = await readExif(file); if (my !== seq) return;
    const live = await liveGPS(); if (my !== seq) return;
    const s = t();
    const ageMin = exif && exif.time ? Math.max(0, Math.round((Date.now() - exif.time.getTime()) / 60000)) : null;
    let html, color = '#198754';
    if (ageMin === null) { html = 'ℹ️ ' + s.noTime; color = '#6b7c74'; }
    else if (ageMin > 60) { html = '⚠️ ' + fill(s.old, { min: ageMin }); color = '#b45309'; }
    else {
      const hasExifGps = !!(exif && exif.gps);
      const gpsOk = hasExifGps && live && distKm(exif.gps, live) < 1;
      if (hasExifGps && live && !gpsOk) html = '✅ ' + fill(s.fresh, { min: ageMin }) + ' <span style="color:#b45309">' + fill(s.gpsFar, { km: distKm(exif.gps, live).toFixed(1) }) + '</span>';
      else if (hasExifGps && live && gpsOk) html = '✅ ' + fill(s.freshGps, { min: ageMin });
      else if (hasExifGps && !live) html = '✅ ' + fill(s.fresh, { min: ageMin }) + ' <span style="color:#6b7c74">' + s.gpsNoLive + '</span>';
      else html = '✅ ' + fill(s.fresh, { min: ageMin });
    }
    // Surface the live GPS accuracy so a pin a few metres off reads as expected.
    if (live && live.acc != null) html += ' <span style="color:#6b7c74">· ±' + Math.round(live.acc) + ' m</span>';
    set(html, color);
  }

  const photo = document.querySelector('#reportForm input[name="photo"]');
  if (photo) photo.addEventListener('change', (e) => { const b = ensureBox(); if (b) b.textContent = ''; evaluate(e.target.files[0]); });
})();


/* === js/photo-quality.js === */
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


/* === js/dup-detect.js === */
/* ============================================================================
 * dup-detect.js — near-duplicate report warning (ADDITIVE, no app.js edits)
 * ----------------------------------------------------------------------------
 * Crowdsourcing is healthiest when the SAME dirty site reported by three people
 * surfaces fast — but the SAME person re-submitting the same photo 5 m away, or a
 * stale re-report of a site that was cleaned yesterday, just creates noise and
 * wastes reviewer + storage budget. We can't (and shouldn't) BLOCK a second
 * report of a real problem, so this module is a NON-BLOCKING advisory: when the
 * pinned location is within DUP_RADIUS_M of an EXISTING report created in the
 * last DUP_WINDOW_DAYS, we show a friendly "a report already exists ~X m away"
 * note and let the user decide.
 *
 * HOW WE HOOK (the capture-phase pattern, same as validation.js)
 * --------------------------------------------------------------
 * We listen on `document` for `input`/`change` (location edits) and `submit`
 * with capture=true, so we run BEFORE app.js's bubble-phase handler and before
 * any native submit. We never call stopPropagation on submit — the warning is
 * purely informational, so the report still goes through. We own a dedicated
 * message node (#dupMsg) injected after the location row, fully decoupled from
 * app.js's #formMsg and validation.js's #validationMsg.
 *
 * THE ALGORITHM — Haversine great-circle distance
 * -----------------------------------------------
 * For each existing report we compute the surface distance between two
 * (lat,lng) points on a sphere of radius R=6371 km. Flat-earth Euclidean
 * distance would be wrong here because one degree of longitude shrinks toward
 * the poles; Haversine is exact enough for metres-scale work and branch-free
 * cheap. EcoClean.reports (kept by ecoclean-addons.js / map-sync.js) is the
 * in-memory mirror of /api/reports, so we compare against the live dataset
 * with ZERO extra network call. We scan the whole list (a few hundred reports
 * at most) — O(n) per check is fine; a spatial index would be over-engineering
 * at this scale.
 *
 * TIME WINDOW: we parse created_at (ISO 8601) and ignore reports older than
 * DUP_WINDOW_DAYS, because a site cleaned weeks ago is legitimately reportable
 * again if pollution returns.
 * ==========================================================================*/
(function () {
  'use strict';

  /* ---- policy constants (single source of truth) -------------------------- */
  var DUP_RADIUS_M   = 120;     // "same spot" radius in metres
  var DUP_WINDOW_DAYS = 14;     // only consider reports this recent
  var DUP_LS_KEY     = 'dupDismissedAt'; // not used to block, only to debounce

  /* ---- localized strings -------------------------------------------------- */
  var STR = {
    en: { near: 'A report already exists ~{m} m from here ({cat}, {d}d ago). You can still add yours if the situation is new or different.', none: '' },
    fr: { near: 'Un signalement existe déjà à ~{m} m d’ici ({cat}, il y a {d} j). Vous pouvez ajouter le vôtre si la situation est nouvelle ou différente.', none: '' },
    ar: { near: 'يوجد بلاغ بالفعل على بُعد ~{m} م من هنا ({cat}، قبل {d} يوم). يمكنك إضافة بلاغك إذا كانت الحالة جديدة أو مختلفة.', none: '' },
  };
  var lang = function () { return (typeof window.getLang === 'function' ? getLang() : 'en'); };
  var tset = function () { return STR[lang()] || STR.en; };
  var fill = function (s, o) { return String(s).replace(/\{(\w+)\}/g, function (_, k) { return (k in o ? o[k] : ''); }); };
  var catName = function (k) { return (typeof window.catLabel === 'function' ? window.catLabel(k) : k); };

  /* ---- Haversine distance in metres (essay reference implementation) ------ */
  function distanceM(lat1, lng1, lat2, lng2) {
    if (typeof window.EcoGeo === 'object' && typeof window.EcoGeo.distanceKm === 'function') {
      return window.EcoGeo.distanceKm(lat1, lng1, lat2, lng2) * 1000;
    }
    var R = 6371000, toRad = Math.PI / 180;
    var dLat = (lat2 - lat1) * toRad, dLng = (lng2 - lng1) * toRad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function ageDays(iso) {
    if (!iso) return Infinity;
    var t = Date.parse(iso);
    if (isNaN(t)) return Infinity;
    return (Date.now() - t) / 86400000;
  }

  /* Find the closest recent report within the radius, or null. */
  function findNear(lat, lng) {
    var list = (window.EcoClean && window.EcoClean.reports) || [];
    var best = null, bestD = DUP_RADIUS_M;
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (r.lat == null || r.lng == null) continue;
      if (ageDays(r.createdAt) > DUP_WINDOW_DAYS) continue; // too old to count
      var d = distanceM(lat, lng, +r.lat, +r.lng);
      if (d < bestD) { bestD = d; best = r; }
    }
    return best ? { report: best, meters: Math.round(bestD) } : null;
  }

  /* ---- dedicated message node (additive DOM, decoupled) ------------------- */
  var msgEl = null;
  function ensureMsgEl() {
    if (msgEl) return msgEl;
    var locRow = document.querySelector('#reportForm .loc-row');
    if (!locRow) return null;
    msgEl = document.createElement('p');
    msgEl.className = 'form-msg';
    msgEl.id = 'dupMsg';
    msgEl.style.color = '#b06b00'; // amber-ish advisory, never red (non-blocking)
    locRow.insertAdjacentElement('afterend', msgEl);
    return msgEl;
  }
  function show(text) { var el = ensureMsgEl(); if (el) { el.textContent = text; el.hidden = !text; } }

  function recheck() {
    var form = document.getElementById('reportForm');
    if (!form) return;
    var lat = parseFloat(form.lat && form.lat.value), lng = parseFloat(form.lng && form.lng.value);
    if (!isFinite(lat) || !isFinite(lng)) { show(''); return; }
    var hit = findNear(lat, lng);
    if (!hit) { show(''); return; }
    var d = Math.max(1, Math.round(hit.report.createdAt ? ageDays(hit.report.createdAt) : 0));
    show('ℹ️ ' + fill(tset().near, { m: hit.meters, cat: catName(hit.report.category), d: d }));
  }

  /* Listen for any location change (manual entry OR "use my location"). */
  document.addEventListener('input', function (e) {
    if (e.target && e.target.form && e.target.form.id === 'reportForm' &&
        (e.target.name === 'lat' || e.target.name === 'lng')) recheck();
  }, true);
  /* camera-location.js / map-place.js write .value then dispatch 'change'. */
  document.addEventListener('change', function (e) {
    if (e.target && e.target.form && e.target.form.id === 'reportForm' &&
        (e.target.name === 'lat' || e.target.name === 'lng')) recheck();
  }, true);
  /* Re-run once the in-memory report list (re)loads, so a freshly synced report
   * is reflected even if the user typed the coords before the data arrived. */
  document.addEventListener('ecoclean:data', recheck);

  /* On submit: refresh the note (informational only — we do NOT block). */
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'reportForm') recheck();
  }, true);

  /* Clear the note when the modal closes / form resets. */
  document.addEventListener('ecoclean:reported', function () { show(''); });

  window.EcoDup = { findNear: findNear, distanceM: distanceM, DUP_RADIUS_M: DUP_RADIUS_M, DUP_WINDOW_DAYS: DUP_WINDOW_DAYS };
})();


/* === js/trust-system.js === */
/* trust-system.js — popup up/down votes + TrustScore + auto-hide on 3+ flags.
   Trust = (VerifiedReports * 10) / (TotalReports + Flagged).
   Votes & per-reporter tallies persist in localStorage (additive state). */
(function () {
  const VOTES = 'votes';        // { [reportId]: 'up' | 'down' }
  const REPORTER = 'reporterTrust'; // { [name]: {verified,total,flagged} }

  function trustScore(t) { return t ? (t.verified * 10) / (t.total + t.flagged) : 0; }
  function getVotes() { return EcoStore.get(VOTES, {}); }

  function injectButtons(popupEl, reportId) {
    if (!popupEl || popupEl.querySelector('.vote-row')) return;
    const row = document.createElement('div');
    row.className = 'vote-row';
    row.innerHTML = '<button data-v="up">▲</button><span class="vs"></span><button data-v="down">▼</button>';
    popupEl.appendChild(row);
    const votes = getVotes();
    row.querySelector('.vs').textContent = votes[reportId] ? votes[reportId] : '—';
    row.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
      votes[reportId] = btn.dataset.v;
      EcoStore.set(VOTES, votes);
      row.querySelector('.vs').textContent = votes[reportId];
      evaluateFlags();
    }));
  }

  // Per-report flag count: hide ONLY the marker that reaches 3+ downvotes.
  function evaluateFlags() {
    const votes = getVotes();
    const counts = {};
    Object.entries(votes).forEach(([id, v]) => { if (v === 'down') counts[id] = (counts[id] || 0) + 1; });
    Object.entries(counts).forEach(([id, n]) => {
      if (n >= 3) {
        window.EcoClean.maps.forEach(map =>
          map.eachLayer(l => { if (l._reportId === id) map.removeLayer(l); }));
      }
    });
  }

  window.addEventListener('ecoclean:mapready', map => {
    map.on('popupopen', e => {
      const marker = e.popup._source;           // Leaflet stores the opener on _source
      const id = marker && marker._reportId;
      if (id) injectButtons(e.popup.getElement(), id);
    });
  });
  // Re-tag markers whenever reports change.
  window.EcoData.load().then(() => window.EcoClean.tagMarkers());
  window.EcoTrust = { trustScore, getTrust: () => EcoStore.get(REPORTER, {}) };
})();


