// EcoClean Connect — citizen app logic (landing + map + i18n)
const MAP_CENTER = [33.5731, -7.5898]; // Casablanca (pilot city)
let map, markerLayer, mapInited = false;
const $ = (s) => document.querySelector(s);

function initMap() {
  map = L.map('map', { zoomControl: true }).setView(MAP_CENTER, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  $('#latInput').value = MAP_CENTER[0];
  $('#lngInput').value = MAP_CENTER[1];
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

async function loadReports() {
  if (!mapInited) return;
  try {
    const res = await fetch('/api/reports');
    const reports = await res.json();
    markerLayer.clearLayers();
    reports.forEach((r) => {
      L.circleMarker([r.lat, r.lng], pinStyle(r.status))
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

async function handleReport(e) {
  e.preventDefault();
  const form = e.target;
  const msg = $('#formMsg');
  const fd = new FormData(form);
  if (!fd.get('photo') || !fd.get('lat') || !fd.get('lng')) {
    msg.textContent = t('err_required');
    return;
  }
  msg.textContent = t('submitting');
  try {
    const res = await fetch('/api/reports', { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      msg.textContent = '❌ ' + (err.error || t('err_fail'));
      return;
    }
    form.reset();
    populateCategories($('#categorySelect'));
    closeModal();
    await loadReports();
    showToast(t('success'));
  } catch (err) {
    msg.textContent = t('err_network');
  }
}

const openModal = () => {
  $('#reportModal').classList.remove('hidden');
  if (mapInited) setTimeout(() => map.invalidateSize(), 50);
};
const closeModal = () => $('#reportModal').classList.add('hidden');

function showMap() {
  $('#landing').classList.add('hidden');
  $('#mapView').classList.remove('hidden');
  $('#reportBtn').classList.remove('hidden');
  if (!mapInited) {
    initMap();
    mapInited = true;
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
});
