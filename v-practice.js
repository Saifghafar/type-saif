/* Type Saif — TS.views.practice
 * Free-practice view: random words / weak keys / custom text,
 * timed sessions (1/2/5 min), live WPM + accuracy, per-char highlighting
 * (implemented locally), XP award (2/min, cap 10/session), results saved
 * to ts_attempts with lessonId "practice" so charts include them.
 */
(function () {
  "use strict";

  var TS = window.TypeSaif = window.TypeSaif || {};
  TS.views = TS.views || {};

  var S = null; // active view/session state; cleared on destroy

  // ---- Fallback word lists (used only if TS.data.WORD_LISTS is unavailable) ----
  var FALLBACK_WORDS = {
    easy: ("the and for are but not you all can had her was one our out day get has him his how its may new now old see two way who boy did its let put say she too use very want well went were what when your about after again against could every first found great house large learn look made make many more other over such these thing think three water where which while world write year").split(" "),
    medium: ("because between children during earth every field garden happy house light magic money night often paper plant quick river seven small sound spell sport start story table their there these those today under until water while white whole woman world would write wrong year young about above after again along also always another answer around become before begin behind being below both bring build carry catch change check child city close color could").split(" "),
    hard: ("rhythm zephyr jigsaw quizzical juxtapose oxygen sphinx glyph buoy fjord waltz knack mnemonic phlegm queue cryptic jovial kayak zigzag azure ivory jumbo kayak lymph biopsy abuzz blizzard dwarf ember foyer geyser haiku kayak kiwi luxury nymph onyx pixel quartz rogue safari tango umbra vivid waltz xenon yacht zebra").split(" ")
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function getStore(key, fb) {
    try { if (TS.store && typeof TS.store.get === "function") return TS.store.get(key, fb); } catch (e) {}
    return fb;
  }
  function setStore(key, val) {
    try { if (TS.store && typeof TS.store.set === "function") TS.store.set(key, val); } catch (e) {}
  }

  function toast(msg) {
    try { if (TS.ui && typeof TS.ui.toast === "function") { TS.ui.toast(msg); return; } } catch (e) {}
    var d = document.createElement("div");
    d.textContent = msg;
    d.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0F172A;color:#fff;padding:10px 16px;border-radius:8px;z-index:9999;font-size:14px;";
    document.body.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 2400);
  }

  function getSettings() {
    var dflt = {
      sound: true, keySound: true, keyboard: true, fingerGuide: true,
      highlight: "caret", difficulty: "normal", backspace: "allow",
      reducedMotion: false, layout: "qwerty"
    };
    var s = getStore("ts_settings", {}) || {};
    var out = {};
    for (var k in dflt) out[k] = (s[k] !== undefined) ? s[k] : dflt[k];
    return out;
  }

  // ---- Weak keys: aggregate charErrors across all attempts ----
  function weakKeyList(limit) {
    var attempts = getStore("ts_attempts", []) || [];
    var counts = {};
    attempts.forEach(function (a) {
      var ce = a.charErrors || {};
      for (var ch in ce) {
        if (Object.prototype.hasOwnProperty.call(ce, ch)) counts[ch] = (counts[ch] || 0) + Number(ce[ch] || 0);
      }
    });
    return Object.keys(counts)
      .filter(function (ch) { return ch.length === 1; })
      .map(function (ch) { return { ch: ch, n: counts[ch] }; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, limit || 6);
  }

  function wordLists() {
    try {
      if (TS.data && TS.data.WORD_LISTS && typeof TS.data.WORD_LISTS === "object") {
        var wl = TS.data.WORD_LISTS;
        if (wl.easy && wl.easy.length && wl.medium && wl.medium.length && wl.hard && wl.hard.length) return wl;
      }
    } catch (e) {}
    return FALLBACK_WORDS;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function buildChunk(mode, opts) {
    opts = opts || {};
    if (mode === "custom") return opts.customText || "";
    if (mode === "weak") {
      var keys = weakKeyList(6).map(function (k) { return k.ch; });
      if (!keys.length) return "";
      var toks = [];
      for (var i = 0; i < 120; i++) {
        var a = keys[Math.floor(Math.random() * keys.length)];
        var b = keys[Math.floor(Math.random() * keys.length)];
        var c = keys[Math.floor(Math.random() * keys.length)];
        toks.push(a + b + c);
      }
      return toks.join(" ");
    }
    // random words
    var wl = wordLists();
    var diff = opts.difficulty || "easy";
    var pool = wl[diff] || wl.easy || [];
    if (!pool.length) pool = FALLBACK_WORDS.easy;
    var words = [];
    var shuffled = shuffle(pool);
    var si = 0;
    for (var w = 0; w < 240; w++) {
      if (si >= shuffled.length) { shuffled = shuffle(pool); si = 0; }
      words.push(shuffled[si++]);
    }
    return words.join(" ");
  }

  function starFor(acc) {
    if (acc >= 97) return 3;
    if (acc >= 90) return 2;
    if (acc >= 75) return 1;
    return 0;
  }

  function awardXp(n) {
    var done = false;
    try {
      if (TS.gamify && typeof TS.gamify.addXp === "function") { TS.gamify.addXp(n); done = true; }
    } catch (e) {}
    if (!done) {
      var xp = getStore("ts_xp", { total: 0 }) || { total: 0 };
      xp.total = (Number(xp.total) || 0) + n;
      setStore("ts_xp", xp);
    }
  }

  // ============================ SETUP SCREEN ============================
  function renderSetup(el) {
    S.screen = "setup";
    var settings = getSettings();
    var weak = weakKeyList(6);

    var html = '<div class="page-head"><h1>Practice</h1>' +
      '<p class="text-2">Free typing practice. Timed sessions earn XP and count toward your progress charts.</p></div>';

    html += '<div class="card"><h3>1. Choose a mode</h3><div class="mode-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:12px 0;">';

    html += '<button type="button" class="btn mode-btn ' + (S.mode === "random" ? "btn-primary" : "btn-ghost") + '" data-mode="random">' +
      '<strong>Random words</strong><span class="text-2">Words at your difficulty level</span></button>';
    html += '<button type="button" class="btn mode-btn ' + (S.mode === "weak" ? "btn-primary" : "btn-ghost") + '" data-mode="weak">' +
      '<strong>Weak keys</strong><span class="text-2">Drills built from your mistakes</span></button>';
    html += '<button type="button" class="btn mode-btn ' + (S.mode === "custom" ? "btn-primary" : "btn-ghost") + '" data-mode="custom">' +
      '<strong>Custom text</strong><span class="text-2">Paste your own text</span></button>';
    html += "</div>";

    // Mode-specific options
    html += '<div id="mode-options">';
    if (S.mode === "random") {
      html += "<h3>2. Difficulty</h3><div class=\"pills\">" +
        ["easy", "medium", "hard"].map(function (d) {
          return '<button type="button" class="btn diff-btn ' + (S.difficulty === d ? "btn-primary" : "btn-ghost") + '" data-diff="' + d + '">' +
            d.charAt(0).toUpperCase() + d.slice(1) + "</button>";
        }).join("") + "</div>" +
        '<p class="text-2">Defaults to your settings difficulty (' + esc(settings.difficulty) + ").</p>";
    } else if (S.mode === "weak") {
      html += "<h3>2. Your weak keys</h3>";
      if (!weak.length) {
        html += '<div class="empty-state"><h3>No mistake data yet</h3>' +
          "<p>Complete a lesson first — we'll build drills from the keys you mistype most.</p>" +
          '<a class="btn btn-primary" href="#/learn">Go to lessons</a></div>';
      } else {
        html += '<p>Drills will focus on: ' + weak.map(function (k) {
          return '<kbd>' + esc(k.ch === " " ? "Space" : k.ch) + "</kbd> (" + k.n + "×)";
        }).join(" ") + "</p>";
      }
    } else {
      html += '<h3>2. Your text</h3><div class="form-row">' +
        '<label for="custom-text">Paste or type the text you want to practice (30–2000 characters)</label>' +
        '<textarea id="custom-text" class="input" rows="5" style="width:100%;">' + esc(S.customText) + "</textarea></div>";
    }
    html += "</div>";

    html += "<h3>3. Session length</h3><div class=\"pills\">" +
      [1, 2, 5].map(function (m) {
        return '<button type="button" class="btn dur-btn ' + (S.minutes === m ? "btn-primary" : "btn-ghost") + '" data-min="' + m + '">' + m + " min</button>";
      }).join("") + "</div>";

    html += '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">' +
      '<button type="button" class="btn btn-primary" id="practice-start">Start practice</button>' +
      '<span class="text-2" style="align-self:center;">Earn 2 XP per minute practiced (max 10 per session).</span></div>';

    html += "</div>";
    el.innerHTML = html;

    // Bind mode buttons
    var mbs = el.querySelectorAll(".mode-btn");
    for (var i = 0; i < mbs.length; i++) {
      (function (b) {
        b.addEventListener("click", function () {
          S.mode = b.getAttribute("data-mode");
          renderSetup(el);
        });
      })(mbs[i]);
    }
    var dbs = el.querySelectorAll(".diff-btn");
    for (var j = 0; j < dbs.length; j++) {
      (function (b) {
        b.addEventListener("click", function () {
          S.difficulty = b.getAttribute("data-diff");
          renderSetup(el);
        });
      })(dbs[j]);
    }
    var ubs = el.querySelectorAll(".dur-btn");
    for (var k = 0; k < ubs.length; k++) {
      (function (b) {
        b.addEventListener("click", function () {
          S.minutes = parseInt(b.getAttribute("data-min"), 10);
          renderSetup(el);
        });
      })(ubs[k]);
    }

    el.querySelector("#practice-start").addEventListener("click", function () {
      if (S.mode === "custom") {
        var ta = el.querySelector("#custom-text");
        S.customText = ta ? ta.value : "";
        var cleaned = S.customText.replace(/\s+/g, " ").trim();
        if (cleaned.length < 30) { toast("Custom text needs at least 30 characters."); return; }
        if (cleaned.length > 2000) { toast("Custom text is limited to 2000 characters."); return; }
        S.customText = cleaned;
      }
      if (S.mode === "weak" && !weakKeyList(1).length) {
        toast("No mistake data yet — complete a lesson first.");
        return;
      }
      startSession(el);
    });
  }

  // ============================ SESSION ============================
  function startSession(el) {
    var settings = getSettings();
    var text = buildChunk(S.mode, { difficulty: S.difficulty, customText: S.customText });
    text = text.replace(/\s+/g, " ").trim();
    if (!text) { toast("Could not build practice text."); return; }

    S.screen = "session";
    S.text = text;
    S.pos = 0;
    S.states = text.split("").map(function () { return 0; });
    S.typed = 0; S.correct = 0; S.incorrect = 0; S.corrected = 0;
    S.charErrors = {};
    S.totalMs = S.minutes * 60000;
    S.activeMs = 0;
    S.started = false;
    S.paused = false;
    S.done = false;
    S.settings = settings;
    S.lastTick = Date.now();

    var el2 = el;
    el2.innerHTML =
      '<div class="page-head"><h1>Practice</h1><p class="text-2">' + esc(modeLabel()) + " · " + S.minutes + " minute" + (S.minutes > 1 ? "s" : "") + "</p></div>" +
      '<div class="card"><div class="hud" style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;">' +
      '<div class="stat-tile"><div class="stat-tile-title">Time left</div><div class="stat-tile-value" id="pr-time">--:--</div></div>' +
      '<div class="stat-tile"><div class="stat-tile-title">WPM</div><div class="stat-tile-value" id="pr-wpm">0</div></div>' +
      '<div class="stat-tile"><div class="stat-tile-title">Accuracy</div><div class="stat-tile-value" id="pr-acc">100%</div></div>' +
      "</div>" +
      '<div id="pr-paused" class="badge" style="display:none;margin-bottom:8px;">Paused — press Resume or keep typing</div>' +
      '<div id="pr-area" class="typing-area" tabindex="0" role="textbox" aria-label="Practice typing area. Click and start typing."></div>' +
      '<input id="pr-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" ' +
      'aria-label="Typing input" style="position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;" value="">' +
      '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">' +
      '<button type="button" class="btn btn-ghost" id="pr-pause">Pause</button>' +
      '<button type="button" class="btn btn-ghost" id="pr-end">End session</button>' +
      "</div></div>" +
      '<div id="pr-kb"></div>';

    S.root = el2;
    S.area = el2.querySelector("#pr-area");
    S.input = el2.querySelector("#pr-input");
    S.timeEl = el2.querySelector("#pr-time");
    S.wpmEl = el2.querySelector("#pr-wpm");
    S.accEl = el2.querySelector("#pr-acc");
    S.pausedEl = el2.querySelector("#pr-paused");

    renderSpans();

    // Optional virtual-keyboard target highlight (guarded; API unknown)
    try {
      var kb = TS.keyboard;
      if (kb) {
        var rfn = kb.render;
        if (typeof rfn === "function") rfn.call(kb, el2.querySelector("#pr-kb"));
      }
    } catch (e) {}

    S.area.addEventListener("click", function () { try { S.input.focus(); } catch (e) {} });
    S.onKey = onKeyDown;
    S.onIn = onInputEvent;
    S.input.addEventListener("keydown", S.onKey);
    S.input.addEventListener("input", S.onIn);

    S.onVis = function () { if (document.hidden) setPaused(true); };
    S.onBlur = function () { setPaused(true); };
    document.addEventListener("visibilitychange", S.onVis);
    window.addEventListener("blur", S.onBlur);

    el2.querySelector("#pr-pause").addEventListener("click", function () { setPaused(!S.paused); });
    el2.querySelector("#pr-end").addEventListener("click", function () { finish("manual"); });

    S.tickId = setInterval(tick, 200);
    updateHud();
    try { S.input.focus(); } catch (e) {}
  }

  function modeLabel() {
    if (S.mode === "weak") return "Weak keys";
    if (S.mode === "custom") return "Custom text";
    return "Random words (" + S.difficulty + ")";
  }

  function renderSpans() {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < S.text.length; i++) {
      var sp = document.createElement("span");
      sp.className = "ch" + (i === 0 ? " caret" : "");
      sp.textContent = S.text[i];
      frag.appendChild(sp);
    }
    S.area.innerHTML = "";
    S.area.appendChild(frag);
    S.spans = S.area.childNodes;
  }

  function appendChunk() {
    var chunk = buildChunk(S.mode, { difficulty: S.difficulty, customText: S.customText });
    chunk = chunk.replace(/\s+/g, " ").trim();
    if (!chunk) return;
    S.text += " " + chunk;
    for (var i = 0; i <= chunk.length; i++) {
      S.states.push(0);
      var sp = document.createElement("span");
      sp.className = "ch";
      sp.textContent = i === 0 ? " " : chunk[i - 1];
      S.area.appendChild(sp);
    }
    S.spans = S.area.childNodes;
  }

  function setCaret(pos) {
    if (!S.spans) return;
    for (var i = 0; i < S.spans.length; i++) {
      if (S.spans[i].classList) S.spans[i].classList.remove("caret");
    }
    if (S.spans[pos] && S.spans[pos].classList) {
      S.spans[pos].classList.add("caret");
      try { S.spans[pos].scrollIntoView({ block: "nearest" }); } catch (e) {}
    }
  }

  function markSpan(pos, cls) {
    var sp = S.spans && S.spans[pos];
    if (!sp || !sp.classList) return;
    sp.classList.remove("correct", "wrong");
    if (cls) sp.classList.add(cls);
  }

  function kbHint(ch) {
    try {
      var kb = TS.keyboard;
      if (!kb) return;
      var fn = kb.highlight || kb.setCurrent || kb.markKey || kb.press;
      if (typeof fn === "function") fn.call(kb, ch);
    } catch (e) {}
  }

  function onKeyDown(e) {
    if (S.done) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // ignore shortcuts
    if (e.repeat) return;
    if (e.key === "Dead") return; // dead keys
    if (e.key === "Backspace") {
      e.preventDefault();
      doBackspace();
      return;
    }
    if (e.key === "Tab") { e.preventDefault(); return; }
    if (e.key && e.key.length === 1) {
      e.preventDefault();
      if (S.paused) setPaused(false);
      typeChar(e.key);
    }
  }

  function onInputEvent() {
    if (S.done) return;
    var v = S.input.value;
    S.input.value = "";
    if (!v) return;
    if (S.paused) setPaused(false);
    typeChar(v.charAt(v.length - 1));
  }

  function ensureStarted() {
    if (!S.started) {
      S.started = true;
      S.paused = false;
      S.lastTick = Date.now();
    }
  }

  function typeChar(ch) {
    if (S.done) return;
    ensureStarted();
    if (S.paused) return;
    if (S.pos >= S.text.length) appendChunk();
    var expected = S.text[S.pos];
    S.typed++;
    if (ch === expected) {
      S.states[S.pos] = 1;
      S.correct++;
      markSpan(S.pos, "correct");
    } else {
      S.states[S.pos] = 2;
      S.incorrect++;
      S.charErrors[expected] = (S.charErrors[expected] || 0) + 1;
      markSpan(S.pos, "wrong");
    }
    S.pos++;
    setCaret(S.pos);
    if (S.pos >= S.text.length) appendChunk();
    else kbHint(S.text[S.pos]);
    updateHud();
  }

  function doBackspace() {
    if (S.done) return;
    if (S.settings.backspace === "block") return; // blocked by settings
    if (S.pos <= 0) return;
    if (S.paused) setPaused(false);
    ensureStarted();
    S.pos--;
    if (S.states[S.pos] === 2) S.corrected++;
    S.states[S.pos] = 0;
    markSpan(S.pos, null);
    setCaret(S.pos);
    kbHint(S.text[S.pos]);
  }

  function liveStats() {
    var activeMin = Math.max(S.activeMs / 60000, 1 / 600); // avoid div-by-zero
    var gross = (S.typed / 5) / activeMin;
    var uncorrected = Math.max(0, S.incorrect - S.corrected);
    var net = Math.max(0, gross - uncorrected / activeMin);
    var acc = S.typed > 0 ? (S.correct / S.typed) * 100 : 100;
    return { wpm: net, acc: acc, gross: gross };
  }

  function tick() {
    if (!S || S.done) return;
    var now = Date.now();
    if (S.started && !S.paused && !document.hidden) {
      S.activeMs += now - S.lastTick;
    }
    S.lastTick = now;
    if (S.activeMs >= S.totalMs) { finish("time"); return; }
    updateHud();
  }

  function updateHud() {
    if (!S || !S.timeEl) return;
    var remain = Math.max(0, S.totalMs - S.activeMs);
    var rs = Math.ceil(remain / 1000);
    S.timeEl.textContent = Math.floor(rs / 60) + ":" + (rs % 60 < 10 ? "0" : "") + (rs % 60);
    var st = liveStats();
    S.wpmEl.textContent = String(Math.round(st.wpm));
    S.accEl.textContent = (Math.round(st.acc * 10) / 10) + "%";
  }

  function setPaused(p) {
    if (!S || S.done || !S.started) return;
    S.paused = p;
    S.lastTick = Date.now();
    if (S.pausedEl) S.pausedEl.style.display = p ? "inline-block" : "none";
    var btn = S.root && S.root.querySelector("#pr-pause");
    if (btn) btn.textContent = p ? "Resume" : "Pause";
  }

  // ============================ FINISH & SUMMARY ============================
  function finish(reason) {
    if (!S || S.done) return;
    S.done = true;
    if (S.tickId) clearInterval(S.tickId);
    detachSessionListeners();

    var activeSec = S.activeMs / 1000;
    var st = liveStats();
    var minutes = activeSec / 60;
    var xp = Math.min(10, Math.max(1, Math.round(2 * minutes)));
    var stars = starFor(st.acc);

    var attempt = {
      id: "p" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      lessonId: "practice",
      date: new Date().toISOString(),
      xp: xp,
      stars: stars,
      prevBest: null,
      improved: false,
      charErrors: S.charErrors,
      typed: S.typed,
      correct: S.correct,
      incorrect: S.incorrect,
      corrected: S.corrected,
      uncorrected: Math.max(0, S.incorrect - S.corrected),
      accuracy: Math.round(st.acc * 100) / 100,
      grossWpm: Math.round(st.gross * 100) / 100,
      netWpm: Math.round(st.wpm * 100) / 100,
      errorsPerMin: activeSec > 0 ? Math.round((S.incorrect / (activeSec / 60)) * 100) / 100 : 0,
      durationSec: Math.round(activeSec),
      activeSec: Math.round(activeSec)
    };

    // Save to history (cap 500, newest last)
    var attempts = getStore("ts_attempts", []) || [];
    attempts.push(attempt);
    if (attempts.length > 500) attempts.splice(0, attempts.length - 500);
    setStore("ts_attempts", attempts);

    // Practice seconds
    var ps = Number(getStore("ts_practiceSec", 0)) || 0;
    setStore("ts_practiceSec", ps + Math.round(activeSec));

    // XP
    awardXp(xp);

    // Activity / achievements (guarded)
    var newAch = [];
    try {
      if (TS.gamify) {
        if (typeof TS.gamify.recordActivity === "function") TS.gamify.recordActivity("practice");
        if (typeof TS.gamify.checkAll === "function") newAch = TS.gamify.checkAll() || [];
      }
    } catch (e) {}

    renderSummary(S.root, {
      wpm: st.wpm, acc: st.acc, typed: S.typed, correct: S.correct,
      incorrect: S.incorrect, activeSec: activeSec, xp: xp, stars: stars,
      reason: reason, achievements: newAch
    });
  }

  function renderSummary(el, r) {
    S.screen = "summary";
    var mm = Math.floor(r.activeSec / 60), ss = Math.round(r.activeSec % 60);
    var dur = mm > 0 ? mm + "m " + ss + "s" : ss + "s";
    var starRow = "";
    for (var i = 0; i < 3; i++) starRow += i < r.stars ? "★" : "☆";

    var html = '<div class="page-head"><h1>Practice complete</h1>' +
      '<p class="text-2">' + (r.reason === "time" ? "Time's up — nice work!" : "Session ended.") + " Result saved to your history.</p></div>" +
      '<div class="card"><div style="text-align:center;margin-bottom:16px;">' +
      '<div class="stat-tile-value" style="font-size:48px;">' + Math.round(r.wpm) + '</div>' +
      '<div class="text-2">net WPM</div>' +
      '<div style="margin-top:8px;"><span class="badge">' + starRow + '</span> ' +
      '<span class="badge badge-xp">+' + r.xp + " XP</span></div></div>" +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;">' +
      '<div class="stat-tile"><div class="stat-tile-title">Accuracy</div><div class="stat-tile-value">' + (Math.round(r.acc * 10) / 10) + '%</div></div>' +
      '<div class="stat-tile"><div class="stat-tile-title">Characters</div><div class="stat-tile-value">' + r.correct + "/" + r.typed + "</div></div>" +
      '<div class="stat-tile"><div class="stat-tile-title">Mistakes</div><div class="stat-tile-value">' + r.incorrect + "</div></div>" +
      '<div class="stat-tile"><div class="stat-tile-title">Time practiced</div><div class="stat-tile-value">' + dur + "</div></div>" +
      "</div>";

    if (r.achievements && r.achievements.length) {
      html += '<p><span class="badge">🏆 Achievement unlocked!</span></p>';
    }

    html += '<p class="text-2">This session was added to your progress history and counts toward your charts.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">' +
      '<button type="button" class="btn btn-primary" id="pr-again">Practice again</button>' +
      '<a class="btn btn-ghost" href="#/progress">View progress</a>' +
      "</div></div>";

    el.innerHTML = html;
    el.querySelector("#pr-again").addEventListener("click", function () { renderSetup(el); });
    toast("+" + r.xp + " XP earned");
  }

  function detachSessionListeners() {
    if (!S) return;
    if (S.tickId) { clearInterval(S.tickId); S.tickId = null; }
    try {
      if (S.input) {
        if (S.onKey) S.input.removeEventListener("keydown", S.onKey);
        if (S.onIn) S.input.removeEventListener("input", S.onIn);
      }
      if (S.onVis) document.removeEventListener("visibilitychange", S.onVis);
      if (S.onBlur) window.removeEventListener("blur", S.onBlur);
    } catch (e) {}
  }

  function cleanup() {
    detachSessionListeners();
    S = null;
  }

  TS.views.practice = {
    render: function (el) {
      cleanup();
      var settings = getSettings();
      S = {
        screen: "setup",
        mode: "random",
        difficulty: ["easy", "medium", "hard"].indexOf(settings.difficulty) >= 0 ? settings.difficulty : "easy",
        minutes: 2,
        customText: ""
      };
      renderSetup(el);
    },
    destroy: function () { cleanup(); }
  };
})();
