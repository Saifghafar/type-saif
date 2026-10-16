/* Type Saif — Game: Typing Race
 * Type a ~30-word passage as fast and accurately as you can. Your car moves
 * with your progress while two CPU opponents (clearly labeled CPU Racer,
 * fixed WPM with jitter) race alongside. Finish for placement, WPM and
 * accuracy. Score = round(net WPM) + placement bonus (1st +50, 2nd +25, 3rd +10).
 * Registers TS.games["typing-race"] = {id,title,desc,icon,render,destroy}.
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
function toast(msg) { try { if (T.ui && T.ui.toast) T.ui.toast(msg); } catch (e) {} }
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
    + '<h2 style="margin:0 0 4px">' + esc(o.title) + '</h2>'
    + '<div style="font-size:52px;font-weight:800;line-height:1.1">' + esc(o.score) + '</div>'
    + '<div style="color:var(--text-2);margin-bottom:12px">' + esc(o.scoreLabel) + '</div>'
    + (rows ? '<div style="max-width:360px;margin:0 auto 12px;text-align:left">' + rows + '</div>' : '')
    + '<div style="margin-bottom:16px"><span class="badge">+' + o.xp + ' XP earned</span></div>'
    + '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'
    + '<button class="btn btn-primary" data-again>Race again</button>'
    + '<a class="btn btn-ghost" href="#/games" style="text-decoration:none">All games</a></div></div>';
}

/* ---------- game ---------- */
var GAME_ID = "typing-race";
/* CPU opponents: fixed WPM with a small deterministic jitter factor. */
var CPU_DEFS = [
  { name: "Bolt", emoji: "🚗", wpm: 25, jitter: 0.94 },
  { name: "Dash", emoji: "🚙", wpm: 40, jitter: 1.06 }
];

