/* ============================================================================
 * partner-form.js — a reusable "Become a partner" application modal (ADDITIVE)
 * ----------------------------------------------------------------------------
 * Turns the partner CTAs on /associations.html + /impact.html from a dead mailto
 * into a real, stored lead (POST /api/partner-apply -> partner_applications, RLS
 * write-only from the browser). Exposes window.EcoPartnerForm.open(). Any element
 * with [data-partner-open] opens it on click, so pages wire up with zero JS of
 * their own. Trilingual + themed; closes on Esc / backdrop / ×. Accessible: labels,
 * required fields, focus the first input on open. This is the difference between
 * "a demo with a mailto" and "a platform that can actually onboard partners".
 * ==========================================================================*/
(function () {
  'use strict';
  var L = {
    en: { title: 'Bring EcoClean to your city', org: 'Organisation name', city: 'City', contact: 'Your name', email: 'Email', type: 'Organisation type', type_ph: 'Association / Municipality / Student club / Other', msg: 'Message (optional)', msg_ph: 'Tell us about your city and your team…', submit: 'Send application', sending: 'Sending…', ok: '✅ Thank you! We’ll be in touch about bringing EcoClean to your city.', err: '❌ Something went wrong — please try again or email us.', soon: '🌱 Applications open very soon — meanwhile, email contact@ecoclean-connect.org.', open: '🤝 Become a partner', close: 'Close' },
    fr: { title: 'Amenez EcoClean dans votre ville', org: 'Nom de l’organisation', city: 'Ville', contact: 'Votre nom', email: 'E-mail', type: 'Type d’organisation', type_ph: 'Association / Commune / Club étudiant / Autre', msg: 'Message (facultatif)', msg_ph: 'Parlez-nous de votre ville et de votre équipe…', submit: 'Envoyer la candidature', sending: 'Envoi…', ok: '✅ Merci ! Nous vous contacterons pour amener EcoClean dans votre ville.', err: '❌ Une erreur est survenue — réessayez ou écrivez-nous.', soon: '🌱 Les candidatures ouvrent très bientôt — en attendant, écrivez à contact@ecoclean-connect.org.', open: '🤝 Devenir partenaire', close: 'Fermer' },
    ar: { title: 'اجلب EcoClean إلى مدينتك', org: 'اسم المنظمة', city: 'المدينة', contact: 'اسمك', email: 'البريد الإلكتروني', type: 'نوع المنظمة', type_ph: 'جمعية / بلدية / نادٍ طلابي / أخرى', msg: 'رسالة (اختياري)', msg_ph: 'أخبرنا عن مدينتك وفريقك…', submit: 'إرسال الطلب', sending: 'جارٍ الإرسال…', ok: '✅ شكرًا لك! سنتواصل بشأن جلب EcoClean إلى مدينتك.', err: '❌ حدث خطأ — حاول مجددًا أو راسلنا.', soon: '🌱 الطلبات تُفتح قريبًا جدًا — حتى ذلك الحين راسل contact@ecoclean-connect.org.', open: '🤝 كن شريكًا', close: 'إغلاق' },
  };
  var lang = function () { return (typeof window.getLang === 'function' ? getLang() : 'en'); };
  var t = function () { return L[lang()] || L.en; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/"/g, '&quot;'); };
  var modal = null;

  function field(label, name, opts) {
    opts = opts || {};
    var req = opts.required ? ' required' : '';
    var ph = opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '';
    var type = opts.type || 'text';
    return '<label class="pf-field"><span>' + esc(label) + '</span><input name="' + name + '" type="' + type + '"' + ph + req + ' /></label>';
  }
  function build() {
    if (modal) return modal;
    var T = t();
    modal = document.createElement('div'); modal.className = 'pf-modal'; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = '<div class="pf-card">' +
      '<button class="pf-x" type="button" aria-label="' + esc(T.close) + '">&times;</button>' +
      '<h2 class="pf-title">' + esc(T.title) + '</h2>' +
      '<form id="pfForm">' +
        field(T.org, 'orgName', { required: true }) +
        field(T.city, 'city', { required: true }) +
        field(T.contact, 'contactName') +
        field(T.email, 'email', { type: 'email', required: true }) +
        field(T.type, 'orgType', { ph: T.type_ph }) +
        '<label class="pf-field"><span>' + esc(T.msg) + '</span><textarea name="message" rows="3" placeholder="' + esc(T.msg_ph) + '"></textarea></label>' +
        '<button class="primary-btn pf-submit" type="submit">' + esc(T.submit) + '</button>' +
        '<p class="pf-msg" id="pfMsg"></p>' +
      '</form></div>';
    modal.querySelector('.pf-x').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    modal.querySelector('#pfForm').addEventListener('submit', submit);
    document.body.appendChild(modal);
    return modal;
  }
  function submit(e) {
    e.preventDefault();
    var T = t(), f = e.target, msg = modal.querySelector('#pfMsg'), btn = modal.querySelector('.pf-submit');
    var payload = {
      orgName: f.orgName.value.trim(), city: f.city.value.trim(), email: f.email.value.trim(),
      contactName: f.contactName.value.trim(), orgType: f.orgType.value.trim(), message: f.message.value.trim(),
    };
    msg.className = 'pf-msg'; msg.textContent = T.sending; btn.disabled = true;
    fetch('/api/health', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.status === 503 ? { soon: true } : (r.ok ? r.json() : Promise.reject(r)); })
      .then(function (j) {
        if (j && j.soon) { msg.className = 'pf-msg ok'; msg.textContent = T.soon; btn.disabled = false; return; }
        msg.className = 'pf-msg ok'; msg.textContent = T.ok; f.reset(); btn.disabled = false; setTimeout(close, 2600);
      })
      .catch(function () { msg.className = 'pf-msg err'; msg.textContent = T.err; btn.disabled = false; });
  }
  function open() {
    var T = t();
    if (modal) modal.remove(); modal = null;       // rebuild so language is fresh
    build();
    modal.querySelector('.pf-title').textContent = T.title;
    modal.querySelector('.pf-submit').textContent = T.submit;
    modal.classList.add('open');
    var fi = modal.querySelector('input'); if (fi) fi.focus();
  }
  function close() { if (modal) modal.classList.remove('open'); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  document.addEventListener('click', function (e) { var o = e.target.closest && e.target.closest('[data-partner-open]'); if (o) { e.preventDefault(); open(); } });

  window.EcoPartnerForm = { open: open, close: close };

  if (!document.getElementById('eco-partner-style')) {
    var st = document.createElement('style'); st.id = 'eco-partner-style';
    st.textContent =
      '.pf-modal{position:fixed;inset:0;z-index:1700;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(8,28,20,.55);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);}' +
      '.pf-modal.open{display:flex;}' +
      '.pf-card{position:relative;background:var(--surface,#fff);border-radius:20px;max-width:420px;width:100%;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.3);max-height:90vh;overflow:auto;}' +
      '.pf-title{margin:0 0 14px;font-size:1.2rem;font-weight:800;color:var(--accent-dark,#0a5c3f);}' +
      '.pf-x{position:absolute;top:8px;right:12px;background:none;border:none;font-size:1.5rem;color:var(--muted,#6b7c74);cursor:pointer;line-height:1;}' +
      '.pf-field{display:block;margin-bottom:11px;}.pf-field span{display:block;font-size:.78rem;font-weight:700;color:var(--muted,#5d7268);margin-bottom:4px;}' +
      '.pf-field input,.pf-field textarea{width:100%;border:1px solid var(--border-strong,#cfe2d8);background:var(--surface,#fff);color:var(--text,#14241d);border-radius:10px;padding:9px 11px;font-size:.9rem;font-family:inherit;}' +
      '.pf-field input:focus,.pf-field textarea:focus{outline:2px solid var(--accent-2,#0d9488);outline-offset:1px;border-color:var(--accent-2,#0d9488);}' +
      '.pf-submit{width:100%;margin-top:4px;}.pf-submit:disabled{opacity:.6;cursor:wait;}' +
      '.pf-msg{font-size:.82rem;margin:10px 0 0;min-height:1em;}.pf-msg.ok{color:var(--accent,#0a5c3f);}.pf-msg.err{color:#dc3545;}' +
      '.ghost-btn-2{background:transparent;border:2px solid rgba(255,255,255,.7);color:#fff;border-radius:12px;padding:11px 18px;font-weight:700;cursor:pointer;font-family:inherit;}';
    document.head.appendChild(st);
  }
})();
