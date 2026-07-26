/* camera-location.js — accuracy-aware location fusion for the report pin.
 * Two sensors can tell us where a report happened: the device's live, high-
 * accuracy geolocation, and the GPS embedded in the photo's EXIF. The old code
 * let EXIF *overwrite* the live fix, which is backwards: a phone photo's EXIF
 * GPS is often coarser (or from a slightly different moment) than a real-time
 * high-accuracy fix, so the pin could land a few metres off where the user
 * actually stands. We now FUSE the two: the live fix wins whenever its reported
 * accuracy is good; EXIF is the fallback when live GPS is missing or poor (e.g.
 * indoors). EXIF GPS still feeds the anti-fraud checks in photo-trust.js /
 * validation.js regardless — fusion only changes which coordinate pins the map. */
(function () {
  const latIn = () => document.querySelector('#latInput');
  const lngIn = () => document.querySelector('#lngInput');
  const LIVE_ACC_THRESHOLD = 100;   // metres; prefer the live fix when its accuracy <= this
  let live = null;                  // {lat, lng, acc}
  let exifGps = null;               // {lat, lng}

  function apply(lat, lng) { const a = latIn(), o = lngIn(); if (a) a.value = lat.toFixed(6); if (o) o.value = lng.toFixed(6); }
  function choose() {
    if (live && exifGps) {
      // Sensor fusion: trust the real-time fix when it is accurate; otherwise the
      // photo's embedded GPS is the better bet (live accuracy degrades indoors).
      if (live.acc == null || live.acc <= LIVE_ACC_THRESHOLD) apply(live.lat, live.lng);
      else apply(exifGps.lat, exifGps.lng);
    } else if (live) apply(live.lat, live.lng);
    else if (exifGps) apply(exifGps.lat, exifGps.lng);
  }

  function getLiveGPS() {
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
    choose();   // re-pick the best source (no longer blindly overwrites the live fix)
  });
  ['#heroReport', '#reportBtn'].forEach((s) => { const b = document.querySelector(s); if (b) b.addEventListener('click', getLiveGPS); });

  // Expose the chosen live accuracy so other modules (photo-trust) can explain it.
  window.EcoLocation = { liveAccuracy: () => (live ? live.acc : null) };
})();
