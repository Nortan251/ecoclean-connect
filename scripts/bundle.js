const fs = require('fs');
const path = require('path');

function mergeFiles(files, outputFile) {
  let output = '/* Bundled automatically */\n\n';
  files.forEach(f => {
    output += `/* === ${f} === */\n`;
    output += fs.readFileSync(path.join(__dirname, '..', f), 'utf8') + '\n\n';
  });
  fs.writeFileSync(path.join(__dirname, '..', outputFile), output);
  console.log(`Created ${outputFile} from ${files.length} files.`);
}

// Bundle trust & verification logic for the reporting flow
mergeFiles([
  'js/camera-location.js',
  'js/validation.js',
  'js/photo-trust.js',
  'js/photo-quality.js',
  'js/dup-detect.js',
  'js/trust-system.js'
], 'js/bundle-trust.js');

// Bundle map additions
mergeFiles([
  'js/map-sync.js',
  'js/cluster.js',
  'js/heatmap.js',
  'js/map-place.js',
  'js/compare.js',
  'js/map-filter.js',
  'js/map-empty.js'
], 'js/bundle-map.js');

// Bundle dashboard UI
mergeFiles([
  'js/account-ui.js',
  'js/static-i18n.js',
  'js/my-reports.js',
  'js/streak.js',
  'js/weekly-board.js'
], 'js/bundle-dashboard.js');
