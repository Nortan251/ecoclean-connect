const fs = require('fs');
let code = fs.readFileSync('css/styles.css', 'utf8');

code = code.replace(
  /\.modal\.hidden \{ display: flex !important; opacity: 0; pointer-events: none; \}/,
  `.modal.hidden { visibility: hidden; opacity: 0; pointer-events: none; }`
);

fs.writeFileSync('css/styles.css', code);
