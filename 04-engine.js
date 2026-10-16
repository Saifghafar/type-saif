/* Type Saif — js/04-engine.js — TS.engine.LessonSession
 *
 * Typing engine for lessons (contract §6).
 *
 *   var session = new TS.engine.LessonSession(lesson, {
 *     resume:   {position, states} | null,   // exact restore after reload
 *     settings: TS.store.get("ts_settings") // backspace mode, etc.
 *   });
 *   session.onUpdate   = function (snapshot) { ... }; // live UI
 *   session.onComplete = function (summary)  { ... }; // TS.metrics summary
 *   session.attach();    // document keydown + pause hooks + autosave
 *   session.detach();    // removes everything, final autosave
 *   session.bindInput(inputEl); // mobile <input> fallback → same key path
 *   session.pause(); session.resume();
 *
 * Keyboard rules:
 *   - Ignores Ctrl/Alt/Meta combos, e.repeat, and any key whose e.key is
 *     longer than 1 char (Shift, Dead, CapsLock, Enter, arrows, …).
 *   - " " is a real character. Space/Backspace are preventDefault()ed while
 *     attached so the page never scrolls or navigates.
 *   - keydown-only handling (no double firing from keypress).
 *   - Backspace "allow": step back one char, reset its state to upcoming, and
 *     mark the deleted wrong keystroke as corrected (kept in the log).
 *   - Backspace "block": ignored entirely.
 *
 * Timer: starts on the FIRST keystroke (never before). activeMs accumulates
 * only while running. Auto-pauses on document hidden / window blur / pause().
 * Never auto-resumes: after reload or pause, the timer only continues on an
 * explicit resume() or the next keystroke.
 *
 * Autosave: every 5s and on pause()/detach() → ts_progress
 *   {levelIndex, lessonIndex, lessonId, position, states, updatedAt}.
 */
