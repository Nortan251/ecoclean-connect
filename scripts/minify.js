const fs = require('fs');
const path = require('path');
const cssFile = path.join(__dirname, '..', 'css', 'styles.css');

// Extremely simple CSS whitespace stripping
let css = fs.readFileSync(cssFile, 'utf8');
css = css.replace(/\/\*[\s\S]*?\*\//g, '');
css = css.replace(/\s+/g, ' ');
css = css.replace(/\s*{\s*/g, '{');
css = css.replace(/\s*}\s*/g, '}');
css = css.replace(/\s*:\s*/g, ':');
css = css.replace(/\s*;\s*/g, ';');
css = css.replace(/\s*,\s*/g, ',');
css = css.trim();

fs.writeFileSync(path.join(__dirname, '..', 'css', 'styles.min.css'), css);
console.log('Created styles.min.css');

// Replace in HTML
['index.html', 'dashboard.html', 'admin.html', 'impact.html', 'associations.html'].forEach(f => {
  const fp = path.join(__dirname, '..', f);
  let html = fs.readFileSync(fp, 'utf8');
  html = html.replace(/css\/styles\.css\?v=5/g, 'css/styles.min.css?v=6');
  fs.writeFileSync(fp, html);
  console.log('Updated CSS link in', f);
});
