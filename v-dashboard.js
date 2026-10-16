/* Type Saif — views/v-dashboard.js — TS.views.dashboard
 * Dashboard: continue-learning card, performance overview (real data only),
 * daily challenge, recent activity. New users see empty states, never fake stats.
 */
(function () {
  'use strict';

  var root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  var TS = root.TypeSaif || (root.TypeSaif = {});
  root.TS = TS;
  TS.views = TS.views || {};

  /* ---------- guarded helpers (self-contained; no dependency on other builders) ---------- */

  function num(v, fb) {
    var n = Number(v);
    return (isFinite(n) ? n : (fb || 0));
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function storeGet(key, fb) {
    try {
      if (TS.store && typeof TS.store.get === 'function') return TS.store.get(key, fb);
    } catch (e) { /* fall through */ }
    try {
      if (typeof localStorage !== 'undefined') {
        var raw = localStorage.getItem(key);
        if (raw === null || raw === undefined) return fb;
        return JSON.parse(raw);
      }
    } catch (e2) { /* fall through */ }
    return fb;
  }

  function todayStr() {
    try {
      if (TS.gamify && typeof TS.gamify.todayStr === 'function') return TS.gamify.todayStr();
      if (TS.util && typeof TS.util.todayStr === 'function') return TS.util.todayStr();
    } catch (e) { /* fall through */ }
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function getLessonSafe(id) {
    try {
      if (TS.data && typeof TS.data.getLesson === 'function') return TS.data.getLesson(id);
    } catch (e) { /* fall through */ }
    return null;
  }

  function allLessonsSafe() {
    try {
      if (TS.data && typeof TS.data.allLessons === 'function') return TS.data.allLessons() || [];
      if (TS.data && TS.data.CURRICULUM) {
        var out = [];
        TS.data.CURRICULUM.forEach(function (lv) { (lv.lessons || []).forEach(function (l) { out.push(l); }); });
        return out;
      }
    } catch (e) { /* fall through */ }
    return [];
  }

  function fmtDur(sec) {
    sec = Math.max(0, Math.round(num(sec, 0)));
    var m = Math.floor(sec / 60), s = sec % 60;
    if (m >= 60) return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
    return m > 0 ? m + 'm ' + s + 's' : s + 's';
  }

  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function starsRow(stars) {
    stars = Math.max(0, Math.min(3, Math.round(num(stars, 0))));
    return '★'.repeat(stars) + '☆'.repeat(3 - stars);
  }

  function go(hash) {
    try {
      if (TS.router && typeof TS.router.go === 'function') { TS.router.go(hash); return; }
    } catch (e) { /* fall through */ }
    if (typeof window !== 'undefined') window.location.hash = hash;
  }

  /* ---------- sections ---------- */

  function continueCard() {
    var attempts = storeGet('ts_attempts', []) || [];
    var progress = storeGet('ts_progress', null);
    var all = allLessonsSafe();
    var isNew = attempts.length === 0;

    var lesson = null, pct = 0, resumeNote = '';
    if (progress && progress.lessonId) {
      lesson = getLessonSafe(progress.lessonId);
      if (lesson && lesson.text && lesson.text.length) {
        pct = Math.min(100, Math.max(0, Math.round((num(progress.position, 0) / lesson.text.length) * 100)));
        if (pct > 0 && pct < 100) resumeNote = 'Resume at ' + pct + '%';
      }
    }
    if (!lesson && all.length) lesson = all[0];

    var title, btnLabel, sub;
    if (isNew) {
      title = 'Welcome to Type Saif!';
      sub = 'Your typing journey starts here. Work through bite-size lessons, earn stars, ' +
            'and watch your speed grow — one key at a time.';
      btnLabel = 'Start First Lesson';
    } else {
      title = 'Continue Learning';
      sub = 'Pick up right where you left off.' + (resumeNote ? ' ' + resumeNote + '.' : '');
      btnLabel = pct > 0 && pct < 100 ? 'Resume Lesson' : 'Continue Lesson';
    }

    var lessonLine = lesson
      ? '<div class="cl-lesson"><strong>' + esc(lesson.title || lesson.id) + '</strong>' +
        (lesson.level ? ' <span class="badge">Level ' + esc(lesson.level) + '</span>' : '') +
        (!isNew && lesson.text && lesson.text.length
          ? '<div class="progress"><div class="progress-bar" style="width:' + pct + '%"></div></div>' +
            '<small>' + pct + '% complete</small>'
          : '') +
        '</div>'
      : '<p class="empty-state">Course data is not available yet.</p>';

    return '' +
      '<section class="card continue-card">' +
      '<h2>' + esc(title) + '</h2>' +
      '<p class="muted">' + esc(sub) + '</p>' +
      lessonLine +
      (lesson
        ? '<button class="btn btn-primary" data-go="#/lesson/' + esc(lesson.id) + '">' + esc(btnLabel) + '</button>'
        : '') +
      '</section>';
  }

  function overviewTiles() {
    var attempts = storeGet('ts_attempts', []) || [];
    var hasData = attempts.length > 0;
    var xpState = storeGet('ts_xp', { total: 0 }) || { total: 0 };
    var streak = storeGet('ts_streak', { count: 0, lastDate: null }) || {};
    var practiceSec = num(storeGet('ts_practiceSec', 0), 0);
    var gamify = TS.gamify || null;

    var last = hasData ? attempts[attempts.length - 1] : null;
    var bestWpm = 0, accSum = 0;
    var distinct = {};
    attempts.forEach(function (a) {
      a = a || {};
      var w = num(a.netWpm, 0);
      if (w > bestWpm) bestWpm = w;
      accSum += num(a.accuracy, 0);
      if (a.lessonId) distinct[a.lessonId] = true;
    });
    var distinctCount = Object.keys(distinct).length;
    var totalLessons = allLessonsSafe().length;
    var coursePct = totalLessons ? Math.round((distinctCount / totalLessons) * 100) : 0;

    function tile(label, value, sub) {
      return '<div class="stat-tile"><div class="stat-value">' + value + '</div>' +
        '<div class="stat-label">' + esc(label) + '</div>' +
        (sub ? '<div class="stat-sub">' + sub + '</div>' : '') + '</div>';
    }

    var dash = '—';
    var tiles =
      tile('Current WPM', hasData ? esc(String(Math.round(num(last.netWpm, 0) * 10) / 10)) : dash,
        hasData ? 'last attempt' : '') +
      tile('Best WPM', hasData ? esc(String(Math.round(bestWpm * 10) / 10)) : dash, '') +
      tile('Avg Accuracy', hasData ? esc((accSum / attempts.length).toFixed(1)) + '%' : dash, '') +
      tile('Lessons Completed', esc(String(distinctCount)), totalLessons ? 'of ' + totalLessons : '') +
      tile('Practice Time', esc(fmtDur(practiceSec)), '') +
      tile('Total XP', esc(String(Math.round(num(xpState.total, 0)))),
        gamify ? 'Level ' + gamify.levelFor(num(xpState.total, 0)) : '') +
      tile('Day Streak', esc(String(num(streak.count, 0))), num(streak.count, 0) === 1 ? 'day' : 'days') +
      tile('Course Progress', esc(coursePct + '%'), '');

    return '' +
      '<section class="card">' +
      '<h2>Performance Overview</h2>' +
      '<div class="stat-grid">' + tiles + '</div>' +
      (!hasData ? '<p class="empty-state">Complete a lesson to see your stats here.</p>' : '') +
      '</section>';
  }

  function dailyCard() {
    var gamify = TS.gamify;
    if (!gamify) return '';
    var today = todayStr();
    var ch = gamify.dailyChallenge(today);
    var daily = storeGet('ts_daily', {}) || {};
    var done = !!(daily[today] && daily[today].done) || gamify.isDailyDone(today);

    var route = '#/learn';
    if (ch.type === 'practice-5min') route = '#/practice';

    return '' +
      '<section class="card daily-card">' +
      '<div class="card-head"><h2>Daily Challenge</h2>' +
      (done ? '<span class="badge badge-gold">Done ✓</span>' : '<span class="badge">Pending</span>') +
      '</div>' +
      '<p><strong>' + esc(ch.title) + '</strong></p>' +
      '<p class="muted">' + esc(ch.desc) + '</p>' +
      (done
        ? '<p class="muted">Nice work — challenge complete. Come back tomorrow for a new one.</p>'
        : '<button class="btn btn-ghost" data-go="' + route + '">Start Challenge</button>') +
      '</section>';
  }

  function recentActivity() {
    var attempts = storeGet('ts_attempts', []) || [];
    var earned = storeGet('ts_achievements', {}) || {};
    var items = [];

    attempts.forEach(function (a) {
      if (!a || !a.date) return;
      var lesson = getLessonSafe(a.lessonId);
      items.push({
        date: a.date,
        icon: '⌨️',
        html: '<strong>' + esc(lesson ? (lesson.title || a.lessonId) : String(a.lessonId || 'Lesson')) + '</strong>' +
          ' — ' + esc(String(Math.round(num(a.netWpm, 0) * 10) / 10)) + ' WPM · ' +
          esc(num(a.accuracy, 0).toFixed(1)) + '% · <span class="stars">' + starsRow(a.stars) + '</span>'
      });
    });

    var achDefs = {};
    (TS.gamify && TS.gamify.ACHIEVEMENTS || []).forEach(function (d) { achDefs[d.id] = d; });
    Object.keys(earned).forEach(function (id) {
      var def = achDefs[id];
      if (!def || !earned[id]) return;
      items.push({
        date: earned[id],
        icon: '🏆',
        html: 'Achievement unlocked: <strong>' + esc(def.name) + '</strong> ' + esc(def.icon || '')
      });
    });

    items.sort(function (x, y) { return String(y.date).localeCompare(String(x.date)); });
    var top = items.slice(0, 6);

    var body = top.length
      ? '<ul class="activity-list">' + top.map(function (it) {
          return '<li><span class="act-icon">' + it.icon + '</span><span class="act-text">' + it.html +
            '</span><span class="act-time">' + esc(fmtDate(it.date)) + '</span></li>';
        }).join('') + '</ul>'
      : '<p class="empty-state">No activity yet. Complete your first lesson and it will show up here.</p>';

    return '<section class="card"><h2>Recent Activity</h2>' + body + '</section>';
  }

  /* ---------- view ---------- */

  function render(el) {
    el.innerHTML =
      '<div class="view view-dashboard">' +
      '<header class="view-head"><h1>Welcome to Type Saif!</h1>' +
      '<p class="muted">Build your typing skills one lesson at a time.</p></header>' +
      '<div class="dash-grid">' +
      continueCard() +
      dailyCard() +
      '</div>' +
      overviewTiles() +
      recentActivity() +
      '</div>';

    el.querySelectorAll('[data-go]').forEach(function (btn) {
      btn.addEventListener('click', function () { go(btn.getAttribute('data-go')); });
    });
  }

  TS.views.dashboard = { render: render };
})();
