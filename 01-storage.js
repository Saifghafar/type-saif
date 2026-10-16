/* Type Saif — js/01-storage.js
   TS.store — localStorage persistence, namespaced `ts_`.
   Keys/shapes follow ARCHITECTURE.md §3 exactly.
   - set() coalesces writes with a 300ms per-key throttle (hot paths safe).
   - get() never throws: corrupt JSON falls back to defaults.
   - flush() forces pending writes (also called on pagehide/beforeunload). */
(function () {
  'use strict';

  window.TypeSaif = window.TypeSaif || {};
  var TS = window.TypeSaif;

  var KNOWN_KEYS = [
    'ts_settings', 'ts_progress', 'ts_attempts', 'ts_bests', 'ts_xp',
    'ts_achievements', 'ts_streak', 'ts_daily', 'ts_games', 'ts_practiceSec'
  ];

  function defaultFor(key) {
    switch (key) {
      case 'ts_settings':
        return {
          sound: true, keySound: true, keyboard: true, fingerGuide: true,
          highlight: 'caret', difficulty: 'easy', backspace: 'allow',
          reducedMotion: false, layout: 'qwerty'
        };
      case 'ts_progress':
        return { levelIndex: 0, lessonIndex: 0, lessonId: 'L1-1', position: 0, states: [], updatedAt: null };
      case 'ts_attempts': return [];
      case 'ts_bests': return {};
      case 'ts_xp': return { total: 0 };
      case 'ts_achievements': return {};
      case 'ts_streak': return { count: 0, lastDate: null };
      case 'ts_daily': return {};
      case 'ts_games': return {};
      case 'ts_practiceSec': return 0;
      default: return undefined;
    }
  }

  function isObj(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function validateValue(key, v) {
    var i;
    switch (key) {
      case 'ts_settings': {
        if (!isObj(v)) return 'must be an object';
        var bools = ['sound', 'keySound', 'keyboard', 'fingerGuide', 'reducedMotion'];
        for (i = 0; i < bools.length; i++) {
          if (bools[i] in v && typeof v[bools[i]] !== 'boolean') return bools[i] + ' must be a boolean';
        }
        if ('highlight' in v && v.highlight !== 'caret' && v.highlight !== 'block') return 'highlight must be "caret" or "block"';
        if ('difficulty' in v && ['easy', 'normal', 'hard'].indexOf(v.difficulty) < 0) return 'difficulty must be easy|normal|hard';
        if ('backspace' in v && v.backspace !== 'allow' && v.backspace !== 'block') return 'backspace must be "allow" or "block"';
        if ('layout' in v && typeof v.layout !== 'string') return 'layout must be a string';
        return null;
      }
      case 'ts_progress':
        if (!isObj(v)) return 'must be an object';
        if ('lessonId' in v && typeof v.lessonId !== 'string') return 'lessonId must be a string';
        if ('position' in v && typeof v.position !== 'number') return 'position must be a number';
        if ('states' in v && !Array.isArray(v.states)) return 'states must be an array';
        return null;
      case 'ts_attempts':
        if (!Array.isArray(v)) return 'must be an array';
        return null;
      case 'ts_bests':
      case 'ts_achievements':
      case 'ts_daily':
      case 'ts_games':
        if (!isObj(v)) return 'must be an object';
        return null;
      case 'ts_xp':
        if (!isObj(v) || typeof v.total !== 'number') return 'must be {total:number}';
        return null;
      case 'ts_streak':
        if (!isObj(v) || typeof v.count !== 'number') return 'must be {count:number,...}';
        return null;
      case 'ts_practiceSec':
        if (typeof v !== 'number') return 'must be a number';
        return null;
      default:
        return 'unknown key';
    }
  }

  /* ---- Throttled write machinery ---- */
  var pending = {}; // key -> serialized value awaiting write
  var timers = {};  // key -> timeout id

  function writeNow(key) {
    if (timers[key]) {
      try { clearTimeout(timers[key]); } catch (e) { /* ignore */ }
      delete timers[key];
    }
    if (!Object.prototype.hasOwnProperty.call(pending, key)) return;
    var raw = pending[key];
    delete pending[key];
    try {
      localStorage.setItem(key, raw);
    } catch (e) {
      /* Storage unavailable or quota exceeded: drop silently, app keeps running. */
    }
  }

  var store = {
    /** True when localStorage is usable. Set by init(). */
    available: true,

    /** Safe to call any time; never throws. Returns storage availability. */
    init: function () {
      var ok = true;
      try {
        localStorage.setItem('ts_probe', '1');
        localStorage.removeItem('ts_probe');
      } catch (e) {
        ok = false;
      }
      this.available = ok;
      try {
        if (typeof window !== 'undefined' && window.addEventListener) {
          window.addEventListener('pagehide', function () { store.flush(); });
          window.addEventListener('beforeunload', function () { store.flush(); });
        }
      } catch (e) { /* ignore */ }
      return ok;
    },

    /** Read a key. Corrupt JSON -> fallback (or the key's default shape). Never throws. */
    get: function (key, fallback) {
      var hasFallback = arguments.length > 1;
      var fb = hasFallback ? fallback : defaultFor(key);
      try {
        var raw = localStorage.getItem(key);
        if (raw === null || raw === undefined) return fb;
        var val = JSON.parse(raw);
        if (val === null || val === undefined) return fb;
        // Merge stored settings over defaults so newly added options keep working.
        if (key === 'ts_settings' && isObj(val)) {
          var merged = defaultFor('ts_settings');
          for (var k in val) {
            if (Object.prototype.hasOwnProperty.call(val, k) &&
                Object.prototype.hasOwnProperty.call(merged, k)) {
              merged[k] = val[k];
            }
          }
          return merged;
        }
        return val;
      } catch (e) {
        return fb;
      }
    },

    /** Write a key. Coalesced: at most one localStorage write per 300ms per key. */
    set: function (key, val) {
      var raw;
      try {
        raw = JSON.stringify(val === undefined ? null : val);
      } catch (e) {
        return false;
      }
      pending[key] = raw;
      if (!timers[key]) {
        timers[key] = setTimeout(function () { writeNow(key); }, 300);
      }
      return true;
    },

    /** Force pending writes now (all keys, or one key). */
    flush: function (key) {
      try {
        if (key) {
          writeNow(key);
          return;
        }
        var keys = Object.keys(timers);
        for (var i = 0; i < keys.length; i++) writeNow(keys[i]);
      } catch (e) { /* ignore */ }
    },

    /** Full backup object for download. */
    exportJSON: function () {
      var data = {};
      for (var i = 0; i < KNOWN_KEYS.length; i++) {
        data[KNOWN_KEYS[i]] = this.get(KNOWN_KEYS[i]);
      }
      return {
        app: 'type-saif',
        version: 1,
        exportedAt: new Date().toISOString(),
        data: data
      };
    },

    /** Restore from a backup object (accepts {data:{...}} or flat {ts_...:...}).
        Validates each key; invalid keys are skipped and reported. */
    importJSON: function (obj) {
      var errors = [];
      var imported = [];
      if (!isObj(obj)) {
        return { ok: false, errors: ['Backup must be an object.'], imported: imported };
      }
      var data = isObj(obj.data) ? obj.data : obj;
      for (var i = 0; i < KNOWN_KEYS.length; i++) {
        var k = KNOWN_KEYS[i];
        if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
        var v = data[k];
        var err = validateValue(k, v);
        if (err) {
          errors.push(k + ': ' + err);
          continue;
        }
        if (k === 'ts_attempts' && v.length > 500) v = v.slice(v.length - 500);
        store.set(k, v);
        imported.push(k);
      }
      store.flush();
      return { ok: errors.length === 0, errors: errors, imported: imported };
    },

    /** Remove every ts_* key. Callers must confirm with the user first. */
    resetAll: function () {
      try {
        for (var i = 0; i < KNOWN_KEYS.length; i++) {
          var k = KNOWN_KEYS[i];
          if (timers[k]) {
            try { clearTimeout(timers[k]); } catch (e) { /* ignore */ }
            delete timers[k];
          }
          delete pending[k];
        }
        for (var j = 0; j < KNOWN_KEYS.length; j++) {
          try { localStorage.removeItem(KNOWN_KEYS[j]); } catch (e) { /* ignore */ }
        }
      } catch (e) { /* ignore */ }
      return true;
    }
  };

  TS.store = store;
})();
