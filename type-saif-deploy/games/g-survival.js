/* Type Saif — Game: Survival
 * Rounds of increasing difficulty: each round you type a set of words
 * (word + Space/Enter to submit). You must keep round accuracy >= 90% to
 * advance. Higher rounds use harder word tiers and longer words. One failed
 * round ends the run. Score = roundsSurvived*100 + totalCorrectChars.
 * Registers TS.games["survival"] = {id,title,desc,icon,render,destroy}.
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
  var w = lists[tier] || lists.easy || [];
  if (w && w.length) return w.slice();
  return "the and for are but not you all any can had her was one our out day get has him his how its may new now old see two way who boy did".split(" ");
}
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function toast(msg) { try { if (T.ui && T.ui.toast) T.ui.toast(msg); } catch (e) {} }
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
    + '<h2 style="margin:0 0 4px">' + esc(o.title) + '</h2>'
    + '<div style="font-size:52px;font-weight:800;line-height:1.1">' + esc(o.score) + '</div>'
    + '<div style="color:var(--text-2);margin-bottom:12px">' + esc(o.scoreLabel) + '</div>'
    + (rows ? '<div style="max-width:360px;margin:0 auto 12px;text-align:left">' + rows + '</div>' : '')
    + '<div style="margin-bottom:16px"><span class="badge">+' + o.xp + ' XP earned</span></div>'
    + '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'
    + '<button class="btn btn-primary" data-again>Survive again</button>'
    + '<a class="btn btn-ghost" href="#/games" style="text-decoration:none">All games</a></div></div>';
}

/* ---------- game ---------- */
var GAME_ID = "survival";
function tierForRound(n) { return n <= 2 ? "easy" : (n <= 4 ? "medium" : "hard"); }

