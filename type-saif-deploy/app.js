/* Type Saif — app.js
   Boot sequence: safe store init -> apply saved settings -> wire the shell
   chrome (sidebar collapse, mobile drawer) -> start the router.
   Views own their own state restoration; no global keydown handling here
   (the typing engine owns keyboard input). */
(function () {
  'use strict';

  window.TypeSaif = window.TypeSaif || {};
  window.TS = window.TypeSaif;
  var TS = window.TypeSaif;

  function applySettings() {
    var s = null;
    try {
      s = TS.store.get('ts_settings');
    } catch (e) {
      s = null;
    }
    if (!s) return;
    if (s.reducedMotion) document.body.classList.add('reduced-motion');
    /* The remaining settings (keyboard, fingerGuide, highlight, difficulty,
       backspace, layout, sound, keySound) are consumed by the views and the
       typing engine when they render. */
  }

  function wireShell() {
    var collapseBtn = document.getElementById('collapse-toggle');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', function () {
        document.body.classList.toggle('collapsed');
        var collapsed = document.body.classList.contains('collapsed');
        collapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        collapseBtn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
        collapseBtn.setAttribute('title', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
      });
    }

    var burger = document.getElementById('hamburger');
    if (burger) {
      burger.addEventListener('click', function () {
        document.body.classList.toggle('nav-open');
      });
    }

    var scrim = document.getElementById('scrim');
    if (scrim) {
      scrim.addEventListener('click', function () {
        document.body.classList.remove('nav-open');
      });
    }
  }

  function boot() {
    try {
      TS.store.init();
    } catch (e) {
      /* Storage is optional: the app still boots with in-memory defaults. */
    }
    applySettings();
    wireShell();
    TS.router.start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
