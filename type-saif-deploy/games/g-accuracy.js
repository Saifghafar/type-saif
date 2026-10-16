/* Type Saif — Game: Accuracy Challenge
 * Type a ~25-word passage with no time pressure (only elapsed time is shown).
 * Backspace is allowed. Score = round(accuracy*10 - errors), min 0, where
 * accuracy = correct keystrokes / total keystrokes * 100 and
 * errors = total - correct. Tiered encouragement, with special praise at >=98%.
 * Registers TS.games["accuracy-challenge"] = {id,title,desc,icon,render,destroy}.
 */
(function () {
"use strict";
var T = (window.TypeSaif = window.TypeSaif || {});
T.games = T.games || {};
var current = null;

/* ---------- guarded, self-contained helpers ---------- */
function storeGet(k, fb) { try { if (T.store && T.store.get) { var v = T.store.get(k, fb); return v === undefined ? fb : v; } } catch (e) {} return fb; }
function storeSet(k, v) { try { if (T.store && T.store.set) T.store.set(k, v); } catch (e) {} }
function wordList() {
  var lists = (T.data && T.data.WORD_LISTS) || {};
  var w = lists.medium || lists.easy || [];
  if (w && w.length) return w.slice();
  return "the and for are but not you all any can had her was one our out day get has him his how its may new now old see two way who boy did".split(" ");
}
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
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
function gameOverHTML(o) {
  var rows = (o.rows || []).map(function (r) {
    return '<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--border)">'
      + '<span style="color:var(--text-2)">' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
  }).join("");
  return '<div class="card" style="margin-top:12px;text-align:center;padding:28px 20px">'
    + (o.isBest ? '<div style="margin-bottom:8px"><span class="badge">🎉 New personal best!</span></div>' : '')
    + '<div style="font-size:44px;margin-bottom:4px">' + esc(o.emoji || "🎯") + '</div>'
    + '<h2 style="margin:0 0 4px">' + esc(o.title) + '</h2>'
    + '<div style="font-size:52px;font-weight:800;line-height:1.1">' + esc(o.score) + '</div>'
    + '<div style="color:var(--text-2);margin-bottom:12px">' + esc(o.scoreLabel) + '</div>'
    + (o.feedback ? '<p style="font-size:17px;font-weight:600">' + esc(o.feedback) + '</p>' : '')
    + (rows ? '<div style="max-width:360px;margin:0 auto 12px;text-align:left">' + rows + '</div>' : '')
    + '<div style="margin-bottom:16px"><span class="badge">+' + o.xp + ' XP earned</span></div>'
    + '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'
    + '<button class="btn btn-primary" data-again>Try again</button>'
    + '<a class="btn btn-ghost" href="#/games" style="text-decoration:none">All games</a></div></div>';
}
function fmtTime(sec) {
  sec = Math.floor(sec);
  var m = Math.floor(sec / 60), s = sec % 60;
  return m + ":" + (s < 10 ? "0" : "") + s;
}
function tierFeedback(acc) {
  if (acc >= 98) return { emoji: "🏆", text: "Flawless! 98%+ accuracy — elite control." };
  if (acc >= 95) return { emoji: "🌟", text: "Excellent! You're in the top tier." };
  if (acc >= 90) return { emoji: "👍", text: "Great run — 90%+ is solid typing." };
  if (acc >= 80) return { emoji: "💪", text: "Good effort. Slow down a touch for accuracy." };
  return { emoji: "🧘", text: "Keep practicing — accuracy first, speed follows." };
}

/* ---------- game ---------- */
var GAME_ID = "accuracy-challenge";

function render(el) {
  destroy();
  var passage = shuffle(wordList()).slice(0, 25).join(" ");
  var S = current = {
    phase: "idle", passage: passage, pos: 0,
    correct: 0, total: 0, backs: 0,
    clock: makeClock(), timerId: null,
    onKey: null, onVis: null, onBlur: null, els: {}
  };
  var best = (loadGames()[GAME_ID] || {}).best || 0;

  el.innerHTML =
    '<div class="card" style="margin-bottom:12px">'
    + '<h2 style="margin:0 0 6px">🎯 Accuracy Challenge</h2>'
    + '<p style="margin:0;color:var(--text-2)">No countdown, no pressure — just type the passage as <b>accurately</b> as you can. '
    + 'Backspace is allowed. Score = <b>accuracy × 10 − errors</b> (min 0). Aim for <b>98%+</b> for the top tier!</p>'
    + (best ? '<p style="margin:8px 0 0"><span class="badge">🏅 Personal best score: ' + best + '</span></p>' : '')
    + '</div>'
    + '<div class="card" style="margin-bottom:12px">'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
    + hudTile("⏱ Elapsed", "ac-time", "0:00")
    + hudTile("🎯 Accuracy", "ac-acc", "100%")
    + hudTile("❌ Errors", "ac-err", "0")
    + hudTile("📏 Progress", "ac-prog", "0%")
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '<button class="btn btn-primary" id="ac-start">Start</button>'
    + '<button class="btn btn-ghost" id="ac-pause" disabled>Pause</button>'
    + '<button class="btn btn-ghost" id="ac-restart">Restart</button>'
    + '</div></div>'
    + '<div class="card" style="margin-bottom:12px">'
    + '<div id="ac-passage" style="font-size:19px;line-height:2;letter-spacing:.5px" aria-live="polite"></div>'
    + '<input id="ac-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" '
    + 'placeholder="Type the passage here" aria-label="Type the passage here" '
    + 'style="margin-top:12px;width:100%;max-width:420px;padding:10px 14px;font-size:18px;border:1px solid var(--border);border-radius:10px" />'
    + '<div id="ac-msg" style="margin-top:10px;color:var(--text-2)">Press Start, then type carefully. Backspace is allowed.</div>'
    + '</div>'
    + '<div id="ac-result"></div>';

  S.els = {
    passage: el.querySelector("#ac-passage"), input: el.querySelector("#ac-input"),
    msg: el.querySelector("#ac-msg"), result: el.querySelector("#ac-result"),
    time: el.querySelector("#ac-time"), acc: el.querySelector("#ac-acc"),
    err: el.querySelector("#ac-err"), prog: el.querySelector("#ac-prog"),
    start: el.querySelector("#ac-start"), pause: el.querySelector("#ac-pause"),
    restart: el.querySelector("#ac-restart")
  };

  function refocus() { try { S.els.input.focus({ preventScroll: true }); } catch (e) { try { S.els.input.focus(); } catch (e2) {} } }

  function paintPassage() {
    var p = S.passage, html = "";
    for (var i = 0; i < p.length; i++) {
      var ch = p[i] === " " ? "&nbsp;" : esc(p[i]);
      var st = "";
      if (i < S.pos) st = "color:var(--green);font-weight:700";
      else if (i === S.pos) st = "background:var(--blue-soft);border-bottom:3px solid var(--blue);font-weight:700";
      html += '<span style="' + st + '">' + ch + "</span>";
    }
    S.els.passage.innerHTML = html;
  }

  function paintHud() {
    var acc = S.total > 0 ? Math.round(S.correct / S.total * 100) : 100;
    S.els.acc.textContent = acc + "%";
    S.els.err.textContent = (S.total - S.correct);
    S.els.prog.textContent = Math.round(S.pos / S.passage.length * 100) + "%";
    S.els.time.textContent = fmtTime(S.clock.elapsed());
  }

  function updateButtons() {
    var running = S.phase === "running", over = S.phase === "over";
    S.els.start.disabled = running;
    S.els.start.textContent = S.phase === "paused" ? "Resume" : "Start";
    S.els.pause.disabled = !running;
    S.els.restart.disabled = (S.phase === "idle" && !over && S.pos === 0);
  }

  function tick() {
    if (S.phase !== "running") return;
    S.els.time.textContent = fmtTime(S.clock.elapsed());
  }

  function start() {
    if (S.phase === "running") return;
    if (S.phase === "over") reset();
    S.phase = "running";
    S.clock.start();
    if (!S.timerId) S.timerId = setInterval(tick, 500);
    S.els.msg.textContent = "Take your time — accuracy is everything.";
    S.els.result.innerHTML = "";
    updateButtons(); refocus();
  }
  function pause() {
    if (S.phase !== "running") return;
    S.phase = "paused";
    S.clock.pause();
    S.els.msg.textContent = "Paused — press Resume to continue.";
    updateButtons();
  }
  function reset() {
    S.clock.reset();
    S.pos = 0; S.correct = 0; S.total = 0; S.backs = 0;
    S.phase = "idle";
    S.els.result.innerHTML = "";
    S.els.msg.textContent = "Press Start, then type carefully. Backspace is allowed.";
    paintPassage(); paintHud(); updateButtons();
  }
  function restart() { reset(); start(); }

  function endGame() {
    if (S.phase === "over") return;
    S.phase = "over";
    S.clock.pause();
    if (S.timerId) { clearInterval(S.timerId); S.timerId = null; }
    var acc = S.total > 0 ? (S.correct / S.total * 100) : 0;
    var errors = S.total - S.correct;
    var score = Math.max(0, Math.round(acc * 10 - errors));
    var tf = tierFeedback(acc);
    var r = finishGame(GAME_ID, score, {
      accuracy: Math.round(acc * 10) / 10, errors: errors,
      corrections: S.backs, elapsedSec: Math.round(S.clock.elapsed())
    });
    S.els.msg.textContent = "Passage complete!";
    S.els.result.innerHTML = gameOverHTML({
      title: "Challenge complete!", score: score,
      scoreLabel: "score = accuracy × 10 − errors",
      isBest: r.isBest, xp: r.xp, emoji: tf.emoji, feedback: tf.text,
      rows: [
        ["Accuracy", (Math.round(acc * 10) / 10) + "%"],
        ["Errors", errors],
        ["Corrections (backspace)", S.backs],
        ["Time", fmtTime(S.clock.elapsed())],
        ["Personal best", r.rec.best]
      ]
    });
    var again = S.els.result.querySelector("[data-again]");
    if (again) again.addEventListener("click", function () { restart(); });
    updateButtons();
  }

  S.onKey = function (e) {
    if (!keyOK(e)) return;
    if (S.phase !== "running") return;
    if (S.pos >= S.passage.length) return;
    var k = e.key;
    if (k === "Backspace") {
      e.preventDefault();
      if (S.pos > 0) { S.pos--; S.backs++; paintPassage(); paintHud(); }
      return;
    }
    if (k === "Enter") { e.preventDefault(); return; }
    if (k === " ") e.preventDefault();
    if (k.length !== 1) return;
    if (document.activeElement && document.activeElement !== S.els.input) document.activeElement.blur();
    S.total++;
    if (k === S.passage[S.pos]) { S.pos++; S.correct++; }
    paintPassage(); paintHud();
    if (S.pos >= S.passage.length) endGame();
  };
  S.onVis = function () { if (document.hidden) pause(); };
  S.onBlur = function () { pause(); };
  document.addEventListener("keydown", S.onKey);
  document.addEventListener("visibilitychange", S.onVis);
  window.addEventListener("blur", S.onBlur);

  S.els.start.addEventListener("click", function () { start(); });
  S.els.pause.addEventListener("click", function () { pause(); });
  S.els.restart.addEventListener("click", function () { restart(); });

  paintPassage(); paintHud(); updateButtons();
}

function destroy() {
  if (!current) return;
  var S = current; current = null;
  try { if (S.timerId) clearInterval(S.timerId); } catch (e) {}
  try { document.removeEventListener("keydown", S.onKey); } catch (e) {}
  try { document.removeEventListener("visibilitychange", S.onVis); } catch (e) {}
  try { window.removeEventListener("blur", S.onBlur); } catch (e) {}
}

T.games[GAME_ID] = {
  id: GAME_ID,
  title: "Accuracy Challenge",
  desc: "No timer pressure — type a passage perfectly. Score = accuracy × 10 − errors.",
  icon: "🎯",
  render: render,
  destroy: destroy
};
})();
