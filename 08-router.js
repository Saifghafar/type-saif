/* Type Saif — js/08-router.js
   TS.router — hash routing per ARCHITECTURE.md §0.
   Maps each hash to TS.views.<name>.render(el, params), calls the previous
   view's destroy() when present, and updates the sidebar + topbar.
   Missing view modules (or render crashes) degrade to a friendly empty
   state — the app never crashes, so it boots cleanly even before all
   view files exist. */
(function () {
  'use strict';

  window.TypeSaif = window.TypeSaif || {};
  var TS = window.TypeSaif;

  var appEl = null;
  var started = false;
  var current = null; // { name, module }

  var TITLES = {
    dashboard: 'Dashboard',
    learn: 'Learn to Type',
    lesson: 'Lesson',
    practice: 'Practice',
    games: 'Typing Games',
    game: 'Game',
    progress: 'Progress',
    achievements: 'Achievements',
    reports: 'Lesson Reports',
    settings: 'Settings'
  };

  /* Param routes highlight their parent section in the sidebar. */
  var PARENT_NAV = {
    lesson: 'learn',
    game: 'games'
  };

  var ROUTES = [
    { re: /^\/?$/, view: 'dashboard' },
    { re: /^\/dashboard\/?$/, view: 'dashboard' },
    { re: /^\/learn\/?$/, view: 'learn' },
    { re: /^\/lesson\/([^\/]+)\/?$/, view: 'lesson', params: ['id'] },
    { re: /^\/practice\/?$/, view: 'practice' },
    { re: /^\/games\/?$/, view: 'games' },
    { re: /^\/game\/([^\/]+)\/?$/, view: 'game', params: ['id'] },
    { re: /^\/progress\/?$/, view: 'progress' },
    { re: /^\/achievements\/?$/, view: 'achievements' },
    { re: /^\/reports\/?$/, view: 'reports' },
    /* Report detail is handled by the reports view with an attemptId param. */
    { re: /^\/report\/([^\/]+)\/?$/, view: 'reports', params: ['attemptId'] },
    { re: /^\/settings\/?$/, view: 'settings' }
  ];

  function parseHash() {
    var raw = (window.location.hash || '').replace(/^#/, '');
    var path = raw || '/dashboard';
    for (var i = 0; i < ROUTES.length; i++) {
      var m = path.match(ROUTES[i].re);
      if (m) {
        var params = {};
        var names = ROUTES[i].params || [];
        for (var j = 0; j < names.length; j++) {
          try {
            params[names[j]] = decodeURIComponent(m[j + 1]);
          } catch (e) {
            params[names[j]] = m[j + 1];
          }
        }
        return { view: ROUTES[i].view, params: params, path: path };
      }
    }
    return { view: null, params: {}, path: path };
  }

  function setTitle(t) {
    var el = document.getElementById('page-title');
    if (el) el.textContent = t;
    document.title = t + ' — Type Saif';
  }

  function setActive(viewName) {
    var navKey = PARENT_NAV[viewName] || viewName;
    var links = document.querySelectorAll('#sidebar .nav-link');
    for (var i = 0; i < links.length; i++) {
      var on = links[i].getAttribute('data-nav') === navKey;
      links[i].classList.toggle('active', on);
      if (on) links[i].setAttribute('aria-current', 'page');
      else links[i].removeAttribute('aria-current');
    }
  }

  function homeAction() {
    return '<a class="btn btn-primary" href="#/dashboard">Back to Dashboard</a>';
  }

  /* Optional hook so the gamify module can refresh the streak/XP chips. */
  function refreshChips() {
    try {
      if (TS.gamify && typeof TS.gamify.renderHeaderChips === 'function') {
        TS.gamify.renderHeaderChips();
      }
    } catch (e) { /* never block navigation */ }
  }

  function render() {
    if (!appEl) appEl = document.getElementById('app');
    if (!appEl) return;

    var route = parseHash();

    /* Tear down the previous view. */
    if (current && current.module && typeof current.module.destroy === 'function') {
      try { current.module.destroy(); } catch (e) { /* keep navigating */ }
    }
    current = null;

    /* Close the mobile drawer on every navigation. */
    try { document.body.classList.remove('nav-open'); } catch (e) { /* ignore */ }

    /* 404 — no route matched. */
    if (!route.view) {
      setTitle('Page not found');
      setActive('__none__');
      appEl.innerHTML = TS.ui.emptyState(
        'Page not found',
        'There is no page at "' + route.path + '". Check the address or head back home.',
        homeAction()
      );
      refreshChips();
      return;
    }

    var viewName = route.view;
    var title = TITLES[viewName] || 'Type Saif';
    if (route.params.id) title += ' \u00B7 ' + route.params.id;
    setTitle(title);
    setActive(viewName);

    appEl.innerHTML = '';

    var mod = TS.views ? TS.views[viewName] : null;
    if (!mod || typeof mod.render !== 'function') {
      /* View module not loaded yet — degrade gracefully, no crash. */
      appEl.innerHTML = TS.ui.emptyState(
        'Section not available',
        'The "' + title + '" section has not loaded yet. Make sure all of the app\u2019s script files are in place, then reload the page.',
        homeAction()
      );
      refreshChips();
      return;
    }

    try {
      mod.render(appEl, route.params || {});
      current = { name: viewName, module: mod };
    } catch (err) {
      current = null;
      appEl.innerHTML = TS.ui.emptyState(
        'Something went wrong',
        'This section ran into a problem while loading. Reloading the page usually fixes it.',
        homeAction()
      );
    }
    refreshChips();
  }

  function navigate(hash) {
    if (window.location.hash === hash) render();
    else window.location.hash = hash;
  }

  function start() {
    if (started) return;
    started = true;
    if (!window.location.hash) window.location.hash = '#/dashboard';
    window.addEventListener('hashchange', render);
    render();
  }

  TS.router = {
    start: start,
    render: render,
    navigate: navigate,
    setTitle: setTitle,
    currentView: function () { return current ? current.name : null; }
  };
})();
