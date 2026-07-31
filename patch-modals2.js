const fs = require('fs');

let appJs = fs.readFileSync('js/app.js', 'utf8');
appJs = appJs.replace(
  /const openModal = \(\) => \{ const m = \$\('#reportModal'\); m\.classList\.remove\('hidden'\); m\.classList\.remove\('closing'\); \};/,
  `const openModal = () => { const m = $('#reportModal'); m.classList.remove('hidden'); m.classList.add('closing'); void m.offsetWidth; m.classList.remove('closing'); };`
);
fs.writeFileSync('js/app.js', appJs);

let adminJs = fs.readFileSync('js/admin.js', 'utf8');
adminJs = adminJs.replace(
  /setTimeout\(\(\) => m\.classList\.remove\('hidden'\), 10\);/,
  `m.classList.remove('hidden'); m.classList.add('closing'); void m.offsetWidth; m.classList.remove('closing');`
);
fs.writeFileSync('js/admin.js', adminJs);
