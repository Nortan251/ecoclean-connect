const fs = require('fs');
let code = fs.readFileSync('js/admin.js', 'utf8');

code = code.replace(
  /loadAdminContext\(\);\n\s*load\(\); \/\/ Force load the data now that we know they are allowed in/,
  `loadAdminContext();
    if (!window._adminLoadedOnce) {
      window._adminLoadedOnce = true;
      load(); // Load the data only once
    }`
);

fs.writeFileSync('js/admin.js', code);
