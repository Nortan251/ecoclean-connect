const fs = require('fs');

// 1. Add confetti.js to index, dashboard, admin
['index.html', 'dashboard.html', 'admin.html'].forEach(file => {
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('confetti.js')) {
    html = html.replace(
      /<script src="js\/ecoclean-addons\.js"><\/script>/,
      `<script src="js/ecoclean-addons.js"></script>\n  <script src="js/confetti.js"></script>`
    );
    fs.writeFileSync(file, html);
  }
});

// 2. Trigger Confetti in app.js on Self-Clean
let appJs = fs.readFileSync('js/app.js', 'utf8');
if (!appJs.includes('EcoConfetti.fire()')) {
  appJs = appJs.replace(
    /showToast\('Hero! Clean-up Verified! ✅'\);/,
    `showToast('Hero! Clean-up Verified! ✅');\n      if (window.EcoConfetti) EcoConfetti.fire();`
  );
  fs.writeFileSync('js/app.js', appJs);
}

// 3. Trigger Confetti in admin.js on Verify
let adminJs = fs.readFileSync('js/admin.js', 'utf8');
if (!adminJs.includes('EcoConfetti.fire()')) {
  adminJs = adminJs.replace(
    /showToast\(t\('verified'\)\);/,
    `showToast(t('verified'));\n        if (window.EcoConfetti) EcoConfetti.fire();`
  );
  fs.writeFileSync('js/admin.js', adminJs);
}

// 4. Trigger Confetti in gamification.js on Claim
let gamificationJs = fs.readFileSync('js/gamification.js', 'utf8');
if (!gamificationJs.includes('EcoConfetti.fire()')) {
  gamificationJs = gamificationJs.replace(
    /\.then\(\(\) => render\(\)\)/,
    `.then(() => { render(); if (window.EcoConfetti) EcoConfetti.fire(); })`
  );
  fs.writeFileSync('js/gamification.js', gamificationJs);
}

// 5. Enhance CSS: List staggering, pulse animation for FAB
let css = fs.readFileSync('css/styles.css', 'utf8');
if (!css.includes('@keyframes staggerFade')) {
  css += `

/* --- UI Enhancements & Animations --- */

/* 1. Breathing effect for the main FAB to attract attention */
.fab {
  animation: fab-breathe 3s infinite ease-in-out;
}
@keyframes fab-breathe {
  0%, 100% { box-shadow: 0 6px 16px rgba(13,148,136,.4); transform: translateY(0); }
  50% { box-shadow: 0 12px 24px rgba(13,148,136,.6); transform: translateY(-2px); }
}
.fab:hover { animation: none; }

/* 2. Staggered fade-up for report cards and lists */
.card, .report, .wb-list li, .acu-lb li {
  animation: staggerFade 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
}
.card:nth-child(1), .report:nth-child(1), li:nth-child(1) { animation-delay: 0.05s; }
.card:nth-child(2), .report:nth-child(2), li:nth-child(2) { animation-delay: 0.10s; }
.card:nth-child(3), .report:nth-child(3), li:nth-child(3) { animation-delay: 0.15s; }
.card:nth-child(4), .report:nth-child(4), li:nth-child(4) { animation-delay: 0.20s; }
.card:nth-child(5), .report:nth-child(5), li:nth-child(5) { animation-delay: 0.25s; }
.card:nth-child(6), .report:nth-child(6), li:nth-child(6) { animation-delay: 0.30s; }
.card:nth-child(7), .report:nth-child(n+7), li:nth-child(n+7) { animation-delay: 0.35s; }

@keyframes staggerFade {
  0% { opacity: 0; transform: translateY(15px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* Ensure empty states don't awkwardly animate */
.muted:empty { display: none; }
`;
  fs.writeFileSync('css/styles.css', css);
}

