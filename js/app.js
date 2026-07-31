// EcoClean Connect — citizen app logic (landing + map + i18n)
const MAP_CENTER = [33.5731, -7.5898]; // Casablanca (pilot city)
let map, markerLayer, mapInited = false;
const $ = (s) => document.querySelector(s);

function initMap() {
  // attributionControl:false -> we replace the default (ugly) credits bar with a
  // compact, compliant (i) chip below (Mapbox-style: credits hidden until tap/hover).
  map = L.map('map', { zoomControl: true, attributionControl: false }).setView(MAP_CENTER, 13);
  // Basemap swaps with the theme: CARTO Positron (light) / dark_all (dark). The
  // attribution stays on the layer and is surfaced via the compact (i) chip below.
  var LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
  var DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
  window.EcoTileUrls = { light: LIGHT_TILES, dark: DARK_TILES };
  var tiles = L.tileLayer((window.EcoTheme && EcoTheme.get() === 'dark') ? DARK_TILES : LIGHT_TILES, {
    maxZoom: 20,
    subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);
  window.EcoTiles = tiles;
  window.addEventListener('ecoclean:theme', function (e) {
    if (window.EcoTiles && window.EcoTileUrls) window.EcoTiles.setUrl(window.EcoTileUrls[e.detail] || window.EcoTileUrls.light);
  });
  markerLayer = L.layerGroup().addTo(map);
  $('#latInput').value = MAP_CENTER[0];
  $('#lngInput').value = MAP_CENTER[1];

  // Loading shimmer over the map until the first tiles paint (clean loading state).
  if (!document.getElementById('eco-maploader-style')) {
    const ls = document.createElement('style'); ls.id = 'eco-maploader-style';
    ls.textContent =
      '.eco-map-loader{position:absolute;inset:0;z-index:450;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#eef5f1,#e6f0ea);transition:opacity .4s ease;}' +
      '.eco-map-loader.hide{opacity:0;pointer-events:none;}' +
      '.eco-map-spin{width:34px;height:34px;border-radius:50%;border:3px solid rgba(25,135,84,.2);border-top-color:#198754;animation:eco-map-spin .8s linear infinite;}' +
      '@keyframes eco-map-spin{to{transform:rotate(360deg);}}';
    document.head.appendChild(ls);
  }
  const mapBox = document.getElementById('map');
  if (mapBox) {
    const ld = document.createElement('div'); ld.className = 'eco-map-loader'; ld.innerHTML = '<div class="eco-map-spin"></div>';
    mapBox.appendChild(ld);
    const kill = () => { ld.classList.add('hide'); setTimeout(() => { if (ld.parentNode) ld.parentNode.removeChild(ld); }, 450); };
    try { map.whenReady(() => map.once('load', kill)); } catch (e) {}
    setTimeout(kill, 6000); // safety if the 'load' event never fires
  }

  // --- compact map chrome: sleek zoom box + collapsible credits chip ----------
  if (!document.getElementById('eco-mapctrl-style')) {
    const st = document.createElement('style'); st.id = 'eco-mapctrl-style';
    st.textContent =
      '.leaflet-control-zoom{border:none!important;box-shadow:0 4px 12px rgba(16,40,30,.15)!important;border-radius:12px!important;overflow:hidden;}' +
      '.leaflet-control-zoom a{border:none!important;color:#0a5c3f!important;font-weight:700!important;width:34px!important;height:34px!important;line-height:34px!important;background:#fff!important;}' +
      '.leaflet-control-zoom a:hover{background:linear-gradient(135deg,#198754,#0d9488)!important;color:#fff!important;}' +
      '.leaflet-control-zoom-in{border-bottom:1px solid #eef2ef!important;}' +
      '.eco-attr{position:absolute;right:14px;bottom:80px;z-index:800;display:flex;flex-direction:column;align-items:flex-end;gap:5px;}' +
      '.eco-attr-btn{width:24px;height:24px;border-radius:50%;border:1px solid rgba(25,135,84,.2);background:rgba(255,255,255,.92);color:#0a5c3f;font-size:13px;font-style:italic;font-family:Georgia,serif;line-height:1;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.15);font-weight:700;}' +
      '.eco-attr-panel{max-height:0;opacity:0;overflow:hidden;transition:max-height .25s ease,opacity .2s ease,padding .2s ease;background:rgba(255,255,255,.94);border-radius:10px;font-size:10px;color:#5d7268;padding:0 8px;box-shadow:0 4px 12px rgba(0,0,0,.12);max-width:72vw;text-align:right;}' +
      '.eco-attr-panel.open{max-height:90px;opacity:1;padding:6px 8px;}' +
      '.eco-attr-panel a{color:#0d9488;text-decoration:none;}';
    document.head.appendChild(st);
  }
  // Credits chip appended to the map (NOT a Leaflet control, NOT the FAB's corner)
  // so it sits ABOVE the Report button, clear of every control. Clicks are stopped
  // so tapping it never drops a pin or triggers the button underneath.
  const mapEl = document.getElementById('map');
  if (mapEl && !mapEl.querySelector('.eco-attr')) {
    const wrap = document.createElement('div');
    wrap.className = 'eco-attr';
    wrap.innerHTML = '<div class="eco-attr-panel"><a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a> | &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a></div>' +
      '<button class="eco-attr-btn" type="button" aria-label="Map data credits" aria-expanded="false">i</button>';
    const btn = wrap.querySelector('.eco-attr-btn'), panel = wrap.querySelector('.eco-attr-panel');
    const set = (o) => { panel.classList.toggle('open', o); btn.setAttribute('aria-expanded', String(o)); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); set(!panel.classList.contains('open')); });
    wrap.addEventListener('mouseenter', () => set(true));
    wrap.addEventListener('mouseleave', () => set(false));
    if (L.DomEvent) L.DomEvent.disableClickPropagation(wrap);
    mapEl.appendChild(wrap);
  }
}

