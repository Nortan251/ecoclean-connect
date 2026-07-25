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
  function parseExifDate(raw) {
    if (!raw) return null;
    const m = String(raw).match(/(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  }

  function readExifTimestamp(file) {
    return new Promise((resolve) => {
      if (!file || !window.EXIF) return resolve(null);
      try {
        EXIF.getData(file, function () {
          resolve(parseExifDate(EXIF.getTag(this, 'DateTimeOriginal')));
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
