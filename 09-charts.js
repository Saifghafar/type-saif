/* Type Saif — TS.charts
 * Pure SVG chart builders. No dependencies (works with no other TS modules loaded).
 * Charts render ONLY from real ts_attempts records supplied by the caller.
 */
(function () {
  "use strict";

  var TS = window.TypeSaif = window.TypeSaif || {};
  TS.charts = TS.charts || {};

  var NS = "http://www.w3.org/2000/svg";
  var INK = "#0F172A", MUTED = "#64748B", GRID = "#E2E8F0";

  function sEl(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    if (attrs) {
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
      }
    }
    if (text !== undefined && text !== null) e.textContent = String(text);
    return e;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function baseSvg(title) {
    var svg = sEl("svg", {
      viewBox: "0 0 640 340",
      role: "img",
      "aria-label": title || "chart",
      preserveAspectRatio: "xMidYMid meet"
    });
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.style.display = "block";
    return svg;
  }

  function emptySvg(el, title, msg) {
    el.innerHTML = "";
    var svg = baseSvg(title);
    svg.appendChild(sEl("text", {
      x: 320, y: 155, "text-anchor": "middle", fill: MUTED, "font-size": 15
    }, msg || "No data yet"));
    svg.appendChild(sEl("text", {
      x: 320, y: 180, "text-anchor": "middle", fill: MUTED, "font-size": 12
    }, "Complete a lesson or practice session to see your trend."));
    el.appendChild(svg);
  }

  function niceCeil(v) {
    if (v <= 0) return 10;
    var pow = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / pow;
    var nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return nice * pow;
  }

  function fmtTick(v, maxY) {
    if (maxY >= 100) return String(Math.round(v));
    if (maxY >= 20) return String(Math.round(v * 10) / 10);
    return String(Math.round(v * 100) / 100);
  }

  /**
   * lineChart(el, {points:[{x:label, y:number}], title, color, yLabel, yMin, yMax})
   */
  TS.charts.lineChart = function (el, opts) {
    opts = opts || {};
    var points = Array.isArray(opts.points) ? opts.points : [];
    var title = opts.title || "Trend";

    if (!points.length) {
      emptySvg(el, title, "No data for this period");
      return;
    }

    el.innerHTML = "";
    var color = opts.color || "#2563EB";
    var W = 640, H = 340, pl = 54, pr = 18, pt = 34, pb = 54;
    var iw = W - pl - pr, ih = H - pt - pb;
    var n = points.length;

    var ys = points.map(function (p) { return Number(p.y) || 0; });
    var maxY = opts.yMax != null ? opts.yMax : niceCeil(Math.max.apply(null, ys.concat([10])) * 1.1);
    var minY = opts.yMin != null ? opts.yMin : 0;
    if (maxY <= minY) maxY = minY + 10;

    function X(i) { return n === 1 ? pl + iw / 2 : pl + iw * (i / (n - 1)); }
    function Y(v) { return pt + ih - ((v - minY) / (maxY - minY)) * ih; }

    var svg = baseSvg(title);

    // Title + y-axis label
    svg.appendChild(sEl("text", { x: pl, y: 18, fill: INK, "font-size": 14, "font-weight": 600 }, esc(title)));
    if (opts.yLabel) {
      var yl = sEl("text", {
        x: 14, y: pt + ih / 2, fill: MUTED, "font-size": 11,
        "text-anchor": "middle", transform: "rotate(-90 14 " + (pt + ih / 2) + ")"
      }, esc(opts.yLabel));
      svg.appendChild(yl);
    }

    // Gridlines + y ticks
    for (var t = 0; t <= 4; t++) {
      var v = minY + (maxY - minY) * (t / 4);
      var y = Y(v);
      svg.appendChild(sEl("line", { x1: pl, y1: y, x2: W - pr, y2: y, stroke: GRID, "stroke-width": 1 }));
      svg.appendChild(sEl("text", {
        x: pl - 8, y: y + 4, "text-anchor": "end", fill: MUTED, "font-size": 11
      }, fmtTick(v, maxY)));
    }

    // Axes
    svg.appendChild(sEl("line", { x1: pl, y1: pt, x2: pl, y2: pt + ih, stroke: "#94A3B8", "stroke-width": 1 }));
    svg.appendChild(sEl("line", { x1: pl, y1: pt + ih, x2: W - pr, y2: pt + ih, stroke: "#94A3B8", "stroke-width": 1 }));

    // X labels (sparse)
    var step = Math.max(1, Math.ceil(n / 8));
    for (var i = 0; i < n; i++) {
      if (i % step !== 0 && i !== n - 1) continue;
      var lx = X(i);
      var lab = sEl("text", {
        x: lx, y: pt + ih + 20, "text-anchor": "middle", fill: MUTED, "font-size": 11
      }, esc(points[i].x));
      if (step > 1 && n > 4) {
        lab.setAttribute("transform", "rotate(-28 " + lx + " " + (pt + ih + 20) + ")");
        lab.setAttribute("text-anchor", "end");
      }
      svg.appendChild(lab);
    }

    // Line path
    var d = points.map(function (p, j) {
      return (j === 0 ? "M" : "L") + X(j).toFixed(1) + " " + Y(ys[j]).toFixed(1);
    }).join(" ");
    svg.appendChild(sEl("path", { d: d, fill: "none", stroke: color, "stroke-width": 2.5, "stroke-linejoin": "round", "stroke-linecap": "round" }));

    // Dots with tooltips
    for (var k = 0; k < n; k++) {
      var c = sEl("circle", { cx: X(k), cy: Y(ys[k]), r: n > 30 ? 2.5 : 4, fill: "#fff", stroke: color, "stroke-width": 2 });
      var tip = sEl("title", null, points[k].x + ": " + ys[k]);
      c.appendChild(tip);
      svg.appendChild(c);
    }

    el.appendChild(svg);
  };

  /**
   * barChart(el, {points:[{x:label, y:number}], title, color, yLabel})
   */
  TS.charts.barChart = function (el, opts) {
    opts = opts || {};
    var points = Array.isArray(opts.points) ? opts.points : [];
    var title = opts.title || "Counts";

    if (!points.length) {
      emptySvg(el, title, "No data for this period");
      return;
    }

    el.innerHTML = "";
    var color = opts.color || "#7C3AED";
    var W = 640, H = 340, pl = 54, pr = 18, pt = 34, pb = 54;
    var iw = W - pl - pr, ih = H - pt - pb;
    var n = points.length;

    var ys = points.map(function (p) { return Number(p.y) || 0; });
    var maxY = niceCeil(Math.max.apply(null, ys.concat([1])) * 1.15);
    function Y(v) { return pt + ih - (v / maxY) * ih; }

    var svg = baseSvg(title);
    svg.appendChild(sEl("text", { x: pl, y: 18, fill: INK, "font-size": 14, "font-weight": 600 }, esc(title)));
    if (opts.yLabel) {
      svg.appendChild(sEl("text", {
        x: 14, y: pt + ih / 2, fill: MUTED, "font-size": 11,
        "text-anchor": "middle", transform: "rotate(-90 14 " + (pt + ih / 2) + ")"
      }, esc(opts.yLabel)));
    }

    for (var t = 0; t <= 4; t++) {
      var v = maxY * (t / 4);
      var y = Y(v);
      svg.appendChild(sEl("line", { x1: pl, y1: y, x2: W - pr, y2: y, stroke: GRID, "stroke-width": 1 }));
      svg.appendChild(sEl("text", {
        x: pl - 8, y: y + 4, "text-anchor": "end", fill: MUTED, "font-size": 11
      }, String(Math.round(v))));
    }
    svg.appendChild(sEl("line", { x1: pl, y1: pt, x2: pl, y2: pt + ih, stroke: "#94A3B8", "stroke-width": 1 }));
    svg.appendChild(sEl("line", { x1: pl, y1: pt + ih, x2: W - pr, y2: pt + ih, stroke: "#94A3B8", "stroke-width": 1 }));

    var slot = iw / n;
    var bw = Math.max(2, Math.min(48, slot * 0.62));
    for (var i = 0; i < n; i++) {
      var bx = pl + slot * i + (slot - bw) / 2;
      var by = Y(ys[i]);
      var bh = pt + ih - by;
      var r = sEl("rect", {
        x: bx.toFixed(1), y: by.toFixed(1), width: bw.toFixed(1), height: Math.max(bh, 0).toFixed(1),
        rx: 3, fill: color, opacity: ys[i] > 0 ? 0.9 : 0.25
      });
      r.appendChild(sEl("title", null, points[i].x + ": " + ys[i]));
      svg.appendChild(r);

      if (ys[i] > 0 && n <= 60) {
        svg.appendChild(sEl("text", {
          x: (bx + bw / 2).toFixed(1), y: (by - 5).toFixed(1),
          "text-anchor": "middle", fill: MUTED, "font-size": 10
        }, String(ys[i])));
      }

      var step = Math.max(1, Math.ceil(n / 12));
      if (i % step === 0 || i === n - 1) {
        var lx2 = pl + slot * i + slot / 2;
        var lab = sEl("text", {
          x: lx2.toFixed(1), y: pt + ih + 20, "text-anchor": "middle", fill: MUTED, "font-size": 10
        }, esc(points[i].x));
        if (n > 12) {
          lab.setAttribute("transform", "rotate(-28 " + lx2.toFixed(1) + " " + (pt + ih + 20) + ")");
          lab.setAttribute("text-anchor", "end");
        }
        svg.appendChild(lab);
      }
    }

    el.appendChild(svg);
  };

  /**
   * filterAttempts(attempts, range) — range in {"7d","30d","all"}.
   * Uses LOCAL calendar dates derived from each attempt's ISO date.
   */
  TS.charts.filterAttempts = function (attempts, range) {
    if (!Array.isArray(attempts)) return [];
    var clean = attempts.filter(function (a) { return a && typeof a === "object"; });
    if (range === "all") return clean;
    var days = range === "30d" ? 30 : 7;
    var cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (days - 1));
    var cutoffMs = cutoff.getTime();
    return attempts.filter(function (a) {
      if (!a || !a.date) return false;
      var d = new Date(a.date);
      if (isNaN(d.getTime())) return false;
      var day = new Date(d);
      day.setHours(0, 0, 0, 0);
      return day.getTime() >= cutoffMs;
    });
  };
})();
