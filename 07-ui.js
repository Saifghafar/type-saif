/* Type Saif — js/07-ui.js
   TS.ui — reusable interface components:
   statTile, emptyState, modal, confirmDialog, toast, badge, stars, progressBar.
   All text params are escaped; actionHtml in emptyState is trusted view-built HTML. */
(function () {
  'use strict';

  window.TypeSaif = window.TypeSaif || {};
  var TS = window.TypeSaif;

  function esc(s) {
    return TS.util.esc(s);
  }

  /* ---------- statTile(label, value, sub) -> HTML string ---------- */
  function statTile(label, value, sub) {
    return '<div class="stat-tile">' +
      '<div class="stat-value">' + esc(value) + '</div>' +
      '<div class="stat-label">' + esc(label) + '</div>' +
      (sub ? '<div class="stat-sub">' + esc(sub) + '</div>' : '') +
      '</div>';
  }

  /* ---------- emptyState(title, desc, actionHtml) -> HTML string ---------- */
  function emptyState(title, desc, actionHtml) {
    return '<div class="empty-state">' +
      '<div class="empty-icon" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>' +
      '</div>' +
      '<h3>' + esc(title) + '</h3>' +
      (desc ? '<p>' + esc(desc) + '</p>' : '') +
      (actionHtml ? '<div class="empty-actions">' + actionHtml + '</div>' : '') +
      '</div>';
  }

  /* ---------- modal({title, body, actions, onClose}) -> {el, close} ---------- */
  var lastFocused = null;
  var modalSeq = 0;

  function restoreFocus() {
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try { lastFocused.focus(); } catch (e) { /* ignore */ }
    }
    lastFocused = null;
  }

  function modal(opts) {
    opts = opts || {};
    lastFocused = document.activeElement;
    modalSeq += 1;

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    var labelId = 'ts-modal-title-' + modalSeq;
    overlay.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="' + labelId + '">' +
        '<div class="modal-head">' +
          '<h2 id="' + labelId + '">' + esc(opts.title || '') + '</h2>' +
          '<button type="button" class="modal-x" aria-label="Close dialog">&times;</button>' +
        '</div>' +
        '<div class="modal-body"></div>' +
        '<div class="modal-actions"></div>' +
      '</div>';

    var bodyEl = overlay.querySelector('.modal-body');
    if (typeof opts.body === 'string') {
      bodyEl.innerHTML = opts.body; // trusted view-built HTML
    } else if (opts.body && opts.body.nodeType) {
      bodyEl.appendChild(opts.body);
    }

    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      restoreFocus();
      try { if (typeof opts.onClose === 'function') opts.onClose(); } catch (e) { /* ignore */ }
    }

    var actionsEl = overlay.querySelector('.modal-actions');
    var actions = Array.isArray(opts.actions) && opts.actions.length ? opts.actions : [{ label: 'Close' }];
    actions.forEach(function (a, i) {
      var b = document.createElement('button');
      b.type = 'button';
      var kind = a.kind === 'primary' ? 'btn-primary' : a.kind === 'danger' ? 'btn-danger' : 'btn-ghost';
      b.className = 'btn ' + kind;
      b.textContent = a.label || 'OK';
      b.addEventListener('click', function () {
        try {
          if (typeof a.onClick === 'function') a.onClick(close);
          else close();
        } catch (e) {
          close();
        }
      });
      actionsEl.appendChild(b);
      if (i === 0) {
        setTimeout(function () { try { b.focus(); } catch (e) { /* ignore */ } }, 0);
      }
    });

    overlay.querySelector('.modal-x').addEventListener('click', close);
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) close();
    });
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    });

    document.body.appendChild(overlay);
    return { el: overlay, close: close };
  }

  /* ---------- confirmDialog(msg) -> Promise<boolean> ---------- */
  function confirmDialog(msg) {
    return new Promise(function (resolve) {
      var settled = false;
      function done(v) {
        if (settled) return;
        settled = true;
        resolve(v);
      }
      modal({
        title: 'Please confirm',
        body: '<p>' + esc(msg) + '</p>',
        actions: [
          {
            label: 'Cancel', kind: 'ghost',
            onClick: function (close) { close(); done(false); }
          },
          {
            label: 'Confirm', kind: 'primary',
            onClick: function (close) { close(); done(true); }
          }
        ],
        onClose: function () { done(false); }
      });
    });
  }

  /* ---------- toast(msg, type) ---------- */
  function ensureToastWrap() {
    var w = document.getElementById('toast-wrap');
    if (!w) {
      w = document.createElement('div');
      w.id = 'toast-wrap';
      w.setAttribute('aria-live', 'polite');
      document.body.appendChild(w);
    }
    return w;
  }

  function toast(msg, type) {
    var t = (type === 'success' || type === 'error' || type === 'info') ? type : 'info';
    var wrap = ensureToastWrap();
    var el = document.createElement('div');
    el.className = 'toast toast-' + t;
    el.setAttribute('role', 'status');
    var icon = t === 'success' ? '\u2713' : t === 'error' ? '!' : 'i';
    el.innerHTML = '<span class="toast-icon" aria-hidden="true">' + icon + '</span>' +
      '<span class="toast-msg"></span>';
    el.querySelector('.toast-msg').textContent = String(msg === null || msg === undefined ? '' : msg);
    wrap.appendChild(el);
    setTimeout(function () {
      el.classList.add('toast-out');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 250);
    }, 3200);
    return el;
  }

  /* ---------- badge(text, kind) -> HTML string ---------- */
  function badge(text, kind) {
    var k = ['blue', 'green', 'gold', 'red', 'purple'].indexOf(kind) >= 0 ? kind : 'gray';
    return '<span class="badge badge-' + k + '">' + esc(text) + '</span>';
  }

  /* ---------- stars(n) -> HTML string (n of 3) ---------- */
  function stars(n) {
    var filled = Math.max(0, Math.min(3, Math.round(Number(n) || 0)));
    var s = '';
    for (var i = 0; i < 3; i++) s += i < filled ? '\u2605' : '\u2606';
    return '<span class="stars" role="img" aria-label="' + filled + ' of 3 stars">' + s + '</span>';
  }

  /* ---------- progressBar(pct) -> HTML string ---------- */
  function progressBar(pct) {
    var p = Math.max(0, Math.min(100, Number(pct) || 0));
    var r = Math.round(p);
    return '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + r + '">' +
      '<div class="bar" style="width:' + p + '%"></div>' +
      '</div>';
  }

  TS.ui = {
    statTile: statTile,
    emptyState: emptyState,
    modal: modal,
    confirmDialog: confirmDialog,
    toast: toast,
    badge: badge,
    stars: stars,
    progressBar: progressBar
  };
})();
