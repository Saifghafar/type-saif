/* Type Saif — views/v-lesson.js — TS.views.lesson
 *
 * Lesson runner: typing area, live stats, virtual keyboard, completion
 * screen. Contract: uses TS.data.getLesson, TS.engine.LessonSession,
 * TS.metrics (via engine summary), TS.keyboard, guarded calls to TS.gamify,
 * TS.ui, TS.router, TS.reports.
 *
 * render(el, {id}) — full replace of #app. destroy() — detach engine,
 * clear timers/listeners (router calls it before switching views).
 */
(function () {
  "use strict";

  var TS = (window.TS = window.TS || {});
  TS.views = TS.views || {};

  var SETTING_DEFAULTS = {
    sound: true, keySound: true, keyboard: true, fingerGuide: true,
    highlight: "caret", difficulty: "normal", backspace: "allow",
    reducedMotion: false, layout: "qwerty"
  };

  var active = null; // cleanup state for the current render

  /* ---------------- small helpers ---------------- */

  function esc(s) {
    return String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function r1(n) { return Math.round((+n || 0) * 10) / 10; }
  function r2(n) { return Math.round((+n || 0) * 100) / 100; }
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ":" + ("0" + s).slice(-2);
  }
  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function go(hash) {
    if (TS.router && typeof TS.router.go === "function") TS.router.go(hash);
    else location.hash = hash;
  }
  function storeGet(key, fallback) {
    try {
      return TS.store && typeof TS.store.get === "function"
        ? TS.store.get(key, fallback)
        : fallback;
    } catch (e) { return fallback; }
  }
  function storeSet(key, val) {
    try {
      if (TS.store && typeof TS.store.set === "function") TS.store.set(key, val);
    } catch (e) { /* storage must never break the lesson */ }
  }

  function toast(msg, type) {
    try {
      if (TS.ui && typeof TS.ui.toast === "function") {
        TS.ui.toast(msg, type || "info");
        return;
      }
    } catch (e) { /* fall through to fallback */ }
    var t = document.createElement("div");
    t.textContent = msg;
    t.setAttribute("role", "status");
    t.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);" +
      "background:#0F172A;color:#fff;padding:10px 16px;border-radius:8px;z-index:9999;" +
      "font-size:.9rem;max-width:90vw;";
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3400);
  }

  function confirmAsync(message) {
    try {
      if (TS.ui && typeof TS.ui.confirmDialog === "function") {
        var r = TS.ui.confirmDialog({ title: "Please confirm", message: message });
        if (r && typeof r.then === "function") {
          return r.then(function (v) { return !!v; });
        }
        return Promise.resolve(!!r);
      }
    } catch (e) { /* fall through */ }
    return Promise.resolve(window.confirm(message));
  }

  function starsHtml(n) {
    n = Math.max(0, Math.min(3, Math.round(n || 0)));
    try {
      if (TS.ui && typeof TS.ui.stars === "function") {
        var h = TS.ui.stars(n);
        if (h) return h;
      }
    } catch (e) { /* fall through */ }
    var s = "";
    for (var i = 0; i < 3; i++) s += i < n ? "★" : "☆";
    return '<span class="ls-stars" role="img" aria-label="' + n + ' of 3 stars">' + s + "</span>";
  }

  function showModal(html) {
    try {
      if (TS.ui && typeof TS.ui.modal === "function") {
        TS.ui.modal(html);
        return;
      }
    } catch (e) { /* fall through */ }
    var ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9998;" +
      "display:flex;align-items:center;justify-content:center;padding:16px;";
    var box = document.createElement("div");
    box.className = "card";
    box.style.cssText = "max-width:420px;width:100%;padding:20px;";
    box.innerHTML = html + '<div style="margin-top:12px;text-align:right;">' +
      '<button class="btn btn-primary" id="ls-modal-ok">OK</button></div>';
    ov.appendChild(box);
    ov.addEventListener("click", function (e) {
      if (e.target === ov || e.target.id === "ls-modal-ok") ov.remove();
    });
    document.body.appendChild(ov);
  }

  /* ---------------- lesson data ---------------- */

  function getLesson(id) {
    try {
      if (TS.data && typeof TS.data.getLesson === "function") return TS.data.getLesson(id);
    } catch (e) { /* fall through */ }
    return null;
  }

  function allLessons() {
    try {
      if (TS.data && typeof TS.data.allLessons === "function") return TS.data.allLessons() || [];
    } catch (e) { /* fall through */ }
    return [];
  }

  /* Unlock rule (contract §4): lesson i unlocked if every previous lesson in
   * the whole course has ≥1 attempt, or it is lesson 0. */
  function isUnlocked(lessonId) {
    try {
      var flat = allLessons();
      var idx = -1;
      for (var i = 0; i < flat.length; i++) {
        if (flat[i] && flat[i].id === lessonId) { idx = i; break; }
      }
      if (idx <= 0) return true;
      var attempts = storeGet("ts_attempts", []);
      var done = {};
      for (var j = 0; j < attempts.length; j++) {
        if (attempts[j]) done[attempts[j].lessonId] = true;
      }
      for (var k = 0; k < idx; k++) {
        if (!done[flat[k].id]) return false;
      }
      return true;
    } catch (e) { return true; }
  }

  function lessonMeta(lesson) {
    var meta = { levelN: lesson.level || 1, num: 1, levelTitle: "" };
    try {
      if (TS.data && Array.isArray(TS.data.CURRICULUM)) {
        for (var li = 0; li < TS.data.CURRICULUM.length; li++) {
          var lv = TS.data.CURRICULUM[li];
          var lessons = lv.lessons || [];
          for (var lsi = 0; lsi < lessons.length; lsi++) {
            if (lessons[lsi] && lessons[lsi].id === lesson.id) {
              meta.levelN = lv.n || (li + 1);
              meta.num = lsi + 1;
              meta.levelTitle = lv.title || "";
            }
          }
        }
      }
    } catch (e) { /* keep defaults */ }
    return meta;
  }

  function nextLessonOf(id) {
    try {
      if (TS.data && typeof TS.data.nextLesson === "function") return TS.data.nextLesson(id);
    } catch (e) { /* fall through */ }
    return null;
  }

  /* ---------------- scoped CSS ----------------
   * Only view-specific layout/animation. Char states (.ch-*), keys (.vk-*),
   * and .card/.btn/.stat-tile come from the theme stylesheets. */
  var VIEW_CSS = [
    ".ls-wrap{max-width:880px;margin:0 auto;display:flex;flex-direction:column;gap:16px;}",
    ".ls-kicker{color:#64748B;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;margin:0 0 4px;}",
    ".ls-wrap h1{margin:0 0 4px;font-size:1.5rem;}",
    ".ls-sub{color:#64748B;margin:0;}",
    ".ls-typing{font-size:1.35rem;line-height:2.1;letter-spacing:.02em;user-select:none;-webkit-user-select:none;}",
    ".ls-typing:focus{outline:none;}",
    ".ls-typing:focus-visible{outline:2px solid #2563EB;outline-offset:4px;border-radius:6px;}",
    ".ls-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:14px 0;}",
    "@media (max-width:560px){.ls-stats{grid-template-columns:repeat(2,1fr);}.ls-typing{font-size:1.15rem;}}",
    ".ls-stats .stat-tile{text-align:center;padding:10px 6px;}",
    ".ls-stats .stat-tile strong{display:block;font-size:1.35rem;line-height:1.2;}",
    ".ls-stats .stat-tile span{color:#64748B;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;}",
    ".ls-controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}",
    ".ls-progress{height:8px;background:#E2E8F0;border-radius:99px;overflow:hidden;margin-top:10px;}",
    ".ls-progress>div{height:100%;background:#2563EB;width:0;transition:width .2s;}",
    ".ls-paused-note{display:none;margin-top:10px;padding:8px 12px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;color:#92400E;font-size:.9rem;}",
    ".is-paused .ls-paused-note{display:block;}",
    ".is-paused .ls-typing{opacity:.55;}",
    ".ls-mobile-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;}",
    ".ls-focus-btn{display:none;margin-top:10px;}",
    "@media (pointer:coarse){.ls-focus-btn{display:inline-block;}}",
    ".ls-kb-wrap{overflow-x:auto;}",
    ".ls-complete{max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:16px;}",
    ".ls-result{text-align:center;padding:28px 24px;}",
    ".ls-check{font-size:2.6rem;color:#16A34A;line-height:1;}",
    ".ls-pop{animation:lsPop .45s ease-out;}",
    "@keyframes lsPop{from{transform:scale(.96);opacity:0;}to{transform:scale(1);opacity:1;}}",
    ".reduced-motion .ls-pop{animation:none;}",
    "@media (prefers-reduced-motion:reduce){.ls-pop{animation:none;}.ls-progress>div{transition:none;}}",
    ".ls-stars{color:#D97706;font-size:1.7rem;letter-spacing:.18em;}",
    ".ls-detail{width:100%;border-collapse:collapse;margin:8px auto;max-width:420px;text-align:left;}",
    ".ls-detail td{padding:7px 4px;border-top:1px solid #E2E8F0;font-size:.95rem;}",
    ".ls-detail td:last-child{text-align:right;font-weight:600;}",
    ".ls-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:14px;}",
    ".ls-feedback{text-align:left;}",
    ".ls-feedback p{margin:.5em 0;}"
  ].join("\n");

  /* ---------------- typing screen ---------------- */

  function charSpans(text) {
    var out = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === "\n") {
        // Real line break + hidden placeholder span so spans[] stays
        // index-aligned with states[] (paintChars indexes by char position).
        out.push('<br><span class="ch" data-i="' + i +
          '" style="display:none" aria-hidden="true"></span>');
        continue;
      }
      var disp = ch === " " ? "&nbsp;" : esc(ch);
      out.push('<span class="ch ch-upcoming" data-i="' + i + '">' + disp + "</span>");
    }
    return out.join("");
  }

  function lessonHtml(lesson, settings, meta, resumed) {
    var hl = settings.highlight === "block" ? "ls-hl-block" : "ls-hl-caret";
    return (
      '<div class="ls-wrap' + (settings.reducedMotion ? " reduced-motion" : "") + '">' +
      "<style>" + VIEW_CSS + "</style>" +
      '<div class="card">' +
        '<p class="ls-kicker">Level ' + esc(meta.levelN) +
          (meta.levelTitle ? " · " + esc(meta.levelTitle) : "") +
          " · Lesson " + esc(meta.num) + "</p>" +
        "<h1>" + esc(lesson.title) + "</h1>" +
        (lesson.desc ? '<p class="ls-sub">' + esc(lesson.desc) + "</p>" : "") +
        '<div class="ls-progress" role="progressbar" aria-label="Lesson progress">' +
          '<div id="ls-bar"></div></div>' +
      "</div>" +
      '<div class="card">' +
        "<h2>Instructions</h2>" +
        "<p>" + esc(lesson.instructions || "Type the text below as accurately as you can.") + "</p>" +
        (lesson.focus ? '<p class="ls-sub">Focus keys: <strong>' + esc(lesson.focus) + "</strong></p>" : "") +
        (resumed ? '<p class="ls-sub">Resumed from your saved progress — the timer restarts on your first keystroke.</p>' : "") +
      "</div>" +
      '<div class="card" id="ls-typing-card">' +
        '<div class="ls-typing ' + hl + '" id="ls-text" tabindex="0" role="textbox" ' +
          'aria-label="Typing area. Type the highlighted text." aria-readonly="true">' +
          charSpans(lesson.text) +
        "</div>" +
        '<div class="ls-paused-note">Paused — press <strong>Resume</strong> to continue. Your progress is saved.</div>' +
        '<div class="ls-stats">' +
          '<div class="stat-tile"><strong id="ls-wpm">0</strong><span>WPM</span></div>' +
          '<div class="stat-tile"><strong id="ls-acc">100%</strong><span>Accuracy</span></div>' +
          '<div class="stat-tile"><strong id="ls-time">0:00</strong><span>Time</span></div>' +
          '<div class="stat-tile"><strong id="ls-mist">0</strong><span>Mistakes</span></div>' +
        "</div>" +
        '<div class="ls-controls">' +
          '<button class="btn btn-ghost" id="ls-pause">Pause</button>' +
          '<button class="btn btn-ghost" id="ls-restart">Restart</button>' +
          '<button class="btn btn-ghost" id="ls-exit">Exit</button>' +
        "</div>" +
        '<input class="ls-mobile-input" id="ls-mobile" type="text" autocomplete="off" ' +
          'autocapitalize="none" autocorrect="off" spellcheck="false" ' +
          'aria-label="Type here on touch devices">' +
        '<button class="btn btn-primary ls-focus-btn" id="ls-focus">Tap to start typing</button>' +
      "</div>" +
      (settings.keyboard
        ? '<div class="card"><h2>Keyboard</h2><div class="ls-kb-wrap" id="ls-kb"></div></div>'
        : "") +
      "</div>"
    );
  }

  function paintChars(spans, states, position) {
    for (var i = 0; i < spans.length; i++) {
      var cls = "ch ";
      if (i < position) cls += states[i] === 1 ? "ch-correct" : "ch-wrong";
      else cls += "ch-upcoming";
      if (i === position) cls += " ch-current";
      if (spans[i].className !== cls) spans[i].className = cls;
    }
  }

  /* ---------------- gamify fallback ----------------
   * TS.gamify.completeLesson is authoritative when present. This fallback
   * implements contract §7 so an attempt record is still real without it. */
  function localComplete(summary, lessonId) {
    var acc = summary.accuracy;
    var stars = acc >= 97 ? 3 : acc >= 90 ? 2 : acc >= 75 ? 1 : 0;
    var xp = 20 + Math.round(acc * 0.3) + stars * 5;
    var bests = storeGet("ts_bests", {});
    var prev = bests[lessonId];
    var prevXp = prev && typeof prev.xp === "number" ? prev.xp : 0;
    var xpEarned = prev ? Math.max(0, xp - prevXp) : xp; // improvement delta only
    return { xpEarned: xpEarned, stars: stars, newAchievements: [], leveledUp: false };
  }

  /* ---------------- feedback ---------------- */

  function topChars(charErrors, n) {
    var keys = Object.keys(charErrors || {});
    keys.sort(function (a, b) { return charErrors[b] - charErrors[a]; });
    return keys.slice(0, n);
  }

  function fmtChar(ch) {
    if (ch === " ") return "space";
    return "“" + ch + "”";
  }

  function buildFeedback(summary, charErrors, improved, prevBest) {
    var out = [];
    var acc = summary.accuracy;
    var net = summary.netWpm;

    if (acc >= 97 && net < 25) {
      out.push("Outstanding accuracy — your fingers are landing exactly where they should. Now nudge your pace up a little; speed will follow naturally.");
    } else if (net >= 40 && acc < 90) {
      out.push("Great pace, but accuracy is slipping. Slow down just slightly and let your fingers catch up — clean keystrokes are faster than corrected ones.");
    } else if (acc >= 97 && net >= 40) {
      out.push("Elite combination: fast and precise. This is exactly what touch typing should feel like.");
    } else if (improved && prevBest) {
      out.push("You beat your previous best — faster and cleaner than last time. Keep this momentum going.");
    } else if (acc < 75) {
      out.push("Focus on accuracy first, not speed. Type slowly and deliberately; speed builds on top of correct muscle memory.");
    } else {
      out.push("Solid run. A little more practice and this lesson will feel automatic.");
    }

    var worst = topChars(charErrors, 3).filter(function (ch) { return charErrors[ch] >= 2; });
    if (worst.length) {
      out.push("Keys to drill: " + worst.map(fmtChar).join(", ") +
        " — these tripped you up the most. Slow down on them and feel the home-row reach.");
    }

    if (summary.corrected > 0) {
      out.push("You caught and fixed " + summary.corrected + " mistake" +
        (summary.corrected === 1 ? "" : "s") + " with backspace — good habit. Aim to catch them before typing them.");
    }
    return out;
  }

  /* ---------------- completion ---------------- */

  function handleComplete(el, lesson, meta, session, summary) {
    try { session.detach(); } catch (e) { /* ignore */ }

    // The real TS.gamify.completeLesson is authoritative: it updates ts_bests
    // itself (shape {netWpm, accuracy, stars, xp, score, date}) and returns
    // prevBest/improved, so we must NOT re-read or re-write ts_bests after it.
    var gamRes = null, usedGamify = false;
    try {
      if (TS.gamify && typeof TS.gamify.completeLesson === "function") {
        gamRes = TS.gamify.completeLesson(summary, lesson.id);
        usedGamify = true;
      }
    } catch (e) { gamRes = null; usedGamify = false; }
    if (!gamRes || typeof gamRes.xpEarned !== "number") {
      gamRes = localComplete(summary, lesson.id);
      usedGamify = false;
    }

    // Previous best (before this attempt) + improvement check.
    var prev = null, improved = false;
    if (usedGamify) {
      prev = gamRes.prevBest || null; // {wpm, accuracy} | null
      improved = !!gamRes.improved;
    } else {
      var bests = storeGet("ts_bests", {});
      prev = bests[lesson.id] || null;
      var prevWpm = prev ? (prev.netWpm != null ? prev.netWpm : (prev.wpm || 0)) : 0;
      var prevScore = prev ? prevWpm * (prev.accuracy || 0) : -1;
      var score = summary.netWpm * summary.accuracy;
      improved = score > prevScore;
      if (improved) {
        // Fallback bests write uses the same shape as TS.gamify.completeLesson.
        bests[lesson.id] = {
          netWpm: r1(summary.netWpm),
          accuracy: r1(summary.accuracy),
          stars: gamRes.stars,
          xp: 20 + Math.round(summary.accuracy * 0.3) + gamRes.stars * 5,
          score: score,
          date: new Date().toISOString()
        };
        storeSet("ts_bests", bests);
      }
    }

    var attempt = {
      id: uid(),
      lessonId: lesson.id,
      date: new Date().toISOString(),
      typed: summary.typed,
      correct: summary.correct,
      incorrect: summary.incorrect,
      corrected: summary.corrected,
      uncorrected: summary.uncorrected,
      accuracy: r1(summary.accuracy),
      grossWpm: r1(summary.grossWpm),
      netWpm: r1(summary.netWpm),
      errorsPerMin: r2(summary.errorsPerMin),
      durationSec: r1(summary.durationSec),
      activeSec: r1(summary.activeSec),
      charErrors: summary.charErrors || {},
      xp: gamRes.xpEarned,
      stars: gamRes.stars,
      prevBest: prev ? { wpm: r1(prev.wpm != null ? prev.wpm : (prev.netWpm || 0)), accuracy: r1(prev.accuracy || 0) } : null,
      improved: improved
    };

    var attempts = storeGet("ts_attempts", []);
    if (!Array.isArray(attempts)) attempts = [];
    attempts.push(attempt);
    if (attempts.length > 500) attempts = attempts.slice(-500); // cap 500
    storeSet("ts_attempts", attempts);

    storeSet("ts_practiceSec", (storeGet("ts_practiceSec", 0) || 0) + summary.activeSec);
    storeSet("ts_progress", null); // lesson done — clear resume state

    try {
      if (TS.gamify && typeof TS.gamify.recordActivity === "function") {
        TS.gamify.recordActivity();
      }
    } catch (e) { /* ignore */ }

    var newAch = [];
    try {
      if (TS.gamify && typeof TS.gamify.checkAll === "function") {
        newAch = TS.gamify.checkAll() || [];
      }
    } catch (e) { /* ignore */ }
    // Achievements earned from the direct completeLesson result also count.
    if (gamRes && Array.isArray(gamRes.newAchievements)) {
      for (var ai = 0; ai < gamRes.newAchievements.length; ai++) {
        if (newAch.indexOf(gamRes.newAchievements[ai]) === -1) {
          newAch.push(gamRes.newAchievements[ai]);
        }
      }
    }
    newAch.forEach(function (a) {
      var name = a && typeof a === "object" ? (a.title || a.name || a.id) : a;
      toast("Achievement unlocked: " + name, "success");
    });
    if (gamRes.leveledUp) toast("Level up! Keep going.", "success");

    renderComplete(el, lesson, meta, attempt, prev, gamRes);
  }

  function renderComplete(el, lesson, meta, attempt, prev, gamRes) {
    active = { session: null, lessonId: lesson.id };
    var reduced = storeGet("ts_settings", {}).reducedMotion;
    var next = nextLessonOf(lesson.id);
    var feedback = buildFeedback(attempt, attempt.charErrors, attempt.improved, attempt.prevBest);

    var delta = "";
    if (attempt.prevBest) {
      var dw = r1(attempt.netWpm - attempt.prevBest.wpm);
      var da = r1(attempt.accuracy - attempt.prevBest.accuracy);
      delta = "<p>Previous attempt: <strong>" + attempt.prevBest.wpm + " WPM</strong> · " +
        attempt.prevBest.accuracy + "% accuracy" +
        (attempt.improved
          ? " — improved by " + (dw >= 0 ? "+" : "") + dw + " WPM, " + (da >= 0 ? "+" : "") + da + "% accuracy."
          : ".") + "</p>";
    } else {
      delta = "<p>First attempt on this lesson — this is your baseline. Beat it next time.</p>";
    }

    el.innerHTML =
      '<div class="ls-complete' + (reduced ? " reduced-motion" : "") + '">' +
      "<style>" + VIEW_CSS + "</style>" +
      '<div class="card ls-result ls-pop">' +
        '<div class="ls-check" role="img" aria-label="Completed">✓</div>' +
        "<h1>Lesson complete!</h1>" +
        '<p class="ls-sub">' + esc(lesson.title) + " · Level " + esc(meta.levelN) + "</p>" +
        '<div style="margin:10px 0;">' + starsHtml(gamRes.stars) + "</div>" +
        '<div class="ls-stats">' +
          '<div class="stat-tile"><strong>' + attempt.netWpm + '</strong><span>Net WPM</span></div>' +
          '<div class="stat-tile"><strong>' + attempt.accuracy + '%</strong><span>Accuracy</span></div>' +
          '<div class="stat-tile"><strong>' + fmtTime(attempt.activeSec) + '</strong><span>Time</span></div>' +
          '<div class="stat-tile"><strong>+' + attempt.xp + '</strong><span>XP earned</span></div>' +
        "</div>" +
        '<table class="ls-detail">' +
          "<tr><td>Gross WPM</td><td>" + attempt.grossWpm + "</td></tr>" +
          "<tr><td>Correct characters</td><td>" + attempt.correct + "</td></tr>" +
          "<tr><td>Incorrect keystrokes</td><td>" + attempt.incorrect + "</td></tr>" +
          "<tr><td>Corrected with backspace</td><td>" + attempt.corrected + "</td></tr>" +
          "<tr><td>Left uncorrected</td><td>" + attempt.uncorrected + "</td></tr>" +
          "<tr><td>Errors per minute</td><td>" + attempt.errorsPerMin + "</td></tr>" +
        "</table>" +
      "</div>" +
      '<div class="card">' +
        "<h2>Your progress</h2>" + delta +
        "<p>Personal best: <strong>" + attempt.netWpm + " WPM</strong> · " +
          attempt.accuracy + "% accuracy" +
          (attempt.improved || !attempt.prevBest ? " — new personal best!" : "") + "</p>" +
      "</div>" +
      '<div class="card ls-feedback"><h2>Feedback</h2>' +
        feedback.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") +
      "</div>" +
      '<div class="card"><div class="ls-actions">' +
        '<button class="btn btn-ghost" id="ls-retry">Retry Lesson</button>' +
        (next ? '<button class="btn btn-primary" id="ls-next">Continue to Next Lesson</button>' : "") +
        '<button class="btn btn-ghost" id="ls-report">View Detailed Report</button>' +
        '<button class="btn btn-ghost" id="ls-print">Print Report</button>' +
        '<button class="btn btn-ghost" id="ls-pdf">Save as PDF</button>' +
        '<button class="btn btn-ghost" id="ls-dash">Return to Dashboard</button>' +
      "</div></div>" +
      "</div>";

    function on(id, fn) {
      var b = document.getElementById(id);
      if (b) b.addEventListener("click", fn);
    }
    on("ls-retry", function () { render(el, { id: lesson.id }); });
    if (next) on("ls-next", function () { go("#/lesson/" + next.id); });
    on("ls-report", function () { go("#/report/" + attempt.id); });
    on("ls-print", function () {
      if (TS.reports && typeof TS.reports.print === "function") {
        try { TS.reports.print(attempt.id); return; } catch (e) { /* fall through */ }
      }
      window.print();
    });
    on("ls-pdf", function () {
      toast("In the print dialog, choose “Save as PDF” as the destination.", "info");
      setTimeout(function () {
        if (TS.reports && typeof TS.reports.print === "function") {
          try { TS.reports.print(attempt.id); return; } catch (e) { /* fall through */ }
        }
        window.print();
      }, 600);
    });
    on("ls-dash", function () { go("#/dashboard"); });
  }

  /* ---------------- static screens ---------------- */

  function staticHtml(title, body) {
    return '<div class="ls-wrap"><style>' + VIEW_CSS + "</style>" +
      '<div class="card" style="text-align:center;padding:32px 24px;">' +
      "<h1>" + title + "</h1><p>" + body + "</p>" +
      '<p style="margin-top:16px;"><a class="btn btn-primary" href="#/learn">Back to Learn</a></p>' +
      "</div></div>";
  }

  /* ---------------- main render ---------------- */

  function render(el, params) {
    destroy();
    el.innerHTML = "";

    var id = params && params.id;
    var lesson = getLesson(id);
    if (!lesson) {
      el.innerHTML = staticHtml("Lesson not found",
        "We couldn’t find a lesson with id “" + esc(id) + "”.");
      active = { session: null };
      return;
    }
    if (!isUnlocked(lesson.id)) {
      el.innerHTML = staticHtml("🔒 Lesson locked",
        "Finish the previous lessons first to unlock “" + esc(lesson.title) + "”.");
      active = { session: null };
      return;
    }

    var settings = {};
    for (var k in SETTING_DEFAULTS) settings[k] = SETTING_DEFAULTS[k];
    var saved = storeGet("ts_settings", {});
    for (var k2 in saved) settings[k2] = saved[k2];

    var meta = lessonMeta(lesson);

    var resume = null;
    var prog = storeGet("ts_progress", null);
    if (prog && prog.lessonId === lesson.id &&
        typeof prog.position === "number" &&
        Array.isArray(prog.states) &&
        prog.states.length === lesson.text.length &&
        prog.position < lesson.text.length) {
      resume = { position: prog.position, states: prog.states };
    }

    el.innerHTML = lessonHtml(lesson, settings, meta, !!resume);

    var spans = Array.prototype.slice.call(
      el.querySelectorAll('#ls-text span[data-i]'));
    var bar = document.getElementById("ls-bar");
    var wpmEl = document.getElementById("ls-wpm");
    var accEl = document.getElementById("ls-acc");
    var timeEl = document.getElementById("ls-time");
    var mistEl = document.getElementById("ls-mist");
    var pauseBtn = document.getElementById("ls-pause");
    var typingCard = document.getElementById("ls-typing-card");
    var mobileInput = document.getElementById("ls-mobile");
    var focusBtn = document.getElementById("ls-focus");
    var kbEl = document.getElementById("ls-kb");

    var session = new TS.engine.LessonSession(lesson, {
      resume: resume,
      settings: settings
    });
    active = { session: session, lessonId: lesson.id };

    if (resume && resume.position > 0) {
      toast("Resumed your saved progress.", "info");
    }

    function updatePauseUI(snap) {
      var label = snap.running ? "Pause" : (session.startTime ? "Resume" : "Pause");
      if (pauseBtn) pauseBtn.textContent = label;
      if (typingCard) {
        var showPaused = !snap.running && !!session.startTime && !snap.completed;
        typingCard.classList.toggle("is-paused", showPaused);
      }
    }

    function updateUI(snap) {
      paintChars(spans, snap.states, snap.position);
      if (bar) bar.style.width = (lesson.text.length
        ? (snap.position / lesson.text.length) * 100 : 0) + "%";
      if (wpmEl) wpmEl.textContent = r1(snap.wpm);
      if (accEl) accEl.textContent = r1(snap.accuracy) + "%";
      if (timeEl) timeEl.textContent = fmtTime(snap.elapsedSec);
      if (mistEl) mistEl.textContent = snap.mistakes;
      updatePauseUI(snap);
      if (kbEl && TS.keyboard && typeof TS.keyboard.updateTarget === "function") {
        var next = snap.position < lesson.text.length
          ? lesson.text.charAt(snap.position) : null;
        TS.keyboard.updateTarget(next);
      }
    }

    session.onUpdate = updateUI;
    session.onComplete = function (summary) {
      handleComplete(el, lesson, meta, session, summary);
    };

    if (kbEl && TS.keyboard && typeof TS.keyboard.render === "function") {
      try {
        TS.keyboard.render(kbEl, {
          layout: settings.layout || "qwerty",
          showFingers: !!settings.fingerGuide && lesson.fingers !== false,
          targetChar: lesson.text.charAt(0) || null
        });
      } catch (e) { /* keyboard is an aid, never fatal */ }
    }

    session.bindInput(mobileInput);
    session.attach();

    function togglePause() {
      if (session.completed) return;
      if (session.running) session.pause();
      else session.resume();
    }
    if (pauseBtn) pauseBtn.addEventListener("click", togglePause);

    var restartBtn = document.getElementById("ls-restart");
    if (restartBtn) restartBtn.addEventListener("click", function () {
      confirmAsync("Restart this lesson? Your current attempt progress will be lost.")
        .then(function (ok) {
          if (!ok) return;
          storeSet("ts_progress", null);
          render(el, { id: lesson.id });
        });
    });

    var exitBtn = document.getElementById("ls-exit");
    if (exitBtn) exitBtn.addEventListener("click", function () {
      var hasProgress = session.position > 0 || session.keystrokes.length > 0;
      var done = function () {
        try { session.detach(); } catch (e) { /* ignore */ }
        active = { session: null };
        go("#/learn");
      };
      if (hasProgress) {
        confirmAsync("Leave the lesson? Your progress is auto-saved and you can resume later.")
          .then(function (ok) { if (ok) done(); });
      } else {
        done();
      }
    });

    if (focusBtn && mobileInput) {
      focusBtn.addEventListener("click", function () {
        try { mobileInput.focus({ preventScroll: true }); }
        catch (e) { try { mobileInput.focus(); } catch (e2) { /* ignore */ } }
      });
    }

    var textEl = document.getElementById("ls-text");
    if (textEl) {
      // Keep the caret visible while typing long lessons.
      textEl.addEventListener("click", function () {
        try { textEl.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      });
    }

  }

  function destroy() {
    if (!active) return;
    try {
      if (active.session) active.session.detach();
    } catch (e) { /* ignore */ }
    active = null;
  }

  TS.views.lesson = {
    render: render,
    destroy: destroy
  };
})();
