/* Type Saif — js/00-utils.js
   TS.util — small shared helpers. No dependencies. */
(function () {
  'use strict';

  window.TypeSaif = window.TypeSaif || {};
  window.TS = window.TypeSaif;
  var TS = window.TypeSaif;

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  TS.util = {
    /** Escape a value for safe insertion into HTML. */
    esc: function (value) {
      return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    /** Format seconds as m:ss (or h:mm:ss when >= 1 hour). */
    fmtTime: function (totalSec) {
      var s = Math.max(0, Math.floor(Number(totalSec) || 0));
      var h = Math.floor(s / 3600);
      var m = Math.floor((s % 3600) / 60);
      var sec = s % 60;
      if (h > 0) return h + ':' + pad2(m) + ':' + pad2(sec);
      return m + ':' + pad2(sec);
    },

    /** Local calendar date as YYYY-MM-DD (used for streaks / daily). */
    todayStr: function (d) {
      var date = d instanceof Date ? d : new Date();
      return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
    },

    /** Short unique id for attempts, games, etc. */
    uid: function () {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    },

    /** Clamp a number into [min, max]; non-numbers become min. */
    clamp: function (value, min, max) {
      var v = Number(value);
      if (!isFinite(v)) return min;
      if (v < min) return min;
      if (v > max) return max;
      return v;
    },

    /** Trailing-edge debounce. Returned fn has a .cancel() method. */
    debounce: function (fn, wait) {
      var t = null;
      function debounced() {
        var ctx = this;
        var args = arguments;
        if (t) clearTimeout(t);
        t = setTimeout(function () {
          t = null;
          fn.apply(ctx, args);
        }, wait || 200);
      }
      debounced.cancel = function () {
        if (t) { clearTimeout(t); t = null; }
      };
      return debounced;
    }
  };
})();
