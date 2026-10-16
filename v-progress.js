/* Type Saif — TS.views.progress
 * Progress view: filter pills, stat tiles, SVG charts (from TS.charts),
 * most-challenging-keys, recent + full history tables.
 * All stats derive ONLY from real ts_attempts records.
 */
(function () {
  "use strict";

  var TS = window.TypeSaif = window.TypeSaif || {};
  TS.views = TS.views || {};

  var currentRange = "7d";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function getStore(key, fb) {
    try {
      if (TS.store && typeof TS.store.get === "function") return TS.store.get(key, fb);
    } catch (e) { /* fall through */ }
    return fb;
  }

  function toast(msg) {
    try {
      if (TS.ui && typeof TS.ui.toast === "function") { TS.ui.toast(msg); return; }
    } catch (e) { /* fall through */ }
    var d = document.createElement("div");
    d.className = "toast toast-fallback";
    d.textContent = msg;
    d.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0F172A;color:#fff;padding:10px 16px;border-radius:8px;z-index:9999;font-size:14px;";
    document.body.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 2200);
  }

  function statTileEl(title, value, sub) {
    try {
      if (TS.ui && typeof TS.ui.statTile === "function") return TS.ui.statTile(title, value, sub);
    } catch (e) { /* fall through */ }
    var d = document.createElement("div");
    d.className = "stat-tile";
    d.innerHTML = '<div class="stat-tile-title">' + esc(title) + '</div>' +
      '<div class="stat-tile-value">' + esc(value) + '</div>' +
      (sub ? '<div class="stat-tile-sub">' + esc(sub) + '</div>' : '');
    return d;
  }

  function emptyStateEl(title, msg) {
    try {
      if (TS.ui && typeof TS.ui.emptyState === "function") {
        var tmp = document.createElement("div");
        tmp.innerHTML = "";
        var r = TS.ui.emptyState(title, msg);
        if (typeof r === "string") { tmp.innerHTML = r; return tmp.firstChild || tmp; }
        return r;
      }
    } catch (e) { /* fall through */ }
    var d = document.createElement("div");
    d.className = "empty-state";
    d.innerHTML = "<h3>" + esc(title) + "</h3><p>" + esc(msg) + "</p>";
    return d;
  }

  function lessonTitle(id) {
    if (id === "practice") return "Free Practice";
    try {
      if (TS.data && typeof TS.data.getLesson === "function") {
        var l = TS.data.getLesson(id);
        if (l) return (l.level ? "L" + l.level + " · " : "") + (l.title || id);
      }
    } catch (e) { /* fall through */ }
    return id || "—";
  }

  function localDateLabel(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function fmtDateTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " +
      d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function fmtDur(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    if (sec < 60) return sec + "s";
    var m = Math.floor(sec / 60);
    if (m < 60) return m + "m " + (sec % 60) + "s";
    var h = Math.floor(m / 60);
    return h + "h " + (m % 60) + "m";
  }

  function fmtPracticeSec(total) {
    total = Math.max(0, Math.round(Number(total) || 0));
    if (total < 60) return total + "s";
    var m = Math.floor(total / 60);
    var h = Math.floor(m / 60);
    if (h === 0) return m + "m";
    return h + "h " + (m % 60) + "m";
  }

  function starsHtml(n) {
    n = Math.max(0, Math.min(3, Math.round(Number(n) || 0)));
    var s = "";
    for (var i = 0; i < 3; i++) s += i < n ? "★" : "☆";
    return '<span class="badge" title="' + n + ' of 3 stars">' + s + '</span>';
  }

  function dayKeyLocal(iso) {
    var d = new Date(iso);
    var y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    return y + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function attemptRow(a) {
    var wpm = a.netWpm != null ? Math.round(a.netWpm) : (a.grossWpm != null ? Math.round(a.grossWpm) : "—");
    var acc = a.accuracy != null ? (Math.round(a.accuracy * 10) / 10) + "%" : "—";
    var dur = a.durationSec != null ? fmtDur(a.durationSec) : (a.activeSec != null ? fmtDur(a.activeSec) : "—");
    var mistakes = a.incorrect != null ? a.incorrect : "—";
    var reportLink = a.id
      ? '<a class="btn btn-ghost btn-sm" href="#/report/' + esc(a.id) + '">View report</a>'
      : '<span class="text-2">—</span>';
    return "<tr>" +
      "<td>" + esc(fmtDateTime(a.date)) + "</td>" +
      "<td>" + esc(lessonTitle(a.lessonId)) + "</td>" +
      "<td>" + esc(wpm) + "</td>" +
      "<td>" + esc(acc) + "</td>" +
      "<td>" + esc(dur) + "</td>" +
      "<td>" + esc(mistakes) + "</td>" +
      "<td>" + starsHtml(a.stars) + "</td>" +
      "<td>" + reportLink + "</td>" +
      "</tr>";
  }

  function historyTable(attempts) {
    if (!attempts.length) {
      return '<div class="empty-state"><p>No attempts in this period yet.</p></div>';
    }
    var rows = attempts.map(attemptRow).join("");
    return '<div class="table-wrap"><table class="table">' +
      "<thead><tr><th>Date</th><th>Lesson</th><th>WPM</th><th>Accuracy</th>" +
      "<th>Duration</th><th>Mistakes</th><th>Stars</th><th>Report</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table></div>";
  }

  function renderInto(el) {
    var attempts = getStore("ts_attempts", []);
    var range = currentRange;
    var filtered = (TS.charts && typeof TS.charts.filterAttempts === "function")
      ? TS.charts.filterAttempts(attempts, range)
      : attempts.slice();

    var html = "";
    html += '<div class="page-head"><h1>Progress</h1>' +
      '<p class="text-2">Your typing stats, computed from your real attempts.</p></div>';

    // Filter pills
    var pills = [["7d", "Last 7 days"], ["30d", "Last 30 days"], ["all", "All"]];
    html += '<div class="pills" role="tablist" aria-label="Date range">';
    pills.forEach(function (p) {
      html += '<button type="button" class="btn ' + (range === p[0] ? "btn-primary" : "btn-ghost") +
        '" data-range="' + p[0] + '" role="tab" aria-selected="' + (range === p[0]) + '">' + p[1] + "</button>";
    });
    html += "</div>";

    if (!attempts.length) {
      el.innerHTML = html;
      var wrap = document.createElement("div");
      wrap.className = "card";
      wrap.style.marginTop = "16px";
      wrap.appendChild(emptyStateEl(
        "No progress data yet",
        "Complete your first lesson or a practice session and your charts, stats, and history will appear here."
      ));
      var cta = document.createElement("div");
      cta.style.cssText = "display:flex;gap:8px;justify-content:center;margin-top:12px;";
      cta.innerHTML = '<a class="btn btn-primary" href="#/learn">Start learning</a>' +
        '<a class="btn btn-ghost" href="#/practice">Try practice mode</a>';
      wrap.appendChild(cta);
      el.appendChild(wrap);
      bindPills(el);
      return;
    }

    // ---- Stat tiles ----
    var sorted = filtered.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    var wpms = sorted.map(function (a) { return a.netWpm != null ? a.netWpm : (a.grossWpm != null ? a.grossWpm : 0); });
    var bestWpm = wpms.length ? Math.max.apply(null, wpms) : 0;
    var accs = sorted.map(function (a) { return Number(a.accuracy) || 0; }).filter(function (x) { return x > 0; });
    var avgAcc = accs.length ? accs.reduce(function (s, x) { return s + x; }, 0) / accs.length : 0;
    var lessonIds = {};
    sorted.forEach(function (a) {
      if (a.lessonId && a.lessonId !== "practice") lessonIds[a.lessonId] = true;
    });
    var lessonsCompleted = Object.keys(lessonIds).length;
    var practiceSec = Number(getStore("ts_practiceSec", 0)) || 0;
    var xpTotal = (getStore("ts_xp", { total: 0 }) || {}).total || 0;

    var tiles = document.createElement("div");
    tiles.className = "tiles";
    tiles.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:16px 0;";
    tiles.appendChild(statTileEl("Best WPM", sorted.length ? String(Math.round(bestWpm)) : "—", range === "all" ? "all time" : "this period"));
    tiles.appendChild(statTileEl("Avg accuracy", sorted.length ? (Math.round(avgAcc * 10) / 10) + "%" : "—", sorted.length + " attempt" + (sorted.length === 1 ? "" : "s")));
    tiles.appendChild(statTileEl("Lessons completed", String(lessonsCompleted), "with at least 1 attempt"));
    tiles.appendChild(statTileEl("Practice time", fmtPracticeSec(practiceSec), "all time"));
    tiles.appendChild(statTileEl("Total XP", String(Math.round(xpTotal)), "all time"));
    el.innerHTML = html;
    el.appendChild(tiles);

    if (!sorted.length) {
      var none = document.createElement("div");
      none.className = "card";
      none.style.marginTop = "8px";
      none.appendChild(emptyStateEl("Nothing in this period", "Try a wider date range — your data is still here."));
      el.appendChild(none);
      bindPills(el);
      return;
    }

    // ---- Charts ----
    var chartsWrap = document.createElement("div");
    chartsWrap.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:16px;";

    var wpmCard = document.createElement("div"); wpmCard.className = "card";
    var accCard = document.createElement("div"); accCard.className = "card";
    var barCard = document.createElement("div"); barCard.className = "card";
    barCard.style.gridColumn = "1 / -1";
    chartsWrap.appendChild(wpmCard); chartsWrap.appendChild(accCard); chartsWrap.appendChild(barCard);
    el.appendChild(chartsWrap);

    var wpmDiv = document.createElement("div"); wpmCard.appendChild(wpmDiv);
    var accDiv = document.createElement("div"); accCard.appendChild(accDiv);
    var barDiv = document.createElement("div"); barCard.appendChild(barDiv);

    TS.charts.lineChart(wpmDiv, {
      title: "WPM over time",
      color: "#2563EB",
      yLabel: "net WPM",
      points: sorted.map(function (a) {
        return { x: localDateLabel(a.date), y: Math.round((a.netWpm != null ? a.netWpm : a.grossWpm || 0) * 10) / 10 };
      })
    });
    TS.charts.lineChart(accDiv, {
      title: "Accuracy over time",
      color: "#16A34A",
      yLabel: "accuracy %",
      yMin: 0, yMax: 100,
      points: sorted.map(function (a) {
        return { x: localDateLabel(a.date), y: Math.round((Number(a.accuracy) || 0) * 10) / 10 };
      })
    });

    // Attempts per day
    var dayCounts = {};
    sorted.forEach(function (a) {
      var k = dayKeyLocal(a.date);
      dayCounts[k] = (dayCounts[k] || 0) + 1;
    });
    var days = [];
    if (range === "all") {
      var keys = Object.keys(dayCounts).sort();
      days = keys.slice(-120);
    } else {
      var span = range === "30d" ? 30 : 7;
      var today = new Date(); today.setHours(0, 0, 0, 0);
      for (var di = span - 1; di >= 0; di--) {
        var d = new Date(today); d.setDate(d.getDate() - di);
        var kk = dayKeyLocal(d.toISOString());
        days.push(kk);
      }
    }
    TS.charts.barChart(barDiv, {
      title: "Attempts per day",
      color: "#7C3AED",
      yLabel: "attempts",
      points: days.map(function (k) {
        var dd = new Date(k + "T12:00:00");
        return { x: dd.toLocaleDateString(undefined, { month: "short", day: "numeric" }), y: dayCounts[k] || 0 };
      })
    });

    // ---- Most challenging keys ----
    var keyCounts = {};
    sorted.forEach(function (a) {
      var ce = a.charErrors || {};
      for (var ch in ce) {
        if (Object.prototype.hasOwnProperty.call(ce, ch)) {
          keyCounts[ch] = (keyCounts[ch] || 0) + Number(ce[ch] || 0);
        }
      }
    });
    var topKeys = Object.keys(keyCounts)
      .map(function (ch) { return { ch: ch, n: keyCounts[ch] }; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, 8);

    var keysCard = document.createElement("div");
    keysCard.className = "card";
    keysCard.style.marginBottom = "16px";
    var kh = '<h3>Most challenging keys</h3><p class="text-2">Keys you mistype most often in this period.</p>';
    if (!topKeys.length) {
      kh += '<div class="empty-state"><p>No mistakes recorded yet — nice typing!</p></div>';
    } else {
      var maxN = topKeys[0].n;
      kh += '<div class="keys-list">';
      topKeys.forEach(function (k) {
        var label = k.ch === " " ? "Space" : k.ch;
        var pct = Math.round((k.n / maxN) * 100);
        kh += '<div class="key-row" style="display:flex;align-items:center;gap:12px;margin:8px 0;">' +
          '<kbd class="key-cap" style="min-width:40px;text-align:center;">' + esc(label) + "</kbd>" +
          '<div class="bar-track" style="flex:1;height:10px;background:#EFF6FF;border-radius:6px;overflow:hidden;">' +
          '<div class="bar-fill" style="width:' + pct + '%;height:100%;background:#2563EB;"></div></div>' +
          '<span class="badge">' + k.n + "×</span></div>";
      });
      kh += "</div>";
    }
    keysCard.innerHTML = kh;
    el.appendChild(keysCard);

    // ---- Recent attempts ----
    var desc = filtered.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    var recentCard = document.createElement("div");
    recentCard.className = "card";
    recentCard.style.marginBottom = "16px";
    recentCard.innerHTML = "<h3>Recent attempts</h3>" + historyTable(desc.slice(0, 10));
    el.appendChild(recentCard);

    // ---- Full history ----
    var histCard = document.createElement("div");
    histCard.className = "card";
    histCard.innerHTML = "<h3>Full lesson history</h3>" +
      '<p class="text-2">' + desc.length + " attempt" + (desc.length === 1 ? "" : "s") + " in this period.</p>" +
      historyTable(desc);
    el.appendChild(histCard);

    bindPills(el);
  }

  function bindPills(el) {
    var btns = el.querySelectorAll("[data-range]");
    for (var i = 0; i < btns.length; i++) {
      (function (b) {
        b.addEventListener("click", function () {
          currentRange = b.getAttribute("data-range");
          renderInto(el);
          try { toast("Showing " + b.textContent); } catch (e) { /* noop */ }
        });
      })(btns[i]);
    }
  }

  TS.views.progress = {
    render: function (el) {
      currentRange = "7d";
      renderInto(el);
    },
    destroy: function () { /* no timers/listeners to clean up */ }
  };
})();
