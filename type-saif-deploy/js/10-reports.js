/* Type Saif — 10-reports.js — TS.reports
 * Printable lesson reports. TS.reports.print(attemptId) builds the report DOM
 * into #print-root, adds body.printing, calls window.print(), and cleans up
 * on afterprint. TS.reports.printHTML(attempt) returns the report HTML string
 * (also used for on-screen previews in v-reports.js).
 * No fake PDF: "Save as PDF" flows call print() with helper text.
 */
(function () {
  'use strict';

  var root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  var TS = root.TypeSaif || (root.TypeSaif = {});
  root.TS = TS;

  /* ---------- guarded helpers ---------- */

  function num(v, fb) {
    var n = Number(v);
    return (isFinite(n) ? n : (fb || 0));
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function storeGet(key, fb) {
    try {
      if (TS.store && typeof TS.store.get === 'function') return TS.store.get(key, fb);
    } catch (e) { /* fall through */ }
    try {
      if (typeof localStorage !== 'undefined') {
        var raw = localStorage.getItem(key);
        if (raw === null || raw === undefined) return fb;
        return JSON.parse(raw);
      }
    } catch (e2) { /* fall through */ }
    return fb;
  }

  function toast(msg, kind) {
    try {
      if (TS.ui && typeof TS.ui.toast === 'function') { TS.ui.toast(msg, kind); return; }
    } catch (e) { /* fall through */ }
  }

  function getLessonSafe(id) {
    try {
      if (TS.data && typeof TS.data.getLesson === 'function') return TS.data.getLesson(id);
    } catch (e) { /* fall through */ }
    return null;
  }

  function fmtDateTime(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return '—'; }
  }

  function fmtDur(sec) {
    sec = Math.max(0, Math.round(num(sec, 0)));
    var m = Math.floor(sec / 60), s = sec % 60;
    if (m >= 60) { var h = Math.floor(m / 60); return h + 'h ' + (m % 60) + 'm'; }
    if (m > 0) return m + 'm ' + s + 's';
    return s + 's';
  }

  function fmtNum(v, digits) {
    var n = num(v, 0);
    return (digits ? n.toFixed(digits) : String(Math.round(n * 10) / 10));
  }

  function starsRow(stars) {
    stars = Math.max(0, Math.min(3, Math.round(num(stars, 0))));
    return '★'.repeat(stars) + '☆'.repeat(3 - stars);
  }

  function charLabel(ch) {
    if (ch === ' ') return 'space';
    if (ch === '\n' || ch === '\r') return 'enter';
    if (ch === '\t') return 'tab';
    return ch;
  }

  /* ---------- recommendations (derived from real data) ---------- */

  function buildRecommendations(a) {
    var recs = [];
    var charErrors = (a && a.charErrors) || {};
    var entries = Object.keys(charErrors).map(function (ch) {
      return { ch: ch, count: num(charErrors[ch], 0) };
    }).filter(function (e) { return e.count > 0; });
    entries.sort(function (x, y) { return y.count - x.count; });

    entries.slice(0, 5).forEach(function (e) {
      recs.push('Practice the letter \u2018' + charLabel(e.ch) + '\u2019 — missed ' +
        e.count + (e.count === 1 ? ' time.' : ' times.'));
    });

    var accuracy = num(a.accuracy, 0);
    var netWpm = num(a.netWpm, 0);
    var grossWpm = num(a.grossWpm, 0);
    var incorrect = num(a.incorrect, 0);
    var uncorrected = num(a.uncorrected, 0);
    var stars = num(a.stars, 0);

    if (accuracy > 0 && accuracy < 90) {
      recs.push('Slow down slightly and focus on hitting the right keys — speed follows accuracy.');
    }
    if (incorrect > 0 && uncorrected / incorrect > 0.5) {
      recs.push('Correct mistakes as you type instead of leaving them — uncorrected errors cost the most WPM.');
    }
    if (grossWpm - netWpm >= 5) {
      recs.push('Errors are costing you about ' + Math.round(grossWpm - netWpm) +
        ' WPM. A slower, steadier pace will raise your net score.');
    }
    if (stars < 3) {
      recs.push('Replay this lesson to earn 3 stars — aim for 97% accuracy or higher.');
    }
    if (netWpm > 0 && netWpm < 20) {
      recs.push('Keep drilling the home-row keys until they feel automatic, then add speed.');
    }
    if (!recs.length) {
      recs.push('Solid run — try the next lesson to keep building speed and accuracy.');
    }
    return recs;
  }

  /* ---------- report HTML ---------- */

  var REPORT_CSS = '' +
    '<style>' +
    '.ts-report{font-family:Inter,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0F172A;max-width:720px;margin:0 auto;}' +
    '.ts-report .rp-head{border-bottom:3px solid #2563EB;padding-bottom:12px;margin-bottom:16px;}' +
    '.ts-report .rp-brand{font-size:22px;font-weight:800;color:#2563EB;margin:0;}' +
    '.ts-report .rp-sub{color:#64748B;font-size:13px;margin:4px 0 0;}' +
    '.ts-report h2{font-size:18px;margin:0 0 4px;}' +
    '.ts-report .rp-meta{color:#64748B;font-size:13px;margin:0 0 16px;}' +
    '.ts-report table{width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;}' +
    '.ts-report th,.ts-report td{text-align:left;padding:8px 10px;border:1px solid #E2E8F0;}' +
    '.ts-report th{background:#EFF6FF;font-weight:600;}' +
    '.ts-report .rp-stars{color:#D97706;font-size:20px;letter-spacing:2px;}' +
    '.ts-report h3{font-size:15px;margin:20px 0 8px;color:#0F172A;}' +
    '.ts-report ul{margin:8px 0;padding-left:20px;font-size:14px;}' +
    '.ts-report li{margin:4px 0;}' +
    '.ts-report .rp-pos{color:#16A34A;font-weight:600;}' +
    '.ts-report .rp-neg{color:#DC2626;font-weight:600;}' +
    '.ts-report .rp-foot{margin-top:24px;padding-top:12px;border-top:1px solid #E2E8F0;color:#64748B;font-size:12px;}' +
    '</style>';

  function printHTML(attempt) {
    if (!attempt) {
      return REPORT_CSS + '<div class="ts-report"><p>No attempt data available.</p></div>';
    }
    var lesson = getLessonSafe(attempt.lessonId);
    var lessonName = lesson ? (lesson.title || attempt.lessonId) : String(attempt.lessonId || '—');
    var lessonLevel = lesson && lesson.level ? 'Level ' + lesson.level : '';

    var accuracy = num(attempt.accuracy, 0);
    var netWpm = num(attempt.netWpm, 0);
    var grossWpm = num(attempt.grossWpm, 0);
    var stars = num(attempt.stars, 0);

    // Previous-attempt comparison + improvement summary
    var cmpHtml = '';
    var prev = attempt.prevBest || null;
    if (prev) {
      var dWpm = netWpm - num(prev.wpm, 0);
      var dAcc = accuracy - num(prev.accuracy, 0);
      var clsW = dWpm > 0 ? 'rp-pos' : (dWpm < 0 ? 'rp-neg' : '');
      var clsA = dAcc > 0 ? 'rp-pos' : (dAcc < 0 ? 'rp-neg' : '');
      var fW = (dWpm > 0 ? '+' : '') + fmtNum(dWpm, 1);
      var fA = (dAcc > 0 ? '+' : '') + fmtNum(dAcc, 1);
      cmpHtml =
        '<h3>Comparison with previous best</h3>' +
        '<table><tr><th></th><th>Previous best</th><th>This attempt</th><th>Change</th></tr>' +
        '<tr><td>Net WPM</td><td>' + fmtNum(prev.wpm, 1) + '</td><td>' + fmtNum(netWpm, 1) +
        '</td><td class="' + clsW + '">' + fW + '</td></tr>' +
        '<tr><td>Accuracy</td><td>' + fmtNum(prev.accuracy, 1) + '%</td><td>' + fmtNum(accuracy, 1) +
        '%</td><td class="' + clsA + '">' + fA + '%</td></tr></table>' +
        '<p>' + (attempt.improved
          ? '<span class="rp-pos">New personal best!</span> You beat your previous score on this lesson.'
          : 'Not a personal best this time — keep practicing to beat ' +
            fmtNum(prev.wpm, 1) + ' WPM at ' + fmtNum(prev.accuracy, 1) + '% accuracy.') + '</p>';
    } else {
      cmpHtml = '<h3>Comparison with previous best</h3>' +
        '<p>This was your first recorded attempt on this lesson — every future run will be compared against it.</p>';
    }

    var recs = buildRecommendations(attempt);
    var recHtml = '<h3>Recommendations</h3><ul>' +
      recs.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>';

    return REPORT_CSS +
      '<div class="ts-report">' +
      '<div class="rp-head">' +
      '<p class="rp-brand">Type Saif</p>' +
      '<p class="rp-sub">Lesson Report</p>' +
      '</div>' +
      '<h2>' + esc(lessonName) + '</h2>' +
      '<p class="rp-meta">' + esc(lessonLevel) + (lessonLevel ? ' · ' : '') + esc(fmtDateTime(attempt.date)) + '</p>' +
      '<table>' +
      '<tr><th>Metric</th><th>Value</th></tr>' +
      '<tr><td>Duration</td><td>' + esc(fmtDur(attempt.durationSec || attempt.activeSec)) + '</td></tr>' +
      '<tr><td>Gross WPM</td><td>' + fmtNum(grossWpm, 1) + '</td></tr>' +
      '<tr><td>Net WPM</td><td><strong>' + fmtNum(netWpm, 1) + '</strong></td></tr>' +
      '<tr><td>Accuracy</td><td>' + fmtNum(accuracy, 1) + '%</td></tr>' +
      '<tr><td>Correct characters</td><td>' + num(attempt.correct, 0) + '</td></tr>' +
      '<tr><td>Incorrect characters</td><td>' + num(attempt.incorrect, 0) + '</td></tr>' +
      '<tr><td>Corrected errors</td><td>' + num(attempt.corrected, 0) + '</td></tr>' +
      '<tr><td>Uncorrected errors</td><td>' + num(attempt.uncorrected, 0) + '</td></tr>' +
      '<tr><td>XP earned</td><td>+' + num(attempt.xp, 0) + ' XP</td></tr>' +
      '<tr><td>Stars</td><td><span class="rp-stars">' + starsRow(stars) + '</span></td></tr>' +
      '</table>' +
      cmpHtml + recHtml +
      '<p class="rp-foot">Generated by Type Saif · Keep practicing a little every day.</p>' +
      '</div>';
  }

  function findAttempt(attemptId) {
    var attempts = storeGet('ts_attempts', []) || [];
    for (var i = 0; i < attempts.length; i++) {
      if (String(attempts[i] && attempts[i].id) === String(attemptId)) return attempts[i];
    }
    return null;
  }

  // Builds the report into #print-root, prints, then cleans up on afterprint.
  function print(attemptId) {
    if (typeof document === 'undefined' || typeof window === 'undefined') return false;
    var attempt = findAttempt(attemptId);
    if (!attempt) {
      toast('Report not found.', 'error');
      return false;
    }
    var rootEl = document.getElementById('print-root');
    if (!rootEl) {
      rootEl = document.createElement('div');
      rootEl.id = 'print-root';
      document.body.appendChild(rootEl);
    }
    rootEl.innerHTML = printHTML(attempt);
    document.body.classList.add('printing');

    var cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      document.body.classList.remove('printing');
      rootEl.innerHTML = '';
      if (window.removeEventListener) window.removeEventListener('afterprint', cleanup);
    }
    if (window.addEventListener) window.addEventListener('afterprint', cleanup);
    // Safety net: some environments never fire afterprint.
    setTimeout(function () {
      if (document.body.classList.contains('printing')) cleanup();
    }, 8000);

    try { window.print(); } catch (e) { cleanup(); return false; }
    return true;
  }

  TS.reports = {
    print: print,
    printHTML: printHTML,
    findAttempt: findAttempt
  };
})();
