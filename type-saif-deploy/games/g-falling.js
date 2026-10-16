/* Type Saif — Game: Falling Words
 * Words fall down the play area. Type a visible word and press Enter to zap
 * it before it reaches the bottom. A word that reaches the bottom costs one
 * life (3 lives). Every 10 zapped words the level rises: faster falls and
 * longer words. Score = words zapped.
 * Registers TS.games["falling-words"] = {id,title,desc,icon,render,destroy}.
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
function reducedMotion() { return !!getSettings().reducedMotion; }
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
    + '<button class="btn btn-primary" data-again>Play again</button>'
    + '<a class="btn btn-ghost" href="#/games" style="text-decoration:none">All games</a></div></div>';
}

/* ---------- game ---------- */
var GAME_ID = "falling-words";
var AREA_H = 340;

function tierForLevel(level) { return level <= 2 ? "easy" : (level <= 4 ? "medium" : "hard"); }

function render(el) {
  destroy();
  var S = current = {
    phase: "idle", typed: "", zapped: 0, lives: 3, level: 1,
    items: [], bag: [], spawnIn: 0, raf: 0, lastT: 0, stepAcc: 0, flash: 0,
    onKey: null, onVis: null, onBlur: null, els: {}
  };
  var best = (loadGames()[GAME_ID] || {}).best || 0;

  el.innerHTML =
    '<div class="card" style="margin-bottom:12px">'
    + '<h2 style="margin:0 0 6px">🌧️ Falling Words</h2>'
    + '<p style="margin:0;color:var(--text-2)">Words rain down the play area. <b>Type a falling word exactly, then press Enter</b> to zap it. '
    + 'A word that reaches the bottom costs <b>1 life</b> — you have 3. Every <b>10 zapped words</b> the level rises: '
    + 'words fall faster and get longer. Score = words zapped.</p>'
    + (best ? '<p style="margin:8px 0 0"><span class="badge">🏅 Personal best: ' + best + ' zapped</span></p>' : '')
    + '</div>'
    + '<div class="card" style="margin-bottom:12px">'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
    + hudTile("❤️ Lives", "fw-lives", "❤️❤️❤️")
    + hudTile("💥 Zapped", "fw-zapped", "0")
    + hudTile("🚀 Level", "fw-level", "1")
    + hudTile("⌨️ Typing", "fw-typed", "—")
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '<button class="btn btn-primary" id="fw-start">Start</button>'
    + '<button class="btn btn-ghost" id="fw-pause" disabled>Pause</button>'
    + '<button class="btn btn-ghost" id="fw-restart">Restart</button>'
    + '</div></div>'
    + '<div class="card" style="margin-bottom:12px">'
    + '<div id="fw-area" style="position:relative;height:' + AREA_H + 'px;overflow:hidden;background:var(--bg);border:1px solid var(--border);border-radius:10px">'
    + '<div id="fw-hint" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--text-2);pointer-events:none">Press Start — words will fall here.</div>'
    + '</div>'
    + '<input id="fw-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" '
    + 'placeholder="Type a falling word, then Enter" aria-label="Type a falling word" '
    + 'style="margin-top:12px;width:100%;max-width:420px;padding:10px 14px;font-size:18px;border:1px solid var(--border);border-radius:10px" />'
    + '</div>'
    + '<div id="fw-result"></div>';

  S.els = {
    area: el.querySelector("#fw-area"), hint: el.querySelector("#fw-hint"),
    input: el.querySelector("#fw-input"), result: el.querySelector("#fw-result"),
    lives: el.querySelector("#fw-lives"), zapped: el.querySelector("#fw-zapped"),
    level: el.querySelector("#fw-level"), typed: el.querySelector("#fw-typed"),
    start: el.querySelector("#fw-start"), pause: el.querySelector("#fw-pause"),
    restart: el.querySelector("#fw-restart")
  };

  function refocus() { try { S.els.input.focus({ preventScroll: true }); } catch (e) { try { S.els.input.focus(); } catch (e2) {} } }

  function paintHud() {
    var hearts = "";
    for (var i = 0; i < 3; i++) hearts += i < S.lives ? "❤️" : "🤍";
    S.els.lives.textContent = hearts;
    S.els.zapped.textContent = S.zapped;
    S.els.level.textContent = S.level;
    S.els.typed.textContent = S.typed || "—";
    S.els.typed.style.color = S.flash > 0 ? "var(--red)" : "";
  }

  function updateButtons() {
    var running = S.phase === "running", over = S.phase === "over";
    S.els.start.disabled = running;
    S.els.start.textContent = S.phase === "paused" ? "Resume" : "Start";
    S.els.pause.disabled = !running;
    S.els.restart.disabled = (S.phase === "idle" && !over && S.zapped === 0);
  }

  function nextWord() {
    if (!S.bag.length) {
      var tier = tierForLevel(S.level);
      var pool = wordList(tier);
      if (S.level >= 3) { var long = pool.filter(function (w) { return w.length >= 4; }); if (long.length) pool = long; }
      S.bag = shuffle(pool);
    }
    return S.bag.pop();
  }

  function spawn() {
    var w = nextWord();
    var div = document.createElement("div");
    div.textContent = w;
    var x = 4 + Math.random() * 72;
    div.style.cssText = "position:absolute;top:-30px;left:" + x + "%;font-size:20px;font-weight:700;"
      + "background:#fff;border:1px solid var(--border);border-radius:8px;padding:4px 10px;"
      + "box-shadow:0 1px 2px rgba(15,23,42,.08);white-space:nowrap";
    S.els.area.appendChild(div);
    S.items.push({ el: div, word: w, y: -34 });
  }

  function clearItems() {
    S.items.forEach(function (it) { try { it.el.remove(); } catch (e) {} });
    S.items = [];
  }

  function speed() { return 42 + S.level * 10; }           /* px per second */
  function spawnInterval() { return Math.max(700, 2400 - S.level * 220); } /* ms */
  function maxActive() { return Math.min(2 + S.level, 6); }

  function moveItems(dy) {
    var H = S.els.area.clientHeight || AREA_H;
    for (var i = S.items.length - 1; i >= 0; i--) {
      var it = S.items[i];
      it.y += dy;
      it.el.style.top = it.y + "px";
      if (it.y > H - 30) miss(i);
    }
  }

  function miss(i) {
    var it = S.items[i];
    try { it.el.remove(); } catch (e) {}
    S.items.splice(i, 1);
    S.lives--;
    toast("Missed “" + it.word + "” — " + Math.max(0, S.lives) + (S.lives === 1 ? " life" : " lives") + " left");
    paintHud();
    if (S.lives <= 0) endGame();
  }

  function loop(t) {
    if (S.phase !== "running") return;
    if (!S.lastT) S.lastT = t;
    var dt = Math.min((t - S.lastT) / 1000, 0.1);
    S.lastT = t;
    var rm = reducedMotion();
    if (rm) {
      S.stepAcc += dt;
      if (S.stepAcc >= 0.35) { moveItems(speed() * S.stepAcc); S.stepAcc = 0; }
    } else {
      moveItems(speed() * dt);
    }
    S.spawnIn -= dt * 1000;
    if (S.spawnIn <= 0 && S.items.length < maxActive()) { spawn(); S.spawnIn = spawnInterval(); }
    S.raf = requestAnimationFrame(loop);
  }

  function tryZap() {
    var t = S.typed;
    if (!t) return;
    var hit = -1;
    for (var i = 0; i < S.items.length; i++) if (S.items[i].word === t) { hit = i; break; }
    if (hit >= 0) {
      var it = S.items[hit];
      try { it.el.remove(); } catch (e) {}
      S.items.splice(hit, 1);
      S.zapped++;
      if (S.zapped % 10 === 0) {
        S.level++;
        toast("🚀 Level " + S.level + " — faster falls, longer words!");
      }
      S.typed = ""; S.flash = 0;
    } else {
      S.flash = 3; S.typed = "";
      setTimeout(function () { if (S === current) { S.flash = 0; paintHud(); } }, 350);
    }
    paintHud();
  }

  function start() {
    if (S.phase === "running") return;
    if (S.phase === "over") reset();
    S.phase = "running";
    S.els.hint.style.display = "none";
    S.lastT = 0; S.stepAcc = 0; S.spawnIn = 400;
    S.raf = requestAnimationFrame(loop);
    S.els.result.innerHTML = "";
    updateButtons(); refocus();
  }
  function pause() {
    if (S.phase !== "running") return;
    S.phase = "paused";
    if (S.raf) cancelAnimationFrame(S.raf);
    S.raf = 0;
    updateButtons();
  }
  function reset() {
    pause();
    clearItems();
    S.typed = ""; S.zapped = 0; S.lives = 3; S.level = 1; S.bag = []; S.flash = 0;
    S.phase = "idle";
    S.els.hint.style.display = "";
    S.els.result.innerHTML = "";
    paintHud(); updateButtons();
  }
  function restart() { reset(); start(); }

  function endGame() {
    if (S.phase === "over") return;
    S.phase = "over";
    if (S.raf) cancelAnimationFrame(S.raf);
    S.raf = 0;
    var r = finishGame(GAME_ID, S.zapped, { level: S.level, livesLeft: 0 });
    S.els.result.innerHTML = gameOverHTML({
      title: "Game over!", score: S.zapped, scoreLabel: "words zapped",
      isBest: r.isBest, xp: r.xp,
      rows: [["Level reached", S.level], ["Personal best", r.rec.best]]
    });
    var again = S.els.result.querySelector("[data-again]");
    if (again) again.addEventListener("click", function () { restart(); });
    updateButtons();
  }

  S.onKey = function (e) {
    if (!keyOK(e)) return;
    if (S.phase !== "running") return;
    var k = e.key;
    if (k === "Enter") {
      e.preventDefault();
      if (document.activeElement && document.activeElement !== S.els.input) document.activeElement.blur();
      tryZap(); refocus();
      return;
    }
    if (k === " ") { e.preventDefault(); return; }
    if (k === "Backspace") { S.typed = S.typed.slice(0, -1); S.els.input.value = S.typed; paintHud(); return; }
    if (k.length === 1 && /[a-zA-Z'-]/.test(k)) {
      S.typed = (S.typed + k.toLowerCase()).slice(-24);
      S.els.input.value = S.typed;
      paintHud();
    }
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
  try { if (S.raf) cancelAnimationFrame(S.raf); } catch (e) {}
  try { document.removeEventListener("keydown", S.onKey); } catch (e) {}
  try { document.removeEventListener("visibilitychange", S.onVis); } catch (e) {}
  try { window.removeEventListener("blur", S.onBlur); } catch (e) {}
}

T.games[GAME_ID] = {
  id: GAME_ID,
  title: "Falling Words",
  desc: "Zap falling words by typing them + Enter before they hit the bottom.",
  icon: "🌧️",
  render: render,
  destroy: destroy
};
})();