function render(el) {
  destroy();
  var passage = shuffle(wordList()).slice(0, 30).join(" ");
  var S = current = {
    phase: "idle", passage: passage, pos: 0,
    correct: 0, incorrect: 0, keys: 0,
    clock: makeClock(), raf: 0, lastT: 0,
    cpus: [], cpuDone: {}, playerDone: null, gaveUp: false,
    onKey: null, onVis: null, onBlur: null, els: {}
  };
  S.cpus = CPU_DEFS.map(function (c) {
    return { name: c.name, emoji: c.emoji, wpm: c.wpm, rate: (c.wpm * 5 / 60) * c.jitter, prog: 0, el: null };
  });
  var best = (loadGames()[GAME_ID] || {}).best || 0;

  function trackRow(label, id, car, extra) {
    return '<div style="margin-bottom:10px">'
      + '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">'
      + '<span>' + label + '</span><span id="' + id + '-pct" style="color:var(--text-2)">0%</span></div>'
      + '<div style="position:relative;height:36px;background:var(--bg);border:1px solid var(--border);border-radius:18px;overflow:hidden">'
      + '<div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--border)"></div>'
      + '<div id="' + id + '-car" style="position:absolute;top:2px;left:0;font-size:24px;' + (extra || "") + '">' + car + '</div>'
      + '<div style="position:absolute;right:6px;top:0;bottom:0;width:4px;background:var(--green-soft);border-left:2px dashed var(--green)"></div>'
      + '</div></div>';
  }

  el.innerHTML =
    '<div class="card" style="margin-bottom:12px">'
    + '<h2 style="margin:0 0 6px">🏎️ Typing Race</h2>'
    + '<p style="margin:0;color:var(--text-2)">Type the passage below as fast and accurately as you can. Your car (🧍 <b>You</b>) '
    + 'moves with your progress. You are racing two computer opponents — <b>🤖 CPU Racer Bolt (25 wpm)</b> and '
    + '<b>🤖 CPU Racer Dash (40 wpm)</b>. No real players, just you vs. the CPUs. No backspace in a race — keep going!</p>'
    + (best ? '<p style="margin:8px 0 0"><span class="badge">🏅 Personal best score: ' + best + '</span></p>' : '')
    + '</div>'
    + '<div class="card" style="margin-bottom:12px">'
    + trackRow("🧍 You", "rc-you", "🏎️", "")
    + trackRow("🤖 CPU Racer · Bolt (25 wpm)", "rc-cpu0", "🚗", "opacity:.9")
    + trackRow("🤖 CPU Racer · Dash (40 wpm)", "rc-cpu1", "🚙", "opacity:.9")
    + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0">'
    + hudTile("⏱ Time", "rc-time", "0.0s")
    + hudTile("🎯 Accuracy", "rc-acc", "100%")
    + hudTile("📏 Progress", "rc-prog", "0%")
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '<button class="btn btn-primary" id="rc-start">Start race</button>'
    + '<button class="btn btn-ghost" id="rc-pause" disabled>Pause</button>'
    + '<button class="btn btn-ghost" id="rc-restart">Restart</button>'
    + '<button class="btn btn-ghost" id="rc-quit" disabled>End race</button>'
    + '</div></div>'
    + '<div class="card" style="margin-bottom:12px">'
    + '<div id="rc-passage" style="font-size:19px;line-height:2;letter-spacing:.5px" aria-live="polite"></div>'
    + '<input id="rc-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" '
    + 'placeholder="Type here to race" aria-label="Type here to race" '
    + 'style="margin-top:12px;width:100%;max-width:420px;padding:10px 14px;font-size:18px;border:1px solid var(--border);border-radius:10px" />'
    + '<div id="rc-msg" style="margin-top:10px;color:var(--text-2)">Press “Start race”, then type the passage.</div>'
    + '</div>'
    + '<div id="rc-result"></div>';

  S.els = {
    passage: el.querySelector("#rc-passage"), input: el.querySelector("#rc-input"),
    msg: el.querySelector("#rc-msg"), result: el.querySelector("#rc-result"),
    time: el.querySelector("#rc-time"), acc: el.querySelector("#rc-acc"), prog: el.querySelector("#rc-prog"),
    youCar: el.querySelector("#rc-you-car"), youPct: el.querySelector("#rc-you-pct"),
    start: el.querySelector("#rc-start"), pause: el.querySelector("#rc-pause"),
    restart: el.querySelector("#rc-restart"), quit: el.querySelector("#rc-quit")
  };
  S.cpus[0].carEl = el.querySelector("#rc-cpu0-car"); S.cpus[0].pctEl = el.querySelector("#rc-cpu0-pct");
  S.cpus[1].carEl = el.querySelector("#rc-cpu1-car"); S.cpus[1].pctEl = el.querySelector("#rc-cpu1-pct");

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
    var total = S.passage.length;
    var pct = Math.round(S.pos / total * 100);
    S.els.prog.textContent = pct + "%";
    S.els.youPct.textContent = pct + "%";
    S.els.youCar.style.left = "calc(" + pct + "% - " + Math.round(pct * 0.28) + "px)";
    var acc = S.keys > 0 ? Math.round(S.correct / S.keys * 100) : 100;
    S.els.acc.textContent = acc + "%";
    S.els.time.textContent = S.clock.elapsed().toFixed(1) + "s";
  }

  function updateButtons() {
    var running = S.phase === "running", over = S.phase === "over";
    S.els.start.disabled = running;
    S.els.start.textContent = S.phase === "paused" ? "Resume" : "Start race";
    S.els.pause.disabled = !running;
    S.els.quit.disabled = !running;
    S.els.restart.disabled = (S.phase === "idle" && !over && S.pos === 0);
  }

  function paintCpu() {
    var total = S.passage.length, elapsed = S.clock.elapsed();
    S.cpus.forEach(function (c, i) {
      if (S.phase === "running" || S.phase === "paused" || S.phase === "over") {
        c.prog = Math.min(1, (c.rate * elapsed) / total);
      }
      var pct = Math.round(c.prog * 100);
      if (c.carEl) c.carEl.style.left = "calc(" + pct + "% - " + Math.round(pct * 0.28) + "px)";
      if (c.pctEl) c.pctEl.textContent = pct + "%";
      if (c.prog >= 1 && !S.cpuDone[c.name]) {
        S.cpuDone[c.name] = elapsed;
        toast("🤖 CPU Racer " + c.name + " finished!");
      }
    });
  }

  function loop() {
    if (S.phase !== "running") return;
    paintHud(); paintCpu();
    S.raf = requestAnimationFrame(loop);
  }

  function start() {
    if (S.phase === "running") return;
    if (S.phase === "over") reset();
    S.phase = "running";
    S.clock.start();
    if (!S.raf) S.raf = requestAnimationFrame(loop);
    S.els.msg.textContent = "Race on! Type the passage — no backspace.";
    S.els.result.innerHTML = "";
    updateButtons(); refocus();
  }
  function pause() {
    if (S.phase !== "running") return;
    S.phase = "paused";
    S.clock.pause();
    if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; }
    S.els.msg.textContent = "Paused — press Resume to continue.";
    updateButtons();
  }
  function reset() {
    if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; }
    S.clock.reset();
    S.pos = 0; S.correct = 0; S.incorrect = 0; S.keys = 0;
    S.cpuDone = {}; S.playerDone = null; S.gaveUp = false;
    S.cpus.forEach(function (c) { c.prog = 0; });
    S.phase = "idle";
    S.els.result.innerHTML = "";
    S.els.msg.textContent = "Press “Start race”, then type the passage.";
    paintPassage(); paintHud(); paintCpu(); updateButtons();
  }
  function restart() { reset(); start(); }

  function endRace(gaveUp) {
    if (S.phase === "over") return;
    S.phase = "over";
    S.clock.pause();
    if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; }
    paintHud(); paintCpu();
    var elapsed = Math.max(S.clock.elapsed(), 0.5);
    var mins = elapsed / 60;
    var gross = (S.keys / 5) / mins;
    var net = Math.max(0, gross - (S.incorrect / mins));
    var acc = S.keys > 0 ? Math.round(S.correct / S.keys * 100) : 0;
    var playerTime = gaveUp ? Infinity : (S.playerDone !== null ? S.playerDone : Infinity);
    var times = [{ who: "you", t: playerTime }];
    S.cpus.forEach(function (c) {
      var t = S.cpuDone[c.name];
      if (t === undefined) t = (c.rate > 0 ? S.passage.length / c.rate : Infinity);
      times.push({ who: c.name, t: t });
    });
    times.sort(function (a, b) { return a.t - b.t; });
    var rank = 0;
    for (var i = 0; i < times.length; i++) if (times[i].who === "you") rank = i + 1;
    var bonus = gaveUp ? 0 : (rank === 1 ? 50 : (rank === 2 ? 25 : 10));
    var score = Math.round(net) + bonus;
    var medal = rank === 1 ? "🥇" : (rank === 2 ? "🥈" : "🥉");
    var r = finishGame(GAME_ID, score, {
      placement: gaveUp ? "DNF" : rank,
      wpm: Math.round(net), accuracy: acc,
      cpu: S.cpus.map(function (c) { return { name: c.name, wpm: c.wpm }; })
    });
    S.els.msg.textContent = gaveUp ? "Race ended early." : "Finished!";
    S.els.result.innerHTML = gameOverHTML({
      title: gaveUp ? "You ended the race" : (medal + " You placed #" + rank + " of 3!"),
      score: score, scoreLabel: "race score (net WPM + placement bonus)",
      isBest: r.isBest, xp: r.xp,
      rows: [
        ["Placement", gaveUp ? "DNF (ended early)" : "#" + rank + " of 3"],
        ["Net WPM", Math.round(net) + " wpm"],
        ["Accuracy", acc + "%"],
        ["CPU Bolt (25 wpm)", S.cpuDone.Bolt !== undefined ? "finished " + S.cpuDone.Bolt.toFixed(1) + "s" : "did not finish"],
        ["CPU Dash (40 wpm)", S.cpuDone.Dash !== undefined ? "finished " + S.cpuDone.Dash.toFixed(1) + "s" : "did not finish"],
        ["Your time", gaveUp ? "—" : S.playerDone.toFixed(1) + "s"],
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
    if (k === "Backspace") { e.preventDefault(); return; } /* no backspace in a race */
    if (k === "Enter") { e.preventDefault(); return; }
    if (k === " ") e.preventDefault();
    if (k.length !== 1) return;
    if (document.activeElement && document.activeElement !== S.els.input) document.activeElement.blur();
    S.keys++;
    if (k === S.passage[S.pos]) { S.pos++; S.correct++; }
    else S.incorrect++;
    paintPassage(); paintHud();
    if (S.pos >= S.passage.length) {
      S.playerDone = S.clock.elapsed();
      endRace(false);
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
  S.els.quit.addEventListener("click", function () { endRace(true); });

  paintPassage(); paintHud(); paintCpu(); updateButtons();
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
  title: "Typing Race",
  desc: "Race two clearly-labeled CPU opponents over a 30-word passage.",
  icon: "🏎️",
  render: render,
  destroy: destroy
};
})();
