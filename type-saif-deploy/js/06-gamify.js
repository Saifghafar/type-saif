/* Type Saif — 06-gamify.js — TS.gamify
 * XP, levels, stars, streaks, achievements, daily challenges.
 * Classic script; registers on window.TypeSaif (short: TS).
 * All cross-module calls (TS.store / TS.util / TS.data) are guarded so this
 * module still works if a dependency file hasn't loaded yet.
 */
(function () {
  'use strict';

  var root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  var TS = root.TypeSaif || (root.TypeSaif = {});
  root.TS = TS;

  /* ---------- guarded helpers ---------- */

  function num(v, fb) {
    var n = Number(v);
    return (isFinite(n) ? n : (fb || 0));
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function ymd(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function todayStr() {
    try {
      if (TS.util && typeof TS.util.todayStr === 'function') return TS.util.todayStr();
    } catch (e) { /* fall through */ }
    return ymd(new Date());
  }

  function addDays(dateStr, n) {
    var p = String(dateStr).split('-');
    var d = new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1);
    d.setDate(d.getDate() + n);
    return ymd(d);
  }

  // Guarded storage access. Prefers TS.store; falls back to direct localStorage
  // so the module never crashes when 01-storage.js isn't present.
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

  function storeSet(key, val) {
    try {
      if (TS.store && typeof TS.store.set === 'function') { TS.store.set(key, val); return; }
    } catch (e) { /* fall through */ }
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(val));
    } catch (e2) { /* ignore */ }
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

  /* ---------- XP & levels ---------- */

  // level = floor(total/200) + 1  (contract §3 / §7)
  function levelFor(total) {
    return Math.floor(Math.max(0, num(total, 0)) / 200) + 1;
  }

  function addXp(n) {
    n = Math.max(0, Math.round(num(n, 0)));
    var state = storeGet('ts_xp', { total: 0 }) || { total: 0 };
    var oldTotal = num(state.total, 0);
    var oldLevel = levelFor(oldTotal);
    var total = oldTotal + n;
    state.total = total;
    storeSet('ts_xp', state);
    var level = levelFor(total);
    return { leveledUp: level > oldLevel, level: level, total: total, xpAdded: n };
  }

  function starsFor(accuracy) {
    accuracy = num(accuracy, 0);
    if (accuracy >= 97) return 3;
    if (accuracy >= 90) return 2;
    if (accuracy >= 75) return 1;
    return 0;
  }

  // Lesson completion: 20 base + round(accuracy*0.3) + stars*5.
  // ANTI-FARMING: only the improvement delta over this lesson's previous best
  // XP is actually added. Best is keyed by score = netWpm * accuracy.
  function completeLesson(summary, lessonId) {
    summary = summary || {};
    var accuracy = Math.min(100, Math.max(0, num(summary.accuracy, 0)));
    var netWpm = Math.max(0, num(summary.netWpm, 0));
    var stars = starsFor(accuracy);
    var xp = 20 + Math.round(accuracy * 0.3) + stars * 5;

    var bests = storeGet('ts_bests', {}) || {};
    var prev = bests[lessonId] || null;
    var prevXp = prev ? num(prev.xp, 0) : 0;
    var xpEarned = Math.max(0, xp - prevXp);

    var score = netWpm * accuracy;
    var prevScore = prev ? num(prev.score, num(prev.netWpm, 0) * num(prev.accuracy, 0)) : 0;
    var improved = !!prev && score > prevScore;
    var prevBest = prev ? { wpm: num(prev.netWpm, 0), accuracy: num(prev.accuracy, 0) } : null;

    if (!prev || score > prevScore) {
      bests[lessonId] = {
        netWpm: netWpm,
        accuracy: accuracy,
        stars: stars,
        xp: xp,
        score: score,
        date: new Date().toISOString()
      };
      storeSet('ts_bests', bests);
    }

    var res = addXp(xpEarned);
    return {
      xpEarned: xpEarned,
      stars: stars,
      improved: improved,
      prevBest: prevBest,
      leveledUp: res.leveledUp,
      level: res.level
    };
  }

  // Games: xp = min(25, floor(score/4)). Updates ts_games best/plays/last.
  function addGameXp(gameId, score) {
    score = Math.max(0, Math.round(num(score, 0)));
    var xp = Math.min(25, Math.floor(score / 4));
    addXp(xp);
    var games = storeGet('ts_games', {}) || {};
    var g = games[gameId] || { best: 0, plays: 0, last: null };
    g.plays = num(g.plays, 0) + 1;
    if (score > num(g.best, 0)) g.best = score;
    g.last = { score: score, date: new Date().toISOString() };
    games[gameId] = g;
    storeSet('ts_games', games);
    return xp;
  }

  /* ---------- streaks & daily ---------- */

  // Streak: increments when any lesson/game completes on a new calendar day;
  // resets to 1 if a day was skipped. No-op if already recorded today.
  function recordActivity() {
    var today = todayStr();
    var streak = storeGet('ts_streak', { count: 0, lastDate: null }) || { count: 0, lastDate: null };
    streak.count = num(streak.count, 0);
    if (streak.lastDate !== today) {
      streak.count = (streak.lastDate === addDays(today, -1)) ? streak.count + 1 : 1;
      streak.lastDate = today;
      storeSet('ts_streak', streak);
    }
    syncDaily(today);
    return { count: streak.count, lastDate: streak.lastDate };
  }

  /* ---------- achievements ---------- */

  var ACHIEVEMENTS = [
    { id: 'first-lesson',    name: 'First Steps',     desc: 'Complete your first typing lesson.',              icon: '🌱' },
    { id: 'home-row-hero',   name: 'Home Row Hero',   desc: 'Finish any Level 2 lesson.',                      icon: '⌨️' },
    { id: 'accuracy-master', name: 'Accuracy Master', desc: 'Score 98% accuracy or higher on any attempt.',    icon: '🎯' },
    { id: 'speed-builder',   name: 'Speed Builder',   desc: 'Reach 40 net WPM on any attempt.',                icon: '⚡' },
    { id: 'five-lessons',    name: 'Explorer',        desc: 'Attempt 5 different lessons.',                    icon: '🧭' },
    { id: 'ten-minutes',     name: 'Warming Up',      desc: 'Accumulate 10 minutes of total practice time.',  icon: '⏱️' },
    { id: 'streak-7',        name: 'On Fire',         desc: 'Keep a 7-day practice streak.',                   icon: '🔥' },
    { id: 'personal-best',   name: 'Personal Best',   desc: 'Beat your own best score on a lesson.',          icon: '🏆' }
  ];

  function achById(id) {
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      if (ACHIEVEMENTS[i].id === id) return ACHIEVEMENTS[i];
    }
    return null;
  }

  // Evaluates every achievement against real store data. Writes ts_achievements
  // for newly earned ones and returns ONLY the newly earned achievement objects.
  function checkAll() {
    var earned = storeGet('ts_achievements', {}) || {};
    var attempts = storeGet('ts_attempts', []) || [];
    var practiceSec = num(storeGet('ts_practiceSec', 0), 0);
    var streak = storeGet('ts_streak', { count: 0, lastDate: null }) || {};
    var newly = [];
    var dirty = false;

    function award(id) {
      if (earned[id]) return;
      var def = achById(id);
      if (!def) return;
      var iso = new Date().toISOString();
      earned[id] = iso;
      dirty = true;
      newly.push({ id: def.id, name: def.name, desc: def.desc, icon: def.icon, earnedAt: iso });
    }

    var distinct = {};
    var bestAcc = 0, bestWpm = 0, beatBest = false, l2Done = false;
    for (var i = 0; i < attempts.length; i++) {
      var a = attempts[i] || {};
      if (a.lessonId) distinct[a.lessonId] = true;
      var acc = num(a.accuracy, 0), wpm = num(a.netWpm, 0);
      if (acc > bestAcc) bestAcc = acc;
      if (wpm > bestWpm) bestWpm = wpm;
      if (a.improved === true) beatBest = true;
      if (lessonLevel(a.lessonId) === 2) l2Done = true;
    }
    var distinctCount = Object.keys(distinct).length;

    if (attempts.length >= 1) award('first-lesson');
    if (l2Done) award('home-row-hero');
    if (bestAcc >= 98) award('accuracy-master');
    if (bestWpm >= 40) award('speed-builder');
    if (distinctCount >= 5) award('five-lessons');
    if (practiceSec >= 600) award('ten-minutes');
    if (num(streak.count, 0) >= 7) award('streak-7');
    if (beatBest) award('personal-best');

    if (dirty) storeSet('ts_achievements', earned);
    return newly;
  }

  /* ---------- daily challenge ---------- */

  var DAILY_DEFS = {
    'complete-lesson': { title: 'Complete a Lesson',  desc: 'Finish any typing lesson today.' },
    'accuracy-95':     { title: 'Precision Focus',    desc: 'Score 95% accuracy or higher on any attempt today.' },
    'practice-5min':    { title: 'Five-Minute Drill',  desc: 'Practice for at least 5 minutes today.' },
    'beat-speed':       { title: 'Beat Your Speed',    desc: 'Beat your personal best net WPM on any lesson today.' }
  };
  var DAILY_TYPES = Object.keys(DAILY_DEFS);

  // Deterministic pick from the date string: hash char codes → one of 4 types.
  function dailyChallenge(dateStr) {
    dateStr = String(dateStr || todayStr());
    var h = 0;
    for (var i = 0; i < dateStr.length; i++) h += dateStr.charCodeAt(i);
    var type = DAILY_TYPES[h % DAILY_TYPES.length];
    var def = DAILY_DEFS[type];
    return { id: dateStr + ':' + type, type: type, date: dateStr, title: def.title, desc: def.desc };
  }

  function attemptsOn(dateStr) {
    var attempts = storeGet('ts_attempts', []) || [];
    return attempts.filter(function (a) {
      return a && a.date && String(a.date).slice(0, 10) === dateStr;
    });
  }

  // Seconds of practice gained on dateStr: baseline is captured in
  // ts_daily[date].detail.practiceBaseline on first evaluation of the day.
  function practiceGainedToday(dateStr) {
    var total = num(storeGet('ts_practiceSec', 0), 0);
    var daily = storeGet('ts_daily', {}) || {};
    var entry = daily[dateStr] || null;
    var base = (entry && entry.detail && typeof entry.detail.practiceBaseline === 'number')
      ? entry.detail.practiceBaseline : null;
    if (base === null) {
      base = total;
      var e = entry || { challengeId: dailyChallenge(dateStr).id, done: false, detail: {} };
      e.detail = e.detail || {};
      e.detail.practiceBaseline = base;
      daily[dateStr] = e;
      storeSet('ts_daily', daily);
    }
    return Math.max(0, total - base);
  }

  function isDailyDone(dateStr) {
    dateStr = String(dateStr || todayStr());
    var ch = dailyChallenge(dateStr);
    var todays = attemptsOn(dateStr);
    switch (ch.type) {
      case 'complete-lesson':
        return todays.length > 0;
      case 'accuracy-95':
        return todays.some(function (a) { return num(a.accuracy, 0) >= 95; });
      case 'practice-5min':
        return practiceGainedToday(dateStr) >= 300;
      case 'beat-speed': {
        var prevBest = 0, found = false;
        var attempts = storeGet('ts_attempts', []) || [];
        attempts.forEach(function (a) {
          if (a && a.date && String(a.date).slice(0, 10) < dateStr) {
            var w = num(a.netWpm, 0);
            if (!found || w > prevBest) { prevBest = w; found = true; }
          }
        });
        if (!found) return false;
        return todays.some(function (a) { return num(a.netWpm, 0) > prevBest; });
      }
    }
    return false;
  }

  function markDaily(dateStr) {
    dateStr = String(dateStr || todayStr());
    var daily = storeGet('ts_daily', {}) || {};
    var e = daily[dateStr] || { challengeId: dailyChallenge(dateStr).id, done: false, detail: {} };
    e.challengeId = dailyChallenge(dateStr).id;
    e.done = true;
    e.detail = e.detail || {};
    daily[dateStr] = e;
    storeSet('ts_daily', daily);
    return e;
  }

  // Re-evaluates today's challenge and marks it done when complete.
  function syncDaily(dateStr) {
    dateStr = String(dateStr || todayStr());
    var daily = storeGet('ts_daily', {}) || {};
    var e = daily[dateStr];
    if (e && e.done) return true;
    if (isDailyDone(dateStr)) { markDaily(dateStr); return true; }
    return false;
  }

  /* ---------- header chips ---------- */

  // Refreshes the streak/XP chips in the topbar (called by TS.router after
  // every navigation). Never throws; silently skips when the DOM isn't ready.
  function renderHeaderChips() {
    try {
      var streak = storeGet('ts_streak', { count: 0, lastDate: null }) || {};
      var xp = storeGet('ts_xp', { total: 0 }) || {};
      var sEl = document.getElementById('chip-streak');
      var xEl = document.getElementById('chip-xp');
      if (sEl) {
        var b = sEl.querySelector('b');
        if (b) b.textContent = String(num(streak.count, 0));
        sEl.title = 'Day streak: ' + num(streak.count, 0) + ' day' + (num(streak.count, 0) === 1 ? '' : 's');
      }
      if (xEl) {
        var xb = xEl.querySelector('b');
        if (xb) xb.textContent = String(Math.round(num(xp.total, 0)));
        xEl.title = 'Total XP — level ' + levelFor(num(xp.total, 0));
      }
    } catch (e) { /* never block navigation */ }
  }

  /* ---------- public API ---------- */

  TS.gamify = {
    ACHIEVEMENTS: ACHIEVEMENTS,
    addXp: addXp,
    levelFor: levelFor,
    starsFor: starsFor,
    completeLesson: completeLesson,
    addGameXp: addGameXp,
    recordActivity: recordActivity,
    checkAll: checkAll,
    dailyChallenge: dailyChallenge,
    isDailyDone: isDailyDone,
    markDaily: markDaily,
    syncDaily: syncDaily,
    renderHeaderChips: renderHeaderChips,
    practiceGainedToday: practiceGainedToday,
    attemptsOn: attemptsOn,
    todayStr: todayStr
  };
})();