const pinStyle = (status) => ({
  radius: 9,
  color: status === 'verified' ? '#198754' : '#dc3545',
  fillColor: status === 'verified' ? '#198754' : '#dc3545',
  fillOpacity: 0.9,
  weight: 2,
});

const escapeHtml = (s) =>
  (s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

function popupHtml(r) {
  const date = new Date(r.createdAt).toLocaleString();
  const before = `<img src="${r.beforePhoto}" class="pop-img" />`;
  const after = r.afterPhoto ? `<img src="${r.afterPhoto}" class="pop-img" />` : '';
  const reward = r.rewardIssued
    ? `<p class="reward">🎁 ${t('reward')}: <b>${escapeHtml(r.rewardCode)}</b></p>`
    : '';
  const badge =
    r.status === 'verified'
      ? `<span class="badge green">${t('verified')}</span>`
      : `<span class="badge red">${t('reported')}</span>`;
  const desc = r.description ? escapeHtml(r.description) : `<i>${t('no_desc')}</i>`;
  return `<div class="popup"><div>${badge} <b>${catLabel(r.category)}</b></div><p>${desc}</p><div class="pop-imgs">${before}${after}</div>${reward}<small>${date}</small></div>`;
}

let _lrTimer=null; async function loadReports() { if(_lrTimer) clearTimeout(_lrTimer); return new Promise(r => { _lrTimer = setTimeout(() => _doLoadReports().then(r), 100); }); } async function _doLoadReports() {
  if (!mapInited) return;
  try {
    let reports;
    if (window.EcoClean && window.EcoClean.reports && window.EcoClean.reports.length > 0) {
      reports = window.EcoClean.reports;
    } else if (window.EcoData && EcoData.load) {
      reports = await EcoData.load();
    } else {
      reports = await (await fetch('/api/reports')).json();
      if (window.EcoClean) window.EcoClean.reports = reports;
    }
    // Optional map filter (category / verified-only), applied at render time only.
    // EcoClean.reports (heatmap / quests / leaderboard) still sees the full dataset.
    const list = window.EcoFilter ? EcoFilter.apply(reports) : reports;
    markerLayer.clearLayers();
    list.forEach((r) => {
      L.circleMarker([r.lat, r.lng], (window.EcoDecayPinStyle ? Object.assign(pinStyle(r.status), window.EcoDecayPinStyle(r)) : pinStyle(r.status)))
        .addTo(markerLayer)
        .bindPopup(popupHtml(r));
    });
  } catch (e) {}
}

async function loadAlerts() {
  try {
    const res = await fetch('/api/alerts');
    const alerts = await res.json();
    const box = $('#alerts');
    box.innerHTML = alerts.length
      ? alerts
          .slice(0, 3)
          .map(
            (a) =>
              `<div class="alert"><b>📢 ${escapeHtml(a.title)}</b><span>${escapeHtml(
                a.body
              )}</span></div>`
          )
          .join('')
      : '';
  } catch (e) {}
}

function showToast(msg) {
  const t2 = $('#toast');
  t2.textContent = msg;
  t2.classList.remove('hidden');
  setTimeout(() => t2.classList.add('hidden'), 3000);
}

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject();
    navigator.geolocation.getCurrentPosition(
      (p) => resolve([p.coords.latitude, p.coords.longitude]),
      () => reject(),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

/* ============================================================================
 * fileToResizedDataUrl — client-side image COMPRESSION before upload.
 * ----------------------------------------------------------------------------
 * A 12 MP phone JPEG is ~5-7 MB; uploading that over Moroccan 4G is slow and it
 * bloats Supabase storage. We downscale on a <canvas> and re-encode as JPEG.
 * Parameter choices (the engineering trade-off, useful for essays):
 *   maxDim = 1280  → long edge capped at 1280 CSS px. A pollution photo only
 *                    ever needs to prove "what is at this spot", and 1280 px is
 *                    sharp enough for the public before/after slider while being
 *                    ~1/9th the pixels of a 12 MP sensor. (1024 was too soft for
 *                    side-by-side comparison.) Area, hence bytes, scale with the
 *                    SQUARE of the linear reduction — this is why capping the
 *                    long edge is so effective.
 *   quality = 0.78 → JPEG quality knob (0..1). 0.78 sits just past the perceptual
 *                    "knee" of the rate/distortion curve: visible detail is kept
 *                    but file size is roughly halved vs 0.92. Below ~0.7 the
 *                    8x8 DCT blocking artefacts start to look like image content
 *                    and would confuse a human (or future ML) reviewer.
 * Output is a base64 data URL because the existing API expects `photo` inline in
 * JSON. (Base64 adds ~33% wire overhead vs a raw Blob/multipart upload — the next
 * efficiency step would be toBlob() + FormData, but that changes the server
 * contract, so it is deferred.)
 * ==========================================================================*/
async function fileToResizedDataUrl(file, maxDim = 1280, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        // Bilinear smoothing so the downscale doesn't leave jagged edges on
        // text/signage in the photo (helps both humans and any later ML triage).
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}



function autoDownloadPhoto(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'EcoClean_Before_' + Date.now() + '.jpg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

window.EcoReportMode = 'report';

async function handleReport(e) {
  e.preventDefault();
  const form = e.target;
  const msg = $('#formMsg');
  const btn = form.querySelector('button[type="submit"]');
  const file = form.photo.files[0];
  const afterFile = form.afterPhoto.files[0];
  
  if (!file || !form.lat.value || !form.lng.value || (window.EcoReportMode === 'clean' && !afterFile)) {
    msg.textContent = t('err_required');
    return;
  }
  msg.textContent = t('submitting');
  const ogText = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('submitting');
  try {
    const photo = await fileToResizedDataUrl(file);
    const payload = {
      photo,
      lat: form.lat.value,
      lng: form.lng.value,
      category: form.category.value,
      description: form.description.value,
      reporterName: form.reporterName.value,
      isSelfCleaned: window.EcoReportMode === 'clean'
    };
    if (window.EcoReportMode === 'clean') {
      payload.afterPhoto = await fileToResizedDataUrl(afterFile);
    }
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, (window.EcoAuth && EcoAuth.getToken()) ? { 'Authorization': 'Bearer ' + EcoAuth.getToken() } : {}),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      msg.textContent = '❌ ' + (err.error || t('err_fail'));
      btn.disabled = false;
      btn.textContent = ogText;
      return;
    }
    
    // Additive hook: tell the thank-you module what was just reported.
    window.dispatchEvent(new CustomEvent('ecoclean:reported', {
      detail: {
        category: form.category.value,
        reporterName: form.reporterName.value,
        lat: form.lat.value,
        lng: form.lng.value,
      },
    }));
    
    form.reset();
    resetTabs();
    populateCategories($('#categorySelect'));
    closeModal();
    
    // If they self-cleaned and are logged in, points were awarded. Refresh auth state.
    if (window.EcoReportMode === 'clean' && window.EcoAuth && EcoAuth.refresh) {
      EcoAuth.refresh();
      showToast('Hero! Clean-up Verified! ✅');
      if (window.EcoConfetti) EcoConfetti.fire();
    } else {
      showToast(t('success'));
    }
    
    await loadReports();
  } catch (err) {
    msg.textContent = t('err_network');
  } finally {
    if (btn && btn.disabled) {
      btn.disabled = false;
      btn.textContent = ogText;
    }
  }
}

function resetTabs() {
  window.EcoReportMode = 'report';
  const tr = $('#tabReport'), tc = $('#tabClean'), fap = $('#fieldAfterPhoto'), lbl = $('#lblBeforePhoto');
  if (tr) tr.classList.add('active');
  if (tc) tc.classList.remove('active');
  if (fap) { fap.classList.add('hidden'); fap.querySelector('input').required = false; }
  if (lbl) lbl.textContent = t('photo');
}


const openModal = () => {
  $('#reportModal').classList.remove('hidden');
  if (mapInited) setTimeout(() => map.invalidateSize(), 50);
};
const closeModal = () => { const m = $('#reportModal'); m.classList.add('closing'); setTimeout(() => { m.classList.add('hidden'); m.classList.remove('closing'); }, 300); };

function showMap() {
  $('#landing').classList.add('hidden');
  $('#mapView').classList.remove('hidden');
  $('#reportBtn').classList.remove('hidden');
  if (!mapInited) {
    initMap();
    mapInited = true;
    // Tiny additive seam: expose the (otherwise module-local) Leaflet map so
    // other modules (city.js) can fly to a city without us wiring them in here.
    window.EcoMap = { flyTo: function (lat, lng, z) { if (map) map.flyTo([lat, lng], z || 12, { duration: 0.8 }); }, get: function () { return map; } };
  }
  setTimeout(() => map && map.invalidateSize(), 250);
  loadReports();
  loadAlerts();
}

function applyLanguage() {
  const lang = getLang();
  setLang(lang);
  const sel = $('#langSelect');
  if (sel) sel.value = lang;
  applyI18n(document);
  populateCategories($('#categorySelect'));
  if (mapInited) loadReports();
}

window.addEventListener('DOMContentLoaded', () => {
  applyLanguage();
  $('#langSelect').addEventListener('change', (e) => {
    setLang(e.target.value);
    applyLanguage();
  });
  $('#navMap').addEventListener('click', (e) => {
    e.preventDefault();
    showMap();
  });
  $('#heroOpenMap').addEventListener('click', showMap);
  $('#heroReport').addEventListener('click', () => {
    showMap();
    setTimeout(openModal, 300);
  });
  $('#reportBtn').addEventListener('click', openModal);
  $('#tabReport').addEventListener('click', () => { window.EcoReportMode = 'report'; $('#tabReport').classList.add('active'); $('#tabClean').classList.remove('active'); $('#fieldAfterPhoto').classList.add('hidden'); $('#fieldAfterPhoto input').required = false; $('#lblBeforePhoto').textContent = t('photo'); });
  $('#tabClean').addEventListener('click', () => { window.EcoReportMode = 'clean'; $('#tabClean').classList.add('active'); $('#tabReport').classList.remove('active'); $('#fieldAfterPhoto').classList.remove('hidden'); $('#fieldAfterPhoto input').required = true; $('#lblBeforePhoto').textContent = t('photo_before'); });
  
  // Auto-download the Before photo so they have it saved on their phone
  const photoInput = document.querySelector('#reportForm input[name="photo"]');
  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0] && window.EcoReportMode === 'clean') {
        autoDownloadPhoto(e.target.files[0]);
        showToast(lang() === 'fr' ? 'Photo Avant sauvegardée dans votre galerie' : (lang() === 'ar' ? 'تم حفظ صورة "قبل" في معرض الصور' : 'Before photo saved to your gallery'));
      }
    });
  }

  $('#closeModal').addEventListener('click', closeModal);
  $('#reportForm').addEventListener('submit', handleReport);
  $('#useLoc').addEventListener('click', async () => {
    try {
      const [lat, lng] = await getLocation();
      $('#latInput').value = lat.toFixed(6);
      $('#lngInput').value = lng.toFixed(6);
      if (mapInited) map.setView([lat, lng], 15);
      showToast(t('location_set'));
    } catch {
      showToast(t('location_fail'));
    }
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  
  // Expose global so realtime.js and map filters can trigger redraws
  window.loadReports = loadReports;
});
