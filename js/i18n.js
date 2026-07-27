/* EcoClean Connect — shared i18n (English / French / Arabic)
 * Loaded before app.js / admin.js / dashboard.js on every page. */
(function () {
  const I18N = {
    en: {
      tagline: 'Report pollution. Mobilize your community.',
      nav_dashboard: 'Dashboard', nav_admin: 'Admin',
      btn_open_map: 'Open Map', btn_report: 'Report Pollution',
      hero_sub: 'Crowdsourced pollution reporting for Morocco',
      hero_desc: 'Turn every citizen into a guardian of their neighborhood. Spot pollution, report it in seconds, and watch your community clean up — with real rewards.',
      features_title: 'How it works',
      f1_t: 'Report', f1_d: 'Drop a pin, snap a photo, pick a category. Takes 30 seconds.',
      f2_t: 'Verify', f2_d: 'Community leaders confirm clean-ups with before/after photos.',
      f3_t: 'Reward', f3_d: 'Verified action earns civic reward vouchers.',
      f4_t: 'Mobilize', f4_d: 'Live map and alerts keep the whole neighborhood engaged.',
      report_title: 'Report a pollution site',
      your_name: 'Your name (optional)', your_name_ph: 'Anonymous',
      category: 'Category',
      photo: 'Photo (required)',
      description: 'Description', description_ph: "What's happening here?",
      lat: 'Latitude', lng: 'Longitude',
      use_location: '📍 Use my location',
      submit: 'Submit report',
      submitting: 'Submitting…',
      err_required: '❌ Photo and location are required',
      err_fail: '❌ Submission failed',
      err_network: '❌ Network error. Check connection and retry.',
      location_set: '📍 Location set',
      location_fail: '⚠️ Could not get location',
      success: '✅ Report submitted. Thank you for protecting Morocco!',
      reported: 'Reported', verified: 'Verified ✓', reward: 'Reward issued', no_desc: 'No description',
      admin_access: 'Admin access', admin_key: 'Admin key', enter: 'Enter',
      post_alert: 'Post community alert', alert_title_ph: 'Title', alert_body_ph: 'Message to the community', post_alert_btn: 'Post alert',
      pending: 'Pending verification', verified_title: 'Verified clean-ups', all_caught: 'All caught up 🎉', none_yet: 'None yet',
      after_photo: 'After photo', notes: 'Notes', reward_code: 'Reward code (optional)', verify_btn: 'Verify & issue reward',
      dash_title: 'Dashboard', dash_sub: 'Impact at a glance',
      total_reports: 'Total reports', reported_red: 'Reported (red)', verified_green: 'Verified (green)',
      by_category: 'By category', recent_activity: 'Recent activity', no_reports: 'No reports yet', no_activity: 'No activity yet',
      impact_nav: 'Impact', impact_hero_title: 'Real impact, measured in the open', impact_hero_sub: 'Every report, every clean-up, every citizen — counted live and published for all of Morocco.',
      kpi_total: 'Reports filed', kpi_cleaned: 'Sites cleaned', kpi_kg: 'Waste removed (est.)', kpi_citizens: 'Citizens engaged',
      impact_cat_title: 'Where we’re winning', impact_gal_title: 'Before → After', impact_gal_empty: 'Verified clean-ups with photos will appear here.',
      impact_map_title: 'The clean-up map', impact_cta_title: 'Bring EcoClean to your city', impact_cta_sub: 'Run by an association, a municipality or a student club? EcoClean is built to be deployed city by city across Morocco.', impact_cta_btn: 'Partner with us', impact_method: 'Methodology'
    },
    fr: {
      tagline: 'Signalez la pollution. Mobilisez votre communauté.',
      nav_dashboard: 'Tableau de bord', nav_admin: 'Admin',
      btn_open_map: 'Ouvrir la carte', btn_report: 'Signaler une pollution',
      hero_sub: 'Signalement citoyen de la pollution au Maroc',
      hero_desc: 'Transformez chaque citoyen en gardien de son quartier. Repérez la pollution, signalez-la en quelques secondes et voyez votre communauté se nettoyer — avec de vraies récompenses.',
      features_title: 'Comment ça marche',
      f1_t: 'Signaler', f1_d: 'Déposez une épingle, prenez une photo, choisissez une catégorie. 30 secondes.',
      f2_t: 'Vérifier', f2_d: 'Les leaders communautaires confirment les nettoyages avec des photos avant/après.',
      f3_t: 'Récompenser', f3_d: 'Une action vérifiée rapporte des bons de récompense citoyens.',
      f4_t: 'Mobiliser', f4_d: 'Carte en direct et alertes impliquent tout le quartier.',
      report_title: 'Signaler un site pollué',
      your_name: 'Votre nom (optionnel)', your_name_ph: 'Anonyme',
      category: 'Catégorie',
      photo: 'Photo (requise)',
      description: 'Description', description_ph: "Qu'est-ce qui se passe ici ?",
      lat: 'Latitude', lng: 'Longitude',
      use_location: '📍 Utiliser ma position',
      submit: 'Envoyer le signalement',
      submitting: 'Envoi…',
      err_required: '❌ Photo et localisation requises',
      err_fail: '❌ Échec de l\'envoi',
      err_network: '❌ Erreur réseau. Vérifiez la connexion.',
      location_set: '📍 Position définie',
      location_fail: '⚠️ Position impossible',
      success: '✅ Signalement envoyé. Merci de protéger le Maroc !',
      reported: 'Signalé', verified: 'Vérifié ✓', reward: 'Récompense attribuée', no_desc: 'Aucune description',
      admin_access: 'Accès admin', admin_key: 'Clé admin', enter: 'Entrer',
      post_alert: 'Publier une alerte', alert_title_ph: 'Titre', alert_body_ph: 'Message à la communauté', post_alert_btn: 'Publier',
      pending: 'Vérification en attente', verified_title: 'Nettoyages vérifiés', all_caught: 'Tout est fait 🎉', none_yet: 'Aucun',
      after_photo: 'Photo après', notes: 'Notes', reward_code: 'Code de récompense', verify_btn: 'Vérifier et récompenser',
      dash_title: 'Tableau de bord', dash_sub: 'Impact en un coup d\'œil',
      total_reports: 'Total des signalements', reported_red: 'Signalé (rouge)', verified_green: 'Vérifié (vert)',
      by_category: 'Par catégorie', recent_activity: 'Activité récente', no_reports: 'Aucun signalement', no_activity: 'Aucune activité',
      impact_nav: 'Impact', impact_hero_title: 'Un impact réel, mesuré en toute transparence', impact_hero_sub: 'Chaque signalement, chaque nettoyage, chaque citoyen — comptés en direct et publiés pour tout le Maroc.',
      kpi_total: 'Signalements', kpi_cleaned: 'Sites nettoyés', kpi_kg: 'Déchets retirés (est.)', kpi_citizens: 'Citoyens engagés',
      impact_cat_title: 'Là où nous gagnons', impact_gal_title: 'Avant → Après', impact_gal_empty: 'Les nettoyages vérifiés avec photos apparaîtront ici.',
      impact_map_title: 'La carte des nettoyages', impact_cta_title: 'Amenez EcoClean dans votre ville', impact_cta_sub: 'Géré par une association, une commune ou un club étudiant ? EcoClean est conçu pour être déployé ville par ville au Maroc.', impact_cta_btn: 'Devenez partenaire', impact_method: 'Méthodologie'
    },
    ar: {
      tagline: 'أبلغ عن التلوث. حشّد مجتمعك.',
      nav_dashboard: 'لوحة المعلومات', nav_admin: 'الإدارة',
      btn_open_map: 'فتح الخريطة', btn_report: 'الإبلاغ عن تلوث',
      hero_sub: 'إبلاغ المواطنين عن التلوث في المغرب',
      hero_desc: 'حوّل كل مواطن إلى حارس لحيّه. رصد التلوث وأبلغ عنه في ثوانٍ، وشاهد مجتمعك ينظف المكان — مع مكافآت حقيقية.',
      features_title: 'كيف يعمل',
      f1_t: 'الإبلاغ', f1_d: 'ضع علامة، التقط صورة، اختر الفئة. 30 ثانية.',
      f2_t: 'التحقق', f2_d: 'يؤكد قادة المجتمع عمليات التنظيف بصور قبل وبعد.',
      f3_t: 'المكافأة', f3_d: 'كل عمل مؤكد يكسب قسائم مكافأة للمواطنين.',
      f4_t: 'التعبئة', f4_d: 'خريطة مباشرة وتنبيهات تبقي الحي بأسره منخرطاً.',
      report_title: 'الإبلاغ عن موقع ملوّث',
      your_name: 'اسمك (اختياري)', your_name_ph: 'مجهول',
      category: 'الفئة',
      photo: 'صورة (مطلوبة)',
      description: 'الوصف', description_ph: 'ماذا يحدث هنا؟',
      lat: 'خط العرض', lng: 'خط الطول',
      use_location: '📍 استخدام موقعي',
      submit: 'إرسال البلاغ',
      submitting: 'جارٍ الإرسال…',
      err_required: '❌ الصورة والموقع مطلوبان',
      err_fail: '❌ فشل الإرسال',
      err_network: '❌ خطأ في الشبكة. تحقق من الاتصال.',
      location_set: '📍 تم تحديد الموقع',
      location_fail: '⚠️ تعذر تحديد الموقع',
      success: '✅ تم إرسال البلاغ. شكراً لحماية المغرب!',
      reported: 'تم الإبلاغ', verified: 'تم التحقق ✓', reward: 'تم منح المكافأة', no_desc: 'لا يوجد وصف',
      admin_access: 'الوصول للإدارة', admin_key: 'مفتاح الإدارة', enter: 'دخول',
      post_alert: 'نشر تنبيه مجتمعي', alert_title_ph: 'العنوان', alert_body_ph: 'رسالة للمجتمع', post_alert_btn: 'نشر',
      pending: 'بانتظار التحقق', verified_title: 'عمليات تنظيف مؤكدة', all_caught: 'تم إنجاز كل شيء 🎉', none_yet: 'لا يوجد',
      after_photo: 'صورة بعد', notes: 'ملاحظات', reward_code: 'رمز المكافأة', verify_btn: 'تحقق ومنح المكافأة',
      dash_title: 'لوحة المعلومات', dash_sub: 'الأثر في لمحة',
      total_reports: 'إجمالي البلاغات', reported_red: 'تم الإبلاغ (أحمر)', verified_green: 'مؤكد (أخضر)',
      by_category: 'حسب الفئة', recent_activity: 'النشاط الأخير', no_reports: 'لا بلاغات بعد', no_activity: 'لا نشاط بعد',
      impact_nav: 'الأثر', impact_hero_title: 'أثر حقيقي، مقاس بشفافية', impact_hero_sub: 'كل بلاغ، كل عملية تنظيف، كل مواطن — تُحسب مباشرة وتُنشر لكل المغرب.',
      kpi_total: 'بلاغات مُقدَّمة', kpi_cleaned: 'مواقع منظَّفة', kpi_kg: 'نفايات مُزالة (تقدير)', kpi_citizens: 'مواطنون مشاركون',
      impact_cat_title: 'حيث ننتصر', impact_gal_title: 'قبل ← بعد', impact_gal_empty: 'ستظهر هنا عمليات التنظيف المتحققة مع الصور.',
      impact_map_title: 'خريطة التنظيف', impact_cta_title: 'اجلب EcoClean إلى مدينتك', impact_cta_sub: 'تديرها جمعية أو بلدية أو نادٍ طلابي؟ صُمم EcoClean ليُنشَر مدينةً مدينةً عبر المغرب.', impact_cta_btn: 'كن شريكًا', impact_method: 'المنهجية'
    }
  };

  const CAT_LABELS = {
    en: { illegal_dumping: 'Illegal Dumping', water: 'Water Pollution', air_smoke: 'Air / Smoke', plastic_marine: 'Plastic / Marine', other: 'Other' },
    fr: { illegal_dumping: 'Dépôt sauvage', water: 'Pollution de l\'eau', air_smoke: 'Air / Fumée', plastic_marine: 'Plastique / Marin', other: 'Autre' },
    ar: { illegal_dumping: 'رمي عشوائي', water: 'تلوث المياه', air_smoke: 'هواء / دخان', plastic_marine: 'بلاستيك / بحري', other: 'أخرى' }
  };
  const CATEGORIES = ['illegal_dumping', 'water', 'air_smoke', 'plastic_marine', 'other'];

  const getLang = () => localStorage.getItem('ecoclean_lang') || 'en';
  const setLang = (lang) => {
    localStorage.setItem('ecoclean_lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';
  };
  const t = (key) => {
    const lang = getLang();
    if (I18N[lang] && I18N[lang][key] !== undefined) return I18N[lang][key];
    return I18N.en[key] !== undefined ? I18N.en[key] : key;
  };
  const catLabel = (key) => {
    const lang = getLang();
    return (CAT_LABELS[lang] && CAT_LABELS[lang][key]) || CAT_LABELS.en[key] || key;
  };
  const applyI18n = (root) => {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
    root.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
  };
  const populateCategories = (select) => {
    if (!select) return;
    select.innerHTML = '';
    CATEGORIES.forEach((c) => {
      const o = document.createElement('option');
      o.value = c; o.textContent = catLabel(c);
      select.appendChild(o);
    });
  };

  window.I18N = I18N; window.CAT_LABELS = CAT_LABELS; window.CATEGORIES = CATEGORIES;
  window.getLang = getLang; window.setLang = setLang; window.t = t;
  window.catLabel = catLabel; window.applyI18n = applyI18n; window.populateCategories = populateCategories;
})();
