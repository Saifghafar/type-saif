/* Type Saif — views/v-learn.js — TS.views.learn
 * Course map: 10 level cards with lesson lists. States: completed (best stars),
 * current (next unlocked), locked. Unlocked lessons link to #/lesson/<id>;
 * completed lessons are re-playable. Resume note when ts_progress matches.
 */
(function () {
  'use strict';

  var root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  var TS = root.TypeSaif || (root.TypeSaif = {});
  root.TS = TS;
  TS.views = TS.views || {};

  /* ---------- guarded helpers ---------- */

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

  function getCurriculum() {
    try {
      if (TS.data && TS.data.CURRICULUM && TS.data.CURRICULUM.length) return TS.data.CURRICULUM;
    } catch (e) { /* fall through */ }
    return [];
  }

  function starsRow(stars) {
    stars = Math.max(0, Math.min(3, Math.round(num(stars, 0))));
    return '★'.repeat(stars) + '☆'.repeat(3 - stars);
  }

  /* ---------- view ---------- */

  function render(el) {
    var curriculum = getCurriculum();

    if (!curriculum.length) {
      el.innerHTML =
        '<div class="view view-learn"><header class="view-head"><h1>Learn</h1></header>' +
        '<p class="empty-state">Course data is not available yet. Please reload the app.</p></div>';
      return;
    }

    var attempts = storeGet('ts_attempts', []) || [];
    var bests = storeGet('ts_bests', {}) || {};
    var progress = storeGet('ts_progress', null);

    var doneSet = {};
    attempts.forEach(function (a) { if (a && a.lessonId) doneSet[a.lessonId] = true; });

    // Flat ordered lesson list for the unlock rule: lesson i is unlocked when
    // every previous lesson in the whole course has >= 1 attempt (or i === 0).
    var flat = [];
    curriculum.forEach(function (lv) { (lv.lessons || []).forEach(function (l) { flat.push(l); }); });
    var stateById = {};
    flat.forEach(function (l, i) {
      var unlocked = (i === 0) || flat.slice(0, i).every(function (p) { return !!doneSet[p.id]; });
      stateById[l.id] = {
        done: !!doneSet[l.id],
        unlocked: unlocked,
        current: unlocked && !doneSet[l.id]
      };
    });

    var html = '<div class="view view-learn">' +
      '<header class="view-head"><h1>Learn</h1>' +
      '<p class="muted">Work through each level to unlock the next. Completed lessons can be replayed any time.</p></header>';

    curriculum.forEach(function (lv) {
      var lessons = lv.lessons || [];
      var doneCount = lessons.filter(function (l) { return stateById[l.id] && stateById[l.id].done; }).length;
      var pct = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0;

      html += '<section class="card level-card">' +
        '<div class="card-head"><h2>Level ' + esc(lv.n) + ' — ' + esc(lv.title || '') + '</h2>' +
        '<span class="badge">' + doneCount + '/' + lessons.length + '</span></div>' +
        (lv.desc ? '<p class="muted">' + esc(lv.desc) + '</p>' : '') +
        '<div class="progress"><div class="progress-bar" style="width:' + pct + '%"></div></div>' +
        '<ul class="lesson-list">';

      lessons.forEach(function (l) {
        var st = stateById[l.id] || { done: false, unlocked: false, current: false };
        var best = bests[l.id];
        var isResume = progress && progress.lessonId === l.id;
        var resumeNote = '';
        if (isResume && l.text && l.text.length) {
          var rp = Math.min(100, Math.max(0, Math.round((num(progress.position, 0) / l.text.length) * 100)));
          if (rp > 0 && rp < 100) resumeNote = ' <span class="resume-note">Resume at ' + rp + '%</span>';
        }

        var statusIcon, statusClass;
        if (st.done) { statusIcon = '✓'; statusClass = 'done'; }
        else if (st.current) { statusIcon = '▶'; statusClass = 'current'; }
        else if (st.unlocked) { statusIcon = '○'; statusClass = 'open'; }
        else { statusIcon = '🔒'; statusClass = 'locked'; }

        var inner =
          '<span class="lesson-status ' + statusClass + '">' + statusIcon + '</span>' +
          '<span class="lesson-main"><span class="lesson-title">' + esc(l.title || l.id) + '</span>' +
          (l.desc ? '<span class="lesson-desc">' + esc(l.desc) + '</span>' : '') + resumeNote + '</span>' +
          '<span class="lesson-meta">' +
          (st.done && best ? '<span class="stars" title="Best: ' + esc(String(Math.round(num(best.netWpm, 0) * 10) / 10)) +
            ' WPM">' + starsRow(best.stars) + '</span>' : '') +
          (st.current ? '<span class="badge badge-blue">Up next</span>' : '') +
          '</span>';

        if (st.unlocked) {
          html += '<li class="lesson-row ' + statusClass + '"><a class="lesson-link" href="#/lesson/' +
            esc(l.id) + '">' + inner + '</a></li>';
        } else {
          html += '<li class="lesson-row locked" aria-disabled="true" title="Complete previous lessons to unlock">' +
            inner + '</li>';
        }
      });

      html += '</ul></section>';
    });

    html += '</div>';
    el.innerHTML = html;
  }

  TS.views.learn = { render: render };
})();
