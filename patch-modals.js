const fs = require('fs');

let appJs = fs.readFileSync('js/app.js', 'utf8');
appJs = appJs.replace(
  /const openModal = \(\) => \$\('#reportModal'\)\.classList\.remove\('hidden'\);/,
  `const openModal = () => { const m = $('#reportModal'); m.classList.remove('hidden'); m.classList.remove('closing'); };`
);
appJs = appJs.replace(
  /const closeModal = \(\) => \$\('#reportModal'\)\.classList\.add\('hidden'\);/,
  `const closeModal = () => { const m = $('#reportModal'); m.classList.add('closing'); setTimeout(() => { m.classList.add('hidden'); m.classList.remove('closing'); }, 300); };`
);
fs.writeFileSync('js/app.js', appJs);

let adminJs = fs.readFileSync('js/admin.js', 'utf8');
adminJs = adminJs.replace(
  /m\.classList\.add\('hidden'\);\n\s*setTimeout\(\(\) => m\.remove\(\), 300\);/,
  `m.classList.add('closing');\n    setTimeout(() => { m.classList.add('hidden'); m.remove(); }, 300);`
);
fs.writeFileSync('js/admin.js', adminJs);
