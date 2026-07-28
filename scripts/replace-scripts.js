const fs = require('fs');
const path = require('path');

function replaceInHtml(htmlFile, removeList, addScript) {
  let content = fs.readFileSync(path.join(__dirname, '..', htmlFile), 'utf8');
  let firstFound = false;
  let insertPos = 0;

  removeList.forEach(file => {
    const scriptTag = `<script src="${file}"></script>`;
    if (content.includes(scriptTag)) {
      if (!firstFound) {
        insertPos = content.indexOf(scriptTag);
        firstFound = true;
      }
      content = content.replace(scriptTag + '\n', '');
      content = content.replace(scriptTag, '');
    }
  });

  if (firstFound && addScript) {
    const tag = `<script src="${addScript}"></script>\n`;
    content = content.slice(0, insertPos) + tag + content.slice(insertPos);
  }

  fs.writeFileSync(path.join(__dirname, '..', htmlFile), content);
  console.log(`Updated ${htmlFile}`);
}

replaceInHtml('index.html', [
  'js/camera-location.js',
  'js/validation.js',
  'js/photo-trust.js',
  'js/photo-quality.js',
  'js/dup-detect.js',
  'js/trust-system.js'
], 'js/bundle-trust.js');

replaceInHtml('index.html', [
  'js/map-sync.js',
  'js/cluster.js',
  'js/heatmap.js',
  'js/map-place.js',
  'js/compare.js',
  'js/map-filter.js',
  'js/map-empty.js'
], 'js/bundle-map.js');

replaceInHtml('dashboard.html', [
  'js/account-ui.js',
  'js/static-i18n.js',
  'js/my-reports.js',
  'js/streak.js',
  'js/weekly-board.js'
], 'js/bundle-dashboard.js');
