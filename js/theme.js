/* theme.js — light/dark theme with persistence + map-tile swap (ADDITIVE).
 * Applies the saved theme (or the OS preference on first visit) to <html> as early
 * as possible (this script is loaded in <head>, before the stylesheet) to avoid a
 * flash of the wrong theme, then injects a 🌙/☀ toggle into the header. Emits
 * 'ecoclean:theme' so the map can swap between light/dark tiles. Loaded on every
 * page so the choice is consistent site-wide. */
(function () {
  'use strict';
  var KEY = 'ecoclean_theme';
  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function resolve() {
    var s = stored();
    if (s === 'dark' || s === 'light') return s;
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  var theme = resolve();
  document.documentElement.setAttribute('data-theme', theme); // ASAP, before paint

  function updateBtn() {
    var b = document.getElementById('eco-theme-btn');
    if (!b) return;
    b.textContent = theme === 'dark' ? '☀️' : '🌙';
    b.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
  function emit() { window.dispatchEvent(new CustomEvent('ecoclean:theme', { detail: theme })); }
  function setTheme(t) {
    theme = t;
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(KEY, t); } catch (e) {}
    updateBtn(); emit();
  }
  function addToggle() {
    var nav = document.querySelector('.topnav');
    if (!nav) { updateBtn(); return; }
    if (!document.getElementById('eco-theme-btn')) {
      var b = document.createElement('button'); b.type = 'button'; b.id = 'eco-theme-btn'; b.className = 'eco-theme-btn';
      b.addEventListener('click', function () { setTheme(theme === 'dark' ? 'light' : 'dark'); });
      var sel = document.getElementById('langSelect');
      if (sel) nav.insertBefore(b, sel); else nav.appendChild(b);
    }
    updateBtn();
  }

  function start() { addToggle(); emit(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.addEventListener('ecoclean:mapready', emit); // make sure an already-open map gets the right tiles
  window.EcoTheme = { get: function () { return theme; }, set: setTheme };
})();
