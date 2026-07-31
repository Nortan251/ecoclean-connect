const fs = require('fs');
let code = fs.readFileSync('css/styles.css', 'utf8');

code = code.replace(
  /\.modal\.hidden \{ visibility: hidden; opacity: 0; pointer-events: none; \}/,
  `.modal.hidden { display: none !important; opacity: 0; pointer-events: none; }
.modal.closing { opacity: 0; pointer-events: none; }
.modal.closing .modal-card { transform: translateY(100%); }`
);

code = code.replace(
  /\.modal\.hidden \.modal-card \{ transform: translateY\(100\%\); \}/,
  ``
);

fs.writeFileSync('css/styles.css', code);
