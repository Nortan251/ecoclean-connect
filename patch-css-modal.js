const fs = require('fs');

let css = fs.readFileSync('css/styles.css', 'utf8');

// Completely rip out the problematic modal hidden CSS
css = css.replace(
  /\.modal\.hidden \{ display: flex !important; opacity: 0; pointer-events: none; \}/,
  `.modal.closing { opacity: 0; pointer-events: none; }\n.modal.closing .modal-card { transform: translateY(100%); }`
);

// Ensure .modal.hidden .modal-card is removed
css = css.replace(
  /\.modal\.hidden \.modal-card \{ transform: translateY\(100\%\); \}/g,
  ``
);

fs.writeFileSync('css/styles.css', css);