function render(el) {
  destroy();
  var S = current = {
    phase: "idle", round: 1, words: [], idx: 0, typed: "",
    rCorrect: 0, rTotal: 0, tCorrect: 0, roundsDone: 0, lastAcc: 0,
    onKey: null, onVis: null, onBlur: null, els: {}
  };
  var best = (loadGames()[GAME_ID] || {}).best || 0;

  el.innerHTML =
    '<div class="card" style="margin-bottom:12px">'
    + '<h2 style="margin:0 0 6px">🛡️ Survival</h2>'
    + '<p style="margin:0;color:var(--text-2)">Type each round\'s words (word + <b>Space</b>/<b>Enter</b>). '
    + 'You need <b>≥90% accuracy</b> in a round to survive to the next one — one failed round ends the run. '
    + 'Higher rounds bring harder words and longer words. Score = <b>rounds × 100 + correct characters</b>.</p>'
    + (best ? '<p style="margin:8px 0 0"><span class="badge">🏅 Personal best score: ' + best + '</span></p>' : '')
    + '</div>'
    + '<div class="card" style="margin-bottom:12px">'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
    + hudTile("🛡️ Round", "sv-round", "1")
    + hudTile("📝 Words left", "sv-left", "—")
    + hudTile("🎯 Round acc.", "sv-acc", "—")
    + hudTile("⭐ Score", "sv-score", "0")
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '<button class="btn btn-primary" id="sv-start">Start</button>'
    + '<button class="btn btn-ghost" id="sv-pause" disabled>Pause</button>'
    + '<button class="btn btn-ghost" id="sv-restart">Restart</button>'
    + '</div></div>'
    + '<div class="card" style="margin-bottom:12px;text-align:center;min-height:190px">'
    + '<div id="sv-word" style="font-size:38px;font-weight:700;letter-spacing:1px;min-height:52px" aria-live="polite"></div>'
    + '<input id="sv-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" '
    + 'placeholder="Type the word here, then Space" aria-label="Type the word here" '
    + 'style="margin-top:12px;width:100%;max-width:420px;padding:10px 14px;font-size:18px;border:1px solid var(--border);border-radius:10px" />'
    + '<div id="sv-msg" style="margin-top:10px;color:var(--text-2)">Press Start to begin round 1. Survive with ≥90% accuracy.</div>'
    + '</div>'
    + '<div id="sv-result"></div>';

  S.els = {
    word: el.querySelector("#sv-word"), input: el.querySelector("#sv-input"),
    msg: el.querySelector("#sv-msg"), result: el.querySelector("#sv-result"),
    round: el.querySelector("#sv-round"), left: el.querySelector("#sv-left"),
    acc: el.querySelector("#sv-acc"), score: el.querySelector("#sv-score"),
    start: el.querySelector("#sv-start"), pause: el.querySelector("#sv-pause"),
    restart: el.querySelector("#sv-restart")
  };

  function refocus() { try { S.els.input.focus({ preventScroll: true }); } catch (e) { try { S.els.input.focus(); } catch (e2) {} } }
  function liveScore() { return S.roundsDone * 100 + S.tCorrect; }
  function roundAcc() { return S.rTotal > 0 ? (S.rCorrect / S.rTotal * 100) : 100; }

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

  function paintHud() {
    S.els.round.textContent = S.round;
    S.els.left.textContent = S.words.length ? (S.words.length - S.idx) : "—";
    S.els.acc.textContent = S.rTotal ? (Math.round(roundAcc() * 10) / 10 + "%") : "—";
    S.els.acc.style.color = S.rTotal && roundAcc() < 90 ? "var(--red)" : "";
    S.els.score.textContent = liveScore();
  }

  function updateButtons() {
    var running = S.phase === "running", over = S.phase === "over";
    S.els.start.disabled = running;
    S.els.start.textContent = S.phase === "paused" ? "Resume" : "Start";
    S.els.pause.disabled = !running;
    S.els.restart.disabled = (S.phase === "idle" && !over && S.roundsDone === 0 && S.idx === 0);
  }

  function buildRound() {
    var tier = tierForRound(S.round);
    var minLen = Math.min(3 + Math.floor(S.round / 2), 9);
    var pool = wordList(tier);
    var long = pool.filter(function (w) { return w.length >= minLen; });
    if (long.length >= 4) pool = long;
    var count = Math.min(4 + S.round, 10);
    var bag = [];
    while (bag.length < count) bag = bag.concat(shuffle(pool));
    S.words = bag.slice(0, count);
    S.idx = 0; S.typed = ""; S.rCorrect = 0; S.rTotal = 0;
    var tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
    S.els.msg.innerHTML = "Round <b>" + S.round + "</b> — " + tierName + " words, min length " + minLen
      + ". Need ≥90% accuracy to advance.";
    paintWord(); paintHud();
  }

  function submitWord() {
    var w = S.words[S.idx];
    if (!w) return;
    var n = Math.max(w.length, S.typed.length);
    for (var i = 0; i < n; i++) {
      S.rTotal++;
      if (S.typed[i] === w[i]) { S.rCorrect++; S.tCorrect++; }
    }
    S.idx++;
    S.typed = "";
    if (S.idx >= S.words.length) endRound();
    else { paintWord(); paintHud(); }
  }

  function endRound() {
    var acc = roundAcc();
    S.lastAcc = acc;
    if (acc >= 90) {
      S.roundsDone++;
      S.round++;
      toast("✅ Round survived at " + Math.round(acc * 10) / 10 + "% — round " + S.round + "!");
      buildRound();
      updateButtons(); refocus();
    } else {
      endGame(acc);
    }
  }

  function start() {
    if (S.phase === "running") return;
    if (S.phase === "over") reset();
    if (S.phase === "idle" && S.words.length === 0) buildRound();
    S.phase = "running";
    S.els.result.innerHTML = "";
    updateButtons(); refocus();
  }
  function pause() {
    if (S.phase !== "running") return;
    S.phase = "paused";
    S.els.msg.textContent = "Paused — press Resume to continue.";
    updateButtons();
  }
  function reset() {
    S.round = 1; S.words = []; S.idx = 0; S.typed = "";
    S.rCorrect = 0; S.rTotal = 0; S.tCorrect = 0; S.roundsDone = 0; S.lastAcc = 0;
    S.phase = "idle";
    S.els.word.innerHTML = "";
    S.els.result.innerHTML = "";
    S.els.msg.textContent = "Press Start to begin round 1. Survive with ≥90% accuracy.";
    paintHud(); updateButtons();
  }
  function restart() { reset(); start(); }

  function endGame(failedAcc) {
    if (S.phase === "over") return;
    S.phase = "over";
    var score = liveScore();
    var r = finishGame(GAME_ID, score, {
      rounds: S.roundsDone, roundReached: S.round,
      lastRoundAccuracy: Math.round(failedAcc * 10) / 10
    });
    S.els.msg.textContent = "Round " + S.round + " accuracy " + Math.round(failedAcc * 10) / 10 + "% — below 90%. Run over.";
    S.els.result.innerHTML = gameOverHTML({
      title: "Eliminated in round " + S.round + "!", score: score,
      scoreLabel: "score = rounds × 100 + correct chars",
      isBest: r.isBest, xp: r.xp,
      rows: [
        ["Rounds survived", S.roundsDone],
        ["Correct characters", S.tCorrect],
        ["Final round accuracy", Math.round(failedAcc * 10) / 10 + "% (needed 90%)"],
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

  paintHud(); updateButtons();
}

function destroy() {
  if (!current) return;
  var S = current; current = null;
  try { document.removeEventListener("keydown", S.onKey); } catch (e) {}
  try { document.removeEventListener("visibilitychange", S.onVis); } catch (e) {}
  try { window.removeEventListener("blur", S.onBlur); } catch (e) {}
}

T.games[GAME_ID] = {
  id: GAME_ID,
  title: "Survival",
  desc: "Rounds get harder — keep ≥90% accuracy each round or you're out.",
  icon: "🛡️",
  render: render,
  destroy: destroy
};
})();
