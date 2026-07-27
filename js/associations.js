/* ============================================================================
 * associations.js — the public "Our network" page (the multi-city proof)
 * ----------------------------------------------------------------------------
 * This is the page that answers a committee's first real question: "does this
 * scale beyond one pilot?" It lists every partner ASSOCIATION, per city, each with
 * its OWN live stats — so the multi-tenant model stops being a diagram and becomes
 * a roster. It is fully public (no login): the association list rides inside the
 * public /api/stats response (so we add NO serverless function — Hobby cap = 12),
 * and each city's numbers are computed CLIENT-SIDE from /api/reports by testing
 * report coordinates against the association's city radius (same bounding-box idea
 * the server uses to scope an association admin, mirrored here for display).
 * That mirroring is deliberate and worth naming: the public page and the admin's
 * enforced view agree on "which reports belong to a city", so the marketing numbers
 * can't drift from the operational truth.
 * ==========================================================================*/
(function () {
  'use strict';
  var T = function (k) { return (typeof window.t === 'function') ? window.t(k) : k; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };

  function inCity(r, a) {
    if (r.lat == null || r.lng == null || a.lat == null || a.lng == null) return false;
    var rad = a.radius_km || 25;
    var dLat = Math.abs(r.lat - a.lat), dLng = Math.abs(r.lng - a.lng);
    return dLat <= (rad / 111.0) && dLng <= (rad / Math.max(1, 111.0 * Math.cos(a.lat * Math.PI / 180)));
  }
  function statsFor(reports, a) {
    var total = 0, verified = 0, people = {};
    reports.forEach(function (r) {
      if (!inCity(r, a)) return;
      total++;
      if (r.status === 'verified') verified++;
      var nm = (r.reporterName || '').trim();
      if (nm && nm.toLowerCase() !== 'anonymous') people[nm.toLowerCase()] = 1;
    });
    return { total: total, verified: verified, citizens: Object.keys(people).length };
  }

  function renderNetworkTotals(assocs, reports) {
    var totR = 0, totV = 0;
    assocs.forEach(function (a) { var s = statsFor(reports, a); totR += s.total; totV += s.verified; });
    var box = document.getElementById('assocNetStats'); if (!box) return;
    var items = [
      [assocs.length, T('net_kpi_cities')],
      [totR, T('net_kpi_reports')],
      [totV, T('net_kpi_cleaned')],
    ];
    box.innerHTML = items.map(function (it) { return '<div class="ans"><b>' + it[0] + '</b><span>' + esc(it[1]) + '</span></div>'; }).join('');
  }

  function renderGrid(assocs, reports) {
    var grid = document.getElementById('assocGrid'); if (!grid) return;
    if (!assocs.length) { grid.innerHTML = '<p class="assoc-empty">' + esc(T('net_empty')) + '</p>'; return; }
    grid.innerHTML = assocs.map(function (a) {
      var s = statsFor(reports, a);
      return '<article class="assoc-card">' +
        '<div class="ac-head"><span class="ac-city">📍 ' + esc(a.city) + '</span></div>' +
        '<h3>' + esc(a.name) + '</h3>' +
        '<div class="ac-stats">' +
          '<div><b>' + s.total + '</b><span>' + esc(T('net_card_reports')) + '</span></div>' +
          '<div><b>' + s.verified + '</b><span>' + esc(T('net_card_cleaned')) + '</span></div>' +
          '<div><b>' + s.citizens + '</b><span>' + esc(T('net_card_citizens')) + '</span></div>' +
        '</div>' +
        (a.contact_email ? '<a class="ac-contact" href="mailto:' + esc(a.contact_email) + '"></a>' : '') +
        '</article>';
    }).join('');
    grid.querySelectorAll('.ac-contact').forEach(function (el) { el.textContent = T('net_card_contact'); });
  }

  function wirePartner() {
    var a = document.getElementById('assocPartner'); if (!a) return;
    var subj = encodeURIComponent('Join the EcoClean network');
    var body = encodeURIComponent('Hello,\n\nWe would like to bring EcoClean Connect to our city.\n\nOrganisation:\nCity:\nContact:\n');
    a.href = 'mailto:contact@ecoclean-connect.org?subject=' + subj + '&body=' + body;
  }

  function load() {
    if (typeof window.applyI18n === 'function') window.applyI18n(document);
    Promise.all([
      fetch('/api/stats', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }),
      fetch('/api/reports', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : []; }),
    ]).then(function (res) {
      var assocs = (res[0] && res[0].associations) || [];
      var reports = res[1] || [];
      renderNetworkTotals(assocs, reports);
      renderGrid(assocs, reports);
      wirePartner();
    }).catch(function () {});
  }

  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'langSelect') { if (typeof window.setLang === 'function') window.setLang(e.target.value); load(); } });

  if (!document.getElementById('eco-assoc-style')) {
    var st = document.createElement('style'); st.id = 'eco-assoc-style';
    st.textContent =
      '.assoc{max-width:1000px;margin:0 auto;padding:22px 18px 60px;}' +
      '.assoc-hero{text-align:center;padding:34px 14px 8px;}' +
      '.assoc-badge{display:inline-block;background:var(--accent-soft,#e8f3ec);color:var(--accent-dark,#0a5c3f);font-weight:800;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;padding:6px 14px;border-radius:999px;}' +
      '.assoc-hero h1{margin:14px 0 8px;font-size:clamp(1.6rem,5vw,2.5rem);font-weight:800;letter-spacing:-.02em;color:var(--text,#14241d);}' +
      '.assoc-hero p{max-width:640px;margin:0 auto;color:var(--muted,#5d7268);font-size:1.02rem;line-height:1.6;}' +
      '.assoc-netstats{display:flex;justify-content:center;gap:30px;margin:22px 0 6px;flex-wrap:wrap;}' +
      '.assoc-netstats .ans{text-align:center;}' +
      '.assoc-netstats .ans b{display:block;font-size:1.9rem;font-weight:800;background:linear-gradient(135deg,var(--accent,#198754),var(--accent-2,#0d9488));-webkit-background-clip:text;background-clip:text;color:transparent;}' +
      '.assoc-netstats .ans span{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#5d7268);}' +
      '.assoc-block{margin:26px 0;}.assoc-block h2{font-size:1.18rem;font-weight:800;color:var(--text,#14241d);margin:0 0 14px;}' +
      '.assoc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;}' +
      '.assoc-card{background:var(--surface,#fff);border:1px solid var(--border,#e3ece7);border-radius:16px;padding:18px 16px;box-shadow:var(--shadow,0 6px 18px rgba(16,40,30,.06));display:flex;flex-direction:column;}' +
      '.assoc-card .ac-city{font-size:.74rem;font-weight:700;color:var(--accent-dark,#0a5c3f);background:var(--accent-soft,#e8f3ec);padding:3px 10px;border-radius:99px;}' +
      '.assoc-card h3{margin:10px 0 12px;font-size:1.06rem;font-weight:800;color:var(--text,#14241d);}' +
      '.assoc-card .ac-stats{display:flex;gap:8px;margin-bottom:12px;}' +
      '.assoc-card .ac-stats>div{flex:1;text-align:center;background:var(--surface-2,#eef7f2);border-radius:10px;padding:8px 4px;}' +
      '.assoc-card .ac-stats b{display:block;font-size:1.15rem;font-weight:800;color:var(--text,#14241d);}' +
      '.assoc-card .ac-stats span{font-size:.62rem;font-weight:600;text-transform:uppercase;letter-spacing:.03em;color:var(--muted,#5d7268);}' +
      '.assoc-card .ac-contact{margin-top:auto;font-size:.8rem;font-weight:700;color:var(--accent-2,#0d9488);text-decoration:none;}' +
      '.assoc-empty{color:var(--muted,#5d7268);}' +
      '.assoc-cta{margin:34px 0 0;text-align:center;background:var(--header-grad,linear-gradient(135deg,rgba(25,135,84,.92),rgba(13,148,136,.92)));color:#fff;border-radius:22px;padding:32px 22px;}' +
      '.assoc-cta h2{color:#fff;margin:0 0 8px;font-size:1.4rem;}.assoc-cta p{color:rgba(255,255,255,.92);max-width:560px;margin:0 auto 16px;line-height:1.6;}' +
      '.assoc-cta .primary-btn{background:#fff;color:var(--accent-dark,#0a5c3f);box-shadow:0 8px 22px rgba(0,0,0,.22);}';
    document.head.appendChild(st);
  }

  function boot() { load(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
