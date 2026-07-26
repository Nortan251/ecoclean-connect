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

  function parseExifDate(raw) {
    if (!raw) return null;
    const m = String(raw).match(/(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
  }
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
          res({ gps: gps, time: parseExifDate(EXIF.getTag(this, 'DateTimeOriginal')) });
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
