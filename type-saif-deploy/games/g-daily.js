/* Type Saif — Game: Daily Challenge
 * Picks today's challenge deterministically via TS.gamify.dailyChallenge(date)
 * (guarded; deterministic local fallback over the 4 known types):
 *   complete-lesson → link to Learn + poll ts_attempts for today's completion
 *   accuracy-95     → mini passage game; done when accuracy >= 95%
 *   practice-5min   → 5-minute free-type timer with a word stream
 *   beat-speed      → 60s word-sprint variant; done when score >= target
 *                       (Word Sprint personal best, or 10 if none yet)
 * Completion is recorded in ts_daily[YYYY-MM-DD] = {challengeId, done, detail}.
 * Scored mini-games also save to ts_games["daily-challenge"] and award XP via
 * TS.gamify.addGameXp (both guarded).
 * Registers TS.games["daily-challenge"] = {id,title,desc,icon,render,destroy}.
 */
(function () {
"use strict";
var T = (window.TypeSaif = window.TypeSaif || {});
T.games = T.games || {};
var current = null;

/* ---------- guarded, self-contained helpers ---------- */
function storeGet(k, fb) { try { if (T.store && T.store.get) { var v = T.store.get(k, fb); return v === undefined ? fb : v; } } catch (e) {} return fb; }
function storeSet(k, v) { try { if (T.store && T.store.set) T.store.set(k, v); } catch (e) {} }
function wordList(tier) {
  var lists = (T.data && T.data.WORD_LISTS) || {};
  var w = lists[tier] || lists.medium || lists.easy || [];
  if (w && w.length) return w.slice();
  return "the and for are but not you all any can had her was one our out day get has him his how its may new now old see two way who boy did".split(" ");
}
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function toast(msg) { try { if (T.ui && T.ui.toast) T.ui.toast(msg); } catch (e) {} }
function pad(n) { return (n < 10 ? "0" : "") + n; }
function todayStr() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function makeClock() {
  var acc = 0, t0 = 0, running = false;
  return {
    start: function () { if (!running) { running = true; t0 = performance.now(); } },
    pause: function () { if (running) { acc += performance.now() - t0; running = false; } },
    reset: function () { acc = 0; running = false; },
    running: function () { return running; },
    elapsed: function () { return (acc + (running ? performance.now() - t0 : 0)) / 1000; }
  };
}
function keyOK(e) {
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  if (e.repeat) return false;
  var k = e.key;
  if (k === "Dead" || k === "Unidentified") return false;
  return true;
}
function loadGames() { var g = storeGet("ts_games", {}); return g || {}; }
function finishGame(gameId, score, detail) {
  score = Math.max(0, Math.round(score));
  var games = loadGames();
  var rec = games[gameId] || { best: 0, plays: 0, last: null };
  var isBest = score > (rec.best || 0);
  rec.best = Math.max(rec.best || 0, score);
  rec.plays = (rec.plays || 0) + 1;
  rec.last = { score: score, date: new Date().toISOString(), detail: detail || {} };
  games[gameId] = rec;
  storeSet("ts_games", games);
  var xp;
  try { if (T.gamify && T.gamify.addGameXp) xp = T.gamify.addGameXp(gameId, score); } catch (e) {}
  if (typeof xp !== "number" || isNaN(xp)) xp = Math.min(25, Math.floor(score / 4));
  try { if (T.gamify && T.gamify.recordActivity) T.gamify.recordActivity(); } catch (e) {}
  return { rec: rec, isBest: isBest, xp: xp };
}
function hudTile(label, id, val) {
  return '<div style="flex:1;min-width:100px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:8px 12px">'
    + '<div style="font-size:12px;color:var(--text-2)">' + esc(label) + '</div>'
    + '<div id="' + id + '" style="font-size:22px;font-weight:700">' + esc(val) + '</div></div>';
}
function fmtTime(sec) { sec = Math.floor(sec); var m = Math.floor(sec / 60), s = sec % 60; return m + ":" + (s < 10 ? "0" : "") + s; }

/* ---------- daily challenge plumbing ---------- */
var GAME_ID = "daily-challenge";
var TYPES = ["complete-lesson", "accuracy-95", "practice-5min", "beat-speed"];
var META = {
  "complete-lesson": { icon: "📚", title: "Complete a Lesson", desc: "Finish any lesson today to complete the daily challenge." },
  "accuracy-95":     { icon: "🎯", title: "95% Accuracy Run", desc: "Type the passage with at least 95% accuracy. Backspace allowed, no timer pressure." },
  "practice-5min":   { icon: "⏱️", title: "5-Minute Practice", desc: "Free-type the word stream for 5 full minutes. Just keep typing!" },
  "beat-speed":      { icon: "⚡", title: "Beat Your Speed", desc: "60-second sprint: score at least your target number of correct words." }
};

function challengeType(today) {
  try {
    if (T.gamify && T.gamify.dailyChallenge) {
      var r = T.gamify.dailyChallenge(today);
      var id = (typeof r === "string") ? r : (r && (r.id || r.type || r.challengeId));
      if (id && TYPES.indexOf(id) >= 0) return id;
    }
  } catch (e) {}
  var h = 0;
  for (var i = 0; i < today.length; i++) h = ((h * 31) + today.charCodeAt(i)) >>> 0;
  return TYPES[h % TYPES.length];
}
function dailyRecord(today) {
  var d = storeGet("ts_daily", {}) || {};
  return d[today] || null;
}
function lessonAttemptToday(today) {
  var at = storeGet("ts_attempts", []) || [];
  for (var i = 0; i < at.length; i++) {
    var a = at[i]; if (!a) continue;
    var dt = a.date || a.completedAt || a.timestamp || a.createdAt;
    if (dt && String(dt).slice(0, 10) === today) return a;
  }
  return null;
}

function render(el) {
  destroy();
  var today = todayStr();
  var type = challengeType(today);
  var meta = META[type];
  var existing = dailyRecord(today);
  var alreadyDone = !!(existing && existing.done && (existing.challengeId === type || !existing.challengeId));
  var target = null;
  if (type === "beat-speed") target = ((loadGames()["word-sprint"] || {}).best || 0) > 0 ? (loadGames()["word-sprint"] || {}).best : 10;

  var S = current = {
    type: type, today: today, done: alreadyDone, target: target,
    teardown: [], body: null, els: {}
  };

  el.innerHTML =
    '<div class="card" style="margin-bottom:12px">'
    + '<h2 style="margin:0 0 6px">📅 Daily Challenge</h2>'
    + '<p style="margin:0;color:var(--text-2)">A new challenge every day (' + esc(today) + '). Complete it to mark the day done.</p>'
    + '</div>'
    + '<div class="card" style="margin-bottom:12px">'
    + '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">'
    + '<div style="font-size:40px">' + meta.icon + '</div>'
    + '<div style="flex:1;min-width:200px"><h3 style="margin:0 0 4px">' + esc(meta.title) + '</h3>'
    + '<p style="margin:0;color:var(--text-2)">' + esc(meta.desc)
    + (type === "beat-speed" ? ' Target: <b>' + target + ' words</b>.' : '')
    + '</p></div>'
    + '<div id="dc-status">' + (alreadyDone ? '<span class="badge">✅ Completed today</span>' : '<span class="badge">🕐 In progress</span>') + '</div>'
    + '</div></div>'
    + '<div id="dc-body"></div>'
    + '<div id="dc-result"></div>';

  S.body = el.querySelector("#dc-body");
  S.els.status = el.querySelector("#dc-status");
  S.els.result = el.querySelector("#dc-result");

  function onTeardown(fn) { S.teardown.push(fn); }

  function markDone(detail, scoreForXp) {
    if (S.done) return;
    S.done = true;
    var d = storeGet("ts_daily", {}) || {};
    d[S.today] = { challengeId: S.type, done: true, detail: detail || {} };
    storeSet("ts_daily", d);
    var xpNote = "";
    if (typeof scoreForXp === "number") {
      var r = finishGame(GAME_ID, scoreForXp, { type: S.type, detail: detail || {} });
      xpNote = '<div style="margin:10px 0"><span class="badge">+' + r.xp + ' XP earned</span></div>';
    } else {
      try { if (T.gamify && T.gamify.recordActivity) T.gamify.recordActivity(); } catch (e) {}
    }
    toast("🎉 Daily challenge complete!");
    S.els.status.innerHTML = '<span class="badge">✅ Completed today</span>';
    S.els.result.innerHTML = '<div class="card" style="margin-top:12px;text-align:center;padding:24px">'
      + '<div style="font-size:40px">🎉</div><h3 style="margin:8px 0">Daily challenge complete!</h3>'
      + '<p style="color:var(--text-2);margin:0 0 8px">Come back tomorrow for a new one.</p>' + xpNote
      + '<a class="btn btn-ghost" href="#/games" style="text-decoration:none">All games</a></div>';
  }

  function captureInput(id, placeholder) {
    return '<input id="' + id + '" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" '
      + 'placeholder="' + esc(placeholder) + '" aria-label="' + esc(placeholder) + '" '
      + 'style="margin-top:12px;width:100%;max-width:420px;padding:10px 14px;font-size:18px;border:1px solid var(--border);border-radius:10px" />';
  }
  function controlsHTML(p) {
    return '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + '<button class="btn btn-primary" id="' + p + '-start">Start</button>'
      + '<button class="btn btn-ghost" id="' + p + '-pause" disabled>Pause</button>'
      + '<button class="btn btn-ghost" id="' + p + '-restart">Restart</button></div>';
  }

  /* ----- type: complete-lesson ----- */
  function buildCompleteLesson() {
    S.body.innerHTML =
      '<div class="card" style="text-align:center;padding:28px 20px">'
      + '<div style="font-size:40px">📚</div>'
      + '<h3 style="margin:8px 0">Complete any lesson today</h3>'
      + '<p style="color:var(--text-2)">Head to Learn, pick a lesson, and finish it. This page detects your completion automatically.</p>'
      + '<a class="btn btn-primary" href="#/learn" style="text-decoration:none">Go to Learn</a>'
      + '<div id="dc-check" style="margin-top:12px;color:var(--text-2)">Waiting for a completed lesson…</div>'
      + '</div>';
    var checkEl = S.body.querySelector("#dc-check");
    function check() {
      if (S !== current || S.done) return;
      var a = lessonAttemptToday(S.today);
      if (a) {
        checkEl.textContent = "Lesson completed — nice work!";
        markDone({ lessonId: a.lessonId || null, attemptId: a.id || null });
      }
    }
    check();
    var iv = setInterval(check, 2500);
    onTeardown(function () { clearInterval(iv); });
  }

  /* ----- type: accuracy-95 (mini passage game) ----- */
  function buildAccuracy95() {
    var passage = shuffle(wordList("medium")).slice(0, 15).join(" ");
    var g = { phase: "idle", pos: 0, correct: 0, total: 0, backs: 0, clock: makeClock(), timerId: null };
    S.body.innerHTML =
      '<div class="card" style="margin-bottom:12px">'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
      + hudTile("🎯 Accuracy", "dca-acc", "100%")
      + hudTile("❌ Errors", "dca-err", "0")
      + hudTile("📏 Progress", "dca-prog", "0%")
      + '</div>' + controlsHTML("dca") + '</div>'
      + '<div class="card"><div id="dca-passage" style="font-size:19px;line-height:2" aria-live="polite"></div>'
      + captureInput("dca-input", "Type the passage here")
      + '<div id="dca-msg" style="margin-top:10px;color:var(--text-2)">Press Start. Reach 95%+ accuracy to complete the challenge.</div></div>';
    var els = {
      passage: S.body.querySelector("#dca-passage"), input: S.body.querySelector("#dca-input"),
      msg: S.body.querySelector("#dca-msg"),
      acc: S.body.querySelector("#dca-acc"), err: S.body.querySelector("#dca-err"), prog: S.body.querySelector("#dca-prog"),
      start: S.body.querySelector("#dca-start"), pause: S.body.querySelector("#dca-pause"), restart: S.body.querySelector("#dca-restart")
    };
    function refocus() { try { els.input.focus({ preventScroll: true }); } catch (e) { try { els.input.focus(); } catch (e2) {} } }
    function paint() {
      var html = "";
      for (var i = 0; i < passage.length; i++) {
        var ch = passage[i] === " " ? "&nbsp;" : esc(passage[i]);
        var st = i < g.pos ? "color:var(--green);font-weight:700"
          : (i === g.pos ? "background:var(--blue-soft);border-bottom:3px solid var(--blue);font-weight:700" : "");
        html += '<span style="' + st + '">' + ch + "</span>";
      }
      els.passage.innerHTML = html;
      els.acc.textContent = (g.total ? Math.round(g.correct / g.total * 100) : 100) + "%";
      els.err.textContent = g.total - g.correct;
      els.prog.textContent = Math.round(g.pos / passage.length * 100) + "%";
    }
    function updateButtons() {
      els.start.disabled = g.phase === "running";
      els.start.textContent = g.phase === "paused" ? "Resume" : "Start";
      els.pause.disabled = g.phase !== "running";
    }
    function start() {
      if (g.phase === "running") return;
      if (g.phase === "over") reset();
      g.phase = "running"; g.clock.start();
      updateButtons(); refocus();
    }
    function pause() {
      if (g.phase !== "running") return;
      g.phase = "paused"; g.clock.pause();
      els.msg.textContent = "Paused — press Resume to continue.";
      updateButtons();
    }
    function reset() {
      g.clock.reset(); g.pos = 0; g.correct = 0; g.total = 0; g.backs = 0; g.phase = "idle";
      els.msg.textContent = "Press Start. Reach 95%+ accuracy to complete the challenge.";
      paint(); updateButtons();
    }
    function finish() {
      g.phase = "over"; g.clock.pause();
      var acc = g.total ? g.correct / g.total * 100 : 0;
      var errors = g.total - g.correct;
      var score = Math.max(0, Math.round(acc * 10 - errors));
      if (acc >= 95) {
        els.msg.textContent = "Accuracy " + (Math.round(acc * 10) / 10) + "% — challenge complete!";
        markDone({ accuracy: Math.round(acc * 10) / 10, errors: errors }, score);
      } else {
        els.msg.innerHTML = "Accuracy <b>" + (Math.round(acc * 10) / 10) + "%</b> — below 95%. Press Restart and try again!";
      }
      updateButtons();
    }
    function onKey(e) {
      if (!keyOK(e)) return;
      if (g.phase !== "running" || S !== current) return;
      if (g.pos >= passage.length) return;
      var k = e.key;
      if (k === "Backspace") { e.preventDefault(); if (g.pos > 0) { g.pos--; g.backs++; paint(); } return; }
      if (k === "Enter") { e.preventDefault(); return; }
      if (k === " ") e.preventDefault();
      if (k.length !== 1) return;
      if (document.activeElement && document.activeElement !== els.input) document.activeElement.blur();
      g.total++;
      if (k === passage[g.pos]) { g.pos++; g.correct++; }
      paint();
      if (g.pos >= passage.length) finish();
    }
    function onVis() { if (document.hidden) pause(); }
    function onBlur() { pause(); }
    document.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    onTeardown(function () {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    });
    els.start.addEventListener("click", start);
    els.pause.addEventListener("click", pause);
    els.restart.addEventListener("click", function () { reset(); start(); });
    paint(); updateButtons();
  }

  /* ----- type: practice-5min (free-type word stream) ----- */
  function buildPractice5min() {
    var DUR = 300;
    var g = { phase: "idle", words: shuffle(wordList("medium")), idx: 0, typed: "", correct: 0, attempted: 0, clock: makeClock(), timerId: null };
    S.body.innerHTML =
      '<div class="card" style="margin-bottom:12px">'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
      + hudTile("⏱ Remaining", "dcp-time", "5:00")
      + hudTile("✅ Words typed", "dcp-words", "0")
      + hudTile("🎯 Correct", "dcp-correct", "0")
      + '</div>' + controlsHTML("dcp") + '</div>'
      + '<div class="card" style="text-align:center"><div id="dcp-word" style="font-size:38px;font-weight:700;min-height:52px" aria-live="polite"></div>'
      + captureInput("dcp-input", "Type the word, then Space — keep going!")
      + '<div id="dcp-msg" style="margin-top:10px;color:var(--text-2)">Press Start and type continuously for 5 minutes.</div></div>';
    var els = {
      word: S.body.querySelector("#dcp-word"), input: S.body.querySelector("#dcp-input"),
      msg: S.body.querySelector("#dcp-msg"),
      time: S.body.querySelector("#dcp-time"), words: S.body.querySelector("#dcp-words"), correct: S.body.querySelector("#dcp-correct"),
      start: S.body.querySelector("#dcp-start"), pause: S.body.querySelector("#dcp-pause"), restart: S.body.querySelector("#dcp-restart")
    };
    function refocus() { try { els.input.focus({ preventScroll: true }); } catch (e) { try { els.input.focus(); } catch (e2) {} } }
    function paintWord() {
      var w = g.words[g.idx] || "";
      var html = "";
      for (var i = 0; i < w.length; i++) {
        var st = i < g.typed.length ? (g.typed[i] === w[i] ? "color:var(--green);font-weight:800" : "color:var(--red);font-weight:800;text-decoration:underline") : "";
        html += '<span style="' + st + '">' + esc(w[i]) + "</span>";
      }
      els.word.innerHTML = html;
      if (els.input.value !== g.typed) els.input.value = g.typed;
    }
    function paintHud() {
      var left = Math.max(0, DUR - g.clock.elapsed());
      els.time.textContent = fmtTime(left);
      els.words.textContent = g.attempted;
      els.correct.textContent = g.correct;
    }
    function updateButtons() {
      els.start.disabled = g.phase === "running";
      els.start.textContent = g.phase === "paused" ? "Resume" : "Start";
      els.pause.disabled = g.phase !== "running";
    }
    function tick() {
      if (g.phase !== "running") return;
      paintHud();
      if (g.clock.elapsed() >= DUR) finish();
    }
    function submit() {
      var w = g.words[g.idx];
      if (!w) return;
      g.attempted++;
      if (g.typed === w) g.correct++;
      g.idx++;
      if (g.idx >= g.words.length) { g.words = shuffle(wordList("medium")); g.idx = 0; }
      g.typed = "";
      paintWord(); paintHud();
    }
    function start() {
      if (g.phase === "running") return;
      if (g.phase === "over") reset();
      g.phase = "running"; g.clock.start();
      if (!g.timerId) g.timerId = setInterval(tick, 500);
      els.msg.textContent = "Keep typing — the timer pauses if you switch tabs.";
      updateButtons(); refocus();
    }
    function pause() {
      if (g.phase !== "running") return;
      g.phase = "paused"; g.clock.pause();
      els.msg.textContent = "Paused — press Resume to continue.";
      updateButtons();
    }
    function reset() {
      if (g.timerId) { clearInterval(g.timerId); g.timerId = null; }
      g.clock.reset(); g.words = shuffle(wordList("medium")); g.idx = 0; g.typed = "";
      g.correct = 0; g.attempted = 0; g.phase = "idle";
      els.msg.textContent = "Press Start and type continuously for 5 minutes.";
      paintWord(); paintHud(); updateButtons();
    }
    function finish() {
      if (g.phase === "over") return;
      g.phase = "over"; g.clock.pause();
      if (g.timerId) { clearInterval(g.timerId); g.timerId = null; }
      els.msg.textContent = "5 minutes complete — well done!";
      markDone({ wordsTyped: g.attempted, correct: g.correct }, g.correct);
      updateButtons();
    }
    function onKey(e) {
      if (!keyOK(e)) return;
      if (g.phase !== "running" || S !== current) return;
      var k = e.key;
      if (k === " " || k === "Enter") {
        e.preventDefault();
        if (document.activeElement && document.activeElement !== els.input) document.activeElement.blur();
        submit(); refocus(); return;
      }
      if (k === "Backspace") { g.typed = g.typed.slice(0, -1); paintWord(); return; }
      if (k.length === 1) { g.typed += k; paintWord(); }
    }
    function onVis() { if (document.hidden) pause(); }
    function onBlur() { pause(); }
    document.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    onTeardown(function () {
      if (g.timerId) clearInterval(g.timerId);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    });
    els.start.addEventListener("click", start);
    els.pause.addEventListener("click", pause);
    els.restart.addEventListener("click", function () { reset(); start(); });
    paintWord(); paintHud(); updateButtons();
  }

  /* ----- type: beat-speed (60s sprint vs target) ----- */
  function buildBeatSpeed() {
    var DUR = 60;
    var g = { phase: "idle", words: shuffle(wordList("medium")), idx: 0, typed: "", correct: 0, errors: 0, clock: makeClock(), timerId: null };
    S.body.innerHTML =
      '<div class="card" style="margin-bottom:12px">'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
      + hudTile("⏱ Time left", "dcb-time", "60s")
      + hudTile("✅ Correct", "dcb-score", "0")
      + hudTile("🎯 Target", "dcb-target", String(S.target))
      + '</div>' + controlsHTML("dcb") + '</div>'
      + '<div class="card" style="text-align:center"><div id="dcb-word" style="font-size:38px;font-weight:700;min-height:52px" aria-live="polite"></div>'
      + captureInput("dcb-input", "Type the word, then Space")
      + '<div id="dcb-msg" style="margin-top:10px;color:var(--text-2)">Press Start. Score ' + S.target + '+ correct words to beat the challenge.</div></div>';
    var els = {
      word: S.body.querySelector("#dcb-word"), input: S.body.querySelector("#dcb-input"),
      msg: S.body.querySelector("#dcb-msg"),
      time: S.body.querySelector("#dcb-time"), score: S.body.querySelector("#dcb-score"),
      start: S.body.querySelector("#dcb-start"), pause: S.body.querySelector("#dcb-pause"), restart: S.body.querySelector("#dcb-restart")
    };
    function refocus() { try { els.input.focus({ preventScroll: true }); } catch (e) { try { els.input.focus(); } catch (e2) {} } }
    function paintWord() {
      var w = g.words[g.idx] || "";
      var html = "";
      for (var i = 0; i < w.length; i++) {
        var st = i < g.typed.length ? (g.typed[i] === w[i] ? "color:var(--green);font-weight:800" : "color:var(--red);font-weight:800;text-decoration:underline") : "";
        html += '<span style="' + st + '">' + esc(w[i]) + "</span>";
      }
      els.word.innerHTML = html;
      if (els.input.value !== g.typed) els.input.value = g.typed;
    }
    function paintHud() {
      els.time.textContent = Math.ceil(Math.max(0, DUR - g.clock.elapsed())) + "s";
      els.score.textContent = g.correct;
    }
    function updateButtons() {
      els.start.disabled = g.phase === "running";
      els.start.textContent = g.phase === "paused" ? "Resume" : "Start";
      els.pause.disabled = g.phase !== "running";
    }
    function tick() {
      if (g.phase !== "running") return;
      paintHud();
      if (g.clock.elapsed() >= DUR) finish();
    }
    function submit() {
      var w = g.words[g.idx];
      if (!w) return;
      if (g.typed === w) g.correct++; else g.errors++;
      g.idx++;
      if (g.idx >= g.words.length) { g.words = shuffle(wordList("medium")); g.idx = 0; }
      g.typed = "";
      paintWord(); paintHud();
    }
    function start() {
      if (g.phase === "running") return;
      if (g.phase === "over") reset();
      g.phase = "running"; g.clock.start();
      if (!g.timerId) g.timerId = setInterval(tick, 200);
      els.msg.textContent = "Go!";
      updateButtons(); refocus();
    }
    function pause() {
      if (g.phase !== "running") return;
      g.phase = "paused"; g.clock.pause();
      els.msg.textContent = "Paused — press Resume to continue.";
      updateButtons();
    }
    function reset() {
      if (g.timerId) { clearInterval(g.timerId); g.timerId = null; }
      g.clock.reset(); g.words = shuffle(wordList("medium")); g.idx = 0; g.typed = "";
      g.correct = 0; g.errors = 0; g.phase = "idle";
      els.msg.textContent = "Press Start. Score " + S.target + "+ correct words to beat the challenge.";
      paintWord(); paintHud(); updateButtons();
    }
    function finish() {
      if (g.phase === "over") return;
      g.phase = "over"; g.clock.pause();
      if (g.timerId) { clearInterval(g.timerId); g.timerId = null; }
      if (g.correct >= S.target) {
        els.msg.textContent = g.correct + " correct — target beaten!";
        markDone({ score: g.correct, target: S.target, errors: g.errors }, g.correct);
      } else {
        els.msg.innerHTML = "<b>" + g.correct + "</b> correct — target was " + S.target + ". Press Restart to try again!";
      }
      updateButtons();
    }
    function onKey(e) {
      if (!keyOK(e)) return;
      if (g.phase !== "running" || S !== current) return;
      var k = e.key;
      if (k === " " || k === "Enter") {
        e.preventDefault();
        if (document.activeElement && document.activeElement !== els.input) document.activeElement.blur();
        submit(); refocus(); return;
      }
      if (k === "Backspace") { g.typed = g.typed.slice(0, -1); paintWord(); return; }
      if (k.length === 1) { g.typed += k; paintWord(); }
    }
    function onVis() { if (document.hidden) pause(); }
    function onBlur() { pause(); }
    document.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    onTeardown(function () {
      if (g.timerId) clearInterval(g.timerId);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    });
    els.start.addEventListener("click", start);
    els.pause.addEventListener("click", pause);
    els.restart.addEventListener("click", function () { reset(); start(); });
    paintWord(); paintHud(); updateButtons();
  }

  /* ----- dispatch ----- */
  if (alreadyDone) {
    S.body.innerHTML = '<div class="card" style="text-align:center;padding:28px 20px">'
      + '<div style="font-size:40px">✅</div>'
      + '<h3 style="margin:8px 0">Today\'s challenge is complete</h3>'
      + '<p style="color:var(--text-2)">You finished: <b>' + esc(meta.title) + '</b>. Come back tomorrow for a new challenge.</p>'
      + '<a class="btn btn-ghost" href="#/games" style="text-decoration:none">All games</a></div>';
  } else if (type === "complete-lesson") {
    buildCompleteLesson();
  } else if (type === "accuracy-95") {
    buildAccuracy95();
  } else if (type === "practice-5min") {
    buildPractice5min();
  } else {
    buildBeatSpeed();
  }
}

function destroy() {
  if (!current) return;
  var S = current; current = null;
  S.teardown.forEach(function (fn) { try { fn(); } catch (e) {} });
}

T.games[GAME_ID] = {
  id: GAME_ID,
  title: "Daily Challenge",
  desc: "A new challenge every day — lessons, accuracy, practice or speed.",
  icon: "📅",
  render: render,
  destroy: destroy
};
})();
