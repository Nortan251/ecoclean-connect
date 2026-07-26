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