(function () {
  "use strict";

  var TS = (window.TS = window.TS || {});
  TS.engine = TS.engine || {};

  var SAVE_EVERY_MS = 5000;
  var TICK_EVERY_MS = 250;

  function now() {
    return Date.now();
  }

  /* Find {levelIndex, lessonIndex} for a lesson id. levelIndex indexes
   * TS.data.CURRICULUM (0-based), lessonIndex indexes level.lessons. */
  function findIndexes(lessonId) {
    var out = { levelIndex: 0, lessonIndex: 0 };
    try {
      if (TS.data && Array.isArray(TS.data.CURRICULUM)) {
        for (var li = 0; li < TS.data.CURRICULUM.length; li++) {
          var lessons = TS.data.CURRICULUM[li].lessons || [];
          for (var lsi = 0; lsi < lessons.length; lsi++) {
            if (lessons[lsi] && lessons[lsi].id === lessonId) {
              return { levelIndex: li, lessonIndex: lsi };
            }
          }
        }
      }
      if (TS.data && typeof TS.data.allLessons === "function") {
        var flat = TS.data.allLessons();
        for (var fi = 0; fi < flat.length; fi++) {
          if (flat[fi] && flat[fi].id === lessonId) {
            out.lessonIndex = fi;
            break;
          }
        }
      }
    } catch (e) {
      /* keep defaults */
    }
    return out;
  }

  function LessonSession(lesson, opts) {
    opts = opts || {};
    this.lesson = lesson || {};
    this.text = String(this.lesson.text || "");
    this.lessonId = this.lesson.id || null;
    this.settings = opts.settings || {};
    this.backspaceMode = this.settings.backspace === "block" ? "block" : "allow";

    var resume = opts.resume || null;
    if (
      resume &&
      typeof resume.position === "number" &&
      Array.isArray(resume.states) &&
      resume.states.length === this.text.length
    ) {
      // Exact resume: position + per-char states restored, timer NOT running.
      this.position = Math.max(0, Math.min(this.text.length, resume.position | 0));
      this.states = resume.states.slice();
    } else {
      this.position = 0;
      this.states = [];
      for (var i = 0; i < this.text.length; i++) this.states.push(0);
    }

    this.keystrokes = []; // {expected, got, correct, time, position, corrected}
    this.charErrors = {}; // expectedChar -> wrong-keystroke count
    this.mistakes = 0;    // total wrong keystrokes this session

    this.startTime = null; // first keystroke (timer never starts before this)
    this.endTime = null;
    this.activeMs = 0;     // accumulated while running (pauses excluded)

    this.running = false;  // timer currently accumulating
    // paused = user explicitly paused (blocks input). Idle (before the first
    // keystroke) is NOT paused: the first keystroke is accepted and starts
    // the timer via _start(). Never start paused — that would swallow the
    // first keystroke forever since _start() is only reached past this gate.
    this.paused = false;
    this.completed = false;

    this.onUpdate = null;  // fn(snapshot)
    this.onComplete = null;// fn(summary)

    this._attached = false;
    this._runStart = 0;
    this._tickTimer = null;
    this._saveTimer = null;
    this._inputEl = null;

    var idx = findIndexes(this.lessonId);
    this.levelIndex = idx.levelIndex;
    this.lessonIndex = idx.lessonIndex;

    var self = this;
    this._onKey = function (e) { self._handleKeyDown(e); };
    this._onVis = function () { if (document.hidden) self.pause(); };
    this._onBlur = function () { self.pause(); };
    this._onInput = function () { self._handleInputEvent(); };
  }

  /* ---------------- lifecycle ---------------- */

  LessonSession.prototype.attach = function () {
    if (this._attached) return;
    this._attached = true;
    document.addEventListener("keydown", this._onKey);
    document.addEventListener("visibilitychange", this._onVis);
    window.addEventListener("blur", this._onBlur);

    var self = this;
    this._tickTimer = setInterval(function () {
      if (self.running) {
        self._accumulate();
        self._emit();
      }
    }, TICK_EVERY_MS);
    this._saveTimer = setInterval(function () {
      self._saveProgress();
    }, SAVE_EVERY_MS);
    this._emit();
  };

  LessonSession.prototype.detach = function () {
    if (!this._attached) return;
    this._attached = false;
    document.removeEventListener("keydown", this._onKey);
    document.removeEventListener("visibilitychange", this._onVis);
    window.removeEventListener("blur", this._onBlur);
    if (this._tickTimer) { clearInterval(this._tickTimer); this._tickTimer = null; }
    if (this._saveTimer) { clearInterval(this._saveTimer); this._saveTimer = null; }
    if (this._inputEl) {
      this._inputEl.removeEventListener("input", this._onInput);
      this._inputEl = null;
    }
    this._saveProgress(); // final autosave on exit/detach
  };

  /* Mobile / on-screen keyboards: feed a real <input>'s input events into
   * the same key path. Typed chars (last char typed vs expected) and
   * deletions (→ backspace) are handled; the input is cleared after each
   * event so it stays a pure conduit. */
  LessonSession.prototype.bindInput = function (inputEl) {
    if (this._inputEl) this._inputEl.removeEventListener("input", this._onInput);
    this._inputEl = inputEl || null;
    if (this._inputEl) {
      this._inputEl.value = "";
      this._inputEl.addEventListener("input", this._onInput);
    }
  };

  /* ---------------- timer ---------------- */

  LessonSession.prototype._start = function () {
    // Timer starts on the first keystroke — never before.
    if (!this.startTime) this.startTime = now();
    this.running = true;
    this.paused = false;
    this._runStart = now();
  };

  LessonSession.prototype._accumulate = function () {
    if (!this.running) return;
    var t = now();
    this.activeMs += t - this._runStart;
    this._runStart = t;
  };

  LessonSession.prototype.activeSec = function () {
    var extra = this.running ? now() - this._runStart : 0;
    return (this.activeMs + extra) / 1000;
  };

  LessonSession.prototype.pause = function () {
    if (this.completed) return;
    this._accumulate();
    this.running = false;
    this.paused = true;
    this._saveProgress();
    this._emit();
  };

  LessonSession.prototype.resume = function () {
    if (this.completed) return;
    this.paused = false;
    if (this.startTime) {
      // Timer continues from accumulated activeMs — never reset, never auto.
      this.running = true;
      this._runStart = now();
    }
    this._emit();
  };

  /* ---------------- key handling ---------------- */

  LessonSession.prototype._handleKeyDown = function (e) {
    if (!this._attached || this.completed) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // ignore combos
    if (e.repeat) return;                            // ignore held keys

    var key = e.key;
    if (key === "Backspace") {
      e.preventDefault(); // stop browser nav while attached
      this._handleBackspace();
      return;
    }
    if (key === " ") {
      e.preventDefault(); // stop page scroll while attached
      this._handleChar(" ");
      return;
    }
    // Ignore Shift, Dead, CapsLock, Enter, Tab, arrows, F-keys, etc.
    if (typeof key !== "string" || key.length !== 1) return;
    this._handleChar(key);
  };

  LessonSession.prototype._handleChar = function (ch) {
    if (this.completed || this.paused) return;
    if (this.position >= this.text.length) return;
    if (!this.running) this._start();

    var expected = this.text.charAt(this.position);
    var ok = ch === expected;
    this.keystrokes.push({
      expected: expected,
      got: ch,
      correct: ok,
      time: now(),
      position: this.position,
      corrected: false
    });
    this.states[this.position] = ok ? 1 : 2;
    if (!ok) {
      this.mistakes++;
      this.charErrors[expected] = (this.charErrors[expected] || 0) + 1;
    }
    this.position++;

    this._accumulate();
    this._emit();

    if (this.position >= this.text.length) this._finish();
  };

  LessonSession.prototype._handleBackspace = function () {
    if (this.completed || this.paused) return;
    if (this.position <= 0) return;
    if (this.backspaceMode === "block") return; // "block": ignore entirely
    if (!this.running) this._start();

    this.position--;
    if (this.states[this.position] === 2) {
      // The deleted char was wrong: mark its keystroke corrected (log kept).
      for (var i = this.keystrokes.length - 1; i >= 0; i--) {
        var k = this.keystrokes[i];
        if (k.position === this.position && !k.correct && !k.corrected) {
          k.corrected = true;
          break;
        }
      }
    }
    this.states[this.position] = 0;

    this._accumulate();
    this._emit();
  };

  LessonSession.prototype._handleInputEvent = function () {
    var el = this._inputEl;
    if (!el) return;
    var val = el.value || "";
    if (val.length > 0) {
      // Mobile keyboards may deliver one or several chars (incl. space).
      for (var i = 0; i < val.length; i++) {
        var ch = val.charAt(i);
        if (ch === "\n" || ch === "\r") continue;
        this._handleChar(ch);
      }
    } else {
      // Input emptied without new chars (e.g. backspace key on mobile).
      this._handleBackspace();
    }
    el.value = "";
  };

  /* ---------------- completion ---------------- */

  LessonSession.prototype._finish = function () {
    if (this.completed) return;
    this.completed = true;
    this._accumulate();
    this.running = false;
    this.paused = false;
    this.endTime = now();
    this._saveProgress();

    var summary;
    if (TS.metrics && typeof TS.metrics.summarize === "function") {
      summary = TS.metrics.summarize({
        keystrokes: this.keystrokes,
        states: this.states.slice(),
        startTime: this.startTime,
        activeMs: this.activeMs,
        endTime: this.endTime
      });
    } else {
      summary = {
        typed: 0, correct: 0, incorrect: 0, corrected: 0, uncorrected: 0,
        accuracy: 100, grossWpm: 0, netWpm: 0, errorsPerMin: 0,
        durationSec: 0, activeSec: 0
      };
    }
    summary.charErrors = {};
    for (var ch in this.charErrors) {
      if (Object.prototype.hasOwnProperty.call(this.charErrors, ch)) {
        summary.charErrors[ch] = this.charErrors[ch];
      }
    }

    if (typeof this.onComplete === "function") this.onComplete(summary);
  };

  /* ---------------- live snapshot ---------------- */

  LessonSession.prototype._emit = function () {
    if (typeof this.onUpdate !== "function") return;
    var activeSec = this.activeSec();
    var typed = this.keystrokes.length;
    var correct = 0;
    for (var i = 0; i < typed; i++) {
      if (this.keystrokes[i].correct) correct++;
    }
    var gross = TS.metrics && TS.metrics.grossWpm
      ? TS.metrics.grossWpm(typed, activeSec)
      : 0;
    var acc = TS.metrics && TS.metrics.accuracy
      ? TS.metrics.accuracy(correct, typed)
      : 100;
    this.onUpdate({
      position: this.position,
      states: this.states,
      wpm: gross,          // live gross WPM (net is computed at completion)
      accuracy: acc,
      mistakes: this.mistakes,
      elapsedSec: activeSec,
      running: this.running,
      paused: this.paused,
      completed: this.completed
    });
  };

  /* ---------------- autosave ---------------- */

  LessonSession.prototype._saveProgress = function () {
    if (this.completed) return;
    if (!TS.store || typeof TS.store.set !== "function") return;
    // Nothing to save before any interaction (or a bare resume with no
    // movement — the existing record already covers it).
    if (!this.startTime && this.position === 0) return;
    try {
      TS.store.set("ts_progress", {
        levelIndex: this.levelIndex,
        lessonIndex: this.lessonIndex,
        lessonId: this.lessonId,
        position: this.position,
        states: this.states.slice(),
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      /* storage failure must never break typing */
    }
  };

  TS.engine.LessonSession = LessonSession;
})();
