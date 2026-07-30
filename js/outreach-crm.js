/* ============================================================================
 * outreach-crm.js — Smart Partner CRM & 1-Click Outreach (Super Admin Only)
 * ----------------------------------------------------------------------------
 * A built-in sales tool to help the founder acquire partner associations.
 * Manages a local database of leads, auto-generates professional French/English
 * pitches, and routes directly to Instagram DMs or Email.
 * ==========================================================================*/
(function () {
  'use strict';

  let leads = JSON.parse(localStorage.getItem('eco_crm_leads') || '[]');
  
  // Seed some realistic Moroccan student club targets if empty
  if (leads.length === 0) {
    leads = [
      { id: 1, name: 'Enactus FST Fes', platform: 'ig', contact: 'enactusfstf', status: 'pending' },
      { id: 2, name: 'Rotaract Club Agadir', platform: 'ig', contact: 'rotaract.agadir', status: 'pending' },
      { id: 3, name: 'JCI Casablanca', platform: 'email', contact: 'contact@jcicasablanca.ma', status: 'pending' }
    ];
    saveLeads();
  }

  function saveLeads() {
    localStorage.setItem('eco_crm_leads', JSON.stringify(leads));
  }

  function generatePitch(lead) {
    const url = "https://ecoclean-connect.vercel.app/";
    if (lead.platform === 'ig') {
      return `Bonjour l'équipe ${lead.name} ! 👋\n\nJe suis le fondateur d'EcoClean Connect, une nouvelle plateforme marocaine qui récompense les actions de nettoyage citoyennes.\n\nJ'ai vu vos superbes initiatives environnementales. J'ai créé un outil 100% gratuit qui permet aux clubs comme le vôtre de générer des rapports d'impact PDF automatiques pour vos sponsors.\n\nSeriez-vous ouverts à utiliser l'application pour votre prochaine action ?\nDécouvrez-la ici : ${url}\n\nBravo pour votre travail ! 🌍`;
    } else {
      return `Madame, Monsieur,\n\nJe me permets de vous contacter de la part d'EcoClean Connect, une plateforme citoyenne marocaine dédiée à la cartographie et à la valorisation des actions de nettoyage.\n\nAyant suivi les excellentes initiatives de ${lead.name}, je tenais à vous présenter notre outil. EcoClean permet aux associations de gérer leurs nettoyages, d'engager leurs bénévoles via un système de points, et de générer automatiquement des rapports d'impact PDF pour vos bailleurs de fonds et sponsors.\n\nL'outil est entièrement gratuit pour les associations étudiantes et les ONG.\n\nSeriez-vous disponibles pour un bref échange ou ouverts à tester la plateforme lors de votre prochaine action de terrain ?\n\nLien vers la plateforme : ${url}\n\nEn vous remerciant pour votre engagement en faveur de l'environnement.\n\nCordialement,\nLe Fondateur d'EcoClean Connect`;
    }
  }

  function renderCRM() {
    const panel = document.querySelector('main.admin-main'); // Append to main instead of panel to avoid getting hidden
    if (!panel || document.getElementById('eco-crm')) return;

    const crm = document.createElement('div');
    crm.id = 'eco-crm';
    crm.className = 'card';
    crm.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
        <h2 style="margin:0;">📈 Partner Outreach CRM</h2>
        <span style="font-size:0.75rem; background:var(--surface-2); padding:4px 8px; border-radius:99px; color:var(--accent-2);">Super Admin</span>
      </div>
      <p class="muted" style="font-size:0.85rem; margin-top:0;">Manage your leads and automate personalized outreach to student clubs and NGOs.</p>
      
      <div style="display:flex; gap:8px; margin-bottom:16px;">
        <input type="text" id="crmName" placeholder="Club Name (e.g. Enactus)" style="flex:2;">
        <select id="crmPlatform" style="flex:1;">
          <option value="ig">Instagram</option>
          <option value="email">Email</option>
        </select>
        <input type="text" id="crmContact" placeholder="@handle or email" style="flex:2;">
        <button id="crmAdd" class="primary-btn" style="flex:1; margin-top:0;">+ Add</button>
      </div>

      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse: collapse; font-size:0.85rem; text-align:left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border); color: var(--muted);">
              <th style="padding:8px;">Organization</th>
              <th style="padding:8px;">Contact</th>
              <th style="padding:8px;">Status</th>
              <th style="padding:8px; text-align:right;">1-Click Outreach</th>
            </tr>
          </thead>
          <tbody id="crmList"></tbody>
        </table>
      </div>
    `;

    // Append to bottom of Admin Panel
    panel.appendChild(crm);

    document.getElementById('crmAdd').onclick = () => {
      const name = document.getElementById('crmName').value.trim();
      const plat = document.getElementById('crmPlatform').value;
      const contact = document.getElementById('crmContact').value.trim();
      if (!name || !contact) return alert('Name and contact required');
      leads.push({ id: Date.now(), name, platform: plat, contact, status: 'pending' });
      saveLeads();
      refreshList();
      document.getElementById('crmName').value = '';
      document.getElementById('crmContact').value = '';
    };

    refreshList();
  }

  function refreshList() {
    const list = document.getElementById('crmList');
    if (!list) return;

    list.innerHTML = leads.map(lead => {
      const isIg = lead.platform === 'ig';
      const contactLink = isIg ? `https://instagram.com/${lead.contact.replace('@','')}` : `mailto:${lead.contact}`;
      
      let statusHtml = '';
      if (lead.status === 'pending') statusHtml = '<span style="color:#f59e0b; font-weight:700;">Pending</span>';
      if (lead.status === 'contacted') statusHtml = '<span style="color:#3b82f6; font-weight:700;">Contacted</span>';
      if (lead.status === 'partnered') statusHtml = '<span style="color:#10b981; font-weight:700;">Partnered ✅</span>';

      return `
        <tr style="border-bottom: 1px solid var(--border-strong);">
          <td style="padding: 10px 8px; font-weight:700; color:var(--text);">${lead.name}</td>
          <td style="padding: 10px 8px;"><a href="${contactLink}" target="_blank" style="color:var(--accent-2); text-decoration:none;">${isIg ? '📸 ' : '📧 '}${lead.contact}</a></td>
          <td style="padding: 10px 8px; cursor:pointer;" class="crm-status" data-id="${lead.id}">${statusHtml}</td>
          <td style="padding: 10px 8px; text-align:right;">
            <button class="ghost-btn crm-send" data-id="${lead.id}" style="padding:6px 12px; margin:0; font-size:0.75rem;">🚀 Draft Pitch</button>
          </td>
        </tr>
      `;
    }).join('');

    // Change Status on Click
    document.querySelectorAll('.crm-status').forEach(td => {
      td.onclick = (e) => {
        const id = Number(e.currentTarget.dataset.id);
        const lead = leads.find(l => l.id === id);
        if (lead.status === 'pending') lead.status = 'contacted';
        else if (lead.status === 'contacted') lead.status = 'partnered';
        else lead.status = 'pending';
        saveLeads();
        refreshList();
      };
    });

    // 1-Click Send
    document.querySelectorAll('.crm-send').forEach(btn => {
      btn.onclick = async (e) => {
        const id = Number(e.currentTarget.dataset.id);
        const lead = leads.find(l => l.id === id);
        const pitch = generatePitch(lead);
        
        if (lead.platform === 'ig') {
          try {
            await navigator.clipboard.writeText(pitch);
            alert(`Pitch copied to clipboard!\n\nOpening Instagram for @${lead.contact.replace('@','')}... Just hit Paste and Send!`);
            window.open(`https://ig.me/m/${lead.contact.replace('@','')}`, '_blank');
            lead.status = 'contacted'; saveLeads(); refreshList();
          } catch(err) {
            prompt('Copy this pitch, then paste it in Instagram:', pitch);
          }
        } else {
          const subject = `Proposition de partenariat - EcoClean Connect x ${lead.name}`;
          const mailto = `mailto:${lead.contact}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(pitch)}`;
          window.location.href = mailto;
          lead.status = 'contacted'; saveLeads(); refreshList();
        }
      };
    });
  }

  // Hook into auth load
  window.addEventListener('ecoclean:auth', () => {
    const u = window.EcoAuth && window.EcoAuth.getUser ? window.EcoAuth.getUser() : null;
    if (u && u.admin && (u.admin.scope === 'all' || u.admin.role === 'super')) { 
      setTimeout(renderCRM, 800); 
    } else {
      const crm = document.getElementById('eco-crm');
      if (crm) crm.remove();
    }
  });

})();
