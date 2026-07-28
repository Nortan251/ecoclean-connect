/* ============================================================================
 * escalate.js — 1-Click City Council Petitions (Civic Escalation)
 * ----------------------------------------------------------------------------
 * Transforms the app from a volunteering tool into an activist weapon. 
 * Heavy pollution (like construction dumping or sewage) can't be cleaned by 
 * citizens. This adds an "Escalate to Municipality" button that generates a 
 * formal, legally worded email to the local government with GPS coordinates.
 * ==========================================================================*/
(function () {
  'use strict';

  const L10N = {
    en: { btn: '🏛️ Escalate to Municipality', confirm: 'This will open your email app with a formal request to the city council. Continue?' },
    fr: { btn: '🏛️ Signaler à la Commune', confirm: 'Ceci ouvrira votre application e-mail avec une demande formelle à la commune. Continuer ?' },
    ar: { btn: '🏛️ تصعيد إلى البلدية', confirm: 'سيؤدي هذا إلى فتح تطبيق البريد الإلكتروني الخاص بك مع طلب رسمي للبلدية. هل تريد المتابعة؟' }
  };
  const lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');
  const t = (k) => (L10N[lang()] || L10N.en)[k];

  function buildEmail(rep) {
    const lat = Number(rep.lat).toFixed(5);
    const lng = Number(rep.lng).toFixed(5);
    const link = location.origin + '?rally=' + rep.id; // Reuse the fly-to logic from rallies
    const cat = typeof window.catLabel === 'function' ? window.catLabel(rep.category) : rep.category;
    
    let subject, body;
    if (lang() === 'fr') {
      subject = `[URGENT] Signalement de pollution - Intervention requise (${lat}, ${lng})`;
      body = `Madame, Monsieur le Président du Conseil Communal,\n\nJe vous contacte via la plateforme citoyenne EcoClean Connect pour signaler un cas de pollution nécessitant l'intervention urgente des services municipaux.\n\nNature du problème : ${cat}\nCoordonnées GPS : ${lat}, ${lng}\nLien vers la carte : ${link}\nPhoto : ${rep.beforePhoto || 'N/A'}\nDescription : ${rep.description || 'N/A'}\n\nEn vous remerciant d'avance pour votre réactivité et votre engagement pour la propreté de notre ville.\n\nCordialement,\nUn citoyen engagé`;
    } else if (lang() === 'ar') {
      subject = `[عاجل] بلاغ عن تلوث بيئي - طلب تدخل (${lat}, ${lng})`;
      body = `السيد رئيس المجلس الجماعي،\n\nأتواصل معكم عبر منصة EcoClean Connect للإبلاغ عن حالة تلوث تتطلب التدخل العاجل للمصالح البلدية.\n\nنوع المشكل: ${cat}\nالإحداثيات: ${lat}, ${lng}\nرابط الخريطة: ${link}\nالصورة: ${rep.beforePhoto || 'N/A'}\nالوصف: ${rep.description || 'N/A'}\n\nشكراً لجهودكم وتفاعلكم السريع للحفاظ على نظافة مدينتنا.\n\nمع خالص التحيات،\nمواطن غيور`;
    } else {
      subject = `[URGENT] Pollution Report - Intervention Required (${lat}, ${lng})`;
      body = `To the City Council,\n\nI am contacting you via the EcoClean Connect citizen platform to report a pollution site that requires municipal intervention.\n\nCategory: ${cat}\nGPS Coordinates: ${lat}, ${lng}\nMap Link: ${link}\nPhoto: ${rep.beforePhoto || 'N/A'}\nDescription: ${rep.description || 'N/A'}\n\nThank you for your swift action to keep our city clean.\n\nSincerely,\nA concerned citizen`;
    }

    // Default to a generic municipality email (can be mapped per city later)
    const to = 'contact@commune.gov.ma'; 
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  window.addEventListener('ecoclean:mapready', (ev) => {
    const map = ev.detail;
    if (!map) return;
    map.on('popupopen', (e) => {
      const marker = e.popup && e.popup._source;
      const id = marker && marker._reportId;
      if (!id) return;
      const rep = (window.EcoClean.reports || []).find((r) => r.id === id);
      
      // Only escalate pending reports
      if (!rep || rep.status !== 'reported') return;

      const el = e.popup.getElement();
      if (!el || el.querySelector('.eco-escalate-btn')) return;

      const btn = document.createElement('button');
      btn.className = 'ghost-btn eco-escalate-btn';
      btn.style.cssText = 'border-color:#ef4444; color:#ef4444; margin-top:8px; width:100%;';
      btn.textContent = t('btn');

      btn.onclick = () => {
        if (confirm(t('confirm'))) {
          window.location.href = buildEmail(rep);
        }
      };

      // Append right before the Rally box if it exists, otherwise at the end
      const rallyBox = el.querySelector('.eco-rally-box');
      if (rallyBox) {
        rallyBox.parentNode.insertBefore(btn, rallyBox);
      } else {
        el.appendChild(btn);
      }
    });
  });
})();
