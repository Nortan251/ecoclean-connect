// EcoClean Connect — citizen app logic
const MAP_CENTER = [33.5731, -7.5898]; // Casablanca (pilot city)
let map, markerLayer;
const $ = (s) => document.querySelector(s);

const CATEGORY_LABELS = {
  illegal_dumping: 'Illegal Dumping',
  water: 'Water Pollution',
  air_smoke: 'Air / Smoke',
  plastic_marine: 'Plastic / Marine',
  other: 'Other',
};
const label = (c) => CATEGORY_LABELS[c] || c;
const escapeHtml = (s) =>
  (s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

function initMap() {
  map = L.map('map').setView(MAP_CENTER, 13);
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

function popupHtml(r) {
  const date = new Date(r.createdAt).toLocaleString();
  const before = `<img src="${r.beforePhoto}" alt="before" class="pop-img" />`;
  const after = r.afterPhoto ? `<img src="${r.afterPhoto}" alt="after" class="pop-img" />` : '';
  const reward = r.rewardIssued
    ? `<p class="reward">🎁 Reward issued: <b>${escapeHtml(r.rewardCode)}</b></p>`
    : '';
  const badge =
    r.status === 'verified'
      ? '<span class="badge green">Verified ✓</span>'
      : '<span class="badge red">Reported</span>';
  return `<div class="popup">
    <div>${badge} <b>${label(r.category)}</b></div>
    <p>${escapeHtml(r.description) || '<i>No description</i>'}</p>
    <div class="pop-imgs">${before}${after}</div>
    ${reward}
    <small>${date}</small>
  </div>`;
}

async function loadReports() {
  const res = await fetch('/api/reports');
  const reports = await res.json();
  markerLayer.clearLayers();
  reports.forEach((r) => {
    L.circleMarker([r.lat, r.lng], pinStyle(r.status))
      .addTo(markerLayer)
      .bindPopup(popupHtml(r));
  });
}

async function loadAlerts() {
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
}

function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
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
  msg.textContent = 'Submitting…';
  const fd = new FormData(form);
  try {
    const res = await fetch('/api/reports', { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      msg.textContent = '❌ ' + (err.error || 'Submission failed');
      return;
    }
    msg.textContent = '';
    form.reset();
    closeModal();
    await loadReports();
    showToast('✅ Report submitted. Thank you for protecting Morocco!');
  } catch {
    msg.textContent = '❌ Network error. Check connection and retry.';
  }
}

const openModal = () => {
  $('#reportModal').classList.remove('hidden');
  setTimeout(() => map && map.invalidateSize(), 50);
};
const closeModal = () => $('#reportModal').classList.add('hidden');

window.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadReports();
  loadAlerts();
  $('#reportBtn').addEventListener('click', openModal);
  $('#closeModal').addEventListener('click', closeModal);
  $('#reportForm').addEventListener('submit', handleReport);
  $('#useLoc').addEventListener('click', async () => {
    try {
      const [lat, lng] = await getLocation();
      $('#latInput').value = lat.toFixed(6);
      $('#lngInput').value = lng.toFixed(6);
      map.setView([lat, lng], 15);
      showToast('📍 Location set');
    } catch {
      showToast('⚠️ Could not get location — enter lat/lng manually');
    }
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
});
