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
      impact_cat_title: 'Where we’re winning', impact_how_title: 'How EcoClean works', impact_step1_t: 'Citizens report', impact_step1_d: 'Anyone drops a pin, snaps a photo and picks a category — in about 30 seconds, from any phone.', impact_step2_t: 'Your association verifies', impact_step2_d: 'Your team logs in, sees only your city, confirms clean-ups with a before/after photo and rewards the citizen.', impact_step3_t: 'The city sees the impact', impact_step3_d: 'Every verified clean-up updates this dashboard live — proof you can show funders, the municipality and the press.', impact_demo_note: 'Live demo: the before/after gallery shows real clean-up photos once the platform runs with a partner — the verification flow that feeds it is already built.',
      impact_map_title: 'The clean-up map', impact_cta_title: 'Bring EcoClean to your city', impact_cta_sub: 'Run by an association, a municipality or a student club? EcoClean is built to be deployed city by city across Morocco.', impact_cta_btn: 'Partner with us', impact_method: 'Methodology',
      impact_net: '{cities} cities · {orgs} associations on the network', impact_net_link: 'See the network →', impact_updated: 'Last updated',
      net_nav: 'Network', net_hero_title: 'A network of associations, city by city', net_hero_sub: 'One platform, deployed city by city. Each partner runs its own city; together they form a national clean-up movement.',
      net_kpi_cities: 'Cities', net_kpi_reports: 'Reports', net_kpi_cleaned: 'Cleaned', net_orgs_title: 'Active partners', net_empty: 'No partner associations yet — be the first.',
      net_card_reports: 'reports', net_card_cleaned: 'cleaned', net_card_citizens: 'citizens', net_card_contact: 'Contact this partner', net_cta_title: 'Your city isn’t here yet?', net_cta_sub: 'EcoClean is built to onboard a new city in days, not months. If you run an association, a municipality or a student club, let’s talk.',
      partner_open: '🤝 Become a partner',
      empty_dash_title: 'Your dashboard is ready', empty_dash_sub: 'No activity yet. Submit the first report from the map and your impact, points and quests will appear here.', empty_dash_btn: 'Open the map & report',
      empty_impact_title: 'This is EcoClean Connect', empty_impact_sub: 'A live demo with a partner association will fill these counters, the map and the network with real clean-ups. The platform that powers it is fully built — explore how it works below.', empty_map: 'No reports on the map yet — be the first to drop a pin and protect your neighborhood.',
      admin_sum_total: 'Total', admin_sum_pending: 'Pending', admin_sum_verified: 'Verified', admin_empty: 'No reports in your scope yet. As citizens report pollution, they’ll appear here for verification.',
      partner_open: '🤝 Become a partner'
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
      impact_cat_title: 'Là où nous gagnons', impact_how_title: 'Comment EcoClean fonctionne', impact_step1_t: 'Les citoyens signalent', impact_step1_d: 'Chacun dépose un repère, prend une photo et choisit une catégorie — en ~30 secondes, depuis n’importe quel téléphone.', impact_step2_t: 'Votre association vérifie', impact_step2_d: 'Votre équipe se connecte, ne voit que sa ville, confirme les nettoyages avec une photo avant/après et récompense le citoyen.', impact_step3_t: 'La ville voit l’impact', impact_step3_d: 'Chaque nettoyage vérifié met ce tableau à jour en direct — une preuve pour les financeurs, la commune et la presse.', impact_demo_note: 'Démo : la galerie avant/après affichera de vraies photos de nettoyage dès que la plateforme tournera avec un partenaire — le flux de vérification qui l’alimente est déjà construit.',
      impact_map_title: 'La carte des nettoyages', impact_cta_title: 'Amenez EcoClean dans votre ville', impact_cta_sub: 'Géré par une association, une commune ou un club étudiant ? EcoClean est conçu pour être déployé ville par ville au Maroc.', impact_cta_btn: 'Devenez partenaire', impact_method: 'Méthodologie',
      impact_net: '{cities} villes · {orgs} associations sur le réseau', impact_net_link: 'Voir le réseau →', impact_updated: 'Dernière mise à jour',
      net_nav: 'Réseau', net_hero_title: 'Un réseau d’associations, ville par ville', net_hero_sub: 'Une plateforme, déployée ville par ville. Chaque partenaire gère sa ville ; ensemble, ils forment un mouvement national de nettoyage.',
      net_kpi_cities: 'Villes', net_kpi_reports: 'Signalements', net_kpi_cleaned: 'Nettoyés', net_orgs_title: 'Partenaires actifs', net_empty: 'Aucune association partenaire pour l’instant — soyez le premier.',
      net_card_reports: 'signalements', net_card_cleaned: 'nettoyés', net_card_citizens: 'citoyens', net_card_contact: 'Contacter ce partenaire', net_cta_title: 'Votre ville n’y est pas encore ?', net_cta_sub: 'EcoClean est conçu pour intégrer une nouvelle ville en quelques jours. Si vous gérez une association, une commune ou un club étudiant, parlons-en.',
      partner_open: '🤝 Devenir partenaire',
      empty_dash_title: 'Votre tableau est prêt', empty_dash_sub: 'Aucune activité pour l’instant. Soumettez le premier signalement depuis la carte ; votre impact, vos points et vos quêtes apparaîtront ici.', empty_dash_btn: 'Ouvrir la carte et signaler',
      empty_impact_title: 'Voici EcoClean Connect', empty_impact_sub: 'Une démo en direct avec une association partenaire remplira ces compteurs, la carte et le réseau de vrais nettoyages. La plateforme qui les anime est entièrement construite — découvrez son fonctionnement ci-dessous.', empty_map: 'Aucun signalement sur la carte pour l’instant — soyez le premier à déposer un repère.',
      admin_sum_total: 'Total', admin_sum_pending: 'En attente', admin_sum_verified: 'Vérifiés', admin_empty: 'Aucun signalement dans votre périmètre pour l’instant. Dès que des citoyens signalent, ils apparaîtront ici pour vérification.',
      partner_open: '🤝 Devenir partenaire'
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
      impact_cat_title: 'حيث ننتصر', impact_how_title: 'كيف يعمل EcoClean', impact_step1_t: 'المواطنون يبلّغون', impact_step1_d: 'أي شخص يضع دبوسًا ويلتقط صورة ويختار فئة — في نحو 30 ثانية، من أي هاتف.', impact_step2_t: 'جمعيتك تتحقّق', impact_step2_d: 'فريقك يسجّل الدخول، يرى مدينته فقط، يؤكّد عمليات التنظيف بصورة قبل/بعد ويكافئ المواطن.', impact_step3_t: 'المدينة ترى الأثر', impact_step3_d: 'كل عملية تنظيف متحققة تحدّث هذه اللوحة مباشرة — دليل تُظهره للمموّلين والبلدية والصحافة.', impact_demo_note: 'عرض تجريبي: معرض قبل/بعد سيعرض صور تنظيف حقيقية حين تعمل المنصة مع شريك — تدفق التحقق الذي يغذّيه مبنيّ بالفعل.',
      impact_map_title: 'خريطة التنظيف', impact_cta_title: 'اجلب EcoClean إلى مدينتك', impact_cta_sub: 'تديرها جمعية أو بلدية أو نادٍ طلابي؟ صُمم EcoClean ليُنشَر مدينةً مدينةً عبر المغرب.', impact_cta_btn: 'كن شريكًا', impact_method: 'المنهجية',
      impact_net: '{cities} مدن · {orgs} جمعيات على الشبكة', impact_net_link: '← عرض الشبكة', impact_updated: 'آخر تحديث',
      net_nav: 'الشبكة', net_hero_title: 'شبكة جمعيات، مدينةً مدينة', net_hero_sub: 'منصة واحدة، تُنشَر مدينةً مدينة. كل شريك يدير مدينته؛ ومعًا يشكّلون حركة تنظيف وطنية.',
      net_kpi_cities: 'مدن', net_kpi_reports: 'بلاغات', net_kpi_cleaned: 'منظَّفة', net_orgs_title: 'شركاء نشطون', net_empty: 'لا جمعيات شريكة بعد — كن الأول.',
      net_card_reports: 'بلاغات', net_card_cleaned: 'منظَّفة', net_card_citizens: 'مواطنون', net_card_contact: 'تواصل مع هذا الشريك', net_cta_title: 'أليست مدينتك هنا بعد؟', net_cta_sub: 'صُمم EcoClean لإضافة مدينة جديدة في أيام لا أشهر. إن كنت تدير جمعية أو بلدية أو نادٍ طلابي، لنتحدّث.',
      partner_open: '🤝 كن شريكًا',
      empty_dash_title: 'لوحتك جاهزة', empty_dash_sub: 'لا نشاط بعد. قدّم أول بلاغ من الخريطة وسيظهر أثرُك ونقاطك ومهماتك هنا.', empty_dash_btn: 'افتح الخريطة وبلّغ',
      empty_impact_title: 'هذا هو EcoClean Connect', empty_impact_sub: 'عرض تجريبي مباشر مع جمعية شريكة سيملأ هذه العدّادات والخريطة والشبكة بعمليات تنظيف حقيقية. المنصة التي تشغّلها مبنيّة بالكامل — استكشف طريقة عملها أدناه.', empty_map: 'لا بلاغات على الخريطة بعد — كن أول من يضع دبوسًا ويحمي حيّه.',
      admin_sum_total: 'الإجمالي', admin_sum_pending: 'قيد الانتظار', admin_sum_verified: 'متحققة', admin_empty: 'لا بلاغات في نطاقك بعد. حين يبلّغ المواطنون ستظهر هنا للتحقق.',
      partner_open: '🤝 كن شريكًا'
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
