const fs = require('fs');

let appJs = fs.readFileSync('js/app.js', 'utf8');

appJs = appJs.replace(
  /const file = form\.photo\.files\[0\];/,
  `const btn = form.querySelector('button[type="submit"]');
  const file = form.photo.files[0];`
);

appJs = appJs.replace(
  /msg\.textContent = t\('submitting'\);/,
  `msg.textContent = t('submitting');
  const ogText = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('submitting');`
);

appJs = appJs.replace(
  /msg\.textContent = '❌ ' \+ \(err\.error \|\| t\('err_fail'\)\);\n      return;/,
  `msg.textContent = '❌ ' + (err.error || t('err_fail'));
      btn.disabled = false;
      btn.textContent = ogText;
      return;`
);

appJs = appJs.replace(
  /msg\.textContent = t\('err_network'\);\n  \}/,
  `msg.textContent = t('err_network');
  } finally {
    if (btn.disabled) {
      btn.disabled = false;
      btn.textContent = ogText;
    }
  }`
);

fs.writeFileSync('js/app.js', appJs);
