/* ============================================================================
 * rallies.js — Multiplayer "Clean-up Rallies" (Viral Growth Engine)
 * ----------------------------------------------------------------------------
 * Transforms the static "Reported" pins into live events. Any citizen can upgrade
 * a pending report into a Rally, choosing a future date/time. The pin changes to
 * a glowing rally point, and other users can click "RSVP" to join the clean-up.
 * Uses a secondary metadata payload injected into the description field to simulate
 * the relational table without needing SQL migrations, so it works out-of-the-box.
 * ==========================================================================*/
(function () {
  'use strict';

  const L10N = {
    en: { org_btn: '📅 Organize a Rally', rsvp_btn: 'I\'m Going!', cancel_btn: 'Cancel RSVP', 
          date_prompt: 'When is the clean-up? (e.g. "This Saturday at 10 AM")', 
          rally_title: 'CLEAN-UP RALLY', attending: 'people attending',
          share_text: 'Join me for a neighborhood clean-up rally! ' },
    fr: { org_btn: '📅 Organiser un Rassemblement', rsvp_btn: 'J\'y vais !', cancel_btn: 'Annuler', 
          date_prompt: 'Quand aura lieu le nettoyage ? (ex: "Ce samedi à 10h")', 
          rally_title: 'RASSEMBLEMENT DE NETTOYAGE', attending: 'participants',
          share_text: 'Rejoignez-moi pour un rassemblement de nettoyage ! ' },
    ar: { org_btn: '📅 تنظيم حملة تنظيف', rsvp_btn: 'سأحضر!', cancel_btn: 'إلغاء الحضور', 
          date_prompt: 'متى موعد التنظيف؟ (مثال: "هذا السبت الساعة 10 صباحاً")', 
          rally_title: 'حملة تنظيف جماعية', attending: 'أشخاص حاضرون',
          share_text: 'انضم إلي في حملة تنظيف الحي! ' }
  };
  const lang = () => (typeof window.getLang === 'function' ? getLang() : 'en');
  const t = (k) => (L10N[lang()] || L10N.en)[k];

  // We serialize rally metadata into the description to avoid SQL schema changes
  // Format: "Description text... ||RALLY:{"time":"Saturday 10am","attendees":["uid1","uid2"]}"
  function parseRally(desc) {
    if (!desc || !desc.includes('||RALLY:')) return null;
    try {
      const jsonStr = desc.split('||RALLY:')[1];
      return JSON.parse(jsonStr);
    } catch(e) { return null; }
  }
  
  function stripRally(desc) {
    if (!desc || !desc.includes('||RALLY:')) return desc;
    return desc.split('||RALLY:')[0].trim();
  }

  function getMe() {
    return window.EcoAuth && window.EcoAuth.getUser ? window.EcoAuth.getUser() : null;
  }

  async function updateRally(reportId, currentDesc, newRallyData) {
    const u = getMe();
    if (!u) { alert('Please log in to organize or join a rally.'); return; }
    
    const cleanDesc = stripRally(currentDesc);
    const newDesc = cleanDesc + ' ||RALLY:' + JSON.stringify(newRallyData);
    
    // We cheat by using the standard /api/reports via POST but we need a special 
    // endpoint. Wait, we are constrained to 12 endpoints. We have api/reports/[id]/verify.js
    // which takes 'action: reject'. We can add 'action: rally_update' to it!
    const res = await fetch(`/api/reports/${reportId}/verify`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + window.EcoAuth.getToken()
      },
      body: JSON.stringify({ action: 'rally_update', new_desc: newDesc })
    });
    
    if (res.ok) {
      if(window.loadReports) window.loadReports();
    } else {
      alert('Failed to update rally. Make sure you are logged in.');
    }
  }

  window.addEventListener('ecoclean:mapready', (ev) => {
    const map = ev.detail;
    if (!map) return;
    
    map.on('popupopen', (e) => {
      const marker = e.popup && e.popup._source;
      const id = marker && marker._reportId;
      if (!id) return;
      
      const rep = (window.EcoClean.reports || []).find((r) => r.id === id);
      if (!rep || rep.status !== 'reported') return; // Rallies are only for pending reports
      
      const el = e.popup.getElement();
      if (!el || el.querySelector('.eco-rally-box')) return;
      
      const rallyData = parseRally(rep.description);
      
      // Patch the description display so it doesn't show the raw JSON
      const pTag = el.querySelector('p');
      if (pTag && pTag.textContent.includes('||RALLY:')) {
        pTag.textContent = stripRally(pTag.textContent);
      }

      const box = document.createElement('div');
      box.className = 'eco-rally-box';
      
      const u = getMe();
      const myId = u ? u.id : null;

      if (!rallyData) {
        // No rally yet: show Organize button
        box.innerHTML = `<button class="ghost-btn rally-org-btn" style="border-color:#10b981; color:#10b981; margin-top:10px;">${t('org_btn')}</button>`;
        el.appendChild(box);
        
        box.querySelector('.rally-org-btn').onclick = () => {
          if (!u) { window.EcoAuth.signIn(); return; }
          const time = prompt(t('date_prompt'));
          if (time) updateRally(id, rep.description, { time: time, attendees: [myId] });
        };
      } else {
        // Active Rally
        const isAttending = myId && rallyData.attendees.includes(myId);
        const count = rallyData.attendees.length;
        
        box.innerHTML = `
          <div style="background:var(--surface-2); border:1px solid #10b981; border-radius:12px; padding:10px; margin-top:10px;">
            <div style="font-size:0.7rem; font-weight:800; color:#10b981; letter-spacing:0.05em;">🔥 ${t('rally_title')}</div>
            <div style="font-size:0.9rem; font-weight:700; margin:4px 0;">${rallyData.time}</div>
            <div style="font-size:0.8rem; color:var(--muted); margin-bottom:8px;">👥 <b>${count}</b> ${t('attending')}</div>
            <button class="primary-btn rally-rsvp-btn" style="padding:8px; margin:0; ${isAttending ? 'background:var(--surface); color:#ef4444; border:1px solid #ef4444; box-shadow:none;' : 'background:#10b981;'}">
              ${isAttending ? t('cancel_btn') : t('rsvp_btn')}
            </button>
            <button class="ghost-btn rally-share-btn" style="padding:8px; margin-top:6px; border:none; background:transparent;">🔗 Share Invite</button>
          </div>
        `;
        el.appendChild(box);
        
        box.querySelector('.rally-rsvp-btn').onclick = () => {
          if (!u) { window.EcoAuth.signIn(); return; }
          let att = rallyData.attendees || [];
          if (isAttending) att = att.filter(x => x !== myId);
          else att.push(myId);
          updateRally(id, rep.description, { time: rallyData.time, attendees: att });
        };

        box.querySelector('.rally-share-btn').onclick = () => {
          const cat = typeof window.catLabel === 'function' ? catLabel(rep.category) : rep.category;
          const url = location.href.split('?')[0] + '?rally=' + id;
          if (navigator.share) {
            navigator.share({ title: t('rally_title'), text: t('share_text') + cat + '!', url: url }).catch(()=>{});
          } else {
            navigator.clipboard.writeText(url);
            alert('Rally link copied to clipboard!');
          }
        };
      }
    });
  });

  // Handle incoming shared rally link
  window.addEventListener('ecoclean:mapready', (ev) => {
    const map = ev.detail;
    if (!map) return;
    const urlParams = new URLSearchParams(window.location.search);
    const rallyId = urlParams.get('rally');
    if (rallyId) {
      setTimeout(() => {
        const rep = (window.EcoClean.reports || []).find(r => r.id === rallyId);
        if (rep && rep.lat) {
          map.flyTo([rep.lat, rep.lng], 16);
          // Strip URL parameter cleanly without reloading
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }, 1000);
    }
  });

  const st = document.createElement('style');
  st.textContent = `
    .marker-rally { animation: rally-pulse 1.5s infinite; filter: hue-rotate(90deg) drop-shadow(0 0 8px #10b981); z-index: 1000 !important; }
    @keyframes rally-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
  `;
  document.head.appendChild(st);

})();
