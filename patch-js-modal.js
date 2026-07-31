const fs = require('fs');

function patchFile(file) {
  let js = fs.readFileSync(file, 'utf8');
  
  // App.js Open
  js = js.replace(
    /const openModal = \(\) => \{ const m = \$\('#reportModal'\); m\.classList\.remove\('hidden'\); m\.classList\.add\('closing'\); void m\.offsetWidth; m\.classList\.remove\('closing'\); \};/g,
    `const openModal = () => { const m = $('#reportModal'); m.classList.add('closing'); m.classList.remove('hidden'); requestAnimationFrame(() => { requestAnimationFrame(() => { m.classList.remove('closing'); }); }); };`
  );

  // App.js Close
  js = js.replace(
    /const closeModal = \(\) => \{ const m = \$\('#reportModal'\); m\.classList\.add\('closing'\); setTimeout\(\(\) => \{ m\.classList\.add\('hidden'\); m\.classList\.remove\('closing'\); \}, 300\); \};/g,
    `const closeModal = () => { const m = $('#reportModal'); m.classList.add('closing'); setTimeout(() => { m.classList.add('hidden'); m.classList.remove('closing'); }, 300); };`
  );

  // Admin.js Open
  js = js.replace(
    /m\.classList\.remove\('hidden'\); m\.classList\.add\('closing'\); void m\.offsetWidth; m\.classList\.remove\('closing'\);/g,
    `m.classList.add('closing'); m.classList.remove('hidden'); requestAnimationFrame(() => requestAnimationFrame(() => m.classList.remove('closing')));`
  );

  fs.writeFileSync(file, js);
}

patchFile('js/app.js');
patchFile('js/admin.js');
