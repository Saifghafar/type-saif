/* Type Saif — Game: Word Sprint
 * 60-second sprint. Words appear one at a time; type the word and press
 * Space/Enter to submit. Score = number of correct words.
 * Registers TS.games["word-sprint"] = {id,title,desc,icon,render,destroy}.
 */
(function () {
"use strict";
var T = (window.TypeSaif = window.TypeSaif || {});
T.games = T.games || {};
var current = null;

/* ---------- guarded, self-contained helpers ---------- */
function storeGet(k, fb) { try { if (T.store && T.store.get) { var v = T.store.get(k, fb); return v === undefined ? fb : v; } } catch (e) {} return fb; }
function storeSet(k, v) { try { if (T.store && T.store.set) T.store.set(k, v); } catch (e) {} }
function getSettings() { var s = storeGet("ts_settings", {}); return s || {}; }
function difficultyTier() { var d = getSettings().difficulty || "easy"; return d === "hard" ? "hard" : (d === "normal" ? "medium" : "easy"); }
function wordList(tier) {
  var lists = (T.data && T.data.WORD_LISTS) || {};
  var w = lists[tier] || lists.easy || [];
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
/* Save result, award XP (guarded). Returns {rec,isBest,xp}. */
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
  return '<div style="flex:1;min-width:110px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:8px 12px">'
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
    + '<h2 style="margin:0 0 4px">' + esc(o.title) + '</h2>'
    + '<div style="font-size:52px;font-weight:800;line-height:1.1">' + esc(o.score) + '</div>'
    + '<div style="color:var(--text-2);margin-bottom:12px">' + esc(o.scoreLabel) + '</div>'
    + (rows ? '<div style="max-width:360px;margin:0 auto 12px;text-align:left">' + rows + '</div>' : '')
    + '<div style="margin-bottom:16px"><span class="badge">+' + o.xp + ' XP earned</span></div>'
    + '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'
    + '<button class="btn btn-primary" data-again>Play again</button>'
    + '<a class="btn btn-ghost" href="#/games" style="text-decoration:none">All games</a></div></div>';
}

/* ---------- game ---------- */
var GAME_ID = "word-sprint";

function render(el) {
  destroy();
  var tier = difficultyTier();
  var S = current = {
    phase: "idle", words: shuffle(wordList(tier)), idx: 0,
    correct: 0, errors: 0, typed: "",
    clock: makeClock(), timerId: null, DUR: 60,
    onKey: null, onVis: null, onBlur: null, els: {}
  };
  var best = (loadGames()[GAME_ID] || {}).best || 0;

  el.innerHTML =
    '<div class="card" style="margin-bottom:12px">'
    + '<h2 style="margin:0 0 6px">⚡ Word Sprint</h2>'
    + '<p style="margin:0;color:var(--text-2)">Type each word, then press <b>Space</b> or <b>Enter</b> to submit it. '
    + 'You have <b>60 seconds</b> — every correct word scores 1 point. Wrong words count as errors. '
    + 'Word difficulty: <b>' + esc(tier) + '</b> (from Settings).</p>'
    + (best ? '<p style="margin:8px 0 0"><span class="badge">🏅 Personal best: ' + best + ' words</span></p>' : '')
    + '</div>'
    + '<div class="card" style="margin-bottom:12px">'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
    + hudTile("⏱ Time left", "ws-time", "60s")
    + hudTile("✅ Correct words", "ws-score", "0")
    + hudTile("❌ Errors", "ws-errors", "0")
    + hudTile("📈 Pace", "ws-pace", "0 wpm")
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '<button class="btn btn-primary" id="ws-start">Start</button>'
    + '<button class="btn btn-ghost" id="ws-pause" disabled>Pause</button>'
    + '<button class="btn btn-ghost" id="ws-restart">Restart</button>'
    + '</div></div>'
    + '<div class="card" style="margin-bottom:12px;text-align:center;min-height:190px">'
    + '<div id="ws-word" style="font-size:38px;font-weight:700;letter-spacing:1px;min-height:52px" aria-live="polite"></div>'
    + '<input id="ws-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" '
    + 'placeholder="Type the word here, then Space" aria-label="Type the word here" '
    + 'style="margin-top:12px;width:100%;max-width:420px;padding:10px 14px;font-size:18px;border:1px solid var(--border);border-radius:10px" />'
    + '<div id="ws-msg" style="margin-top:10px;color:var(--text-2)">Press Start, then type the word above.</div>'
    + '</div>'
    + '<div id="ws-result"></div>';

  S.els = {
    word: el.querySelector("#ws-word"), input: el.querySelector("#ws-input"),
    msg: el.querySelector("#ws-msg"), result: el.querySelector("#ws-result"),
    time: el.querySelector("#ws-time"), score: el.querySelector("#ws-score"),
    errors: el.querySelector("#ws-errors"), pace: el.querySelector("#ws-pace"),
    start: el.querySelector("#ws-start"), pause: el.querySelector("#ws-pause"),
    restart: el.querySelector("#ws-restart")
  };

  function refocus() { try { S.els.input.focus({ preventScroll: true }); } catch (e) { try { S.els.input.focus(); } catch (e2) {} } }

  function paintWord() {
    var w = S.words[S.idx] || "";
    var html = "";
    for (var i = 0; i < w.length; i++) {
      var st = "";
      if (i < S.typed.length) st = (S.typed[i] === w[i])
        ? "color:var(--green);font-weight:800"
        : "color:var(--red);font-weight:800;text-decoration:underline";
      html += '<span style="' + st + '">' + esc(w[i]) + "</span>";
    }
    S.els.word.innerHTML = html;
    if (S.els.input.value !== S.typed) S.els.input.value = S.typed;
  }

  function paintHud(left) {
    if (left === undefined) left = Math.max(0, S.DUR - S.clock.elapsed());
    S.els.time.textContent = Math.ceil(left) + "s";
    S.els.score.textContent = S.correct;
    S.els.errors.textContent = S.errors;
    var mins = Math.max(S.clock.elapsed() / 60, 0.001);
    S.els.pace.textContent = Math.round(S.correct / mins) + " wpm";
  }

  function updateButtons() {
    var running = S.phase === "running", over = S.phase === "over";
    S.els.start.disabled = running;
    S.els.start.textContent = S.phase === "paused" ? "Resume" : "Start";
    S.els.pause.disabled = !running;
    S.els.restart.disabled = (S.phase === "idle" && !over && S.correct === 0 && S.errors === 0);
  }

  function submitWord() {
    var w = S.words[S.idx];
    if (!w) return;
    if (S.typed === w) S.correct++; else S.errors++;
    S.idx++;
    if (S.idx >= S.words.length) { S.words = shuffle(wordList(tier)); S.idx = 0; }
    S.typed = "";
    paintWord(); paintHud();
  }

  function tick() {
    if (S.phase !== "running") return;
    var left = S.DUR - S.clock.elapsed();
    paintHud(Math.max(0, left));
    if (left <= 0) endGame();
  }

  function start() {
    if (S.phase === "running") return;
    if (S.phase === "over") reset();
    S.phase = "running";
    S.clock.start();
    if (!S.timerId) S.timerId = setInterval(tick, 200);
    S.els.msg.textContent = "Go! Type the word, then Space.";
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
    S.correct = 0; S.errors = 0; S.idx = 0; S.typed = "";
    S.words = shuffle(wordList(tier));
    S.phase = "idle";
    S.els.result.innerHTML = "";
    S.els.msg.textContent = "Press Start, then type the word above.";
    paintWord(); paintHud(S.DUR); updateButtons();
  }
  function restart() { reset(); start(); }

  function endGame() {
    if (S.phase === "over") return;
    S.phase = "over";
    S.clock.pause();
    if (S.timerId) { clearInterval(S.timerId); S.timerId = null; }
    var mins = Math.max(S.clock.elapsed() / 60, 1 / 60);
    var wpm = Math.round(S.correct / mins);
    var acc = (S.correct + S.errors) > 0 ? Math.round(S.correct / (S.correct + S.errors) * 100) : 0;
    var r = finishGame(GAME_ID, S.correct, { wpm: wpm, errors: S.errors, accuracy: acc });
    S.els.msg.textContent = "Time's up!";
    S.els.result.innerHTML = gameOverHTML({
      title: "Sprint complete!", score: S.correct, scoreLabel: "correct words in 60 seconds",
      isBest: r.isBest, xp: r.xp,
      rows: [["Pace", wpm + " wpm"], ["Errors", S.errors], ["Word accuracy", acc + "%"], ["Personal best", r.rec.best]]
    });
    var again = S.els.result.querySelector("[data-again]");
    if (again) again.addEventListener("click", function () { restart(); });
    updateButtons();
  }

  S.onKey = function (e) {
    if (!keyOK(e)) return;
    if (S.phase !== "running") return;
    var k = e.key;
    if (k === " " || k === "Enter") {
      e.preventDefault();
      if (document.activeElement && document.activeElement !== S.els.input) document.activeElement.blur();
      submitWord(); refocus();
      return;
    }
    if (k === "Backspace") { S.typed = S.typed.slice(0, -1); paintWord(); return; }
    if (k.length === 1) { S.typed += k; paintWord(); }
  };
  S.onVis = function () { if (document.hidden) pause(); };
  S.onBlur = function () { pause(); };
  document.addEventListener("keydown", S.onKey);
  document.addEventListener("visibilitychange", S.onVis);
  window.addEventListener("blur", S.onBlur);

  S.els.start.addEventListener("click", function () { start(); });
  S.els.pause.addEventListener("click", function () { pause(); });
  S.els.restart.addEventListener("click", function () { restart(); });
  S.els.input.addEventListener("keydown", function () { refocus(); });

  paintWord(); paintHud(S.DUR); updateButtons();
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
  title: "Word Sprint",
  desc: "Type as many words as you can in 60 seconds. Word + Space to score.",
  icon: "⚡",
  render: render,
  destroy: destroy
};
})();
