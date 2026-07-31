const fs = require('fs');

let code = fs.readFileSync('js/admin.js', 'utf8');

code = code.replace(
  /const notes = card\.querySelector\('\.notes'\)\.value \|\| 'Rejected as spam';/,
  `const notes = card.querySelector('.notes').value || 'Rejected as spam';
      const ogText = btn.textContent;
      btn.disabled = true;
      btn.textContent = '...';
      try {`
);

code = code.replace(
  /showToast\('Error rejecting report'\);\n      \}/,
  `showToast('Error rejecting report');
      }
      } catch(err) { showToast('Network error'); } finally { if(btn) { btn.disabled = false; btn.textContent = ogText; } }`
);

code = code.replace(
  /if \(af\) \{\n\s*try \{ payload\.photo = await fileToResizedDataUrl\(af\); \} catch \(err\) \{\}\n\s*\}/,
  `if (af) {
        try { payload.photo = await fileToResizedDataUrl(af); } catch (err) {}
      }
      const ogText = btn.textContent;
      btn.disabled = true;
      btn.textContent = '...';
      try {`
);

code = code.replace(
  /alert\('Verify failed'\);\n\s*\}/,
  `alert('Verify failed');
      }
      } catch(err) { alert('Network error'); } finally { if(btn) { btn.disabled = false; btn.textContent = ogText; } }`
);

fs.writeFileSync('js/admin.js', code);
