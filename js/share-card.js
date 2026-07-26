/* ============================================================================
 * share-card.js — viral growth: a canvas-generated share CARD per report (ADDITIVE)
 * ----------------------------------------------------------------------------
 * Why: sharing a plain URL is weak social proof. A *picture* of the
 * transformation ("reported ➜ cleaned") stops a scroll and carries the brand +
 * a call-to-action into WhatsApp/Instagram/Twitter — that is the growth loop.
 * A static SPA cannot emit a per-report Open-Graph image (the crawler sees one
 * HTML file), so we generate the card CLIENT-SIDE on a <canvas> and share the
 * resulting PNG via the Web Share Level-2 file API (mobile sheets accept files),
 * falling back to a download + copied link on desktop.
 *
 * DESIGN (the "share card" = a 1200x630 OG-sized canvas)
 *   left  ~62% : the report photo, cover-cropped  (text-only if CORS taints it)
 *   right ~38% : brand, a status pill (REPORTED / CLEANED), the category,
 *                the date, and a CTA line + hashtags
 * We draw the leaf logo as vector paths (no external asset fetch) so the card
 * never fails to render. Colours read the live theme tokens where possible, but
 * a share card is a *branded artifact* so we keep the EcoClean green regardless
 * of the viewer's dark/light mode — brand consistency beats theme-matching here.
 *
 * NON-DESTRUCTIVE WIRING: like compare.js / share.js we listen for
 * 'ecoclean:mapready' then 'popupopen' and inject a share ROW into the popup.
 * We render for EVERY report (not only verified ones): a verified report shares
 * the "we cleaned it" proof; an unverified one shares a "help clean this" rally
 * cry — both are growth. We hide the original share.js button to avoid two
 * share buttons in one popup (detected by its class).
 *
 * CORS / TAINT: the photo lives on Supabase public storage (sends CORS), so we
 * load it with crossOrigin='anonymous' and CAN export pixels. If that ever fails
 * (proxy, opaque origin) we retry WITHOUT the flag to at least *show* it, and
 * accept that toBlob will throw — caught below, where we re-render a photo-less
 * card. Net: the card ALWAYS produces a shareable image.
 * ==========================================================================*/
