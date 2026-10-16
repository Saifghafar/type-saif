/* Type Saif — js/03-metrics.js — TS.metrics
 *
 * Pure typing-metric formulas. Fixed by the architecture contract (§5); the
 * exact formulas are documented in the UI, so do not change them.
 *
 *   Gross WPM       = (typedChars / 5) / activeMinutes
 *   Net WPM         = max(0, Gross − (uncorrectedErrors / activeMinutes))
 *   Accuracy        = correctKeystrokes / totalKeystrokes * 100
 *   Errors per min  = totalErrors / activeMinutes
 *
 * "Active" time only counts time while the lesson timer was running (pauses
 * on blur/hidden/pause-button are excluded). All functions are pure and
 * guard against zero/negative time.
 */
(function () {
  "use strict";

  var TS = (window.TS = window.TS || {});

  function isPos(n) {
    return typeof n === "number" && isFinite(n) && n > 0;
  }

  var metrics = {
    /* grossWpm(typedChars, activeSec) = (typedChars/5) / (activeSec/60) */
    grossWpm: function (typedChars, activeSec) {
      if (!isPos(activeSec)) return 0;
      var words = (typedChars || 0) / 5;
      return words / (activeSec / 60);
    },

    /* netWpm(gross, uncorrectedErrors, activeSec)
     *   = max(0, gross − uncorrectedErrors / (activeSec/60))               */
    netWpm: function (gross, uncorrectedErrors, activeSec) {
      if (!isPos(activeSec)) return 0;
      return Math.max(0, (gross || 0) - (uncorrectedErrors || 0) / (activeSec / 60));
    },

    /* accuracy(correctKeystrokes, totalKeystrokes) = correct/total*100.
     * Guard: total = 0 → 100 (no keystrokes yet means nothing wrong).      */
    accuracy: function (correctKeystrokes, totalKeystrokes) {
      if (!isPos(totalKeystrokes)) return 100;
      return (correctKeystrokes / totalKeystrokes) * 100;
    },

    /* errorsPerMin(totalErrors, activeSec) = totalErrors / (activeSec/60) */
    errorsPerMin: function (totalErrors, activeSec) {
      if (!isPos(activeSec)) return 0;
      return (totalErrors || 0) / (activeSec / 60);
    },

    /* summarize(sessionState) → summary object.
     *
     * sessionState = {
     *   keystrokes: [{expected, got, correct, time, position, corrected}],
     *   states:     [0|1|2, ...]  (0=upcoming, 1=correct, 2=wrong at end),
     *   startTime:   ms timestamp of first keystroke (or null),
     *   activeMs:    ms accumulated while the timer ran (excludes pauses),
     *   endTime:     ms timestamp of completion (or null)
     * }
     *
     * Field definitions (contract §5):
     *   typed        = keystrokes.length
     *   correct      = keystrokes with correct === true
     *   incorrect    = keystrokes with correct === false
     *   corrected    = wrong keystrokes later fixed via backspace
     *                  (engine marks k.corrected = true when the wrong char
     *                   is deleted before completion)
     *   uncorrected  = states currently === 2 (wrong) at the end
     *   accuracy     = accuracy(correct, typed)
     *   grossWpm     = grossWpm(typed, activeSec)
     *   netWpm       = netWpm(grossWpm, uncorrected, activeSec)
     *   errorsPerMin = errorsPerMin(incorrect, activeSec)
     *   durationSec  = wall-clock (endTime − startTime)/1000
     *   activeSec    = activeMs/1000 (excludes paused time)
     */
    summarize: function (sessionState) {
      var s = sessionState || {};
      var keystrokes = Array.isArray(s.keystrokes) ? s.keystrokes : [];
      var states = Array.isArray(s.states) ? s.states : [];

      var typed = keystrokes.length;
      var correct = 0;
      var incorrect = 0;
      var corrected = 0;
      for (var i = 0; i < typed; i++) {
        var k = keystrokes[i];
        if (k && k.correct) {
          correct++;
        } else {
          incorrect++;
          if (k && k.corrected) corrected++;
        }
      }

      var uncorrected = 0;
      for (var j = 0; j < states.length; j++) {
        if (states[j] === 2) uncorrected++;
      }

      var activeMs = typeof s.activeMs === "number" && s.activeMs > 0 ? s.activeMs : 0;
      var activeSec = activeMs / 1000;

      var durationSec = 0;
      if (s.startTime && s.endTime && s.endTime >= s.startTime) {
        durationSec = (s.endTime - s.startTime) / 1000;
      }

      var gross = metrics.grossWpm(typed, activeSec);
      return {
        typed: typed,
        correct: correct,
        incorrect: incorrect,
        corrected: corrected,
        uncorrected: uncorrected,
        accuracy: metrics.accuracy(correct, typed),
        grossWpm: gross,
        netWpm: metrics.netWpm(gross, uncorrected, activeSec),
        errorsPerMin: metrics.errorsPerMin(incorrect, activeSec),
        durationSec: durationSec,
        activeSec: activeSec
      };
    }
  };

  TS.metrics = metrics;
})();
