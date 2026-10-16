/* Type Saif — views/v-achievements.js — TS.views.achievements
 * Achievements grid: every achievement from TS.gamify.ACHIEVEMENTS with earned
 * (gold, date) vs locked (gray) states, plus real progress hints
 * (e.g. "3/5 lessons").
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

  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString();
    } catch (e) { return ''; }
  }

  function fmtDur(sec) {
    sec = Math.max(0, Math.round(num(sec, 0)));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m > 0 ? m + 'm ' + s + 's' : s + 's';
  }

  function lessonLevel(lessonId) {
    try {
      if (TS.data && typeof TS.data.getLesson === 'function') {
        var l = TS.data.getLesson(lessonId);
        if (l && l.level) return num(l.level, 0);
      }
    } catch (e) { /* fall through */ }
    var m = /^L(\d+)-/.exec(String(lessonId || ''));
    return m ? num(m[1], 0) : 0;
  }

  /* ---------- progress hints (all derived from real store data) ---------- */

  function progressStats() {
    var attempts = storeGet('ts_attempts', []) || [];
    var practiceSec = num(storeGet('ts_practiceSec', 0), 0);
    var streak = storeGet('ts_streak', { count: 0, lastDate: null }) || {};
    var distinct = {}, bestAcc = 0, bestWpm = 0, l2 = false, improvedCount = 0;
    attempts.forEach(function (a) {
      a = a || {};
      if (a.lessonId) distinct[a.lessonId] = true;
      var acc = num(a.accuracy, 0), wpm = num(a.netWpm, 0);
      if (acc > bestAcc) bestAcc = acc;
      if (wpm > bestWpm) bestWpm = wpm;
      if (a.improved === true) improvedCount++;
      if (lessonLevel(a.lessonId) === 2) l2 = true;
    });
    return {
      attempts: attempts.length,
      distinct: Object.keys(distinct).length,
      bestAcc: bestAcc,
      bestWpm: bestWpm,
      practiceSec: practiceSec,
      streak: num(streak.count, 0),
      l2: l2,
      improvedCount: improvedCount
    };
  }

  function hintFor(id, st) {
    switch (id) {
      case 'first-lesson':
        return st.attempts > 0 ? 'Completed' : 'Complete your first lesson';
      case 'home-row-hero':
        return st.l2 ? 'Completed' : 'Finish any Level 2 lesson';
      case 'accuracy-master':
        return st.attempts > 0 ? 'Best so far: ' + st.bestAcc.toFixed(1) + '%' : 'Score 98%+ on any attempt';
      case 'speed-builder':
        return st.attempts > 0 ? 'Best so far: ' + (Math.round(st.bestWpm * 10) / 10) + ' WPM' : 'Reach 40 net WPM';
      case 'five-lessons':
        return Math.min(st.distinct, 5) + '/5 lessons';
      case 'ten-minutes':
        return fmtDur(Math.min(st.practiceSec, 600)) + ' / 10m';
      case 'streak-7':
        return Math.min(st.streak, 7) + '/7 days';
      case 'personal-best':
        return st.improvedCount > 0
          ? 'Beaten ' + st.improvedCount + (st.improvedCount === 1 ? ' time' : ' times')
          : 'Beat your best score on a lesson';
      default:
        return '';
    }
  }

  /* ---------- view ---------- */

  function render(el) {
    var defs = (TS.gamify && TS.gamify.ACHIEVEMENTS) || [];
    var earned = storeGet('ts_achievements', {}) || {};
    var st = progressStats();

    var earnedCount = defs.filter(function (d) { return !!earned[d.id]; }).length;

    var cards = defs.map(function (d) {
      var iso = earned[d.id];
      var isEarned = !!iso;
      return '' +
        '<div class="card ach-card ' + (isEarned ? 'ach-earned' : 'ach-locked') + '">' +
        '<div class="ach-icon">' + esc(d.icon || '🏅') + '</div>' +
        '<h3>' + esc(d.name) + '</h3>' +
        '<p class="muted">' + esc(d.desc) + '</p>' +
        '<div class="ach-foot">' +
        (isEarned
          ? '<span class="badge badge-gold">Earned · ' + esc(fmtDate(iso)) + '</span>'
          : '<span class="badge">Locked</span><span class="ach-hint">' + esc(hintFor(d.id, st)) + '</span>') +
        '</div></div>';
    }).join('');

    el.innerHTML =
      '<div class="view view-achievements">' +
      '<header class="view-head"><h1>Achievements</h1>' +
      '<p class="muted">' + earnedCount + ' of ' + defs.length + ' unlocked. Keep typing to earn them all.</p></header>' +
      (defs.length
        ? '<div class="ach-grid">' + cards + '</div>'
        : '<p class="empty-state">Achievements are not available yet.</p>') +
      '</div>';
  }

  TS.views.achievements = { render: render };
})();
