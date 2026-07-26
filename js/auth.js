/* auth.js — optional user accounts (Module F). Email/password via Supabase Auth.
 * Anonymous use is preserved: NOTHING here is required to report. When signed in,
 * reports are attributed to the user (the server verifies the access token) and
 * verified clean-ups earn SERVER-SIDE points (tamper-proof). This module injects a
 * compact Log in / Sign up control into the header on every page + an auth modal,
 * and exposes window.EcoAuth so other modules (report submit, wallet, quests) can
 * read the session / token / refresh. Dispatches 'ecoclean:auth' (detail=user|null). */
(function () {
  'use strict';
  let client = null, current = null, bootDone = false;
  const USER_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>';

  function cfgClient() {
    if (client) return Promise.resolve(client);
    return fetch('/api/config', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((c) => {
      if (c && c.url && c.anonKey && window.supabase) client = window.supabase.createClient(c.url, c.anonKey);
      return client;
    }).catch(() => null);
  }
  function emit() { window.dispatchEvent(new CustomEvent('ecoclean:auth', { detail: current })); }

  // --- UI --------------------------------------------------------------------
  function inject() {
    if (document.getElementById('eco-auth-style')) return;
    const st = document.createElement('style'); st.id = 'eco-auth-style';
    st.textContent =
      '.eco-acct-btn{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.18);color:#fff;border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:7px 13px;font-size:.82rem;font-weight:700;cursor:pointer;margin-left:4px;font-family:inherit;transition:background .2s;}' +
      '.eco-acct-btn:hover{background:rgba(255,255,255,.3);}.eco-acct-btn svg{display:block;}' +
      '.eco-acct-chip{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:5px 12px 5px 5px;margin-left:4px;cursor:pointer;color:#fff;font-weight:700;font-size:.82rem;font-family:inherit;}' +
      '.eco-acct-av{width:24px;height:24px;border-radius:50%;background:#fff;color:#0a5c3f;display:grid;place-items:center;font-size:.75rem;font-weight:800;}' +
      '.eco-auth-modal{position:fixed;inset:0;z-index:1500;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(8,28,20,.55);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);}' +
      '.eco-auth-card{position:relative;background:#fff;border-radius:20px;max-width:380px;width:100%;padding:22px;box-shadow:0 24px 60px rgba(0,0,0,.3);}' +
      '.eco-auth-tabs{display:flex;gap:6px;margin-bottom:14px;background:#eef5f1;border-radius:999px;padding:4px;}' +
      '.eco-auth-tabs button{flex:1;border:none;background:none;border-radius:999px;padding:9px;font-weight:700;color:#5d7268;cursor:pointer;font-family:inherit;}' +
      '.eco-auth-tabs button.on{background:#fff;color:#0a5c3f;box-shadow:0 2px 6px rgba(0,0,0,.08);}' +
      '.eco-auth-msg{font-size:.82rem;margin:8px 0 0;min-height:1em;}' +
      '.eco-auth-msg.err{color:#dc3545;}.eco-auth-msg.ok{color:#0a5c3f;}' +
      '.eco-auth-x{position:absolute;top:8px;right:12px;background:none;border:none;font-size:1.5rem;color:#6b7c74;cursor:pointer;line-height:1;}' +
      '.eco-auth-menu{position:fixed;right:14px;top:56px;background:#fff;border-radius:14px;box-shadow:0 12px 30px rgba(0,0,0,.2);padding:6px;z-index:1600;min-width:190px;color:#14241d;}' +
      '.eco-auth-menu .em-head{padding:8px 10px;font-size:.78rem;color:#5d7268;border-bottom:1px solid #eef2ef;margin-bottom:4px;}' +
      '.eco-auth-menu button,.eco-auth-menu a{display:block;width:100%;text-align:left;border:none;background:none;padding:9px 10px;border-radius:8px;font-size:.88rem;font-weight:600;cursor:pointer;color:#14241d;font-family:inherit;text-decoration:none;}' +
      '.eco-auth-menu button:hover,.eco-auth-menu a:hover{background:#eef5f1;}' +
      '@media (max-width:560px){.eco-acct-btn{padding:7px 9px;margin-left:2px;}.eco-acct-btn .eco-acct-label{display:none;}.eco-acct-chip{padding:4px;margin-left:2px;}.eco-acct-chip .eco-acct-name{display:none;}}';
    document.head.appendChild(st);
  }
  const nav = () => document.querySelector('.topnav');
  const initialOf = (u) => ((((u && u.email) || '?').trim().charAt(0)) || '?').toUpperCase();

  let menuEl = null;
  function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
  function renderNav() {
    const n = nav(); if (!n) return;
    const old = n.querySelector('.eco-acct-slot'); if (old) old.remove(); closeMenu();
    const slot = document.createElement('span'); slot.className = 'eco-acct-slot';
    if (current) {
      const chip = document.createElement('button'); chip.className = 'eco-acct-chip'; chip.type = 'button';
      chip.innerHTML = '<span class="eco-acct-av">' + initialOf(current) + '</span><span class="eco-acct-name"></span>';
      chip.querySelector('.eco-acct-name').textContent = current.displayName || initialOf(current);
      chip.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
      slot.appendChild(chip);
    } else {
      const b = document.createElement('button'); b.className = 'eco-acct-btn'; b.type = 'button';
      b.innerHTML = USER_ICON + '<span class="eco-acct-label">Log in</span>';
      b.addEventListener('click', openAuth);
      slot.appendChild(b);
    }
    n.appendChild(slot);
  }
  function toggleMenu() {
    if (menuEl) { closeMenu(); return; }
    menuEl = document.createElement('div'); menuEl.className = 'eco-auth-menu';
    menuEl.innerHTML = '<div class="em-head">' + (current.displayName || current.email || '') + (current.points != null ? ' · ' + current.points + ' pts' : '') + '</div>' +
      '<a href="dashboard.html">My dashboard</a>' +
      '<button data-act="out">Log out</button>';
    document.body.appendChild(menuEl);
    menuEl.querySelector('[data-act="out"]').addEventListener('click', signOut);
    const close = (e) => { if (menuEl && !menuEl.contains(e.target)) { closeMenu(); document.removeEventListener('click', close, true); } };
    setTimeout(() => document.addEventListener('click', close, true), 0);
  }

  // --- auth modal ------------------------------------------------------------
  let modalEl = null;
  function closeAuth() { if (modalEl) { modalEl.remove(); modalEl = null; } }
  function openAuth() {
    closeMenu(); inject(); if (modalEl) return;
    let mode = 'in';
    modalEl = document.createElement('div'); modalEl.className = 'eco-auth-modal';
    function draw() {
      modalEl.innerHTML = '<div class="eco-auth-card">' +
        '<button class="eco-auth-x" type="button" aria-label="Close">&times;</button>' +
        '<div class="eco-auth-tabs"><button data-m="in" class="' + (mode === 'in' ? 'on' : '') + '">Log in</button><button data-m="up" class="' + (mode === 'up' ? 'on' : '') + '">Sign up</button></div>' +
        '<form id="ecoAuthForm">' +
        (mode === 'up' ? '<label class="field"><span>Display name</span><input name="displayName" autocomplete="nickname" placeholder="Eco Guardian" /></label>' : '') +
        '<label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required /></label>' +
        '<label class="field"><span>Password</span><input name="password" type="password" autocomplete="' + (mode === 'up' ? 'new-password' : 'current-password') + '" minlength="6" required /></label>' +
        '<button class="primary-btn" type="submit">' + (mode === 'up' ? 'Create account' : 'Log in') + '</button>' +
        '<p class="eco-auth-msg" id="ecoAuthMsg"></p></form></div>';
      modalEl.querySelectorAll('.eco-auth-tabs button').forEach((t) => t.addEventListener('click', () => { mode = t.dataset.m; draw(); }));
      modalEl.querySelector('.eco-auth-x').addEventListener('click', closeAuth);
      modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeAuth(); });
      modalEl.querySelector('#ecoAuthForm').addEventListener('submit', onSubmit);
      const fi = modalEl.querySelector('input'); if (fi) fi.focus();
    }
    function onSubmit(e) {
      e.preventDefault();
      const f = e.target; const msg = modalEl.querySelector('#ecoAuthMsg');
      const email = f.email.value.trim(), password = f.password.value;
      const dn = f.displayName ? f.displayName.value.trim() : '';
      msg.className = 'eco-auth-msg'; msg.textContent = 'Please wait…';
      cfgClient().then((c) => {
        if (!c) { msg.className = 'eco-auth-msg err'; msg.textContent = 'Auth unavailable.'; return; }
        const p = mode === 'up'
          ? c.auth.signUp({ email: email, password: password, options: { data: { display_name: dn || undefined } } })
          : c.auth.signInWithPassword({ email: email, password: password });
        p.then(({ data, error }) => {
          if (error) { msg.className = 'eco-auth-msg err'; msg.textContent = error.message; return; }
          if (mode === 'up' && data && data.user && !data.session) { msg.className = 'eco-auth-msg ok'; msg.textContent = 'Check your email to confirm, then log in.'; return; }
          msg.className = 'eco-auth-msg ok'; msg.textContent = 'Success!'; setTimeout(closeAuth, 400);
        });
      });
    }
    draw(); document.body.appendChild(modalEl);
  }

  function signOut() { closeMenu(); cfgClient().then((c) => { if (c) c.auth.signOut(); }); }

  // --- session ---------------------------------------------------------------
  function refreshMe() {
    return fetch('/api/me', { headers: { Authorization: 'Bearer ' + current.accessToken } })
      .then((r) => (r.ok ? r.json() : null)).then((me) => {
        if (me && current) { current.displayName = me.displayName; current.points = me.points; current.vouchers = me.vouchers; current.myReports = me.myReports; current.claimedQuests = me.claimedQuests || []; }
        renderNav(); emit(); return current;
      }).catch(() => { renderNav(); emit(); return current; });
  }
  function setSession(sess) {
    current = sess ? { id: sess.user.id, email: sess.user.email, accessToken: sess.access_token } : null;
    if (current) refreshMe(); else { renderNav(); emit(); }
  }
  function start() {
    inject(); renderNav();
    cfgClient().then((c) => {
      if (!c) { bootDone = true; emit(); return; }
      c.auth.getSession().then(({ data }) => { setSession(data && data.session); bootDone = true; });
      c.auth.onAuthStateChange((ev, sess) => { if (ev === 'SIGNED_OUT') { current = null; renderNav(); emit(); } else if (sess) setSession(sess); });
    });
  }

  window.EcoAuth = {
    ready: () => new Promise((res) => { if (bootDone) res(current); else window.addEventListener('ecoclean:auth', () => res(current), { once: true }); }),
    getUser: () => current,
    getToken: () => (current ? current.accessToken : null),
    refresh: () => (current ? refreshMe() : Promise.resolve(null)),
    signIn: openAuth, signOut: signOut,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
