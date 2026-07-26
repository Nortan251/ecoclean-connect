/* static-i18n.js — localize leftover hardcoded strings (dashboard + admin) that were
 * never wired to data-i18n, so FR/AR switches fully translate the page. The Open
 * Data card is included here too (via stable selectors) because its own module's
 * language listener was not reliably re-firing on every language change — routing
 * it through this proven, always-firing path guarantees it translates in AR/FR.
 * Self-contained (no edit to the shared i18n dictionary); applies on load + on
 * every language change. The analytics card title is owned by analytics.js. */
(function () {
  'use strict';
  var L = {
    en: { wallet: 'Reward Wallet', quests: 'Weekly Quests', leaders: 'Neighborhood Leaderboard', open_title: 'Open data', open_note: 'Export every report as open data for journalists, NGOs or your municipality.', open_csv: 'Download CSV', open_geo: 'Download GeoJSON', admin_panel: 'Admin Panel', after_cleanup: 'After Cleanup photo', dispatch: 'Cleanup Dispatch', group: 'Group active (2km)', after_photo: 'After photo' },
    fr: { wallet: 'Portefeuille de récompenses', quests: 'Quêtes hebdomadaires', leaders: 'Classement du quartier', open_title: 'Données ouvertes', open_note: 'Exportez tous les signalements en données ouvertes pour journalistes, ONG ou municipalité.', open_csv: 'Télécharger CSV', open_geo: 'Télécharger GeoJSON', admin_panel: 'Panneau admin', after_cleanup: 'Photo après nettoyage', dispatch: 'Affectation de nettoyage', group: 'Grouper actifs (2km)', after_photo: 'Photo après' },
    ar: { wallet: 'محفظة المكافآت', quests: 'مهام أسبوعية', leaders: 'ترتيب الحي', open_title: 'بيانات مفتوحة', open_note: 'صدّر كل البلاغات كبيانات مفتوحة للصحفيين أو الجمعيات أو البلدية.', open_csv: 'تنزيل CSV', open_geo: 'تنزيل GeoJSON', admin_panel: 'لوحة الإدارة', after_cleanup: 'صورة بعد التنظيف', dispatch: 'توزيع التنظيف', group: 'تجميع النشط (٢ كم)', after_photo: 'صورة بعد' },
  };
  var lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');
  var dash = [
    ['#wallet > h2', 'wallet'], ['#questsBox > h2', 'quests'], ['#lbBox > h2', 'leaders'],
    ['#exportCard > h2', 'open_title'], ['#exportCard > p', 'open_note'], ['#expCsv', 'open_csv'], ['#expGeo', 'open_geo'],
  ];
  var admin = [['.app-header h1', 'admin_panel'], ['#verifyExtras > h2', 'after_cleanup'], ['#dispatch > h2', 'dispatch'], ['#clusterBtn', 'group'], ['#verifyExtras label span', 'after_photo']];
  function apply() {
    var d = L[lang()] || L.en;
    dash.forEach(function (p) { var el = document.querySelector(p[0]); if (el) el.textContent = d[p[1]]; });
    if (document.querySelector('.admin-main')) admin.forEach(function (p) { var el = document.querySelector(p[0]); if (el) el.textContent = d[p[1]]; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'langSelect') apply(); });
})();
