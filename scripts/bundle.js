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

mergeFiles([
  'js/account-ui.js',
  'js/static-i18n.js',
  'js/my-reports.js',
  'js/streak.js',
  'js/weekly-board.js'
], 'js/bundle-dashboard.js');

