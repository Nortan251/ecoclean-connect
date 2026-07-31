const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

code = code.replace(
  /\/\/ Use shared EcoData[\s\S]*?window\.EcoClean\.reports = reports;/,
  `let reports;
    if (window.EcoClean && window.EcoClean.reports && window.EcoClean.reports.length > 0) {
      reports = window.EcoClean.reports;
    } else if (window.EcoData && EcoData.load) {
      reports = await EcoData.load();
    } else {
      reports = await (await fetch('/api/reports')).json();
      if (window.EcoClean) window.EcoClean.reports = reports;
    }`
);

fs.writeFileSync('js/app.js', code);
