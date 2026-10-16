/* Type Saif — views/v-reports.js — TS.views.reports + TS.views.report
 * Reports list: table of all attempts (date, lesson, WPM, accuracy, duration,
 * mistakes, stars; actions View → #/report/<attemptId>, Print).
 * Detail route #/report/<attemptId>: full report on screen + Print Report and
 * Save as PDF buttons (both use the print flow; the PDF button carries helper
 * text explaining the browser's "Save as PDF" destination — no fake PDF).
 */
(function () {
  'use strict';

  var root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  var TS = root.TypeSaif || (root.TypeSaif = {});
  root.TS = TS;
  TS.views = TS.views || {};

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
    if (m >= 60) return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
    return m > 0 ? m + 'm ' + s + 's' : s + 's';
  }

  function starsRow(stars) {
    stars = Math.max(0, Math.min(3, Math.round(num(stars, 0))));
    return '★'.repeat(stars) + '☆'.repeat(3 - stars);
  }

  function lessonTitle(lessonId) {
    if (lessonId === 'practice') return 'Free Practice';
    var l = getLessonSafe(lessonId);
    return l ? (l.title || lessonId) : String(lessonId || '—');
  }

  function allAttempts() {
    return storeGet('ts_attempts', []) || [];
  }

  function onPrintClick(e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-print]') : null;
    if (!btn || !TS.reports) return;
    TS.reports.print(btn.getAttribute('data-print'));
  }

  /* ---------- list view ---------- */

  function renderList(el) {
    var attempts = allAttempts().slice().reverse(); // newest first

    var body;
    if (!attempts.length) {
      body = '<p class="empty-state">No lesson reports yet. Complete a lesson and your report will appear here.</p>';
    } else {
      var rows = attempts.map(function (a) {
        a = a || {};
        return '<tr>' +
          '<td>' + esc(fmtDateTime(a.date)) + '</td>' +
          '<td>' + esc(lessonTitle(a.lessonId)) + '</td>' +
          '<td>' + esc(String(Math.round(num(a.netWpm, 0) * 10) / 10)) + '</td>' +
          '<td>' + esc(num(a.accuracy, 0).toFixed(1)) + '%</td>' +
          '<td>' + esc(fmtDur(a.durationSec || a.activeSec)) + '</td>' +
          '<td>' + esc(String(num(a.incorrect, 0))) + '</td>' +
          '<td><span class="stars">' + starsRow(a.stars) + '</span></td>' +
          '<td class="actions">' +
          '<a class="btn btn-ghost btn-sm" href="#/report/' + esc(a.id) + '">View</a> ' +
          '<button class="btn btn-ghost btn-sm" data-print="' + esc(a.id) + '">Print</button>' +
          '</td></tr>';
      }).join('');
      body = '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Date</th><th>Lesson</th><th>WPM</th><th>Accuracy</th><th>Duration</th>' +
        '<th>Mistakes</th><th>Stars</th><th>Actions</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    el.innerHTML =
      '<div class="view view-reports">' +
      '<header class="view-head"><h1>Lesson Reports</h1>' +
      '<p class="muted">Every attempt, with a printable report for each.</p></header>' +
      '<section class="card">' + body + '</section></div>';

    el.removeEventListener('click', onPrintClick);
    el.addEventListener('click', onPrintClick);
  }

  /* ---------- detail view ---------- */

  function renderDetail(el, params) {
    params = params || {};
    var attemptId = params.attemptId || params.id || null;
    var attempt = null;
    if (attemptId && TS.reports && typeof TS.reports.findAttempt === 'function') {
      attempt = TS.reports.findAttempt(attemptId);
    } else {
      var list = allAttempts();
      for (var i = 0; i < list.length; i++) {
        if (String(list[i] && list[i].id) === String(attemptId)) { attempt = list[i]; break; }
      }
    }

    if (!attempt) {
      el.innerHTML =
        '<div class="view view-report"><header class="view-head"><h1>Report</h1></header>' +
        '<p class="empty-state">Report not found. It may have been deleted.</p>' +
        '<a class="btn btn-ghost" href="#/reports">Back to Reports</a></div>';
      return;
    }

    var reportHtml = (TS.reports && typeof TS.reports.printHTML === 'function')
      ? TS.reports.printHTML(attempt)
      : '<p class="empty-state">Report renderer is not available.</p>';

    el.innerHTML =
      '<div class="view view-report">' +
      '<header class="view-head"><h1>Lesson Report</h1>' +
      '<p class="muted">' + esc(lessonTitle(attempt.lessonId)) + ' · ' + esc(fmtDateTime(attempt.date)) + '</p></header>' +
      '<div class="report-actions card">' +
      '<button class="btn btn-primary" data-print="' + esc(attempt.id) + '">Print Report</button> ' +
      '<button class="btn btn-ghost" data-print-pdf="' + esc(attempt.id) + '">Save as PDF</button>' +
      '<p class="muted hint">Tip: in the print dialog, choose “Save as PDF” as the destination to save this report as a PDF file.</p>' +
      '</div>' +
      '<section class="card report-preview">' + reportHtml + '</section>' +
      '<a class="btn btn-ghost" href="#/reports">Back to Reports</a>' +
      '</div>';

    el.removeEventListener('click', onPrintClick);
    el.addEventListener('click', onPrintClick);
    el.querySelectorAll('[data-print-pdf]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (TS.reports) TS.reports.print(btn.getAttribute('data-print-pdf'));
      });
    });
  }

  /* The router maps #/report/<attemptId> to this module with {attemptId}. */
  function render(el, params) {
    if (params && params.attemptId) renderDetail(el, params);
    else renderList(el);
  }

  function destroy() {
    try {
      var appEl = document.getElementById('app');
      if (appEl) appEl.removeEventListener('click', onPrintClick);
    } catch (e) { /* ignore */ }
  }

  TS.views.reports = { render: render, destroy: destroy };
  TS.views.report = { render: renderDetail };
})();