(function () {
  'use strict';

  var W = 1200, H = 630; // OG / Twitter summary_large_image aspect

  var L10N = {
    en: { verified: 'CLEANED ✅', reported: 'REPORTED 📍', cta_v: 'Track clean-ups near you', cta_r: 'Help clean this spot', tag: '#EcoCleanConnect', shareV: '🌱 Share the cleanup', shareR: '📢 Rally help', cleanedOn: 'Cleaned', reportedOn: 'Reported' },
    fr: { verified: 'NETTOYÉ ✅', reported: 'SIGNALÉ 📍', cta_v: 'Suivez les nettoyages près de chez vous', cta_r: 'Aidez à nettoyer ici', tag: '#EcoCleanConnect', shareV: '🌱 Partager le nettoyage', shareR: '📢 Mobiliser', cleanedOn: 'Nettoyé', reportedOn: 'Signalé' },
    ar: { verified: 'تم التنظيف ✅', reported: 'مبلَّغ 📍', cta_v: 'تابع عمليات التنظيف قربك', cta_r: 'ساعد في تنظيف هذا المكان', tag: '#EcoCleanConnect', shareV: '🌱 شارك التنظيف', shareR: '📢 استنجد المساعدة', cleanedOn: 'نُظّف', reportedOn: 'بُلّغ' },
  };
  var lang = function () { return (typeof window.getLang === 'function' ? getLang() : 'en'); };
  var L = function () { return L10N[lang()] || L10N.en; };
  var catName = function (k) { return (typeof window.catLabel === 'function' ? window.catLabel(k) : k); };

  /* Rounded-rect path helper (CanvasRenderingContext2D.roundRect is still uneven
   * across mobile WebViews, so we draw it by hand). */
  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  /* Wrap text by measuring width; returns the y after the last line drawn. */
  function wrap(ctx, text, x, y, maxW, lh) {
    var words = String(text || '').split(/\s+/), line = '', yy = y;
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = words[i]; yy += lh; }
      else line = test;
    }
    if (line) { ctx.fillText(line, x, yy); yy += lh; }
    return yy;
  }
  /* Vector leaf logo — two quadratic curves + a midrib, scaled to `s` px. */
  function drawLogo(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, s);
    ctx.quadraticCurveTo(0, 0, s, 0);
    ctx.quadraticCurveTo(s, s, 0, s);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#198754'; ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.beginPath(); ctx.moveTo(s * 0.18, s * 0.82); ctx.lineTo(s * 0.78, s * 0.22); ctx.stroke();
    ctx.restore();
  }

  /* Load the photo as an Image we are *allowed* to read pixels from. See the
   * CORS/TAINT note in the header for the two-attempt strategy. */
  function loadDrawable(url) {
    if (!url) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var tried = false;
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(img); };
      img.onerror = function () {
        if (tried) return resolve(null);
        tried = true;
        var img2 = new Image();           // retry opaque: shows but may taint
        img2.onload = function () { resolve(img2); };
        img2.onerror = function () { resolve(null); };
        img2.src = url;
      };
      img.src = url;
    });
  }

  /* Render the card to a canvas. `img` may be null (photo-less card). */
  function render(rep, img) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    var verified = rep.status === 'verified';
    var split = img ? Math.round(W * 0.62) : 0;

    // Left: photo cover-cropped, else a soft green panel with the category icon.
    if (img) {
      var ar = img.width / img.height, boxAr = split / H, sw, sh, sx, sy;
      if (ar > boxAr) { sh = img.height; sw = sh * boxAr; sx = (img.width - sw) / 2; sy = 0; }
      else { sw = img.width; sh = sw / boxAr; sx = 0; sy = (img.height - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, split, H);
      var g = ctx.createLinearGradient(split - 160, 0, split, 0);
      g.addColorStop(0, 'rgba(13,32,24,0)'); g.addColorStop(1, 'rgba(13,32,24,.55)');
      ctx.fillStyle = g; ctx.fillRect(split - 160, 0, 160, H);
    } else {
      ctx.fillStyle = '#0f5132'; ctx.fillRect(0, 0, split || W, H);
      ctx.font = '200px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.18; ctx.fillStyle = '#fff';
      ctx.fillText(({ illegal_dumping: '🗑️', water: '💧', air_smoke: '💨', plastic_marine: '🌊' })[rep.category] || '📍', (split || W) / 2, H / 2);
      ctx.globalAlpha = 1;
    }

    // Right panel.
    var rx = Math.max(split, 0), rw = W - rx;
    if (rw <= 0) { rx = 0; rw = W; } // photo failed AND no split => full-bleed panel below? keep simple: full card green
    var grad = ctx.createLinearGradient(rx, 0, W, H);
    grad.addColorStop(0, '#198754'); grad.addColorStop(1, '#0d9488');
    ctx.fillStyle = grad; ctx.fillRect(rx, 0, rw, H);

    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    var pad = 56, tx = rx + pad, maxW = rw - pad * 2, y = 0;

    // Brand row: logo chip + name.
    ctx.fillStyle = 'rgba(255,255,255,.16)'; rrect(ctx, tx, 70, 64, 64, 16); ctx.fill();
    drawLogo(ctx, tx + 14, 82, 36);
    ctx.fillStyle = '#fff'; ctx.font = '800 34px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('EcoClean Connect', tx + 80, 112);

    // Status pill.
    var pillTxt = verified ? L().verified : L().reported;
    ctx.font = '800 26px "Plus Jakarta Sans", system-ui, sans-serif';
    var pw = ctx.measureText(pillTxt).width + 44;
    ctx.fillStyle = verified ? 'rgba(255,255,255,.95)' : 'rgba(239,68,68,.95)';
    rrect(ctx, tx, 168, pw, 50, 25); ctx.fill();
    ctx.fillStyle = verified ? '#0a5c3f' : '#fff'; ctx.fillText(pillTxt, tx + 22, 202);

    // Category (big) + description.
    ctx.fillStyle = '#fff'; ctx.font = '800 46px "Plus Jakarta Sans", system-ui, sans-serif';
    y = wrap(ctx, catName(rep.category), tx, 290, maxW, 54);
    if (rep.description) {
      ctx.font = '500 26px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      y = wrap(ctx, rep.description, tx, y + 12, maxW, 34);
    }

    // CTA + hashtag pinned near the bottom.
    ctx.font = '700 30px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(verified ? L().cta_v : L().cta_r, tx, H - 96);
    ctx.font = '700 26px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.fillText(L().tag + '  •  ecoclean-connect.vercel.app', tx, H - 56);

    return c;
  }

  function canvasToBlob(canvas, type) {
    return new Promise(function (res) { canvas.toBlob(function (b) { res(b); }, type || 'image/png'); });
  }

  function toast(msg) {
    var t = document.querySelector('#toast');
    if (!t) return;
    t.textContent = msg; t.classList.remove('hidden');
    setTimeout(function () { t.classList.add('hidden'); }, 2600);
  }
  function copyText(s) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(s).catch(function () {});
    try { window.prompt('Copy:', s); } catch (e) {}
    return Promise.resolve();
  }
  function downloadBlob(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  /* Build the card for a report and push it out via the best channel available.
   * Order: native share-with-file (mobile) -> download + copy link (desktop). */
  function buildAndShare(rep) {
    var url = rep.status === 'verified' ? (rep.afterPhoto || rep.beforePhoto) : rep.beforePhoto;
    return loadDrawable(url).then(function (img) {
      var canvas;
      try { canvas = render(rep, img); canvasToBlob(canvas); } // taint test throw?
      catch (e) { canvas = render(rep, null); }
      return canvasToBlob(canvas, 'image/png').then(function (blob) {
        if (!blob) { canvas = render(rep, null); return canvasToBlob(canvas, 'image/png'); }
        return blob;
      }).catch(function () { return canvasToBlob(render(rep, null), 'image/png'); });
    }).then(function (blob) {
      var link = location.href;
      var file = new File([blob], 'ecoclean-' + (rep.id || 'card').slice(0, 8) + '.png', { type: 'image/png' });
      var text = (rep.status === 'verified' ? L().cta_v : L().cta_r) + ' ' + L().tag;
      // Web Share Level 2 (files) — the mobile win.
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: 'EcoClean Connect', text: text }).catch(function () {});
      }
      if (navigator.share) {
        // Share API present but no file support -> share the link, also save the card.
        downloadBlob(blob, file.name);
        return navigator.share({ title: 'EcoClean Connect', text: text, url: link }).catch(function () {});
      }
      // Desktop: save the image + copy a link.
      downloadBlob(blob, file.name);
      return copyText(text + ' ' + link).then(function () { toast(lang() === 'ar' ? 'تم حفظ البطاقة ونسخ الرابط' : (lang() === 'fr' ? 'Carte enregistrée et lien copié' : 'Card saved + link copied')); });
    }).catch(function () {
      // Last resort: no canvas at all -> just share the link.
      var link = location.href;
      if (navigator.share) return navigator.share({ title: 'EcoClean Connect', text: L().tag, url: link }).catch(function () {});
      return copyText(L().tag + ' ' + link);
    });
  }
  window.EcoShareCard = { build: function (rep) { return loadDrawable(rep.beforePhoto).then(function (i) { return render(rep, i); }); }, share: buildAndShare };

  /* Inject a share row into every report popup (verified + unverified). */
  window.addEventListener('ecoclean:mapready', function (ev) {
    var map = ev.detail; if (!map) return;
    map.on('popupopen', function (e) {
      var marker = e.popup && e.popup._source;
      var id = marker && marker._reportId; if (!id) return;
      var rep = (window.EcoClean && window.EcoClean.reports || []).find(function (r) { return r.id === id; });
      if (!rep) return;
      var el = e.popup.getElement(); if (!el || el.querySelector('.eco-card-row')) return;
      // Hide share.js's plain button so we don't show two share actions.
      var old = el.querySelector('.eco-share-row'); if (old) old.style.display = 'none';
      var row = document.createElement('div'); row.className = 'eco-card-row';
      var verified = rep.status === 'verified';
      row.innerHTML =
        '<button type="button" class="eco-card-btn primary"></button>' +
        (verified ? '' : '<button type="button" class="eco-card-btn ghost"></button>');
      el.appendChild(row);
      var btns = row.querySelectorAll('.eco-card-btn');
      btns[0].textContent = verified ? L().shareV : L().shareR;
      btns[0].addEventListener('click', function () { buildAndShare(rep); });
      if (btns[1]) { btns[1].textContent = L().shareR; btns[1].addEventListener('click', function () { buildAndShare(rep); }); }
    });
  });
  // Popups are transient (rebuilt on each open), so the share row is re-created
  // with the current language every time — no live re-localization needed.

  if (!document.getElementById('eco-sharecard-style')) {
    var st = document.createElement('style'); st.id = 'eco-sharecard-style';
    // Theme-aware via tokens: button surfaces follow the active theme so the
    // popup's share row never looks like a white sticker in dark mode.
    st.textContent =
      '.eco-card-row{display:flex;gap:6px;margin-top:8px;}' +
      '.eco-card-btn{flex:1;border-radius:8px;padding:7px 6px;font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid var(--border-strong,#bfe0cd);}' +
      '.eco-card-btn.primary{background:var(--accent-grad,linear-gradient(135deg,#198754,#0d9488));color:var(--on-accent,#fff);border-color:transparent;}' +
      '.eco-card-btn.ghost{background:var(--surface-2,#e8f3ec);color:var(--accent-dark,#0f5132);}';
    document.head.appendChild(st);
  }
})();
