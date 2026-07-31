const fs = require('fs');

let code = fs.readFileSync('js/admin.js', 'utf8');

code = code.replace(
  /async function postAlert\(\) \{[\s\S]*?showToast\(t\('post_alert_btn'\)\);\n  \}\n\}/,
  `async function postAlert() {
  const title = $('#alertTitle').value.trim();
  if (!title) return;
  const btn = $('#postAlert');
  const ogText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '...';
  try {
    const r = await api('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body: $('#alertBody').value.trim() }),
    });
    if (r.ok) {
      $('#alertTitle').value = '';
      $('#alertBody').value = '';
      showToast(t('post_alert_btn'));
    } else {
      showToast('Error posting alert');
    }
  } catch (err) {
    showToast('Network error');
  } finally {
    btn.disabled = false;
    btn.textContent = ogText;
  }
}`
);

fs.writeFileSync('js/admin.js', code);
