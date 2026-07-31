const fs = require('fs');
let code = fs.readFileSync('js/admin.js', 'utf8');

code = code.replace(
  /<button class="primary-btn verify-btn" style="flex:1;margin-top:0;" data-i18n="verify_btn">Verify & issue reward<\/button>/,
  `<button class="primary-btn verify-btn" style="flex:1;margin-top:0;display:flex;align-items:center;justify-content:center;gap:6px;" data-i18n="verify_btn"><span aria-hidden="true" style="font-size:1.1rem">✅</span> Verify</button>`
);

fs.writeFileSync('js/admin.js', code);
