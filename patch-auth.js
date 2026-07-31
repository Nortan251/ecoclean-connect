const fs = require('fs');

let authJs = fs.readFileSync('js/auth.js', 'utf8');

authJs = authJs.replace(
  /const dn = f\.displayName \? f\.displayName\.value\.trim\(\) : '';/,
  `const dn = f.displayName ? f.displayName.value.trim() : '';
      const btn = f.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;`
);

authJs = authJs.replace(
  /if \(\!email\) \{ setMsg\(false, t\('f_email'\)\); return; \}/,
  `if (!email) { setMsg(false, t('f_email')); if (btn) btn.disabled = false; return; }`
);

authJs = authJs.replace(
  /if \(\!c\) \{ setMsg\(false, t\('msg_unavail'\)\); return; \}/g,
  `if (!c) { setMsg(false, t('msg_unavail')); if (btn) btn.disabled = false; return; }`
);

authJs = authJs.replace(
  /if \(error\) \{ setMsg\(false, error\.message\); return; \}/g,
  `if (error) { setMsg(false, error.message); if (btn) btn.disabled = false; return; }`
);

authJs = authJs.replace(
  /if \(password !== f\.confirm\.value\) \{ setMsg\(false, t\('err_pw_match'\)\); return; \}/,
  `if (password !== f.confirm.value) { setMsg(false, t('err_pw_match')); if (btn) btn.disabled = false; return; }`
);

fs.writeFileSync('js/auth.js', authJs);
