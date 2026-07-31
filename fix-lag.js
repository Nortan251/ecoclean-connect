const fs = require('fs');

// Patch 1: Make setInterval respect document.visibilityState globally
const ecocleanAddons = fs.readFileSync('js/ecoclean-addons.js', 'utf8');
if (!ecocleanAddons.includes('originalSetInterval')) {
  fs.writeFileSync('js/ecoclean-addons.js', ecocleanAddons + `

// Performance: prevent background tabs from CPU/Network thrashing
const originalSetInterval = window.setInterval;
window.setInterval = function(fn, delay, ...args) {
  return originalSetInterval(() => {
    if (!document.hidden) fn(...args);
  }, delay);
};
`);
}

// Patch 2: Debounce loadReports so map doesn't flash if multiple realtime events come
const appJs = fs.readFileSync('js/app.js', 'utf8');
if (!appJs.includes('loadReportsDebounced')) {
  const newApp = appJs.replace(
    'async function loadReports() {',
    `let _lrTimer=null; async function loadReports() { if(_lrTimer) clearTimeout(_lrTimer); return new Promise(r => { _lrTimer = setTimeout(() => _doLoadReports().then(r), 100); }); } async function _doLoadReports() {`
  );
  fs.writeFileSync('js/app.js', newApp);
}
