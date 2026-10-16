/* Type Saif — Views: Games hub + game detail
 * TS.views.games — hub at #/games: 6 game cards (title, desc, icon, best,
 *   plays, Play button -> #/game/<id>).
 * TS.views.game  — detail at #/game/<id>: back link + the selected game's
 *   render(el); unknown id -> empty state.
 */
(function () {
"use strict";
var T = (window.TypeSaif = window.TypeSaif || {});
T.views = T.views || {};
var currentGame = null;

var ORDER = ["word-sprint", "falling-words", "typing-race", "accuracy-challenge", "survival", "daily-challenge"];

function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function gamesStore() { try { if (T.store && T.store.get) { var g = T.store.get("ts_games", {}); return g || {}; } } catch (e) {} return {}; }
function destroyCurrent() {
  if (currentGame && typeof currentGame.destroy === "function") {
    try { currentGame.destroy(); } catch (e) {}
  }
  currentGame = null;
}
function emptyStateHTML(title, msg) {
  try {
    if (T.ui && T.ui.emptyState) {
      var d = document.createElement("div");
      T.ui.emptyState(d, { title: title, message: msg });
      if (d.innerHTML) return d.innerHTML;
    }
  } catch (e) {}
  return '<div class="empty-state" style="text-align:center;padding:40px 20px">'
    + '<h3 style="margin:0 0 8px">' + esc(title) + '</h3>'
    + '<p style="color:var(--text-2)">' + esc(msg) + '</p>'
    + '<a class="btn btn-ghost" href="#/games" style="text-decoration:none">← All games</a></div>';
}

T.views.games = {
  render: function (el) {
    destroyCurrent();
    var gs = gamesStore();
    var cards = "";
    ORDER.forEach(function (id) {
      var g = T.games && T.games[id];
      if (!g || typeof g.render !== "function") return; /* never render a dead Play button */
      var rec = gs[id] || { best: 0, plays: 0 };
      cards += '<div class="card" style="display:flex;flex-direction:column;gap:8px">'
        + '<div style="font-size:34px;line-height:1" aria-hidden="true">' + esc(g.icon || "🎮") + '</div>'
        + '<h3 style="margin:0">' + esc(g.title || id) + '</h3>'
        + '<p style="margin:0;color:var(--text-2);font-size:14px;flex:1">' + esc(g.desc || "") + '</p>'
        + '<div style="display:flex;gap:14px;font-size:13px;color:var(--text-2)">'
        + '<span>🏅 Best: <b>' + (rec.best || 0) + '</b></span>'
        + '<span>🎮 Plays: <b>' + (rec.plays || 0) + '</b></span>'
        + '</div>'
        + '<div><button class="btn btn-primary" data-play="' + esc(id) + '">Play</button></div>'
        + '</div>';
    });
    el.innerHTML =
      '<div style="margin-bottom:16px">'
      + '<h1 style="margin:0 0 6px">Typing Games</h1>'
      + '<p style="margin:0;color:var(--text-2)">Short, fun drills to build speed and accuracy. Every game saves your personal best and earns XP.</p>'
      + '</div>'
      + (cards
        ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px">' + cards + '</div>'
        : emptyStateHTML("No games available", "The games have not loaded yet."));
    var btns = el.querySelectorAll("[data-play]");
    for (var i = 0; i < btns.length; i++) {
      (function (b) {
        b.addEventListener("click", function () { location.hash = "#/game/" + b.getAttribute("data-play"); });
      })(btns[i]);
    }
  },
  destroy: function () { destroyCurrent(); }
};

T.views.game = {
  render: function (el, params) {
    destroyCurrent();
    var id = params && (params.id || params[0]);
    if (!id) {
      var m = (location.hash || "").match(/^#\/game\/([^\/?#]+)/);
      if (m) { try { id = decodeURIComponent(m[1]); } catch (e) { id = m[1]; } }
    }
    var g = id && T.games ? T.games[id] : null;
    var head = '<div style="margin-bottom:12px"><a class="btn btn-ghost" href="#/games" style="text-decoration:none">← All games</a></div>';
    if (!g || typeof g.render !== "function") {
      el.innerHTML = head + emptyStateHTML("Game not found", "There is no game with id “" + (id || "") + "”.");
      return;
    }
    el.innerHTML = head + '<div id="game-host"></div>';
    currentGame = g;
    try {
      g.render(el.querySelector("#game-host"));
    } catch (err) {
      currentGame = null;
      el.querySelector("#game-host").innerHTML =
        emptyStateHTML("Could not start game", "Something went wrong loading “" + (g.title || id) + "”. Please try again.");
    }
  },
  destroy: function () { destroyCurrent(); }
};
})();
