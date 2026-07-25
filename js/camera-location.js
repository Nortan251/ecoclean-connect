/* camera-location.js — high-accuracy GPS on modal open + EXIF GPS/timestamp
   from the chosen photo. Real-time coordinates take precedence; EXIF is used
   when present, otherwise the live geolocation fix is the source of truth. */
(function () {
  function setCoords(lat, lng) {
    const la = document.querySelector('#latInput'), lo = document.querySelector('#lngInput');
    if (la) la.value = lat.toFixed(6);
    if (lo) lo.value = lng.toFixed(6);
  }
  function getLiveGPS() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => setCoords(p.coords.latitude, p.coords.longitude),
      () => {}, { enableHighAccuracy: true, timeout: 10000 }
    );
  }
  // EXIF: extract GPS + capture time if the uploaded file carries it.
  function readExif(file) {
    return new Promise(resolve => {
      if (!file || !window.EXIF) return resolve(null);
      EXIF.getData(file, function () {
        const gps = EXIF.getTag(this, 'GPSLatitude');
        if (!gps) return resolve(null);
        const toDeg = (v, ref) => { const d = v[0] + v[1] / 60 + v[2] / 3600; return (ref === 'S' || ref === 'W') ? -d : d; };
        const lat = toDeg(gps, EXIF.getTag(this, 'GPSLatitudeRef'));
        const lng = toDeg(EXIF.getTag(this, 'GPSLongitude'), EXIF.getTag(this, 'GPSLongitudeRef'));
        resolve({ lat, lng, time: EXIF.getTag(this, 'DateTimeOriginal') });
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
  if (photo) photo.addEventListener('change', async e => {
    const exif = await readExif(e.target.files[0]);
    if (exif && exif.lat) setCoords(exif.lat, exif.lng); // else live GPS already set
  });
  ['#heroReport', '#reportBtn'].forEach(s => {
    const b = document.querySelector(s); if (b) b.addEventListener('click', getLiveGPS);
  });
})();
